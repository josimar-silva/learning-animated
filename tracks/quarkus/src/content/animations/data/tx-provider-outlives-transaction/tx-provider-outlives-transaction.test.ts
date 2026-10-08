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

// The provider charges A's card from 3 s until it answers at 9.5 s, in both views.
const DURING_THE_CHARGE = between(3, 9.4);

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(
      new URL(`./tx-provider-outlives-transaction.${name}.svg`, import.meta.url),
      'utf8',
    ),
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

const secondsUntil = (el: Element): number => onsetOf(el)! * LOOP;

// A transaction belongs to checkout request A; the reaper is the transaction
// manager's background thread.
const A = '[data-request="A"]';
const REAPER = '[data-actor="reaper"]';

const transaction = (view: View, tx: string, state: string): Element =>
  view.one(`[data-role="transaction"]${A}[data-tx="${tx}"] [data-state="${state}"]`);

const transactionsOf = (view: View): (string | null)[] =>
  view.all(`[data-role="transaction"]${A}`).map((tx) => tx.getAttribute('data-tx'));

const statesOf = (el: Element): (string | null)[] =>
  [...el.querySelectorAll('[data-state]')]
    .map((state) => state.getAttribute('data-state'))
    .filter((state) => state !== 'dormant');

const codeText = (view: View): string =>
  view
    .all('[data-role="code"] text')
    .map((line) => line.textContent.trim())
    .join('\n');

const deadline = (view: View, timeout: 'transaction' | 'read'): Element =>
  view.one(`[data-role="deadline"][data-timeout="${timeout}"]`);

// A deadline is a line across the lanes, where a moment t seconds into the loop
// sits at x = 160 + 50t.
const momentOf = (marker: Element): number =>
  (Number(marker.querySelector('line')!.getAttribute('x1')) - 160) / 50;

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

  test('A holds the seats at 1 s, calls the provider at 3 s, and confirms at 10 s', () => {
    shownFrom(view.one(`[data-role="call"]${A}[data-call="hold"]`), 1);
    shownFrom(view.one(`[data-role="call"]${A}[data-call="charge"]`), 3);
    shownFrom(view.one(`[data-role="call"]${A}[data-call="confirm"]`), 10);
  });

  test('the code highlights each call while it runs', () => {
    shownOnly(view.one('[data-role="code-line"][data-call="hold"]'), 1, 2.5);
    shownOnly(view.one('[data-role="code-line"][data-call="charge"]'), 3, 9.5);
    shownOnly(view.one('[data-role="code-line"][data-call="confirm"]'), 10, 11.5);
  });

  test('the provider charges the card from 3 s and answers at 9.5 s', () => {
    shownFrom(view.one('[data-role="charge"]'), 3);
    shownFrom(view.one('[data-role="charged"]'), 9.5);
  });

  test('the code brackets follow the transactions they mark', () => {
    const brackets = view.all('[data-role="code-transaction"]');
    expect(brackets.map((bracket) => bracket.getAttribute('data-tx'))).toEqual(
      transactionsOf(view),
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

  test("the client's read timeout starts with the call and falls after the provider answers", () => {
    const read = deadline(view, 'read');
    shownFrom(read, 3);
    expect(momentOf(read)).toBeGreaterThan(secondsUntil(view.one('[data-role="charged"]')));
  });

  test('the verdict shows from 14 s until the loop restarts', () => {
    shownFrom(view.one('[data-role="verdict"]'), 14);
  });
});

describe('before: the transaction times out while the provider is still charging', () => {
  test('@Transactional with a 5 s timeout wraps checkout(), the charge included', () => {
    const code = codeText(before);
    expect(code).toContain('@Transactional @TransactionConfiguration(timeout = 5)\n');
    expect(code).toContain('payments.charge(order)');
    expect(code).not.toContain('QuarkusTransaction');
  });

  test('A runs in one transaction, open from 1 s until it rolls back at 6 s', () => {
    expect(transactionsOf(before)).toEqual(['checkout']);
    shownOnly(transaction(before, 'checkout', 'open'), 1, 6);
    shownFrom(transaction(before, 'checkout', 'rolled-back'), 6);
    expect(before.all('[data-role="transaction"] [data-state="committed"]')).toEqual([]);
  });

  test('the transaction timeout starts at BEGIN and runs out 5 s later, mid-charge', () => {
    const timeout = deadline(before, 'transaction');
    shownFrom(timeout, 1);
    expect(momentOf(timeout)).toBe(1 + 5);
    expect(momentOf(timeout)).toBeGreaterThan(secondsUntil(before.one('[data-role="charge"]')));
    expect(momentOf(timeout)).toBeLessThan(secondsUntil(before.one('[data-role="charged"]')));
  });

  test('the reaper times the transaction from 1 s and rolls it back at 6 s', () => {
    shownFrom(before.one(`[data-role="timer"]${REAPER}`), 1);
    shownFrom(before.one(`[data-role="call"]${REAPER}[data-call="rollback"]`), 6);
  });

  test('checkout keeps waiting on the provider after the rollback', () => {
    const waiting = before.one('[data-role="code-line"][data-call="charge"]');
    expect(shownThroughout(waiting, between(6, 9.4))).toBe(true);
    expect(shownThroughout(before.one('[data-role="charge"]'), DURING_THE_CHARGE)).toBe(true);
    expect(secondsUntil(transaction(before, 'checkout', 'rolled-back'))).toBeLessThan(
      secondsUntil(before.one('[data-role="charged"]')),
    );
  });

  test('the rollback undoes the hold and frees the seats at 6 s', () => {
    const [lock, ...others] = before.all('[data-role="seat-lock"]');
    expect(others).toEqual([]);
    shownOnly(lock!.querySelector('[data-state="held"]')!, 1.5, 6);
    shownFrom(lock!.querySelector('[data-state="released"]')!, 6);
    const free = before.all('[data-role="seat-status"][data-state="free"]');
    expect(free).toHaveLength(2);
    shownFrom(free[1]!, 6);
  });

  test('confirming the order at 10 s fails, because the transaction is no longer active', () => {
    const error = before.one(`[data-role="error"]${A}`);
    expect(error.textContent).toContain('not active');
    shownFrom(error, 10);
  });

  test('A gets 500 at 11.5 s', () => {
    const response = before.one(`[data-role="response"]${A}`);
    expect(response.textContent).toContain('500');
    shownFrom(response, 11.5);
  });

  test('nothing in the database records the charge', () => {
    expect(
      before.all('[data-role="seat-status"]:not([data-state="free"]), [data-payment]'),
    ).toEqual([]);
  });
});

describe('after: charge with no transaction open', () => {
  test('checkout() refuses a caller transaction and opens two short ones of its own', () => {
    const code = codeText(after);
    expect(code).toContain('@Transactional(TxType.NEVER)');
    expect(code).not.toContain('@TransactionConfiguration');
    expect(code.match(/QuarkusTransaction\.requiringNew\(\)\.run\(/g)).toHaveLength(2);
    expect(code).toContain('orders.reserve(order)');
    expect(code).toContain('\nCharge charge = payments.charge(order);\n');
  });

  test('the hold and the PENDING payment commit at 2.5 s, before the charge starts', () => {
    expect(transactionsOf(after)).toEqual(['reserve', 'confirm']);
    shownOnly(transaction(after, 'reserve', 'open'), 1, 2.5);
    shownFrom(transaction(after, 'reserve', 'committed'), 2.5);
    const held = after.one('[data-role="seat-status"][data-state="held"]');
    expect(held.getAttribute('data-payment')).toBe('pending');
    shownFrom(held, 2.5);
  });

  test('no transaction of A is open and no seat is locked during the charge', () => {
    for (const open of after.all(`[data-role="transaction"]${A} [data-state="open"]`)) {
      expect(hiddenThroughout(open, DURING_THE_CHARGE)).toBe(true);
    }
    const locks = after.all('[data-role="seat-lock"] [data-state="held"]');
    expect(locks).toHaveLength(2);
    for (const lock of locks) expect(hiddenThroughout(lock, DURING_THE_CHARGE)).toBe(true);
  });

  test('the reaper has nothing to roll back, and only the read timeout limits the call', () => {
    expect(after.all(`[data-role="call"]${REAPER}, [data-role="timer"]${REAPER}`)).toEqual([]);
    expect(after.all('[data-role="deadline"][data-timeout="transaction"]')).toEqual([]);
    shownFrom(after.one(`[data-role="idle"]${REAPER}`), 3);
  });

  test('a second short transaction confirms the order after the provider answers', () => {
    expect(after.all('[data-role="error"]')).toEqual([]);
    shownOnly(transaction(after, 'confirm', 'open'), 10, 11.5);
    shownFrom(transaction(after, 'confirm', 'committed'), 11.5);
    expect(secondsUntil(transaction(after, 'confirm', 'open'))).toBeGreaterThan(
      secondsUntil(after.one('[data-role="charged"]')),
    );
  });

  test('the seats are sold to A and the payment is paid at 11.5 s', () => {
    const sold = after.one('[data-role="seat-status"][data-state="sold"]');
    expect(sold.getAttribute('data-payment')).toBe('paid');
    shownFrom(sold, 11.5);
  });

  test('A gets 200 OK at 12 s', () => {
    const response = after.one(`[data-role="response"]${A}`);
    expect(response.textContent).toContain('200 OK');
    shownFrom(response, 12);
  });
});
