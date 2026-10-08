import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  opacityAt,
  shownThroughout,
  valueAt,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './embeddings-and-cosine.gen.ts';

const LOOP = 20;
const D = 8;
const STORED = ['v1', 'v2', 'v3'] as const;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./embeddings-and-cosine.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// The doubles an embedding's cells hold, index 0 first.
const elements = (vector: string): number[] =>
  all(`[data-role="element"][data-vector="${vector}"]`).map((cell) => Number(textOf(cell)));
const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const lengthOf = (a: readonly number[]): number => Math.sqrt(dot(a, a));
const fixed = (n: number, digits = 2): string => n.toFixed(digits);
const degrees = (radians: number): number => (radians * 180) / Math.PI;
const cosOf = (deg: number): number => Math.cos((deg * Math.PI) / 180);

const arrow = (vector: string): Element => one(`[data-role="arrow"][data-vector="${vector}"]`);
const shaft = (vector: string): number[] => {
  const line = arrow(vector).querySelector('line');
  if (!line) throw new Error(`the ${vector} arrow has no line`);
  return ['x1', 'y1', 'x2', 'y2'].map((name) => Number(line.getAttribute(name)));
};
// Degrees counterclockwise from the x axis, on a stage whose y axis points down.
const direction = (vector: string): number => {
  const [x1, y1, x2, y2] = shaft(vector) as [number, number, number, number];
  return degrees(Math.atan2(y1 - y2, x2 - x1));
};
const angleFromQ = (vector: string): number => Math.abs(direction(vector) - direction('q'));

// The one text among the matches that shows at a moment, or null when none does.
const shownAt = (selector: string, seconds: number): string | null => {
  const shown = all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);
  if (shown.length > 1) throw new Error(`${shown.length} of ${selector} show at ${seconds} s`);
  return shown[0] ? textOf(shown[0]) : null;
};
const sumAt = (seconds: number): string | null => shownAt('[data-role="sum"]', seconds);
const angleLabelAt = (vector: string, seconds: number): string | null =>
  shownAt(`[data-role="angle-label"][data-vector="${vector}"]`, seconds);

const row = (vector: string): Element => one(`[data-role="score"][data-vector="${vector}"]`);
const part = (vector: string, role: string): Element => {
  const found = row(vector).querySelector(`[data-role="${role}"]`);
  if (!found) throw new Error(`the ${vector} score row has no ${role}`);
  return found;
};
const scoreOf = (vector: string): number => Number(textOf(part(vector, 'score-value')));

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('q and v1 are embeddings of D = 8 doubles, one cell per index from 0 to 7', () => {
  for (const vector of ['q', 'v1']) {
    const cells = all(`[data-role="element"][data-vector="${vector}"]`);
    expect(cells.map((cell) => cell.getAttribute('data-index'))).toEqual(
      [...Array(D).keys()].map(String),
    );
    const lefts = cells.map((cell) => Number(cell.querySelector('rect')?.getAttribute('x')));
    lefts.slice(1).forEach((left, i) => expect(left).toBeGreaterThan(lefts[i]!));
    expect(elements(vector).every((value) => Number.isFinite(value) && value !== 0)).toBe(true);
    cells.forEach((cell) => expect(shownThroughout(cell, between(0, 19.95))).toBe(true));
  }
});

test('in step 1 q and v1 are arrows from one origin, and the angle θ between them shows from 1 s', () => {
  const origin = shaft('q').slice(0, 2);
  for (const vector of ['q', ...STORED]) expect(shaft(vector).slice(0, 2)).toEqual(origin);
  for (const vector of ['q', 'v1']) {
    expect(shownThroughout(arrow(vector), between(0, 19.95))).toBe(true);
  }
  const theta = one('[data-role="angle"][data-vector="v1"]');
  expect(hiddenThroughout(theta, between(0, 0.95))).toBe(true);
  expect(shownThroughout(theta, between(1.05, 19.95))).toBe(true);
  expect(angleLabelAt('v1', 1.05)).toBe('θ');
});

test('in step 2 the pairs multiply one at a time, index 0 to 7, and the products add up to q · v1', () => {
  const [q, v1] = [elements('q'), elements('v1')];
  expect(sumAt(4.45)).toBeNull();
  let sum = 0;
  for (let i = 0; i < D; i += 1) {
    const turn = 4.5 + 0.5 * i;
    const pair = one(`[data-role="pair"][data-index="${i}"]`);
    expect(hiddenThroughout(pair, between(0, turn - 0.05))).toBe(true);
    expect(shownThroughout(pair, between(turn + 0.05, turn + 0.45))).toBe(true);
    expect(hiddenThroughout(pair, between(turn + 0.55, 19.95))).toBe(true);
    const product = one(`[data-role="product"][data-index="${i}"]`);
    expect(textOf(product)).toBe(fixed(q[i]! * v1[i]!));
    expect(hiddenThroughout(product, between(0, turn - 0.05))).toBe(true);
    expect(shownThroughout(product, between(turn + 0.05, 19.95))).toBe(true);
    sum += q[i]! * v1[i]!;
    expect(sumAt(turn + 0.25)).toBe(i < D - 1 ? `sum = ${fixed(sum)}` : `q · v1 = ${fixed(sum)}`);
  }
  expect(fixed(dot(q, v1))).toBe('1.44');
  expect(sumAt(19.95)).toBe('q · v1 = 1.44');
});

test('in step 3 the dot product over both lengths gives cos θ = 0.80, and θ reads as 37°', () => {
  const [q, v1] = [elements('q'), elements('v1')];
  for (const [vector, values] of [
    ['q', q],
    ['v1', v1],
  ] as const) {
    const length = one(`[data-role="length"][data-vector="${vector}"]`);
    expect(textOf(length)).toBe(
      `|${vector}| = √(${vector} · ${vector}) = ${fixed(lengthOf(values), 1)}`,
    );
    expect(hiddenThroughout(length, between(0, 8.95))).toBe(true);
    expect(shownThroughout(length, between(9.05, 19.95))).toBe(true);
  }
  const formula = one('[data-role="formula"]');
  expect(textOf(formula)).toBe('cos θ = (q · v1) / (|q| × |v1|)');
  expect(hiddenThroughout(formula, between(0, 8.95))).toBe(true);
  expect(shownThroughout(formula, between(9.05, 19.95))).toBe(true);

  const cosine = dot(q, v1) / (lengthOf(q) * lengthOf(v1));
  expect(fixed(cosine)).toBe('0.80');
  const worked = one('[data-role="cosine"]');
  expect(textOf(worked)).toBe(
    `cos θ = ${fixed(dot(q, v1))} / (${fixed(lengthOf(q), 1)} × ${fixed(lengthOf(v1), 1)}) = ${fixed(cosine)}`,
  );
  expect(hiddenThroughout(worked, between(0, 9.95))).toBe(true);
  expect(shownThroughout(worked, between(10.05, 19.95))).toBe(true);

  // The arrows meet at the angle whose cosine the arrays give.
  expect(angleFromQ('v1')).toBeCloseTo(degrees(Math.acos(cosine)), 1);
  expect(angleLabelAt('v1', 9.95)).toBe('θ');
  expect(angleLabelAt('v1', 10.05)).toBe('37°');
  expect(angleLabelAt('v1', 19.95)).toBe('37°');
});

test('v1 gets its score in step 3, and v2 and v3 join with theirs in step 4', () => {
  const joins = { v1: 10, v2: 14.5, v3: 15.5 } as const;
  for (const vector of STORED) {
    const from = joins[vector];
    const shown: Element[] = [row(vector)];
    if (vector !== 'v1') {
      shown.push(arrow(vector), one(`[data-role="angle"][data-vector="${vector}"]`));
    }
    for (const el of shown) {
      expect(hiddenThroughout(el, between(0, from - 0.05))).toBe(true);
      expect(shownThroughout(el, between(from + 0.05, 19.95))).toBe(true);
    }
    // The bar grows for half a second, to the score's share of the track.
    const [bar, track] = [part(vector, 'bar'), part(vector, 'track')];
    const full = Number(track.getAttribute('width'));
    expect(valueAt(bar, 'width', at(from), Number.NaN)).toBe(0);
    expect(valueAt(bar, 'width', at(from + 0.25), Number.NaN)).toBeGreaterThan(0);
    for (const moment of [from + 0.5, 19.95]) {
      expect(valueAt(bar, 'width', at(moment), Number.NaN)).toBeCloseTo(scoreOf(vector) * full, 0);
    }
  }
});

test('a smaller angle from q gives a higher score', () => {
  for (const vector of STORED) {
    expect(textOf(part(vector, 'score-value'))).toBe(fixed(cosOf(angleFromQ(vector))));
    expect(textOf(part(vector, 'score-angle'))).toBe(`${Math.round(angleFromQ(vector))}°`);
  }
  const byAngle = [...STORED].sort((a, b) => angleFromQ(a) - angleFromQ(b));
  expect(byAngle).toEqual(['v2', 'v1', 'v3']);
  const scores = byAngle.map(scoreOf);
  scores.slice(1).forEach((score, i) => expect(score).toBeLessThan(scores[i]!));
  // The rows list the stored vectors by angle, top to bottom, so the bars shrink down the list.
  const tops = byAngle.map((vector) => Number(part(vector, 'track').getAttribute('y')));
  tops.slice(1).forEach((top, i) => expect(top).toBeGreaterThan(tops[i]!));

  const closest = one('[data-role="closest"]');
  expect(closest.getAttribute('data-vector')).toBe(byAngle[0]);
  expect(hiddenThroughout(closest, between(0, 16.95))).toBe(true);
  expect(shownThroughout(closest, between(17.05, 19.95))).toBe(true);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
