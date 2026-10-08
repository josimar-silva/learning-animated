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

type Window = readonly [from: number, to: number];
type Attempt = 1 | 2;

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./tx-retry-calls-again.${name}.svg`, import.meta.url), 'utf8'),
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

// Shown during each window, in order, and hidden for the rest of the loop.
const shownDuring = (el: Element, ...windows: Window[]): void => {
  let cursor = 0;
  for (const [from, to] of windows) {
    if (from > cursor) expect(hiddenThroughout(el, between(cursor, from - 0.1))).toBe(true);
    expect(shownThroughout(el, between(from, to === LOOP ? LOOP : to - 0.1))).toBe(true);
    cursor = to;
  }
  if (cursor < LOOP) expect(hiddenThroughout(el, between(cursor, LOOP))).toBe(true);
};

// Hidden until the moment, then shown until the loop restarts.
const shownFrom = (el: Element, seconds: number): void => shownDuring(el, [seconds, LOOP]);

const transaction = (view: View, attempt: Attempt, state: string): Element =>
  view.one(
    `[data-role="transaction"][data-request="A"][data-attempt="${attempt}"] [data-state="${state}"]`,
  );

const call = (view: View, attempt: Attempt, name: string): Element =>
  view.one(`[data-role="call"][data-request="A"][data-attempt="${attempt}"][data-call="${name}"]`);

const seatLock = (view: View, attempt: Attempt, state: string): Element =>
  view.one(`[data-role="seat-lock"][data-attempt="${attempt}"] [data-state="${state}"]`);

const response = (view: View, attempt: Attempt): Element =>
  view.one(`[data-role="response"][data-request="A"][data-attempt="${attempt}"]`);

const charged = (view: View, attempt: Attempt): Element =>
  view.one(`[data-role="charged"][data-attempt="${attempt}"]`);

const codeText = (view: View): string =>
  view
    .all('[data-role="code"] text')
    .map((line) => line.textContent.trim())
    .join('\n');

const chargeNote = (view: View): string =>
  view.one('[data-role="code-note"][data-call="charge"]').textContent.trim();

describe.each([
  ['before', before],
  ['after', after],
] as const)('the %s view', (_name, view) => {
  test('one story lasts 20 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('20s');
  });

  test('the seats start free, and are free again from the rollback at 6 s', () => {
    const free = view.all('[data-role="seat-status"][data-state="free"]');
    expect(free.map((status) => onsetOf(status))).toEqual([0, at(6)]);
    shownFrom(free[0]!, 0);
    shownFrom(free[1]!, 6);
  });

  test('the first attempt holds the seats at 0.5 s, charges at 2 s, and confirms at 4.5 s', () => {
    shownFrom(call(view, 1, 'hold'), 0.5);
    shownFrom(call(view, 1, 'charge'), 2);
    shownFrom(call(view, 1, 'confirm'), 4.5);
  });

  test('the provider charges the card from 2 s and answers with charge 1 at 4.5 s', () => {
    shownFrom(view.one('[data-role="charge"][data-attempt="1"]'), 2);
    const first = charged(view, 1);
    expect(first.getAttribute('data-charge')).toBe('1');
    shownFrom(first, 4.5);
  });

  test('confirm throws, so the first transaction rolls back at 6 s and A gets a 500', () => {
    shownDuring(transaction(view, 1, 'open'), [0.5, 6]);
    shownFrom(transaction(view, 1, 'rolled-back'), 6);
    shownDuring(seatLock(view, 1, 'held'), [1, 6]);
    shownFrom(seatLock(view, 1, 'released'), 6);
    const failed = response(view, 1);
    expect(failed.textContent).toContain('500');
    shownFrom(failed, 6);
  });

  test('the caller retries at 7 s, and the retry holds the seats again at 7.5 s', () => {
    shownDuring(transaction(view, 2, 'open'), [7, 12.5]);
    shownFrom(call(view, 2, 'hold'), 7);
    shownDuring(seatLock(view, 2, 'held'), [7.5, 12.5]);
    shownFrom(seatLock(view, 2, 'released'), 12.5);
  });

  test('the retry calls the provider at 8.5 s, which answers at 11 s, then confirms', () => {
    shownFrom(call(view, 2, 'charge'), 8.5);
    shownFrom(charged(view, 2), 11);
    shownFrom(call(view, 2, 'confirm'), 11);
  });

  test('the retry commits at 12.5 s, sells the seats, and gets 200 OK at 13 s', () => {
    shownFrom(transaction(view, 2, 'committed'), 12.5);
    shownFrom(view.one('[data-role="seat-status"][data-state="sold"]'), 12.5);
    const ok = response(view, 2);
    expect(ok.textContent).toContain('200 OK');
    shownFrom(ok, 13);
  });

  test('the code highlights each call while it runs, once per attempt', () => {
    shownDuring(view.one('[data-role="code-line"][data-call="hold"]'), [0.5, 2], [7, 8.5]);
    shownDuring(view.one('[data-role="code-line"][data-call="charge"]'), [2, 4.5], [8.5, 11]);
    shownDuring(view.one('[data-role="code-line"][data-call="confirm"]'), [4.5, 6], [11, 12.5]);
  });

  test('the code bracket shows the state of the transaction running the code', () => {
    const bracket = view.one('[data-role="code-transaction"]');
    const state = (name: string): Element => bracket.querySelector(`[data-state="${name}"]`)!;
    shownDuring(state('dormant'), [0, 0.5]);
    shownDuring(state('open'), [0.5, 6], [7, 12.5]);
    shownDuring(state('rolled-back'), [6, 7]);
    shownDuring(state('committed'), [12.5, LOOP]);
    for (let t = 0; t < LOOP; t += 0.25) {
      const open = ([1, 2] as const).some(
        (attempt) => opacityAt(transaction(view, attempt, 'open'), at(t)) === 1,
      );
      expect(opacityAt(state('open'), at(t))).toBe(open ? 1 : 0);
    }
  });

  test('the verdict shows from 14 s until the loop restarts', () => {
    shownFrom(view.one('[data-role="verdict"]'), 14);
  });
});

describe('before: the retry charges the card again', () => {
  test('checkout() charges with nothing that marks a repeat', () => {
    const code = codeText(before);
    expect(code).toContain('@Transactional\n');
    expect(code).toContain('\nCharge charge = payments.charge(order);\n');
    expect(code).not.toContain('order.id()');
    expect(chargeNote(before)).toBe('a new charge every time it runs');
  });

  test('the provider charges the card a second time, from 8.5 s', () => {
    const charges = before.all('[data-role="charge"]');
    expect(charges.map((charge) => charge.getAttribute('data-attempt'))).toEqual(['1', '2']);
    shownFrom(charges[1]!, 8.5);
    expect(before.all('[data-role="replay"]')).toEqual([]);
  });

  test('the retry gets charge 2', () => {
    expect(charged(before, 2).getAttribute('data-charge')).toBe('2');
  });

  test('the verdict counts two charges for one order', () => {
    expect(before.one('[data-role="verdict"]').textContent).toContain('two charges');
  });
});

describe('after: the charge carries an idempotency key', () => {
  test('checkout() sends the order id as the Idempotency-Key', () => {
    const code = codeText(after);
    expect(code).toContain('@Transactional\n');
    expect(code).toContain('\nCharge charge = payments.charge(order.id(), order);\n');
    expect(chargeNote(after)).toBe('sends order.id() as the Idempotency-Key');
  });

  test('the provider charges the card once', () => {
    const charges = after.all('[data-role="charge"]');
    expect(charges.map((charge) => charge.getAttribute('data-attempt'))).toEqual(['1']);
  });

  test('the retry sends the same key from 8.5 s and gets charge 1 back at 11 s', () => {
    shownFrom(after.one('[data-role="replay"][data-attempt="2"]'), 8.5);
    const replayed = charged(after, 2);
    expect(replayed.getAttribute('data-charge')).toBe('1');
    shownFrom(replayed, 11);
  });

  test('the verdict counts one charge for one order', () => {
    expect(after.one('[data-role="verdict"]').textContent).toContain('one charge');
  });
});
