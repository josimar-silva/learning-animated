import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { describe, expect, test } from 'vitest';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'consumer' | 'producer'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./consumer-producer-interceptors.${name}.svg`, import.meta.url), 'utf8'),
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

const consumer = load('consumer');
const producer = load('producer');

const textOf = (el: Element): string => el.textContent.trim().split(/\s+/).join(' ');

// The texts a view shows at a moment, among the elements the selector matches.
const shownAt = (view: View, selector: string, seconds: number): string[] =>
  view
    .all(selector)
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map(textOf);

// Shown from `from` to `to`, and hidden for the rest of the loop.
const runsBetween = (el: Element, from: number, to: number): void => {
  expect(hiddenThroughout(el, between(0, from - 0.1))).toBe(true);
  expect(shownThroughout(el, between(from + 0.1, to - 0.1))).toBe(true);
  expect(hiddenThroughout(el, between(to + 0.1, LOOP - 0.1))).toBe(true);
};

// Hidden until the moment, then shown until the story clears at 19.5 s.
const appearsAt = (el: Element, seconds: number): void => runsBetween(el, seconds, 19.5);

const callback = (view: View, name: string, offset?: string): Element =>
  view.one(
    `[data-role="callback"][data-callback="${name}"]${offset ? `[data-offset="${offset}"]` : ''}`,
  );

describe.each([
  ['consumer', consumer],
  ['producer', producer],
] as const)('the %s view', (_name, view) => {
  test('one story lasts 20 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('20s');
  });

  test('the interceptor is bound to the ticket-orders channel', () => {
    expect(textOf(view.one('[data-role="interceptor"]'))).toContain('@Identifier("ticket-orders")');
  });

  test('exactly one caption shows at any moment', () => {
    for (let seconds = 0.25; seconds < LOOP; seconds += 0.5) {
      expect(shownAt(view, '[data-role="caption"]', seconds)).toHaveLength(1);
    }
  });

  test('the log clears before the loop restarts', () => {
    expect(shownAt(view, '[data-role="log-entry"]', 19.7)).toEqual([]);
  });
});

describe('consumer: an IncomingInterceptor around charge(order)', () => {
  // The callbacks that run for one record, in document order.
  const callbacksFor = (offset: string): (string | null)[] =>
    consumer
      .all(`[data-role="callback"][data-offset="${offset}"]`)
      .map((el) => el.getAttribute('data-callback'));

  test('the interceptor offers the three IncomingInterceptor callbacks', () => {
    expect(consumer.all('[data-role="row"]').map(textOf)).toEqual([
      'afterMessageReceive',
      'onMessageAck',
      'onMessageNack',
    ]);
  });

  test('afterMessageReceive runs before charge(order) gets each record', () => {
    runsBetween(callback(consumer, 'afterMessageReceive', '44'), 2, 4);
    runsBetween(consumer.one('[data-role="method-run"][data-offset="44"]'), 4.5, 6.5);
    runsBetween(callback(consumer, 'afterMessageReceive', '45'), 11, 12.5);
    runsBetween(consumer.one('[data-role="method-run"][data-offset="45"]'), 13, 14);
  });

  test('charge(order) returns for offset 44, so onMessageAck runs once the connector has acked it', () => {
    const outcome = consumer.one('[data-role="outcome"][data-offset="44"]');
    expect(textOf(outcome)).toBe('returns');
    runsBetween(outcome, 6.5, 9.5);
    const status = consumer.one('[data-role="status"][data-offset="44"]');
    expect(textOf(status)).toBe('acked');
    appearsAt(status, 7.5);
    runsBetween(callback(consumer, 'onMessageAck', '44'), 8, 9.5);
    expect(callbacksFor('44')).toEqual(['afterMessageReceive', 'onMessageAck']);
  });

  test('charge(order) throws for offset 45, so onMessageNack runs once 45 is on ticket-orders-dlq', () => {
    const outcome = consumer.one('[data-role="outcome"][data-offset="45"]');
    expect(textOf(outcome)).toBe('CardGateway 503 throws');
    appearsAt(outcome, 14);
    const status = consumer.one('[data-role="status"][data-offset="45"]');
    expect(textOf(status)).toBe('DLQ');
    appearsAt(status, 15);
    runsBetween(callback(consumer, 'onMessageNack', '45'), 15.5, 17.5);
    const failure = consumer.one('[data-role="failure"]');
    expect(textOf(failure)).toBe('CardGateway 503');
    appearsAt(failure, 15.5);
    expect(callbacksFor('45')).toEqual(['afterMessageReceive', 'onMessageNack']);
  });

  test('the log lists every call in the order it ran', () => {
    const entries = consumer.all('[data-role="log-entry"]');
    expect(entries.map((entry) => entry.getAttribute('data-call'))).toEqual([
      'afterMessageReceive',
      'charge',
      'onMessageAck',
      'afterMessageReceive',
      'charge',
      'onMessageNack',
    ]);
    [2, 6, 8, 11, 14, 15.5].forEach((seconds, i) => appearsAt(entries[i]!, seconds));
    expect(textOf(entries[0]!)).toContain('offset 44, X-Correlation-Id 9b2e');
    expect(textOf(entries[3]!)).toContain('offset 45, X-Correlation-Id 5d07');
    expect(textOf(entries[5]!)).toContain('CardGateway 503');
  });
});

describe('producer: an OutgoingInterceptor around the send', () => {
  test('the interceptor offers the three OutgoingInterceptor callbacks', () => {
    expect(producer.all('[data-role="row"]').map(textOf)).toEqual([
      'beforeMessageSend',
      'onMessageAck',
      'onMessageNack',
    ]);
  });

  test('beforeMessageSend adds X-Correlation-Id before the record leaves', () => {
    runsBetween(callback(producer, 'beforeMessageSend'), 2, 5);
    const header = producer.one('[data-role="message"] [data-role="header"]');
    expect(textOf(header)).toBe('X-Correlation-Id 9b2e');
    runsBetween(header, 3, 6.5);
    runsBetween(producer.one('[data-role="send"]'), 5, 6.5);
  });

  test('the broker writes order 42 at offset 44, header included', () => {
    const written = producer.one('[data-role="written"][data-offset="44"]');
    expect(textOf(written)).toContain('order 42');
    expect(textOf(written)).toContain('X-Correlation-Id 9b2e');
    appearsAt(written, 6.5);
  });

  test('onMessageAck runs only after the broker confirms the write', () => {
    runsBetween(producer.one('[data-role="ack"]'), 8, 9.5);
    runsBetween(callback(producer, 'onMessageAck'), 10, 12.5);
  });

  test('onMessageAck reads partition 0, offset 44 from OutgoingMessageMetadata', () => {
    const metadata = producer.one('[data-role="metadata"]');
    expect(textOf(metadata)).toContain('partition 0, offset 44');
    appearsAt(metadata, 10);
  });

  test('onMessageNack never runs, because the send succeeds', () => {
    expect(producer.all('[data-role="callback"][data-callback="onMessageNack"]')).toEqual([]);
  });

  test('the log lists every call in the order it ran', () => {
    const entries = producer.all('[data-role="log-entry"]');
    expect(entries.map((entry) => entry.getAttribute('data-call'))).toEqual([
      'checkout',
      'beforeMessageSend',
      'onMessageAck',
    ]);
    [0.5, 3, 10].forEach((seconds, i) => appearsAt(entries[i]!, seconds));
    expect(textOf(entries[1]!)).toContain('X-Correlation-Id 9b2e');
    expect(textOf(entries[2]!)).toContain('partition 0, offset 44');
  });
});
