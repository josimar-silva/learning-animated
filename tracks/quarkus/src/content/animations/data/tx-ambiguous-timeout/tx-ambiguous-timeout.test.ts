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

// In both views checkout A calls the provider at 2.5 s and stops waiting at
// 6.5 s, and the provider charges the card at 8 s.
const TIMEOUT = 6.5;
const CHARGED = 8;
const WHILE_A_WAITS = between(2.5, TIMEOUT - 0.1);

const A = '[data-request="A"]';
const RECONCILIATION = '[data-job="reconcile"]';

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./tx-ambiguous-timeout.${name}.svg`, import.meta.url), 'utf8'),
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

const transaction = (view: View, owner: string, tx: string, state: string): Element =>
  view.one(`[data-role="transaction"]${owner}[data-tx="${tx}"] [data-state="${state}"]`);

const txIds = (view: View, owner: string): (string | null)[] =>
  view.all(`[data-role="transaction"]${owner}`).map((tx) => tx.getAttribute('data-tx'));

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

  test('A holds the seats at 0.5 s and calls the provider at 2.5 s', () => {
    shownFrom(view.one(`[data-role="call"]${A}[data-call="hold"]`), 0.5);
    shownFrom(view.one(`[data-role="call"]${A}[data-call="charge"]`), 2.5);
  });

  test("A's read timeout ends the call at 6.5 s, while the provider is still charging", () => {
    shownFrom(
      view.one(`[data-role="call"]${A}[data-call="charge"] [data-role="timeout"]`),
      TIMEOUT,
    );
    shownFrom(view.one('[data-role="charge"]'), 2.5);
    shownFrom(view.one(`[data-role="charged"]${A}`), CHARGED);
  });

  test('the code highlights each call of checkout while it runs', () => {
    shownOnly(view.one('[data-role="code-line"][data-call="hold"]'), 0.5, 2);
    shownOnly(view.one('[data-role="code-line"][data-call="charge"]'), 2.5, TIMEOUT);
  });

  test('the code brackets change with the transactions they mark', () => {
    const brackets = view.all('[data-role="code-transaction"]');
    expect(brackets.map((bracket) => bracket.getAttribute('data-tx'))).toEqual(txIds(view, A));
    for (const bracket of brackets) {
      const tx = bracket.getAttribute('data-tx')!;
      for (const timeline of view.all(
        `[data-role="transaction"]${A}[data-tx="${tx}"] [data-state]`,
      )) {
        const code = bracket.querySelector(`[data-state="${timeline.getAttribute('data-state')}"]`);
        expect(code).not.toBeNull();
        for (let t = 0; t < LOOP; t += 0.25) {
          expect(opacityAt(code!, at(t))).toBe(opacityAt(timeline, at(t)));
        }
      }
    }
  });

  test('the verdict shows from 14 s until the loop restarts', () => {
    shownFrom(view.one('[data-role="verdict"]'), 14);
  });
});

describe('before: the timeout rolls the whole checkout back', () => {
  test('@Transactional wraps checkout(), the charge included', () => {
    const code = codeText(before);
    expect(code).toContain('@Transactional\n');
    expect(code).toContain('payments.charge(order)');
    expect(code).not.toContain('QuarkusTransaction');
  });

  test('the timeout rolls back the only transaction at 6.5 s', () => {
    expect(txIds(before, A)).toEqual(['checkout']);
    shownOnly(transaction(before, A, 'checkout', 'open'), 0.5, TIMEOUT);
    shownFrom(transaction(before, A, 'checkout', 'rolled-back'), TIMEOUT);
    expect(before.all('[data-role="transaction"] [data-state="committed"]')).toEqual([]);
  });

  test('the rollback frees the seats and keeps no record of the payment', () => {
    const [lock, ...others] = before.all('[data-role="seat-lock"]');
    expect(others).toEqual([]);
    shownOnly(lock!.querySelector('[data-state="held"]')!, 1, TIMEOUT);
    shownFrom(lock!.querySelector('[data-state="released"]')!, TIMEOUT);
    const [, freeAgain, ...more] = before.all('[data-role="seat-status"][data-state="free"]');
    expect(more).toEqual([]);
    shownFrom(freeAgain!, TIMEOUT);
    expect(freeAgain!.textContent).toContain('no payment recorded');
    expect(before.all('[data-role="payment-status"]')).toEqual([]);
    expect(before.all('[data-role="seat-status"]:not([data-state="free"])')).toEqual([]);
  });

  test('A gets a 500 at 7 s, and the provider charges the card after that', () => {
    const response = before.one(`[data-role="response"]${A}`);
    expect(response.textContent).toContain('500');
    shownFrom(response, 7);
    expect(onsetOf(response)!).toBeLessThan(onsetOf(before.one(`[data-role="charged"]${A}`))!);
  });

  test('checkout never reaches orders.confirm()', () => {
    expect(codeText(before)).toContain('orders.confirm(order, charge)');
    expect(before.all('[data-role="code-line"][data-call="confirm"]')).toEqual([]);
  });

  test('reconciliation looks for UNKNOWN payments at 9 s and finds none', () => {
    const find = before.one(`[data-role="call"]${RECONCILIATION}[data-call="find"]`);
    expect(find.textContent).toContain('UNKNOWN');
    shownFrom(find, 9);
    const found = before.one('[data-role="found"]');
    expect(found.getAttribute('data-state')).toBe('none');
    shownFrom(found, 11.5);
    expect(before.all(`[data-role="transaction"]${RECONCILIATION}`)).toEqual([]);
    expect(before.all('[data-role="status"]')).toEqual([]);
  });
});

describe('after: record UNKNOWN, then settle it by idempotency key', () => {
  test('checkout() refuses a caller transaction and commits each step on its own', () => {
    const code = codeText(after);
    expect(code).toContain('@Transactional(TxType.NEVER)');
    expect(code.match(/QuarkusTransaction\.requiringNew\(\)\.run\(/g)).toHaveLength(2);
    expect(code).toContain('\nPayment payment = payments.charge(order);\n');
    expect(code).toContain('orders.record(order, payment)');
  });

  test('the hold commits at 2 s, before the charge starts', () => {
    expect(txIds(after, A)).toEqual(['hold', 'record']);
    shownOnly(transaction(after, A, 'hold', 'open'), 0.5, 2);
    shownFrom(transaction(after, A, 'hold', 'committed'), 2);
    shownFrom(after.one('[data-role="seat-status"][data-state="held"]'), 2);
  });

  test('no transaction of A is open and no seat is locked while A waits', () => {
    for (const open of after.all(`[data-role="transaction"]${A} [data-state="open"]`)) {
      expect(hiddenThroughout(open, WHILE_A_WAITS)).toBe(true);
    }
    for (const held of after.all('[data-role="seat-lock"] [data-state="held"]')) {
      expect(hiddenThroughout(held, between(2.5, CHARGED))).toBe(true);
    }
  });

  test('the timeout becomes an UNKNOWN payment, committed at 8 s', () => {
    shownOnly(after.one('[data-role="code-line"][data-call="record"]'), TIMEOUT, 8);
    shownFrom(after.one(`[data-role="call"]${A}[data-call="record"]`), TIMEOUT);
    shownOnly(transaction(after, A, 'record', 'open'), TIMEOUT, 8);
    shownFrom(transaction(after, A, 'record', 'committed'), 8);
    const unknown = after.one('[data-role="payment-status"][data-state="unknown"]');
    expect(unknown.textContent).toContain('UNKNOWN');
    shownFrom(unknown, 8);
    expect(after.all('[data-state="rolled-back"]')).toEqual([]);
  });

  test('the seats stay held for A until they are sold', () => {
    expect(after.all('[data-role="seat-status"][data-state="free"]')).toHaveLength(1);
    shownFrom(after.one('[data-role="seat-status"][data-state="sold"]'), 12.5);
  });

  test('A gets 202 Accepted at 8 s instead of an error', () => {
    const response = after.one(`[data-role="response"]${A}`);
    expect(response.textContent).toContain('202 Accepted');
    shownFrom(response, 8);
  });

  test('after the provider is done, reconciliation asks for the charge by its key', () => {
    expect(after.all('[data-role="found"]')).toEqual([]);
    const query = after.one(`[data-role="call"]${RECONCILIATION}[data-call="status"]`);
    expect(query.textContent).toContain('key');
    shownFrom(query, 9);
    expect(onsetOf(query)!).toBeGreaterThan(onsetOf(after.one(`[data-role="charged"]${A}`))!);
    shownFrom(after.one('[data-role="status"]'), 9.5);
    shownFrom(after.one(`[data-role="charged"]${RECONCILIATION}`), 10.5);
    expect(after.one('[data-role="verdict"]').textContent).toContain('idempotency key');
  });

  test('the answer settles it: reconciliation confirms the order and sells the seats', () => {
    expect(txIds(after, RECONCILIATION)).toEqual(['confirm']);
    shownFrom(after.one(`[data-role="call"]${RECONCILIATION}[data-call="confirm"]`), 11);
    shownOnly(transaction(after, RECONCILIATION, 'confirm', 'open'), 11, 12.5);
    shownFrom(transaction(after, RECONCILIATION, 'confirm', 'committed'), 12.5);
    expect(onsetOf(transaction(after, RECONCILIATION, 'confirm', 'open'))!).toBeGreaterThan(
      onsetOf(after.one(`[data-role="charged"]${RECONCILIATION}`))!,
    );
    const [, confirmLock, ...others] = after.all('[data-role="seat-lock"]');
    expect(others).toEqual([]);
    shownOnly(confirmLock!.querySelector('[data-state="held"]')!, 11.5, 12.5);
    shownFrom(confirmLock!.querySelector('[data-state="released"]')!, 12.5);
  });
});
