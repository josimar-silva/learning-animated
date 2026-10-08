import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { QUERIES, render, STORED } from './dot-product-hotspot.gen.ts';

const LOOP = 20;
const D = 8;
const ROWS = ['q1', 'q2', 'q3', 'q4'] as const;
const COLUMNS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'] as const;
const PAIRS = ROWS.length * COLUMNS.length;
// The query q and the stored vector v1 of the cosine lesson, which this lesson calls q1 and v1.
const COSINE_LESSON = {
  q: [-0.6, 0.3, 0.7, 0.9, -0.2, 0.6, 0.3, -0.1],
  v1: [-0.3, -0.2, 0.6, 0.5, 0.2, 0.5, 0.5, -0.4],
};

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./dot-product-hotspot.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const cosineOf = (a: readonly number[], b: readonly number[]): number =>
  dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));

// Pair n in loop order: the outer loop walks the queries and the inner loop the stored vectors.
const pairOf = (n: number): [query: string, vector: string] => [
  ROWS[Math.floor(n / COLUMNS.length)]!,
  COLUMNS[n % COLUMNS.length]!,
];
// The first dot product runs slowly, from 2 s to 4 s. Every other one takes 0.5 s.
const turnOf = (n: number): [start: number, end: number] =>
  n === 0 ? [2, 4] : [3.5 + 0.5 * n, 4 + 0.5 * n];

// The one text among the matches that shows at a moment, or null when none does.
const shownAt = (selector: string, seconds: number): string | null => {
  const shown = all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);
  if (shown.length > 1) throw new Error(`${shown.length} of ${selector} show at ${seconds} s`);
  return shown[0] ? textOf(shown[0]) : null;
};
const countAt = (of: string, seconds: number): string | null =>
  shownAt(`[data-role="count"][data-of="${of}"]`, seconds);

const cell = (query: string, vector: string): Element =>
  one(`[data-role="score"][data-query="${query}"][data-vector="${vector}"]`);
const part = (el: Element, role: string): Element => {
  const found = el.querySelector(`[data-role="${role}"]`);
  if (!found) throw new Error(`no ${role} in ${el.getAttribute('data-role')}`);
  return found;
};
const codeLine = (code: string): Element => {
  const found = all('[data-role="code"]').find((line) => textOf(line) === code);
  if (!found) throw new Error(`no code line reads ${code}`);
  return found;
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s, and its steps start on whole seconds', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
  for (const step of steps) expect(Number.isInteger(step.at)).toBe(true);
});

test('the loop calls dot() once per pair, and dot() does one multiply-add per double', () => {
  expect(all('[data-role="code"]').map(textOf)).toEqual([
    'for (int i = 0; i < M; i++)',
    'for (int j = 0; j < N; j++)',
    'score[i][j] = dot(q[i], v[j]);',
    'static double dot(double[] a, double[] b) {',
    'double sum = 0;',
    'for (int k = 0; k < D; k++)',
    'sum += a[k] * b[k];',
    'return sum;',
    '}',
  ]);
  // Each loop's body sits to the right of the loop.
  const x = (code: string): number => numberOf(codeLine(code), 'x');
  expect(x('for (int j = 0; j < N; j++)')).toBeGreaterThan(x('for (int i = 0; i < M; i++)'));
  expect(x('score[i][j] = dot(q[i], v[j]);')).toBeGreaterThan(x('for (int j = 0; j < N; j++)'));
  expect(x('sum += a[k] * b[k];')).toBeGreaterThan(x('for (int k = 0; k < D; k++)'));
});

test('the table has a row for each query, q1 to q4, and a column for each stored vector, v1 to v6', () => {
  const rows = all('[data-role="row"]');
  const columns = all('[data-role="column"]');
  expect(rows.map(textOf)).toEqual([...ROWS]);
  expect(columns.map(textOf)).toEqual([...COLUMNS]);
  expect(all('[data-role="score"]')).toHaveLength(PAIRS);
  for (const header of [...rows, ...columns]) {
    expect(shownThroughout(header, between(0, 19.95))).toBe(true);
  }
  // Each cell sits in its query's row and its stored vector's column.
  for (const [r, query] of ROWS.entries()) {
    for (const [c, vector] of COLUMNS.entries()) {
      const slot = part(cell(query, vector), 'slot');
      const [left, top] = [numberOf(slot, 'x'), numberOf(slot, 'y')];
      const [middle, baseline] = [numberOf(columns[c]!, 'x'), numberOf(rows[r]!, 'y')];
      expect(middle).toBeGreaterThan(left);
      expect(middle).toBeLessThan(left + numberOf(slot, 'width'));
      expect(baseline).toBeGreaterThan(top);
      expect(baseline).toBeLessThan(top + numberOf(slot, 'height'));
      expect(shownThroughout(slot, between(0, 19.95))).toBe(true);
    }
  }
});

test('in step 2 the first pair, q1 and v1, takes D = 8 multiply-adds, one every 0.25 s', () => {
  const [start, end] = turnOf(0);
  expect(shownAt('[data-role="k"]', start - 0.05)).toBeNull();
  expect(countAt('dot-products', start - 0.05)).toBe('0');
  expect(countAt('multiply-adds', start - 0.05)).toBe('0');
  for (let k = 0; k < D; k += 1) {
    const moment = start + 0.25 * k + 0.1;
    expect(shownAt('[data-role="k"]', moment)).toBe(`k = ${k}`);
    expect(countAt('multiply-adds', moment)).toBe(String(k + 1));
    expect(countAt('dot-products', moment)).toBe('0');
  }
  expect(shownAt('[data-role="k"]', end + 0.05)).toBeNull();
  const value = part(cell('q1', 'v1'), 'score-value');
  expect(textOf(value)).toBe('0.80');
  expect(hiddenThroughout(value, between(0, end - 0.05))).toBe(true);
  expect(shownThroughout(value, between(end + 0.05, 19.95))).toBe(true);
  expect(countAt('dot-products', end + 0.05)).toBe('1');
});

test('in step 3 the loop takes the pairs one at a time, row by row, and each cell gets its score when its dot product returns', () => {
  for (let n = 0; n < PAIRS; n += 1) {
    const [query, vector] = pairOf(n);
    const [start, end] = turnOf(n);
    // Rings mark the pair's query and stored vector while its dot product runs.
    const pair = one(`[data-role="pair"][data-query="${query}"][data-vector="${vector}"]`);
    const writing = part(cell(query, vector), 'writing');
    for (const el of [pair, writing]) {
      expect(hiddenThroughout(el, between(0, start - 0.05))).toBe(true);
      expect(shownThroughout(el, between(start + 0.05, end - 0.05))).toBe(true);
      expect(hiddenThroughout(el, between(end + 0.05, 19.95))).toBe(true);
    }
    const value = part(cell(query, vector), 'score-value');
    expect(hiddenThroughout(value, between(0, end - 0.05))).toBe(true);
    expect(shownThroughout(value, between(end + 0.05, 19.95))).toBe(true);
    expect(countAt('dot-products', end + 0.05)).toBe(String(n + 1));
  }
});

test("every cell holds the cosine of its query and stored vector, and q1 keeps the cosine lesson's scores", () => {
  expect(QUERIES[0]).toEqual(COSINE_LESSON.q);
  expect(STORED[0]).toEqual(COSINE_LESSON.v1);
  expect(QUERIES).toHaveLength(ROWS.length);
  expect(STORED).toHaveLength(COLUMNS.length);
  for (const [r, query] of ROWS.entries()) {
    for (const [c, vector] of COLUMNS.entries()) {
      const [a, b] = [QUERIES[r]!, STORED[c]!];
      expect([a.length, b.length]).toEqual([D, D]);
      expect(textOf(part(cell(query, vector), 'score-value'))).toBe(cosineOf(a, b).toFixed(2));
    }
  }
  // The cosine lesson drew v1 at 37°, v2 at 20°, and v3 at 70° from q.
  const firstThree = ['v1', 'v2', 'v3'].map((v) => textOf(part(cell('q1', v), 'score-value')));
  expect(firstThree).toEqual(['0.80', '0.94', '0.34']);
});

test('the 24 dot products cost D = 8 multiply-adds each, and from 16 s the k loop is marked as the hotspot', () => {
  for (let n = 1; n <= PAIRS; n += 1) {
    const moment = turnOf(n - 1)[1] + 0.05;
    expect(countAt('dot-products', moment)).toBe(String(n));
    expect(countAt('multiply-adds', moment)).toBe(String(D * n));
  }
  expect(countAt('dot-products', 19.95)).toBe('24');
  expect(countAt('multiply-adds', 19.95)).toBe('192');
  const formulas = {
    'dot-products': '= M × N = 4 × 6',
    'multiply-adds': '= M × N × D = 4 × 6 × 8',
  };
  for (const [of, words] of Object.entries(formulas)) {
    const formula = one(`[data-role="formula"][data-of="${of}"]`);
    expect(textOf(formula)).toBe(words);
    expect(hiddenThroughout(formula, between(0, 15.95))).toBe(true);
    expect(shownThroughout(formula, between(16.05, 19.95))).toBe(true);
  }

  const running = one('[data-role="running"]');
  expect(hiddenThroughout(running, between(0, 1.95))).toBe(true);
  expect(shownThroughout(running, between(2.05, 15.45))).toBe(true);
  expect(hiddenThroughout(running, between(15.55, 19.95))).toBe(true);
  const hotspot = one('[data-role="hotspot"]');
  const label = one('[data-role="hotspot-label"]');
  expect(textOf(label)).toBe('hotspot');
  for (const el of [hotspot, label]) {
    expect(hiddenThroughout(el, between(0, 15.95))).toBe(true);
    expect(shownThroughout(el, between(16.05, 19.95))).toBe(true);
  }
  // Both marks frame the multiply-add line.
  const baseline = numberOf(codeLine('sum += a[k] * b[k];'), 'y');
  for (const box of [running, hotspot]) {
    const top = numberOf(box, 'y');
    expect(top).toBeLessThan(baseline - 10);
    expect(top + numberOf(box, 'height')).toBeGreaterThan(baseline);
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
