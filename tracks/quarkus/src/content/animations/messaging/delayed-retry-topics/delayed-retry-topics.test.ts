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

import { render } from './delayed-retry-topics.gen.ts';

const LOOP = 25;
const FIRST_RETRY = 'ticket-orders_retry_5000';
const SECOND_RETRY = 'ticket-orders_retry_30000';
const DEAD_LETTERS = 'ticket-orders-dlq';
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./delayed-retry-topics.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment;
};
const delivery = (record: number, attempt: number): string =>
  `[data-record="${record}"][data-delivery="${attempt}"]`;
const token = (record: number, attempt: number): Element =>
  one(`[data-role="token"]${delivery(record, attempt)}`);
const response = (record: number, attempt: number): Element =>
  one(`[data-role="response"]${delivery(record, attempt)}`);
const verdict = (record: number, attempt: number): Element =>
  one(`[data-role="verdict"]${delivery(record, attempt)}`);
const parked = (topic: string): Element => one(`[data-role="parked"][data-topic="${topic}"]`);
const committed = (offset: number): Element =>
  one(`[data-role="committed"][data-offset="${offset}"]`);
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 25 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('25s');
});

test('the channel retries through two delayed topics, then dead-letters', () => {
  const config = one('[data-role="config"]').textContent;
  expect(config).toContain('failure-strategy=delayed-retry-topic');
  expect(config).toContain(`delayed-retry-topic.topics=${FIRST_RETRY},`);
  expect(config).toContain(SECOND_RETRY);
  expect(config).toContain(`dead-letter-queue.topic=${DEAD_LETTERS}`);
});

test('record 3 fails and moves to the first retry topic, and its offset is committed', () => {
  expect(response(3, 1).getAttribute('data-status')).toBe('503');
  const nacked = verdict(3, 1);
  expect(nacked.getAttribute('data-verdict')).toBe('nacked');
  expect(shownThroughout(nacked, between(2.6, 3.9))).toBe(true);
  const waiting = parked(FIRST_RETRY);
  expect(hiddenThroughout(waiting, between(0, 3.9))).toBe(true);
  expect(shownThroughout(waiting, between(4.1, 11.4))).toBe(true);
  expect(onset(waiting)).toBeGreaterThan(onset(nacked));
  expect(shownThroughout(committed(3), between(0, 3.9))).toBe(true);
  expect(hiddenThroughout(committed(3), between(4.1, 24.9))).toBe(true);
  expect(onset(committed(4))).toBe(onset(waiting));
  expect(onset(committed(4))).toBeLessThan(onset(token(4, 1)));
});

test('records 4 and 5 are acked while record 3 waits out its delay', () => {
  const waiting = parked(FIRST_RETRY);
  const wait = one(`[data-role="delay"][data-topic="${FIRST_RETRY}"]`);
  expect(shownThroughout(wait, between(4.1, 11.4))).toBe(true);
  for (const record of [4, 5]) {
    expect(response(record, 1).getAttribute('data-status')).toBe('200');
    const acked = verdict(record, 1);
    expect(acked.getAttribute('data-verdict')).toBe('acked');
    expect(onset(token(record, 1))).toBeGreaterThan(onset(waiting));
    expect(opacityAt(waiting, onset(acked))).toBe(1);
  }
  expect(shownThroughout(committed(6), between(10.6, 24.9))).toBe(true);
  expect(onset(token(3, 2))).toBeGreaterThan(onset(verdict(5, 1)));
});

test('when the retry topics run out, record 3 lands on ticket-orders-dlq', () => {
  const firstRetry = verdict(3, 2);
  const secondRetry = verdict(3, 3);
  expect(firstRetry.getAttribute('data-verdict')).toBe('nacked');
  expect(secondRetry.getAttribute('data-verdict')).toBe('nacked');
  expect(svg.querySelectorAll('[data-role="token"][data-record="3"]')).toHaveLength(3);
  const second = parked(SECOND_RETRY);
  expect(hiddenThroughout(second, between(0, 14.9))).toBe(true);
  expect(shownThroughout(second, between(15.1, 17.9))).toBe(true);
  expect(hiddenThroughout(second, between(18.1, 24.9))).toBe(true);
  const dead = parked(DEAD_LETTERS);
  expect(hiddenThroughout(dead, between(0, 21.4))).toBe(true);
  expect(shownThroughout(dead, between(21.6, 24.9))).toBe(true);
  const path = [parked(FIRST_RETRY), firstRetry, second, secondRetry, dead].map(onset);
  path.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(path[i]!));
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
