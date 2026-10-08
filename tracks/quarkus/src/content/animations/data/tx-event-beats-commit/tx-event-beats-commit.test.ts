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

// A's transaction is open from 1 s and commits at 7.5 s in both views.
const OPENS = 1;
const COMMITS = 7.5;

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./tx-event-beats-commit.${name}.svg`, import.meta.url), 'utf8'),
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

// The moment an element first shows, in seconds, read from its keyTimes.
const seconds = (el: Element): number => Math.round(onsetOf(el)! * LOOP * 10) / 10;

const transaction = (view: View, state: string): Element =>
  view.one(
    `[data-role="transaction"][data-request="A"][data-tx="confirm"] [data-state="${state}"]`,
  );

const uncommitted = (view: View): Element =>
  view.one('[data-role="tickets-write"] [data-state="open"]');

const code = (view: View, method: string): string[] =>
  view
    .all(`[data-role="code"][data-method="${method}"] text`)
    .map((line) => line.textContent.trim());

describe.each([
  ['before', before],
  ['after', after],
] as const)('the %s view', (_name, view) => {
  test('one story lasts 20 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('20s');
  });

  test('confirm() runs in one transaction, open from 1 s and committed at 7.5 s', () => {
    expect(code(view, 'confirm')[0]).toBe('@Transactional');
    shownOnly(transaction(view, 'open'), OPENS, COMMITS);
    shownFrom(transaction(view, 'committed'), COMMITS);
  });

  test('A issues the tickets at 1 s, writes the event at 3 s, and commits from 5 s', () => {
    const calls = view.all('[data-role="call"][data-request="A"]');
    expect(calls.map((call) => call.getAttribute('data-call'))).toEqual([
      'issue',
      view === before ? 'send' : 'outbox',
      'commit',
    ]);
    calls.forEach((call, i) => shownFrom(call, [1, 3, 5][i]!));
  });

  test('the code highlights each step while it runs, COMMIT included', () => {
    const lines = view.all('[data-role="code-line"][data-request="A"]');
    expect(lines.map((line) => line.getAttribute('data-call'))).toEqual(
      view
        .all('[data-role="call"][data-request="A"]')
        .map((call) => call.getAttribute('data-call')),
    );
    shownOnly(lines[0]!, 1, 3);
    shownOnly(lines[1]!, 3, 5);
    shownOnly(lines[2]!, 5, COMMITS);
  });

  test('the code bracket opens and commits with the transaction it marks', () => {
    const bracket = view.one('[data-role="code-transaction"][data-tx="confirm"]');
    for (const state of ['open', 'committed']) {
      const mark = bracket.querySelector(`[data-state="${state}"]`)!;
      for (let t = 0; t < LOOP; t += 0.25) {
        expect(opacityAt(mark, at(t))).toBe(opacityAt(transaction(view, state), at(t)));
      }
    }
  });

  test("the tickets exist only inside A's transaction until it commits at 7.5 s", () => {
    shownFrom(view.one('[data-role="tickets"][data-state="none"]'), 0);
    shownOnly(uncommitted(view), 1.5, COMMITS);
    for (const committed of view.all('[data-role="tickets"][data-state="committed"]')) {
      expect(hiddenThroughout(committed, between(0, COMMITS - 0.1))).toBe(true);
    }
    shownFrom(view.one('[data-role="tickets"][data-state="committed"]'), COMMITS);
  });

  test('A gets 200 OK at 8 s', () => {
    const response = view.one('[data-role="response"][data-request="A"]');
    expect(response.textContent).toContain('200 OK');
    shownFrom(response, 8);
  });

  test('the mailer looks up the tickets as soon as it gets the event', () => {
    const received = view.one('[data-role="received"][data-actor="mailer"]');
    expect(received.textContent).toContain('TicketsIssued');
    const find = view.one('[data-role="call"][data-actor="mailer"][data-call="find"]');
    expect(seconds(find)).toBe(seconds(received));
    shownFrom(find, seconds(received));
  });

  test('the verdict shows from 14 s until the loop restarts', () => {
    shownFrom(view.one('[data-role="verdict"]'), 14);
  });
});

describe('before: the event is sent inside the transaction', () => {
  test('confirm() sends TicketsIssued with sendAndAwait() before it returns', () => {
    expect(code(before, 'confirm')).toContain(
      'events.sendAndAwait(new TicketsIssued(order.id()));',
    );
    expect(before.all('[data-role="code"][data-method="relay"]')).toEqual([]);
  });

  test('the event is on tickets-issued from 4.5 s, while the transaction is still open', () => {
    const event = before.one('[data-role="event"][data-request="A"]');
    shownFrom(event, 4.5);
    expect(shownThroughout(transaction(before, 'open'), between(4.5, COMMITS - 0.1))).toBe(true);
  });

  test('the mailer gets the event at 5 s, 2.5 s before the commit', () => {
    shownFrom(before.one('[data-role="received"][data-actor="mailer"]'), 5);
  });

  test('its lookup runs while the tickets are uncommitted, so it finds none', () => {
    expect(shownThroughout(uncommitted(before), between(5, 7))).toBe(true);
    const outcome = before.one('[data-role="outcome"][data-actor="mailer"]');
    expect(outcome.textContent).toContain('no tickets');
    shownFrom(outcome, 7);
    expect(seconds(outcome)).toBeLessThan(COMMITS);
  });

  test('nobody emails the tickets, even after they commit', () => {
    expect(before.all('[data-call="email"]')).toEqual([]);
    expect(before.all('[data-actor="relay"]')).toEqual([]);
  });
});

describe('after: an outbox row commits with the tickets, and a relay sends it', () => {
  test('confirm() adds an outbox row instead of sending, and nothing else changes', () => {
    const [beforeLines, afterLines] = [code(before, 'confirm'), code(after, 'confirm')];
    expect(afterLines).toContain('outbox.add(new TicketsIssued(order.id()));');
    expect(afterLines.join('\n')).not.toContain('sendAndAwait');
    expect(afterLines.filter((line, i) => line !== beforeLines[i])).toEqual([
      'outbox.add(new TicketsIssued(order.id()));',
    ]);
  });

  test('the relay is a scheduled method that sends each unsent row, then marks it', () => {
    const relay = code(after, 'relay');
    expect(relay[0]).toBe('@Scheduled(every = "2s")');
    const send = relay.indexOf('events.sendAndAwait(row.event());');
    expect(send).toBeGreaterThan(0);
    expect(relay.indexOf('outbox.markSent(row);')).toBe(send + 1);
  });

  test("the outbox row is written inside A's open transaction", () => {
    expect(after.one('[data-role="tickets-write"]').getAttribute('data-outbox')).toBe('written');
    const outbox = after.one('[data-role="call"][data-request="A"][data-call="outbox"]');
    expect(shownThroughout(transaction(after, 'open'), between(seconds(outbox), 5))).toBe(true);
  });

  test('the relay polls every 2 s, and its poll during the commit finds nothing', () => {
    const polls = after.all('[data-role="call"][data-actor="relay"][data-call="poll"]');
    expect(polls.map(seconds)).toEqual([2, 4, 6, 10, 12]);
    expect(shownThroughout(uncommitted(after), between(6, 7))).toBe(true);
    expect(shownThroughout(transaction(after, 'open'), between(6, 7))).toBe(true);
  });

  test('the relay sends the event at 8 s, the first poll after the commit', () => {
    const send = after.one('[data-role="call"][data-actor="relay"][data-call="send"]');
    shownFrom(send, 8);
    expect(seconds(send)).toBeGreaterThan(COMMITS);
    shownOnly(after.one('[data-role="code-line"][data-actor="relay"][data-call="send"]'), 8, 9.5);
    shownOnly(after.one('[data-role="code-line"][data-actor="relay"][data-call="mark"]'), 9.5, 10);
  });

  test('the row stays unsent until the relay marks it at 10 s', () => {
    shownFrom(
      after.one('[data-role="tickets"][data-state="committed"][data-outbox="unsent"]'),
      COMMITS,
    );
    shownFrom(after.one('[data-role="tickets"][data-state="committed"][data-outbox="sent"]'), 10);
  });

  test('the mailer gets the event at 9.5 s, finds the committed tickets, and emails them', () => {
    shownFrom(after.one('[data-role="received"][data-actor="mailer"]'), 9.5);
    expect(after.all('[data-role="event"]')).toEqual([]);
    shownFrom(after.one('[data-role="call"][data-actor="mailer"][data-call="email"]'), 11.5);
    const outcome = after.one('[data-role="outcome"][data-actor="mailer"]');
    expect(outcome.textContent).toContain('tickets emailed to A');
    shownFrom(outcome, 12.5);
  });
});
