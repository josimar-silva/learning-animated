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

import { render } from './batching-into-matmul.gen.ts';

const LOOP = 20;
const D = 8;
const QUERIES = ['q1', 'q2', 'q3'] as const;
const STORED = ['v1', 'v2', 'v3', 'v4'] as const;
const ROWS = [...QUERIES, ...STORED];
// The loop scores the pairs query by query, each query against every stored vector in turn.
const PAIRS = QUERIES.flatMap((q) => STORED.map((v) => [q, v] as const));
const turnOf = (call: number): number => 1 + 0.4 * call;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./batching-into-matmul.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string, root: Element = svg): Element[] => [
  ...root.querySelectorAll(selector),
];
const one = (selector: string, root: Element = svg): Element => {
  const found = root.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const lengthOf = (a: readonly number[]): number => Math.sqrt(dot(a, a));
const fixed = (n: number, digits = 2): string => n.toFixed(digits);
const cosine = (a: readonly number[], b: readonly number[]): number =>
  dot(a, b) / (lengthOf(a) * lengthOf(b));

const cells = (row: string): Element[] =>
  all(`[data-role="row"][data-vector="${row}"] [data-role="element"]`);
const valuesOf = (row: string, role: 'raw' | 'unit'): Element[] =>
  all(`[data-role="row"][data-vector="${row}"] [data-role="${role}"]`);
// The doubles a row holds before batching, index 0 first.
const raw = (row: string): number[] => valuesOf(row, 'raw').map((el) => Number(textOf(el)));
const unitRow = (row: string): number[] => raw(row).map((x) => x / lengthOf(raw(row)));

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
const boxOf = (el: Element): Box => {
  const [x, y, width, height] = ['x', 'y', 'width', 'height'].map((name) =>
    Number(el.getAttribute(name)),
  ) as [number, number, number, number];
  return { x, y, width, height };
};
const contains = (outer: Box, inner: Box): boolean =>
  outer.x < inner.x &&
  outer.y < inner.y &&
  outer.x + outer.width > inner.x + inner.width &&
  outer.y + outer.height > inner.y + inner.height;
const holds = (outer: Box, { x, y }: Point): boolean =>
  outer.x < x && x < outer.x + outer.width && outer.y < y && y < outer.y + outer.height;
const rowBox = (row: string): Box => boxOf(cells(row)[0]!);

const call = (q: string, v: string): Element =>
  one(`[data-role="call"][data-query="${q}"][data-vector="${v}"]`);
const score = (q: string, v: string): Element =>
  one(`[data-role="score"][data-query="${q}"][data-vector="${v}"]`);
// Where a text is anchored, which is inside the cell it labels.
const anchorOf = (el: Element): Point => ({
  x: Number(el.getAttribute('x')),
  y: Number(el.getAttribute('y')),
});
// The cell of C that a score is written in.
const cellOf = (q: string, v: string): Box => {
  const cell = all('rect', one('[data-role="multiply"]'))
    .map(boxOf)
    .find((box) => holds(box, anchorOf(score(q, v))));
  if (!cell) throw new Error(`no cell of C holds the ${q} ${v} score`);
  return cell;
};
// The one text among the matches that shows at a moment, or null when none does.
const shownAt = (selector: string, seconds: number): string | null => {
  const shown = all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);
  if (shown.length > 1) throw new Error(`${shown.length} of ${selector} show at ${seconds} s`);
  return shown[0] ? textOf(shown[0]) : null;
};
const countAt = (table: 'loop' | 'matmul', seconds: number): string | null =>
  shownAt(`[data-role="count"][data-table="${table}"]`, seconds);

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('3 queries and 4 stored vectors are rows of D = 8 doubles, and q1 and v1 are the cosine lesson arrays', () => {
  for (const row of ROWS) {
    expect(cells(row).map((cell) => cell.getAttribute('data-index'))).toEqual(
      [...Array(D).keys()].map(String),
    );
    expect(raw(row)).toHaveLength(D);
    expect(raw(row).every((value) => Number.isFinite(value) && value !== 0)).toBe(true);
    cells(row).forEach((cell) => expect(shownThroughout(cell, between(0, 19.95))).toBe(true));
  }
  expect(raw('q1')).toEqual([-0.6, 0.3, 0.7, 0.9, -0.2, 0.6, 0.3, -0.1]);
  expect(raw('v1')).toEqual([-0.3, -0.2, 0.6, 0.5, 0.2, 0.5, 0.5, -0.4]);
});

test('in step 1 a nested loop makes 12 separate cosine calls, one pair at a time', () => {
  expect(PAIRS).toHaveLength(QUERIES.length * STORED.length);
  expect(countAt('loop', 0.95)).toBeNull();
  PAIRS.forEach(([q, v], n) => {
    const turn = turnOf(n);
    const pair = one(`[data-role="pair"][data-query="${q}"][data-vector="${v}"]`);
    expect(hiddenThroughout(pair, between(0, turn - 0.05))).toBe(true);
    expect(shownThroughout(pair, between(turn + 0.05, turn + 0.35))).toBe(true);
    expect(hiddenThroughout(pair, between(turn + 0.45, 19.95))).toBe(true);
    // The call rings exactly its query's row and its stored vector's row.
    const ringed = all('rect', pair).map((ring) => {
      const inside = ROWS.filter((row) => contains(boxOf(ring), rowBox(row)));
      expect(inside).toHaveLength(1);
      return inside[0];
    });
    expect(ringed).toEqual([q, v]);

    expect(textOf(call(q, v))).toBe(fixed(cosine(raw(q), raw(v))));
    expect(hiddenThroughout(call(q, v), between(0, turn - 0.05))).toBe(true);
    expect(shownThroughout(call(q, v), between(turn + 0.05, 19.95))).toBe(true);
    expect(countAt('loop', turn + 0.2)).toBe(`calls: ${n + 1}`);
  });
  const onsets = PAIRS.map(([q, v]) => onsetOf(call(q, v))!);
  onsets.slice(1).forEach((onset, i) => expect(onset).toBeGreaterThan(onsets[i]!));
  expect(countAt('loop', 19.95)).toBe('calls: 12');
});

test('in step 2 batching packs the queries into A, 3 × 8, and the stored vectors into B, 4 × 8', () => {
  for (const [name, rows] of [
    ['A', QUERIES],
    ['B', STORED],
  ] as const) {
    const matrix = one(`[data-role="matrix"][data-matrix="${name}"]`);
    expect(textOf(matrix)).toBe(name);
    expect(hiddenThroughout(matrix, between(0, 6.45))).toBe(true);
    expect(shownThroughout(matrix, between(6.55, 19.95))).toBe(true);
    // The outline holds its own rows and no others, D cells each.
    const outline = boxOf(one('[data-role="outline"]', matrix));
    const held = ROWS.filter((row) => contains(outline, rowBox(row)));
    expect(held).toEqual([...rows]);
    for (const row of held) {
      cells(row).forEach((cell) => expect(contains(outline, boxOf(cell))).toBe(true));
    }
    const shape = `${held.length} × ${Math.min(...held.map((row) => cells(row).length))}`;
    expect(shape).toBe(`${rows.length} × ${D}`);
    expect(steps[1]!.text).toContain(`${name} (${shape})`);
  }
});

test('then each row is divided by its length, once, so every row has length 1', () => {
  for (const row of ROWS) {
    const length = one(`[data-role="length"][data-vector="${row}"]`);
    expect(textOf(length)).toBe(`÷ ${fixed(lengthOf(raw(row)), 1)}`);
    expect(hiddenThroughout(length, between(0, 7.95))).toBe(true);
    expect(shownThroughout(length, between(8.05, 19.95))).toBe(true);

    const units = valuesOf(row, 'unit');
    expect(units.map(textOf)).toEqual(unitRow(row).map((x) => fixed(x)));
    expect(lengthOf(units.map((el) => Number(textOf(el))))).toBeCloseTo(1, 1);
    for (const el of valuesOf(row, 'raw')) {
      expect(shownThroughout(el, between(0, 7.95))).toBe(true);
      expect(hiddenThroughout(el, between(8.05, 19.95))).toBe(true);
    }
    for (const el of units) {
      expect(hiddenThroughout(el, between(0, 7.95))).toBe(true);
      expect(shownThroughout(el, between(8.05, 19.95))).toBe(true);
    }
  }
});

test('in step 3 one matrix multiply reads A and B and writes all 12 entries of C at once', () => {
  for (const name of ['A', 'B']) {
    const inFlight = one(`[data-role="in-flight"][data-matrix="${name}"]`);
    expect(hiddenThroughout(inFlight, between(0, 11.45))).toBe(true);
    expect(shownThroughout(inFlight, between(11.55, 12.45))).toBe(true);
    expect(hiddenThroughout(inFlight, between(12.55, 19.95))).toBe(true);
  }
  const multiply = one('[data-role="multiply"]');
  expect(onsetOf(multiply)).toBe(at(12));
  expect(all('[data-role="score"]', multiply)).toHaveLength(PAIRS.length);
  for (const [q, v] of PAIRS) {
    expect(hiddenThroughout(score(q, v), between(0, 11.95))).toBe(true);
    expect(shownThroughout(score(q, v), between(12.05, 19.95))).toBe(true);
  }
  expect(countAt('matmul', 11.95)).toBeNull();
  expect(countAt('matmul', 12.05)).toBe('calls: 1');
  expect(countAt('matmul', 19.95)).toBe('calls: 1');
  expect(countAt('loop', 12.05)).toBe('calls: 12');
});

test('C[i][j] = A[i] · B[j], so C is the same score table as the loop, entry for entry', () => {
  for (const [q, v] of PAIRS) {
    expect(textOf(score(q, v))).toBe(fixed(dot(unitRow(q), unitRow(v))));
    expect(textOf(score(q, v))).toBe(textOf(call(q, v)));
    // The two tables share their columns, so equal scores sit one above the other.
    expect(anchorOf(score(q, v)).x).toBe(anchorOf(one('text', call(q, v))).x);
  }
  // q1 meets v1, v2, and v3 at the scores the cosine lesson gave them.
  expect(STORED.slice(0, 3).map((v) => textOf(score('q1', v)))).toEqual(['0.80', '0.94', '0.34']);
});

test('the formula under the rows follows the story: per pair, per row, then one product', () => {
  const formulaAt = (seconds: number): string | null => shownAt('[data-role="formula"]', seconds);
  expect(formulaAt(0.05)).toBe('cos(q, v) = (q · v) / (|q| × |v|), once per pair');
  expect(formulaAt(5.95)).toBe('cos(q, v) = (q · v) / (|q| × |v|), once per pair');
  expect(formulaAt(6.05)).toBe('A[i] = q / |q| and B[j] = v / |v|, once per row');
  expect(formulaAt(10.95)).toBe('A[i] = q / |q| and B[j] = v / |v|, once per row');
  expect(formulaAt(11.05)).toBe('C = A × Bᵀ, so C[i][j] = A[i] · B[j] = cos(q, v)');
  expect(formulaAt(19.95)).toBe('C = A × Bᵀ, so C[i][j] = A[i] · B[j] = cos(q, v)');
});

test("in step 4 each row's maximum names that query's closest stored vector", () => {
  const closest = all('[data-role="closest"]');
  expect(closest.map((el) => el.getAttribute('data-query'))).toEqual([...QUERIES]);
  for (const el of closest) {
    const q = el.getAttribute('data-query')!;
    const scores = STORED.map((v) => Number(textOf(score(q, v))));
    const best = STORED[scores.indexOf(Math.max(...scores))]!;
    expect(el.getAttribute('data-vector')).toBe(best);
    expect(textOf(el)).toBe(best);
    expect(contains(boxOf(one('rect', el)), cellOf(q, best))).toBe(true);
    expect(hiddenThroughout(el, between(0, 16.45))).toBe(true);
    expect(shownThroughout(el, between(16.55, 19.95))).toBe(true);
  }
  // Each query's closest stored vector is a different one.
  expect(closest.map((el) => el.getAttribute('data-vector'))).toEqual(['v2', 'v4', 'v3']);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
