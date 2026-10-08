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

import { render } from './capture-inbound-headers.gen.ts';

const LOOP = 18;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./capture-inbound-headers.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const of = (role: string, request: string, header = ''): Element =>
  one(`[data-role="${role}"][data-request="${request}"]${header && `[data-header="${header}"]`}`);
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

const HEADERS = ['X-Correlation-Id', 'X-Box-Office'] as const;
const SENT = {
  A: { 'X-Correlation-Id': '7f3a', 'X-Box-Office': 'web' },
  B: { 'X-Correlation-Id': 'c41e', 'X-Box-Office': 'kiosk' },
} as const;
const REQUESTS = ['A', 'B'] as const;

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 18 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('18s');
});

test('A and B each arrive with their own X-Correlation-Id and X-Box-Office', () => {
  for (const request of REQUESTS)
    for (const header of HEADERS)
      expect(of('header', request, header).textContent?.trim()).toBe(
        `${header}: ${SENT[request][header]}`,
      );
});

test("the filter reads both of A's headers before checkout() runs for A", () => {
  for (const header of HEADERS)
    expect(shownThroughout(of('header-read', 'A', header), between(1.9, 3.5))).toBe(true);
  expect(shownThroughout(of('filter-run', 'A'), between(1.9, 5.1))).toBe(true);
  expect(hiddenThroughout(of('filter-run', 'A'), between(5.3, 17.9))).toBe(true);
  expect(hiddenThroughout(of('endpoint-run', 'A'), between(0, 5.9))).toBe(true);
  expect(shownThroughout(of('endpoint-run', 'A'), between(6.1, 17.9))).toBe(true);
});

test("the filter reads both of B's headers before checkout() runs for B", () => {
  for (const header of HEADERS)
    expect(shownThroughout(of('header-read', 'B', header), between(7.3, 8.3))).toBe(true);
  expect(shownThroughout(of('filter-run', 'B'), between(7.3, 9.9))).toBe(true);
  expect(hiddenThroughout(of('filter-run', 'B'), between(10.1, 17.9))).toBe(true);
  expect(hiddenThroughout(of('endpoint-run', 'B'), between(0, 10.7))).toBe(true);
  expect(shownThroughout(of('endpoint-run', 'B'), between(10.9, 17.9))).toBe(true);
});

test('every request gets its own duplicated context when it arrives', () => {
  expect(shownThroughout(of('context', 'A'), between(0, 17.9))).toBe(true);
  expect(hiddenThroughout(of('context', 'B'), between(0, 5.9))).toBe(true);
  expect(shownThroughout(of('context', 'B'), between(6.1, 17.9))).toBe(true);
});

test("the filter stores each request's values in that request's duplicated context", () => {
  for (const request of REQUESTS)
    for (const header of HEADERS)
      expect(
        of('context', request)
          .querySelector(`[data-role="stored"][data-header="${header}"]`)
          ?.textContent?.trim(),
      ).toBe(SENT[request][header]);
  for (const header of HEADERS) {
    expect(hiddenThroughout(of('stored', 'A', header), between(0, 5.1))).toBe(true);
    expect(shownThroughout(of('writing', 'A', header), between(3.7, 5.1))).toBe(true);
    expect(shownThroughout(of('stored', 'A', header), between(5.3, 17.9))).toBe(true);
    expect(hiddenThroughout(of('stored', 'B', header), between(0, 9.9))).toBe(true);
    expect(shownThroughout(of('writing', 'B', header), between(8.5, 9.9))).toBe(true);
    expect(shownThroughout(of('stored', 'B', header), between(10.1, 17.9))).toBe(true);
  }
});

test('two requests in flight keep separate values', () => {
  for (const request of REQUESTS)
    expect(shownThroughout(of('packet', request), between(6.1, 17.9))).toBe(true);
  for (const header of HEADERS)
    expect(shownThroughout(of('stored', 'A', header), between(8.4, 10))).toBe(true);
  const held = (request: string): Set<string | undefined> =>
    new Set(
      [
        ...of('context', request).querySelectorAll('[data-role="stored"], [data-role="writing"]'),
      ].map((value) => value.textContent?.trim()),
    );
  for (const request of REQUESTS)
    expect(held(request)).toEqual(new Set(Object.values(SENT[request])));
});

test("each checkout() reads its own request's values, and A reads after B's were stored", () => {
  expect(of('endpoint-read', 'A').textContent?.trim()).toBe('read 7f3a, web');
  expect(of('endpoint-read', 'B').textContent?.trim()).toBe('read c41e, kiosk');
  expect(onsetOf(of('endpoint-read', 'A'))!).toBeGreaterThan(
    onsetOf(of('stored', 'B', 'X-Correlation-Id'))!,
  );
  for (const header of HEADERS) {
    expect(shownThroughout(of('read-marker', 'A', header), between(11.1, 12.5))).toBe(true);
    expect(shownThroughout(of('read-marker', 'B', header), between(13.5, 14.9))).toBe(true);
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
