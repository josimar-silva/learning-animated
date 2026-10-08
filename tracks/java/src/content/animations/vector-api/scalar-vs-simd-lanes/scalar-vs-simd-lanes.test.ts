import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './scalar-vs-simd-lanes.gen.ts';

const LOOP = 20;
const D = 8;
const LANES = [0, 1, 2, 3] as const;
// Both loops start at 2 s and take one step every 1.5 s.
const stepFrom = (step: number): number => 2 + 1.5 * step;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./scalar-vs-simd-lanes.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const fixed = (n: number): string => n.toFixed(2);
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// The doubles an array's cells hold, index 0 first.
const elements = (vector: string): number[] =>
  all(`[data-role="element"][data-vector="${vector}"]`).map((cell) => Number(textOf(cell)));

// The one text among the matches that shows at a moment, or null when none does.
const shownAt = (selector: string, seconds: number): string | null => {
  const shown = all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);
  if (shown.length > 1) throw new Error(`${shown.length} of ${selector} show at ${seconds} s`);
  return shown[0] ? textOf(shown[0]) : null;
};
const statusAt = (side: string, seconds: number): string | null =>
  shownAt(`[data-role="status"][data-side="${side}"]`, seconds);
const scalarAccAt = (seconds: number): string | null =>
  shownAt('[data-role="acc"][data-side="scalar"]', seconds);
const laneAt = (register: string, lane: number, seconds: number): string | null =>
  shownAt(`[data-role="lane-value"][data-register="${register}"][data-lane="${lane}"]`, seconds);
const chunkAt = (register: string, seconds: number): string | null =>
  shownAt(`[data-role="chunk"][data-register="${register}"]`, seconds);
const ringsShownAt = (selector: string, seconds: number): Element[] =>
  all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);

// Shown for one step, from its start, and hidden for the rest of the loop.
const expectShownOnlyDuring = (el: Element, from: number, to: number): void => {
  expect(hiddenThroughout(el, between(0, from - 0.05))).toBe(true);
  expect(shownThroughout(el, between(from + 0.05, to - 0.05))).toBe(true);
  expect(hiddenThroughout(el, between(to + 0.05, LOOP - 0.05))).toBe(true);
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('q and v1 are the series embeddings, 8 doubles each, and q · v1 = 1.44', () => {
  for (const vector of ['q', 'v1']) {
    const cells = all(`[data-role="element"][data-vector="${vector}"]`);
    expect(cells.map((cell) => cell.getAttribute('data-index'))).toEqual(
      [...Array(D).keys()].map(String),
    );
    cells.forEach((cell) => expect(shownThroughout(cell, between(0, 19.95))).toBe(true));
  }
  expect(elements('q')).toEqual([-0.6, 0.3, 0.7, 0.9, -0.2, 0.6, 0.3, -0.1]);
  expect(elements('v1')).toEqual([-0.3, -0.2, 0.6, 0.5, 0.2, 0.5, 0.5, -0.4]);
  const [q, v1] = [elements('q'), elements('v1')];
  expect(fixed(q.reduce((sum, x, i) => sum + x * v1[i]!, 0))).toBe('1.44');
});

test('the scalar loop does one multiply-add per step, index 0 to 7, from 2 s to 14 s', () => {
  const [q, v1] = [elements('q'), elements('v1')];
  expect(scalarAccAt(1.95)).toBe('0.00');
  expect(statusAt('scalar', 1.95)).toBeNull();
  let acc = 0;
  for (let k = 0; k < D; k += 1) {
    const [from, to] = [stepFrom(k), stepFrom(k + 1)];
    expectShownOnlyDuring(one(`[data-role="pair"][data-index="${k}"]`), from, to);
    const madd = one(`[data-role="madd"][data-index="${k}"]`);
    expect(textOf(madd)).toBe(`= ${fixed(acc)} + ${q[k]} × ${v1[k]}`);
    expectShownOnlyDuring(madd, from, to);
    acc += q[k]! * v1[k]!;
    expect(scalarAccAt(from + 0.75)).toBe(fixed(acc));
    expect(statusAt('scalar', from + 0.75)).toBe(`step ${k + 1} of 8`);
  }
  // One pair at a time: exactly one ring while the loop runs, and none before or after it.
  for (let t = 0.1; t < LOOP; t += 0.25) {
    const rings = ringsShownAt('[data-role="pair"]', t).length;
    expect(rings, `pair rings at ${t} s`).toBe(t > 2 && t < 14 ? 1 : 0);
  }
});

test('a 256-bit DoubleVector holds four lanes of 64-bit doubles', () => {
  const species = textOf(one('[data-role="species"]'));
  expect(species).toBe('S = DoubleVector.SPECIES_256: 4 × 64 bits');
  const bits = Number(species.split('SPECIES_')[1]?.split(':')[0]);
  for (const register of ['a', 'b', 'acc']) {
    const lanes = all(`[data-role="lane"][data-register="${register}"]`);
    expect(lanes.map((lane) => lane.getAttribute('data-lane'))).toEqual(LANES.map(String));
    expect(lanes).toHaveLength(bits / 64);
  }
});

test('each vector step loads 4 doubles of q and v1, and fma() multiplies and adds all 4 lanes', () => {
  const [q, v1] = [elements('q'), elements('v1')];
  for (const lane of LANES) {
    expect(laneAt('a', lane, 1.95)).toBeNull();
    expect(laneAt('b', lane, 1.95)).toBeNull();
    expect(laneAt('acc', lane, 1.95)).toBe('0.00');
  }
  const acc = [0, 0, 0, 0];
  for (let step = 0; step < 2; step += 1) {
    const [from, to] = [stepFrom(step), stepFrom(step + 1)];
    expectShownOnlyDuring(one(`[data-role="lanes"][data-step="${step + 1}"]`), from, to);
    const k = LANES.length * step;
    const middle = from + 0.75;
    for (const lane of LANES) {
      expect(laneAt('a', lane, middle)).toBe(String(q[k + lane]));
      expect(laneAt('b', lane, middle)).toBe(String(v1[k + lane]));
      acc[lane] = acc[lane]! + q[k + lane]! * v1[k + lane]!;
      expect(laneAt('acc', lane, middle)).toBe(fixed(acc[lane]!));
    }
    expect(chunkAt('a', middle)).toBe(`q[${k}..${k + 3}]`);
    expect(chunkAt('b', middle)).toBe(`v1[${k}..${k + 3}]`);
    expect(statusAt('vector', middle)).toBe(`step ${step + 1} of 2`);
  }
  expect(acc.map(fixed)).toEqual(['0.14', '0.24', '0.57', '0.49']);
});

test('after two steps, reduceLanes(ADD) adds the 4 lanes into one double, 1.44', () => {
  expectShownOnlyDuring(one('[data-role="reduce"]'), 5, 6.5);
  const lanes = LANES.map((lane) => laneAt('acc', lane, 5.75)!);
  expect(lanes).toEqual(['0.14', '0.24', '0.57', '0.49']);
  expect(statusAt('vector', 5.75)).toBe(`${lanes.join(' + ')} = 1.44`);
  // The lanes keep their partial sums: reduceLanes reads them and writes one double.
  for (const lane of LANES) expect(laneAt('acc', lane, 19.95)).toBe(lanes[lane]);
  expect(ringsShownAt('[data-role="lanes"]', 5.75)).toHaveLength(0);
});

test('the vector loop is done at 6.5 s, while the scalar loop runs to 14 s, and both get 1.44', () => {
  expect(statusAt('vector', 6.55)).toBe('q · v1 = 1.44 after 2 steps + reduceLanes');
  expect(statusAt('scalar', 7.05)).toBe('step 4 of 8');
  for (const t of [7, 10, 13.95]) {
    expect(ringsShownAt('[data-role="lanes"], [data-role="reduce"]', t)).toHaveLength(0);
    expect(ringsShownAt('[data-role="pair"]', t)).toHaveLength(1);
  }
  expect(statusAt('scalar', 13.95)).toBe('step 8 of 8');
  expect(statusAt('scalar', 14.05)).toBe('q · v1 = 1.44 after 8 steps');
  expect(scalarAccAt(19.95)).toBe('1.44');
  expect(statusAt('vector', 19.95)).toBe('q · v1 = 1.44 after 2 steps + reduceLanes');
  expect(statusAt('scalar', 19.95)).toBe('q · v1 = 1.44 after 8 steps');
  // Eight scalar steps against two fma() steps and one reduction.
  expect(all('[data-role="pair"]')).toHaveLength(8);
  expect(all('[data-role="lanes"]')).toHaveLength(2);
  expect(all('[data-role="reduce"]')).toHaveLength(1);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
