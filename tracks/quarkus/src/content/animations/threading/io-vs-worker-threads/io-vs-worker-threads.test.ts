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

import { render } from './io-vs-worker-threads.gen.ts';

const LOOP = 13.5;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./io-vs-worker-threads.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 13.5 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('13.5s');
});

test('executor-thread-1 is blocked from 3.4 s to 8.1 s, and only then', () => {
  const blocked = one('[data-role="worker-blocked"]');
  expect(hiddenThroughout(blocked, between(0, 3.3))).toBe(true);
  expect(shownThroughout(blocked, between(3.5, 8.0))).toBe(true);
  expect(hiddenThroughout(blocked, between(8.2, 13.4))).toBe(true);
});

test('A and B wait on the database for the same 3.5 s, at different times', () => {
  expect(shownThroughout(one('[data-role="db-wait"][data-request="A"]'), between(2.7, 6.0))).toBe(
    true,
  );
  expect(hiddenThroughout(one('[data-role="db-wait"][data-request="A"]'), between(6.2, 13.4))).toBe(
    true,
  );
  expect(shownThroughout(one('[data-role="db-wait"][data-request="B"]'), between(4.1, 7.4))).toBe(
    true,
  );
  expect(hiddenThroughout(one('[data-role="db-wait"][data-request="B"]'), between(7.6, 13.4))).toBe(
    true,
  );
});

test('the I/O thread serves C and D while A waits on the database', () => {
  for (const request of ['C', 'D']) {
    const onset = onsetOf(one(`[data-role="io-busy"][data-request="${request}"]`));
    expect(onset).not.toBeNull();
    expect(onset!).toBeGreaterThan(at(2.6));
    expect(onset!).toBeLessThan(at(6.1));
  }
});

test('A gets its response before B', () => {
  expect(opacityAt(one('[data-role="packet"][data-request="A"]'), at(9))).toBe(0);
  expect(opacityAt(one('[data-role="packet"][data-request="B"]'), at(9))).toBe(1);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
