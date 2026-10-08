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

// The provider charges A's card from 3 s to 10.5 s in both views.
const DURING_THE_CHARGE = between(3, 10.5);

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./tx-remote-call-inside.${name}.svg`, import.meta.url), 'utf8'),
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

const transaction = (view: View, request: 'A' | 'B', tx: string, state: string): Element =>
  view.one(
    `[data-role="transaction"][data-request="${request}"][data-tx="${tx}"] [data-state="${state}"]`,
  );

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

  test('A holds the seats at 1 s, calls the provider at 3 s, and confirms at 11 s', () => {
    shownFrom(view.one('[data-role="call"][data-request="A"][data-call="hold"]'), 1);
    shownFrom(view.one('[data-role="call"][data-request="A"][data-call="charge"]'), 3);
    shownFrom(view.one('[data-role="call"][data-request="A"][data-call="confirm"]'), 11);
  });

  test('the code highlights each call while it runs', () => {
    shownOnly(view.one('[data-role="code-line"][data-call="hold"]'), 1, 2.5);
    shownOnly(view.one('[data-role="code-line"][data-call="charge"]'), 3, 10.5);
    shownOnly(view.one('[data-role="code-line"][data-call="confirm"]'), 11, 12.5);
  });

  test('the provider charges the card from 3 s and answers at 10.5 s', () => {
    shownFrom(view.one('[data-role="charge"]'), 3);
    shownFrom(view.one('[data-role="charged"]'), 10.5);
  });

  test('the code brackets open and commit with the transactions they mark', () => {
    const brackets = view.all('[data-role="code-transaction"]');
    expect(brackets.map((bracket) => bracket.getAttribute('data-tx'))).toEqual(
      view
        .all('[data-role="transaction"][data-request="A"]')
        .map((tx) => tx.getAttribute('data-tx')),
    );
    for (const bracket of brackets) {
      const tx = bracket.getAttribute('data-tx')!;
      for (const state of ['open', 'committed']) {
        const code = bracket.querySelector(`[data-state="${state}"]`)!;
        const timeline = transaction(view, 'A', tx, state);
        for (let t = 0; t < LOOP; t += 0.25) {
          expect(opacityAt(code, at(t))).toBe(opacityAt(timeline, at(t)));
        }
      }
    }
  });

  test('A gets 200 OK at 13 s', () => {
    const response = view.one('[data-role="response"][data-request="A"]');
    expect(response.textContent).toContain('200 OK');
    shownFrom(response, 13);
  });

  test('the verdict shows from 14 s until the loop restarts', () => {
    shownFrom(view.one('[data-role="verdict"]'), 14);
  });
});

describe('before: one transaction around the whole checkout', () => {
  test('@Transactional wraps checkout(), the charge included', () => {
    const code = codeText(before);
    expect(code).toContain('@Transactional\n');
    expect(code).toContain('payments.charge(order)');
    expect(code).not.toContain('QuarkusTransaction');
  });

  test('A runs in one transaction, open from 1 s and committed at 12.5 s', () => {
    expect(
      before
        .all('[data-role="transaction"][data-request="A"]')
        .map((tx) => tx.getAttribute('data-tx')),
    ).toEqual(['checkout']);
    shownOnly(transaction(before, 'A', 'checkout', 'open'), 1, 12.5);
    shownFrom(transaction(before, 'A', 'checkout', 'committed'), 12.5);
  });

  test('the seat locks stay held for the whole provider call', () => {
    const [lock, ...others] = before.all('[data-role="seat-lock"]');
    expect(others).toEqual([]);
    const held = lock!.querySelector('[data-state="held"]')!;
    expect(shownThroughout(held, DURING_THE_CHARGE)).toBe(true);
    shownOnly(held, 1.5, 12.5);
    shownFrom(lock!.querySelector('[data-state="released"]')!, 12.5);
  });

  test('the seats are sold when A commits', () => {
    expect(before.all('[data-role="seat-status"][data-state="held"]')).toEqual([]);
    shownFrom(before.one('[data-role="seat-status"][data-state="sold"]'), 12.5);
  });

  test("B waits on A's locks from 5 s until A commits, then rolls back and gets 409", () => {
    shownFrom(before.one('[data-role="lock-wait"][data-request="B"]'), 5);
    shownOnly(transaction(before, 'B', 'checkout', 'open'), 5, 13);
    shownFrom(transaction(before, 'B', 'checkout', 'rolled-back'), 13);
    const response = before.one('[data-role="response"][data-request="B"]');
    expect(response.textContent).toContain('409');
    shownFrom(response, 13);
    expect(onsetOf(response)!).toBeGreaterThan(
      onsetOf(transaction(before, 'A', 'checkout', 'committed'))!,
    );
  });
});

describe('after: commit the hold, charge with no transaction, then confirm', () => {
  test('checkout() refuses a caller transaction and opens two of its own', () => {
    const code = codeText(after);
    expect(code).toContain('@Transactional(TxType.NEVER)');
    expect(code.match(/QuarkusTransaction\.requiringNew\(\)\.run\(/g)).toHaveLength(2);
    expect(code).toContain('\nCharge charge = payments.charge(order);\n');
  });

  test('the hold commits at 2.5 s, before the charge starts', () => {
    expect(
      after
        .all('[data-role="transaction"][data-request="A"]')
        .map((tx) => tx.getAttribute('data-tx')),
    ).toEqual(['hold', 'confirm']);
    shownOnly(transaction(after, 'A', 'hold', 'open'), 1, 2.5);
    shownFrom(transaction(after, 'A', 'hold', 'committed'), 2.5);
  });

  test('no transaction of A is open and no seat is locked during the charge', () => {
    for (const open of after.all(
      '[data-role="transaction"][data-request="A"] [data-state="open"]',
    )) {
      expect(hiddenThroughout(open, DURING_THE_CHARGE)).toBe(true);
    }
    const held = after.all('[data-role="seat-lock"] [data-state="held"]');
    expect(held).toHaveLength(2);
    for (const lock of held) expect(hiddenThroughout(lock, DURING_THE_CHARGE)).toBe(true);
  });

  test('the seats stay held as committed data from 2.5 s', () => {
    shownFrom(after.one('[data-role="seat-status"][data-state="held"]'), 2.5);
  });

  test('a second short transaction confirms the order after the reply', () => {
    shownOnly(transaction(after, 'A', 'confirm', 'open'), 11, 12.5);
    shownFrom(transaction(after, 'A', 'confirm', 'committed'), 12.5);
    expect(onsetOf(transaction(after, 'A', 'confirm', 'open'))!).toBeGreaterThan(
      onsetOf(after.one('[data-role="charged"]'))!,
    );
    shownFrom(after.one('[data-role="seat-status"][data-state="sold"]'), 12.5);
  });

  test('B reads the committed hold and gets 409 at once, while A is still being charged', () => {
    expect(after.all('[data-role="lock-wait"]')).toEqual([]);
    shownOnly(transaction(after, 'B', 'hold', 'open'), 5, 6.5);
    shownFrom(transaction(after, 'B', 'hold', 'rolled-back'), 6.5);
    const response = after.one('[data-role="response"][data-request="B"]');
    expect(response.textContent).toContain('409');
    shownFrom(response, 6.5);
  });
});
