import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { describe, expect, test } from 'vitest';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];

// The provider charges A's card from 3 s until it answers at 5.5 s, in both views.
const DURING_THE_CHARGE = between(3, 5.4);

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./tx-failure-after-accept.${name}.svg`, import.meta.url), 'utf8'),
  );
  return {
    svg,
    all: (selector) => [...svg.querySelectorAll(selector)],
    one: (selector) => {
      const found = svg.querySelector(selector);
      if (!found) throw new Error(`${name}: missing ${selector}`);
      return found;
    },
  };
}

const before = load('before');
const after = load('after');

// Hidden until the moment, then shown until the loop restarts.
const shownFrom = (el: Element, seconds: number): void => {
  if (seconds > 0) expect(hiddenThroughout(el, between(0, seconds - 0.1))).toBe(true);
  expect(shownThroughout(el, between(seconds, LOOP))).toBe(true);
};

// Shown from one moment to the next, and hidden for the rest of the loop.
const shownOnly = (el: Element, from: number, to: number): void => {
  expect(hiddenThroughout(el, between(0, from - 0.1))).toBe(true);
  expect(shownThroughout(el, between(from, to - 0.1))).toBe(true);
  expect(hiddenThroughout(el, between(to, LOOP))).toBe(true);
};

// A transaction belongs to checkout request A or to the reconciliation job.
const A = '[data-request="A"]';
const RECONCILIATION = '[data-job="reconcile"]';

const transaction = (view: View, owner: string, tx: string, state: string): Element =>
  view.one(`[data-role="transaction"]${owner}[data-tx="${tx}"] [data-state="${state}"]`);

const transactionsOf = (view: View, owner: string): (string | null)[] =>
  view.all(`[data-role="transaction"]${owner}`).map((tx) => tx.getAttribute('data-tx'));

const statesOf = (el: Element): (string | null)[] =>
  [...el.querySelectorAll('[data-state]')]
    .map((state) => state.getAttribute('data-state'))
    .filter((state) => state !== 'dormant');

const codeText = (view: View): string =>
  view
    .all('[data-role="code"] text')
    .map((line) => line.textContent.trim())
    .join('\n');

describe.each([
  ['before', before],
  ['after', after],
] as const)('the %s view', (_name, view) => {
  test('one story lasts 20 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('20s');
  });

  test('the seats start free', () => {
    shownFrom(view.one('[data-role="seat-status"][data-state="free"]'), 0);
  });

  test('A holds the seats at 1 s, calls the provider at 3 s, and confirms at 5.5 s', () => {
    shownFrom(view.one(`[data-role="call"]${A}[data-call="hold"]`), 1);
    shownFrom(view.one(`[data-role="call"]${A}[data-call="charge"]`), 3);
    shownFrom(view.one(`[data-role="call"]${A}[data-call="confirm"]`), 5.5);
  });

  test('the code highlights each call while it runs', () => {
    shownOnly(view.one('[data-role="code-line"][data-call="hold"]'), 1, 2.5);
    shownOnly(view.one('[data-role="code-line"][data-call="charge"]'), 3, 5.5);
    shownOnly(view.one('[data-role="code-line"][data-call="confirm"]'), 5.5, 7);
  });

  test('the provider charges the card from 3 s and answers at 5.5 s', () => {
    shownFrom(view.one('[data-role="charge"]'), 3);
    shownFrom(view.one(`[data-role="charged"]${A}`), 5.5);
  });

  test('the code brackets follow the transactions they mark', () => {
    const brackets = view.all('[data-role="code-transaction"]');
    expect(brackets.map((bracket) => bracket.getAttribute('data-tx'))).toEqual(
      transactionsOf(view, A),
    );
    for (const bracket of brackets) {
      const tx = view.one(
        `[data-role="transaction"]${A}[data-tx="${bracket.getAttribute('data-tx')}"]`,
      );
      expect(statesOf(bracket)).toEqual(statesOf(tx));
      for (const state of statesOf(tx)) {
        const code = bracket.querySelector(`[data-state="${state}"]`)!;
        const timeline = tx.querySelector(`[data-state="${state}"]`)!;
        for (let t = 0; t < LOOP; t += 0.25) {
          expect(opacityAt(code, at(t))).toBe(opacityAt(timeline, at(t)));
        }
      }
    }
  });

  test('a commit of A fails at 7 s, after the provider has charged the card', () => {
    const [failed, ...others] = view.all(
      `[data-role="transaction"]${A} [data-state="rolled-back"]`,
    );
    expect(others).toEqual([]);
    shownFrom(failed!, 7);
    expect(onsetOf(view.one(`[data-role="charged"]${A}`))!).toBeLessThan(onsetOf(failed!)!);
  });

  test('A gets 500 at 7.5 s', () => {
    const response = view.one(`[data-role="response"]${A}`);
    expect(response.textContent).toContain('500');
    shownFrom(response, 7.5);
  });

  test('reconciliation looks for PENDING payments from 8 s', () => {
    const find = view.one(`[data-role="call"]${RECONCILIATION}[data-call="find"]`);
    expect(find.textContent).toContain('PENDING');
    shownFrom(find, 8);
  });

  test('the verdict shows from 14 s until the loop restarts', () => {
    shownFrom(view.one('[data-role="verdict"]'), 14);
  });
});

describe('before: the charge runs inside the one transaction', () => {
  test('@Transactional wraps checkout(), the charge included', () => {
    const code = codeText(before);
    expect(code).toContain('@Transactional\n');
    expect(code).toContain('payments.charge(order)');
    expect(code).not.toContain('QuarkusTransaction');
  });

  test('A runs in one transaction, open from 1 s and rolled back at 7 s', () => {
    expect(transactionsOf(before, A)).toEqual(['checkout']);
    shownOnly(transaction(before, A, 'checkout', 'open'), 1, 7);
    shownFrom(transaction(before, A, 'checkout', 'rolled-back'), 7);
    expect(before.all('[data-role="transaction"] [data-state="committed"]')).toEqual([]);
  });

  test('the rollback takes the hold with it, so the seats are free again at 7 s', () => {
    const [lock, ...others] = before.all('[data-role="seat-lock"]');
    expect(others).toEqual([]);
    shownOnly(lock!.querySelector('[data-state="held"]')!, 1.5, 7);
    shownFrom(lock!.querySelector('[data-state="released"]')!, 7);
    const free = before.all('[data-role="seat-status"][data-state="free"]');
    expect(free).toHaveLength(2);
    shownFrom(free[1]!, 7);
  });

  test('the card stays charged, and nothing records the charge or issues tickets', () => {
    expect(
      before.all('[data-role="seat-status"]:not([data-state="free"]), [data-payment]'),
    ).toEqual([]);
    expect(before.all('[data-role="tickets"]')).toEqual([]);
  });

  test('reconciliation finds no PENDING payment at 10 s, so nothing settles', () => {
    const found = before.one('[data-role="found"]');
    expect(found.getAttribute('data-state')).toBe('none');
    shownFrom(found, 10);
    expect(before.all(`[data-role="transaction"]${RECONCILIATION}`)).toEqual([]);
  });
});

describe('after: commit a PENDING payment before the charge', () => {
  test('checkout() refuses a caller transaction and opens two of its own', () => {
    const code = codeText(after);
    expect(code).toContain('@Transactional(TxType.NEVER)');
    expect(code.match(/QuarkusTransaction\.requiringNew\(\)\.run\(/g)).toHaveLength(2);
    expect(code).toContain('orders.reserve(order)');
    expect(code).toContain('\nCharge charge = payments.charge(order);\n');
  });

  test('the hold and the PENDING payment commit at 2.5 s, before the charge starts', () => {
    expect(transactionsOf(after, A)).toEqual(['reserve', 'confirm']);
    shownOnly(transaction(after, A, 'reserve', 'open'), 1, 2.5);
    shownFrom(transaction(after, A, 'reserve', 'committed'), 2.5);
    const [pending] = after.all('[data-role="seat-status"][data-state="held"]');
    expect(pending!.getAttribute('data-payment')).toBe('pending');
    shownFrom(pending!, 2.5);
  });

  test('no transaction of A is open and no seat is locked during the charge', () => {
    for (const open of after.all(`[data-role="transaction"]${A} [data-state="open"]`)) {
      expect(hiddenThroughout(open, DURING_THE_CHARGE)).toBe(true);
    }
    for (const lock of after.all('[data-role="seat-lock"] [data-state="held"]')) {
      expect(hiddenThroughout(lock, DURING_THE_CHARGE)).toBe(true);
    }
  });

  test('only the confirm transaction rolls back when its commit fails at 7 s', () => {
    shownOnly(transaction(after, A, 'confirm', 'open'), 5.5, 7);
    shownFrom(transaction(after, A, 'confirm', 'rolled-back'), 7);
    expect(statesOf(after.one(`[data-role="transaction"]${A}[data-tx="confirm"]`))).not.toContain(
      'committed',
    );
    expect(shownThroughout(transaction(after, A, 'reserve', 'committed'), between(7, LOOP))).toBe(
      true,
    );
  });

  test('the seats stay held and the payment stays PENDING after the failure', () => {
    const held = after.all('[data-role="seat-status"][data-state="held"]');
    expect(held.map((status) => status.getAttribute('data-payment'))).toEqual([
      'pending',
      'pending',
    ]);
    shownFrom(held[1]!, 7);
    expect(after.all('[data-role="seat-status"][data-state="free"]')).toHaveLength(1);
  });

  test('reconciliation asks the provider at 10 s, and the provider answers charged at 11 s', () => {
    expect(after.all('[data-role="found"]')).toEqual([]);
    shownFrom(after.one(`[data-role="call"]${RECONCILIATION}[data-call="status"]`), 10);
    shownFrom(after.one('[data-role="status"]'), 10);
    shownFrom(after.one(`[data-role="charged"]${RECONCILIATION}`), 11);
  });

  test('reconciliation confirms the order in a short transaction of its own', () => {
    expect(transactionsOf(after, RECONCILIATION)).toEqual(['confirm']);
    shownOnly(transaction(after, RECONCILIATION, 'confirm', 'open'), 11, 12.5);
    shownFrom(transaction(after, RECONCILIATION, 'confirm', 'committed'), 12.5);
    expect(onsetOf(transaction(after, RECONCILIATION, 'confirm', 'open'))!).toBeGreaterThanOrEqual(
      onsetOf(after.one(`[data-role="charged"]${RECONCILIATION}`))!,
    );
  });

  test('the seats are sold to A and the payment is paid at 12.5 s', () => {
    const sold = after.one('[data-role="seat-status"][data-state="sold"]');
    expect(sold.getAttribute('data-payment')).toBe('paid');
    shownFrom(sold, 12.5);
  });

  test('the tickets go out by email at 13 s', () => {
    shownFrom(after.one('[data-role="tickets"]'), 13);
  });
});
