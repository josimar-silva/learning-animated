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

import { render } from './echo-response-headers.gen.ts';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./echo-response-headers.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
type Request = 'A' | 'B';
const of = (role: string, request: Request): Element =>
  one(`[data-role="${role}"][data-request="${request}"]`);
const none = (role: string, request: Request): Element | null =>
  svg.querySelector(`[data-role="${role}"][data-request="${request}"]`);
const echoOn = (request: Request): Element => {
  const echo = of('response', request).querySelector('[data-role="echo"]');
  if (!echo) throw new Error(`the response to ${request} has no echo`);
  return echo;
};
const words = (el: Element): string | undefined => el.textContent?.trim();
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('A and B each send their own X-Correlation-Id', () => {
  expect(words(of('sent', 'A'))).toBe('X-Correlation-Id: 7f3a');
  expect(words(of('sent', 'B'))).toBe('X-Correlation-Id: c41e');
});

test("the response filter runs on A's 200 OK after checkout() returns, before the caller gets it", () => {
  expect(of('response', 'A').getAttribute('data-status')).toBe('200');
  expect(onsetOf(of('endpoint-return', 'A'))).toBe(at(2.5));
  expect(hiddenThroughout(of('response', 'A'), between(0, 2.4))).toBe(true);
  expect(shownThroughout(of('response', 'A'), between(2.6, 19.9))).toBe(true);
  expect(hiddenThroughout(of('filter-run', 'A'), between(0, 3.9))).toBe(true);
  expect(shownThroughout(of('filter-run', 'A'), between(4.1, 6.4))).toBe(true);
  expect(hiddenThroughout(of('filter-run', 'A'), between(6.6, 19.9))).toBe(true);
  expect(hiddenThroughout(of('received', 'A'), between(0, 7.4))).toBe(true);
  expect(shownThroughout(of('received', 'A'), between(7.6, 19.9))).toBe(true);
});

test("the filter copies X-Correlation-Id from A's request onto the 200 OK", () => {
  expect(words(echoOn('A'))).toBe(words(of('sent', 'A')));
  expect(words(of('echo-writing', 'A'))).toBe(words(of('sent', 'A')));
  expect(hiddenThroughout(of('echo-writing', 'A'), between(0, 4.9))).toBe(true);
  expect(shownThroughout(of('echo-writing', 'A'), between(5.1, 6.4))).toBe(true);
  expect(shownThroughout(of('header-read', 'A'), between(5.1, 6.4))).toBe(true);
  expect(hiddenThroughout(echoOn('A'), between(0, 6.4))).toBe(true);
  expect(shownThroughout(echoOn('A'), between(6.6, 19.9))).toBe(true);
});

test('no exception mapper runs for A', () => {
  expect(none('mapper-run', 'A')).toBeNull();
  expect(shownThroughout(of('mapper-skip', 'A'), between(2.6, 19.9))).toBe(true);
});

test('checkout() throws SeatAlreadyTaken for B and never returns', () => {
  const thrown = of('exception', 'B');
  expect(words(thrown)).toBe('SeatAlreadyTaken');
  expect(hiddenThroughout(thrown, between(0, 9.9))).toBe(true);
  expect(shownThroughout(thrown, between(10.1, 12.4))).toBe(true);
  expect(hiddenThroughout(thrown, between(12.6, 19.9))).toBe(true);
  expect(onsetOf(of('endpoint-throw', 'B'))).toBe(at(10));
  expect(none('endpoint-return', 'B')).toBeNull();
});

test('the exception mapper turns SeatAlreadyTaken into the 409 Conflict for B', () => {
  expect(hiddenThroughout(of('mapper-run', 'B'), between(0, 12.4))).toBe(true);
  expect(shownThroughout(of('mapper-run', 'B'), between(12.6, 13.4))).toBe(true);
  expect(hiddenThroughout(of('mapper-run', 'B'), between(13.6, 19.9))).toBe(true);
  expect(of('response', 'B').getAttribute('data-status')).toBe('409');
  expect(onsetOf(of('response', 'B'))).toBe(onsetOf(of('mapper-run', 'B')));
});

test("the response filter also runs on the mapper's 409 and copies B's X-Correlation-Id onto it", () => {
  expect(onsetOf(of('filter-run', 'B'))!).toBeGreaterThan(onsetOf(of('mapper-run', 'B'))!);
  expect(shownThroughout(of('filter-run', 'B'), between(14.6, 16.4))).toBe(true);
  expect(shownThroughout(of('echo-writing', 'B'), between(15.1, 16.4))).toBe(true);
  expect(shownThroughout(of('header-read', 'B'), between(15.1, 16.4))).toBe(true);
  expect(words(echoOn('B'))).toBe(words(of('sent', 'B')));
  expect(hiddenThroughout(echoOn('B'), between(0, 16.4))).toBe(true);
  expect(shownThroughout(echoOn('B'), between(16.6, 19.9))).toBe(true);
  expect(hiddenThroughout(of('received', 'B'), between(0, 17.4))).toBe(true);
  expect(shownThroughout(of('received', 'B'), between(17.6, 19.9))).toBe(true);
});

test('each caller gets back the id it sent', () => {
  for (const request of ['A', 'B'] as const) {
    expect(words(echoOn(request))).toBe(words(of('sent', request)));
    expect(hiddenThroughout(of('same-id', request), between(0, 17.4))).toBe(true);
    expect(shownThroughout(of('same-id', request), between(17.6, 19.9))).toBe(true);
  }
  expect(words(echoOn('A'))).not.toBe(words(echoOn('B')));
});

test('the filter reads the header from the request and puts it on the response', () => {
  const code = words(one('[data-role="filter-code"]'));
  expect(code).toContain('@ServerResponseFilter');
  expect(code).toContain('request.getHeaderString("X-Correlation-Id")');
  expect(code).toContain('response.getHeaders().putSingle("X-Correlation-Id", id)');
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
