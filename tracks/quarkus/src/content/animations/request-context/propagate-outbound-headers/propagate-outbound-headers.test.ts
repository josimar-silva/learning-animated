import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './propagate-outbound-headers.gen.ts';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./propagate-outbound-headers.svg', import.meta.url), 'utf8');
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
const STORED = {
  A: { 'X-Correlation-Id': '7f3a', 'X-Box-Office': 'web' },
  B: { 'X-Correlation-Id': 'c41e', 'X-Box-Office': 'kiosk' },
} as const;
const REQUESTS = ['A', 'B'] as const;
// When checkout() calls charge(), when the factory runs, and when the provider receives the call.
const STORY = {
  A: { call: 1.5, factory: [3, 5.5], received: 6.5 },
  B: { call: 8.5, factory: [10, 12.5], received: 13.5 },
} as const;

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test("each request's duplicated context holds the values the request filter stored", () => {
  for (const request of REQUESTS) {
    expect(shownThroughout(of('context', request), between(0, 19.9))).toBe(true);
    for (const header of HEADERS)
      expect(of('stored', request, header).textContent?.trim()).toBe(STORED[request][header]);
  }
});

test('checkout() calls the payment provider through the PaymentClient REST client', () => {
  for (const request of REQUESTS) {
    const { call, factory, received } = STORY[request];
    expect(hiddenThroughout(of('call', request), between(0, call - 0.1))).toBe(true);
    expect(shownThroughout(of('call', request), between(call + 0.1, factory[0] - 0.1))).toBe(true);
    expect(hiddenThroughout(of('call', request), between(factory[0] + 0.1, 19.9))).toBe(true);
    expect(hiddenThroughout(of('client-run', request), between(0, factory[0] - 0.1))).toBe(true);
    expect(
      shownThroughout(of('client-run', request), between(factory[0] + 0.1, factory[1] - 0.1)),
    ).toBe(true);
    expect(hiddenThroughout(of('client-run', request), between(factory[1] + 0.1, 19.9))).toBe(true);
    expect(hiddenThroughout(of('received', request), between(0, received - 0.1))).toBe(true);
    expect(shownThroughout(of('received', request), between(received + 0.1, 19.9))).toBe(true);
  }
});

test("the ClientHeadersFactory reads the calling request's context before the call leaves", () => {
  for (const request of REQUESTS) {
    const [start, end] = STORY[request].factory;
    for (const role of ['factory-run', 'get-arrow']) {
      expect(hiddenThroughout(of(role, request), between(0, start - 0.1))).toBe(true);
      expect(shownThroughout(of(role, request), between(start + 0.1, end - 0.1))).toBe(true);
      expect(hiddenThroughout(of(role, request), between(end + 0.1, 19.9))).toBe(true);
    }
    for (const header of HEADERS) {
      expect(hiddenThroughout(of('read-marker', request, header), between(0, start - 0.1))).toBe(
        true,
      );
      expect(
        shownThroughout(of('read-marker', request, header), between(start + 0.1, end - 0.1)),
      ).toBe(true);
      expect(hiddenThroughout(of('read-marker', request, header), between(end + 0.1, 19.9))).toBe(
        true,
      );
    }
    expect(hiddenThroughout(of('received', request), between(0, end))).toBe(true);
  }
});

test('the call carries the stored values as headers', () => {
  for (const request of REQUESTS) {
    const sent = STORED[request];
    expect(of('outgoing', request).textContent?.trim()).toBe(
      `sent ${sent['X-Correlation-Id']}, ${sent['X-Box-Office']}`,
    );
    for (const header of HEADERS)
      expect(of('header', request, header).textContent?.trim()).toBe(`${header}: ${sent[header]}`);
  }
});

test("each call carries its own request's values, even with both calls in flight", () => {
  const [start, end] = STORY.B.factory;
  for (const header of HEADERS) {
    expect(hiddenThroughout(of('read-marker', 'A', header), between(start, end))).toBe(true);
    expect(shownThroughout(of('read-marker', 'B', header), between(start + 0.1, end - 0.1))).toBe(
      true,
    );
  }
  expect(shownThroughout(of('received', 'A'), between(start, end))).toBe(true);
  for (const request of REQUESTS)
    expect(shownThroughout(of('received', request), between(STORY.B.received + 0.1, 19.9))).toBe(
      true,
    );
  const carried = (request: string): string[] =>
    HEADERS.map((header) => of('header', request, header).textContent?.trim().split(': ')[1] ?? '');
  const stored = (request: string): string[] =>
    HEADERS.map((header) => of('stored', request, header).textContent?.trim() ?? '');
  for (const request of REQUESTS) expect(carried(request)).toEqual(stored(request));
  expect(carried('A')).not.toEqual(carried('B'));
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
