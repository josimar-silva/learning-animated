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

// The provider charges the card for A from 3 s until it answers at 10.5 s, in both views.
const DURING_A_CHARGE = between(3, 10.5);

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./tx-two-pods.${name}.svg`, import.meta.url), 'utf8'),
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

// A is the copy of the checkout that reaches pod 1, and B the copy that reaches pod 2.
type Copy = 'A' | 'B';

const transaction = (view: View, copy: Copy, tx: string, state: string): Element =>
  view.one(
    `[data-role="transaction"][data-request="${copy}"][data-tx="${tx}"] [data-state="${state}"]`,
  );

const transactionsOf = (view: View, copy: Copy): (string | null)[] =>
  view
    .all(`[data-role="transaction"][data-request="${copy}"]`)
    .map((tx) => tx.getAttribute('data-tx'));

const call = (view: View, copy: Copy, name: string): Element =>
  view.one(`[data-role="call"][data-request="${copy}"][data-call="${name}"]`);

const lock = (view: View, copy: Copy, tx: string, state: string): Element =>
  view.one(
    `[data-role="order-lock"][data-request="${copy}"][data-tx="${tx}"] [data-state="${state}"]`,
  );

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
  ['before', before, 'check'],
  ['after', after, 'claim'],
] as const)('the %s view', (_name, view, first) => {
  test('one story lasts 20 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('20s');
  });

  test('order 42 starts PENDING', () => {
    const pending = view.one('[data-role="order-status"][data-state="pending"]');
    expect(pending.textContent).toContain('PENDING');
    shownFrom(pending, 0);
  });

  test('A reaches pod 1 at 1 s and B reaches pod 2 at 1.5 s', () => {
    shownFrom(call(view, 'A', first), 1);
    shownFrom(call(view, 'B', first), 1.5);
  });

  test("the code highlights each of A's calls while it runs", () => {
    shownOnly(view.one(`[data-role="code-line"][data-call="${first}"]`), 1, 2.5);
    shownOnly(view.one('[data-role="code-line"][data-call="charge"]'), 3, 10.5);
    shownOnly(view.one('[data-role="code-line"][data-call="confirm"]'), 11, 12.5);
  });

  test('the provider charges the card for A from 3 s and answers at 10.5 s', () => {
    shownFrom(call(view, 'A', 'charge'), 3);
    shownFrom(view.one('[data-role="charge"][data-request="A"]'), 3);
    shownFrom(view.one('[data-role="charged"][data-request="A"]'), 10.5);
  });

  test('the code brackets follow the transactions they mark', () => {
    const brackets = view.all('[data-role="code-transaction"]');
    expect(brackets.map((bracket) => bracket.getAttribute('data-tx'))).toEqual(
      transactionsOf(view, 'A'),
    );
    for (const bracket of brackets) {
      const tx = view.one(
        `[data-role="transaction"][data-request="A"][data-tx="${bracket.getAttribute('data-tx')}"]`,
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

  test('no transaction of A is open during the charge', () => {
    const open = view.all('[data-role="transaction"][data-request="A"] [data-state="open"]');
    expect(open.length).toBeGreaterThan(0);
    for (const tx of open) expect(hiddenThroughout(tx, DURING_A_CHARGE)).toBe(true);
  });

  test('A marks the order PAID at 12.5 s and gets 200 OK at 13 s', () => {
    shownOnly(transaction(view, 'A', 'confirm', 'open'), 11, 12.5);
    shownFrom(transaction(view, 'A', 'confirm', 'committed'), 12.5);
    shownOnly(lock(view, 'A', 'confirm', 'held'), 11.5, 12.5);
    const paid = view.one('[data-role="order-status"][data-state="paid"][data-request="A"]');
    expect(paid.textContent).toContain('PAID');
    shownFrom(paid, 12.5);
    const response = view.one('[data-role="response"][data-request="A"]');
    expect(response.textContent).toContain('200 OK');
    shownFrom(response, 13);
  });

  test('the verdict shows from 14 s until the loop restarts', () => {
    shownFrom(view.one('[data-role="verdict"]'), 14);
  });
});

describe('before: both pods read PENDING, and both charge the card', () => {
  test('checkout() reads the status before the charge, and nothing claims the order', () => {
    const code = codeText(before);
    expect(code).toContain('@Transactional(TxType.NEVER)');
    expect(code).toContain(
      '\norders.requirePending(order);\nCharge charge = payments.charge(order);\n',
    );
    expect(code).not.toContain('claim');
  });

  test('both reads see PENDING, and neither one waits or takes a lock', () => {
    for (const copy of ['A', 'B'] as const) {
      expect(call(before, copy, 'check').textContent).toContain('PENDING');
    }
    expect(before.all('[data-role="lock-wait"]')).toEqual([]);
    for (const held of before.all('[data-role="order-lock"] [data-state="held"]')) {
      expect(hiddenThroughout(held, between(0, 8.9))).toBe(true);
    }
    for (const status of before.all('[data-role="order-status"]:not([data-state="pending"])')) {
      expect(hiddenThroughout(status, between(0, 9.9))).toBe(true);
    }
  });

  test('the provider charges the card for B from 3.5 s, while it is still charging for A', () => {
    shownFrom(call(before, 'B', 'charge'), 3.5);
    const forB = before.one('[data-role="charge"][data-request="B"]');
    shownFrom(forB, 3.5);
    shownFrom(before.one('[data-role="charged"][data-request="B"]'), 8);
    const forA = before.one('[data-role="charge"][data-request="A"]');
    expect(shownThroughout(forA, between(3.5, 8))).toBe(true);
    expect(before.all('[data-role="charge"]')).toHaveLength(2);
  });

  test('B marks the order PAID at 10 s, and A marks it PAID again at 12.5 s', () => {
    expect(transactionsOf(before, 'A')).toEqual(['confirm']);
    expect(transactionsOf(before, 'B')).toEqual(['confirm']);
    shownOnly(transaction(before, 'B', 'confirm', 'open'), 8.5, 10);
    shownFrom(transaction(before, 'B', 'confirm', 'committed'), 10);
    shownOnly(lock(before, 'B', 'confirm', 'held'), 9, 10);
    const paid = before.all('[data-role="order-status"][data-state="paid"]');
    expect(paid.map((status) => status.getAttribute('data-request'))).toEqual(['B', 'A']);
    shownFrom(paid[0]!, 10);
    shownFrom(paid[1]!, 12.5);
    expect(before.all('[data-role="transaction"] [data-state="rolled-back"]')).toEqual([]);
  });

  test('both copies get 200 OK: B at 10.5 s and A at 13 s', () => {
    const response = before.one('[data-role="response"][data-request="B"]');
    expect(response.textContent).toContain('200 OK');
    shownFrom(response, 10.5);
  });
});

describe('after: a conditional UPDATE claims the order, so only one pod charges', () => {
  test('claim() takes the place of the status read', () => {
    const code = codeText(after);
    expect(code).toContain('@Transactional(TxType.NEVER)');
    expect(code).toContain('\norders.claim(order);\nCharge charge = payments.charge(order);\n');
    expect(code).not.toContain('requirePending');
    expect(after.svg.textContent).toContain("WHERE status = 'PENDING'");
  });

  test("A's claim commits at 2.5 s, before the charge, and marks the order CHARGING", () => {
    expect(transactionsOf(after, 'A')).toEqual(['claim', 'confirm']);
    shownOnly(transaction(after, 'A', 'claim', 'open'), 1, 2.5);
    shownFrom(transaction(after, 'A', 'claim', 'committed'), 2.5);
    shownOnly(lock(after, 'A', 'claim', 'held'), 1.5, 2.5);
    const claimed = after.one('[data-role="order-status"][data-state="claimed"][data-request="A"]');
    expect(claimed.textContent).toContain('CHARGING');
    shownFrom(claimed, 2.5);
  });

  test("B's UPDATE waits for A's row lock from 1.5 s until A commits", () => {
    const wait = after.one('[data-role="lock-wait"][data-request="B"]');
    shownFrom(wait, 1.5);
    expect(opacityAt(lock(after, 'A', 'claim', 'held'), at(1.5))).toBe(1);
    expect(onsetOf(wait)!).toBeLessThan(onsetOf(transaction(after, 'A', 'claim', 'committed'))!);
  });

  test('then it matches no row, so B rolls back at 3 s and gets 409 Conflict', () => {
    expect(transactionsOf(after, 'B')).toEqual(['claim']);
    shownOnly(transaction(after, 'B', 'claim', 'open'), 1.5, 3);
    const rolledBack = transaction(after, 'B', 'claim', 'rolled-back');
    shownFrom(rolledBack, 3);
    expect(onsetOf(rolledBack)!).toBeGreaterThan(
      onsetOf(transaction(after, 'A', 'claim', 'committed'))!,
    );
    const response = after.one('[data-role="response"][data-request="B"]');
    expect(response.textContent).toContain('409 Conflict');
    shownFrom(response, 3);
  });

  test('only A calls the provider, so the card is charged once', () => {
    expect(after.all('[data-role="charge"]').map((c) => c.getAttribute('data-request'))).toEqual([
      'A',
    ]);
    expect(after.all('[data-role="call"][data-request="B"][data-call="charge"]')).toEqual([]);
    expect(after.all('[data-role="charged"][data-request="B"]')).toEqual([]);
  });
});
