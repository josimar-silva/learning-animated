import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './retry-holds-the-channel.gen.ts';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./retry-holds-the-channel.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const onset = (el: Element): number => {
  const found = onsetOf(el);
  if (found === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return found;
};
const record = (role: string, offset: number): string =>
  `[data-role="${role}"][data-offset="${offset}"]`;
const token = (offset: number): Element => one(record('token', offset));
const request = (offset: number, attempt: number): Element =>
  one(`${record('request', offset)}[data-attempt="${attempt}"]`);
const response = (offset: number, attempt: number): Element =>
  one(`${record('response', offset)}[data-attempt="${attempt}"]`);
const inPartition = (role: string, partition: number, offset: number): Element =>
  one(`${record(role, offset)}[data-partition="${partition}"]`);
const waiting = (partition: number): Element =>
  one(`[data-role="waiting"][data-partition="${partition}"]`);
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// Record 3 is tried from 1.5 s to 10 s, so these are the moments of every attempt and delay.
const ATTEMPTS = between(1.5, 10);

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('charge() reads ticket-orders on a worker thread and retries up to three times', () => {
  const code = one('[data-role="code"]').textContent;
  expect(code).toContain('@Incoming("ticket-orders")');
  expect(code).toContain('@Blocking');
  expect(code).toContain('@Retry(maxRetries = 3, delay = 1000)');
  expect(one('[data-role="consumer"]').textContent?.trim()).toBe('charge(order)');
});

test('charge() calls the payment provider through CardGateway', () => {
  const provider = one('[data-role="payment-provider"]').textContent;
  expect(provider).toContain('payment provider');
  expect(provider).toContain('via CardGateway');
});

test('maxRetries = 3 gives record 3 one call and three retries, and all four get 503', () => {
  expect(all(record('response', 3))).toHaveLength(4);
  expect(all(record('attempt', 3)).map((badge) => badge.textContent?.trim())).toEqual([
    'attempt 1 of 4',
    'attempt 2 of 4',
    'attempt 3 of 4',
    'attempt 4 of 4',
  ]);
  for (const attempt of [1, 2, 3, 4]) {
    expect(response(3, attempt).getAttribute('data-status')).toBe('503');
    expect(response(3, attempt).textContent?.trim()).toBe('503');
    expect(onset(response(3, attempt))).toBeGreaterThan(onset(request(3, attempt)));
  }
});

test('@Retry calls again with the same record, in place, after a delay', () => {
  expect(all(record('token', 3))).toHaveLength(1);
  expect(shownThroughout(token(3), ATTEMPTS)).toBe(true);
  for (const attempt of [1, 2, 3]) {
    const delay = one(`${record('delay', 3)}[data-after="${attempt}"]`);
    expect(onset(delay)).toBeGreaterThan(onset(response(3, attempt)));
    expect(onset(delay)).toBeLessThan(onset(request(3, attempt + 1)));
  }
});

test('the worker thread spends four calls and three delays on record 3 before record 4', () => {
  const calls = all(record('call', 3));
  const delays = all(record('delay', 3));
  expect(calls).toHaveLength(4);
  expect(delays).toHaveLength(3);
  expect(calls.map((call) => call.textContent?.trim())).toEqual(['503', '503', '503', '503']);
  const lastOnRecord3 = Math.max(...[...calls, ...delays].map(onset));
  expect(onset(one(record('call', 4)))).toBeGreaterThan(lastOnRecord3);
});

test('records 4 and 5 wait on partition 0 through every attempt on record 3', () => {
  for (const offset of [4, 5])
    expect(shownThroughout(inPartition('cell', 0, offset), between(0, 19.9))).toBe(true);
  expect(shownThroughout(waiting(0), ATTEMPTS)).toBe(true);
  expect(hiddenThroughout(token(4), between(0, 11.9))).toBe(true);
  expect(svg.querySelector(record('token', 5))).toBeNull();
});

test('partition 1 waits too, though none of its records fails', () => {
  expect(shownThroughout(waiting(1), ATTEMPTS)).toBe(true);
  expect(hiddenThroughout(token(11), between(0, 14.4))).toBe(true);
  expect(
    all('[data-role="response"][data-status="503"]').map((r) => r.getAttribute('data-offset')),
  ).toEqual(['3', '3', '3', '3']);
});

test('new orders pile up on both partitions while record 3 retries', () => {
  for (const [partition, offset] of [
    [0, 6],
    [1, 13],
  ] as const) {
    const appended = inPartition('appended', partition, offset);
    expect(onset(appended)).toBeGreaterThan(at(1.5));
    expect(onset(appended)).toBeLessThan(at(10));
    expect(shownThroughout(appended, between(10, 19.9))).toBe(true);
  }
});

test('the channel moves only after the last attempt on record 3', () => {
  const lastFailure = onset(response(3, 4));
  expect(shownThroughout(inPartition('committed', 0, 3), between(0, 10.9))).toBe(true);
  expect(shownThroughout(inPartition('committed', 1, 11), between(0, 16.4))).toBe(true);
  for (const moved of [
    inPartition('committed', 0, 4),
    inPartition('committed', 1, 12),
    token(4),
    token(11),
  ])
    expect(onset(moved)).toBeGreaterThan(lastFailure);
  for (const partition of [0, 1])
    expect(hiddenThroughout(waiting(partition), between(11.1, 19.9))).toBe(true);
});

test('after the last attempt, record 3 is nacked and lands on ticket-orders-dlq', () => {
  const verdict = one(record('verdict', 3));
  expect(verdict.getAttribute('data-verdict')).toBe('nacked');
  expect(hiddenThroughout(verdict, between(0, 9.9))).toBe(true);
  expect(shownThroughout(verdict, between(10.1, 11.9))).toBe(true);
  expect(one('[data-role="dlq"]').textContent).toContain('ticket-orders-dlq');
  expect(one('[data-role="failure-strategy"]').textContent?.trim()).toBe(
    'failure-strategy=dead-letter-queue',
  );
  const dead = one(record('dead-letter', 3));
  expect(hiddenThroughout(dead, between(0, 10.9))).toBe(true);
  expect(shownThroughout(dead, between(11.1, 19.9))).toBe(true);
  expect(hiddenThroughout(token(3), between(11.1, 19.9))).toBe(true);
});

test('records 4 and 11 then succeed at the first attempt, and both partitions commit', () => {
  for (const offset of [4, 11]) {
    expect(response(offset, 1).getAttribute('data-status')).toBe('200');
    expect(one(record('verdict', offset)).getAttribute('data-verdict')).toBe('acked');
  }
  expect(onset(response(11, 1))).toBeGreaterThan(onset(response(4, 1)));
  expect(shownThroughout(inPartition('committed', 0, 5), between(14.1, 19.9))).toBe(true);
  expect(shownThroughout(inPartition('committed', 1, 12), between(16.6, 19.9))).toBe(true);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
