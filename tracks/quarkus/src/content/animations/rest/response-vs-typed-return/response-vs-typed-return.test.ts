import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './response-vs-typed-return.gen.ts';

type Lane = 'response' | 'typed';

const LOOP = 16;
// Both endpoints are set up first; then three requests arrive, one at each of these moments.
const REQUESTS = [3, 6, 9] as const;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./response-vs-typed-return.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const inLane = (role: string, lane: Lane): Element =>
  one(`[data-role="${role}"][data-lane="${lane}"]`);
// A lane shows its lookup count with one label per value, and exactly one label is visible at a time.
const lookupsAt = (lane: Lane, seconds: number): number => {
  const shown = [...svg.querySelectorAll(`[data-role="lookup-count"][data-lane="${lane}"]`)].filter(
    (count) => opacityAt(count, at(seconds)) === 1,
  );
  expect(shown).toHaveLength(1);
  return Number(shown[0]!.textContent);
};
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 16 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('16s');
});

test('the Response lane looks up a body writer on every request, after the method returns', () => {
  const returned = inLane('result', 'response');
  const lookup = inLane('writer-lookup', 'response');
  const writer = inLane('writer', 'response');
  expect(hiddenThroughout(lookup, between(0, REQUESTS[0]))).toBe(true);
  for (const start of REQUESTS) {
    expect(opacityAt(returned, at(start + 0.6))).toBe(1);
    expect(hiddenThroughout(lookup, between(start, start + 0.9))).toBe(true);
    expect(shownThroughout(lookup, between(start + 1.1, start + 1.55))).toBe(true);
    expect(hiddenThroughout(writer, between(start - 0.3, start + 1.55))).toBe(true);
    expect(shownThroughout(writer, between(start + 1.75, start + 2.4))).toBe(true);
  }
  expect(lookupsAt('response', REQUESTS[0] - 0.2)).toBe(0);
  expect(REQUESTS.map((start) => lookupsAt('response', start + 2.5))).toEqual([1, 2, 3]);
});

test('the TicketResult lane has its writer chosen once, before the first request', () => {
  const lookup = inLane('writer-lookup', 'typed');
  expect(shownThroughout(lookup, between(1.1, 1.9))).toBe(true);
  expect(hiddenThroughout(lookup, between(2.1, LOOP - 0.1))).toBe(true);
  expect(shownThroughout(inLane('writer', 'typed'), between(2.3, LOOP - 0.1))).toBe(true);
  expect(lookupsAt('typed', 0.5)).toBe(0);
  expect(
    [REQUESTS[0] - 0.2, ...REQUESTS.map((start) => start + 2.5)].map((t) => lookupsAt('typed', t)),
  ).toEqual([1, 1, 1, 1]);
});

test('both lanes send the same JSON', () => {
  const bodies = [inLane('json-body', 'response'), inLane('json-body', 'typed')];
  const [response, typed] = bodies.map((body) => body.textContent ?? '');
  expect(response).toBe(typed);
  expect(() => JSON.parse(response!)).not.toThrow();
  for (const body of bodies) {
    expect(hiddenThroughout(body, between(0, REQUESTS[0]))).toBe(true);
    for (const start of REQUESTS) {
      expect(hiddenThroughout(body, between(start + 0.1, start + 1.9))).toBe(true);
      expect(shownThroughout(body, between(start + 2.1, start + 2.9))).toBe(true);
    }
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) =>
    expect(captions.filter((caption) => opacityAt(caption, at(step.at + 0.05)) === 1)).toEqual([
      captions[i],
    ]),
  );
});
