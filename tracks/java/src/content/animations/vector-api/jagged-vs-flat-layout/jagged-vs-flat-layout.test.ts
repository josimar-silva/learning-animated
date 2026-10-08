import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg, tagOf } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  opacityAt,
  shownThroughout,
  valueAt,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './jagged-vs-flat-layout.gen.ts';

const LOOP = 20;
const D = 8;
const ROWS = ['v1', 'v2', 'v3'] as const;
const FLAT = ROWS.length * D;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const range = (n: number): number[] => [...Array(n).keys()];
const text = readFileSync(new URL('./jagged-vs-flat-layout.svg', import.meta.url), 'utf8');
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

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
// The rect that draws a cell or an object: the element itself, or the first rect inside it.
const boxOf = (el: Element): Box => {
  const rect = tagOf(el) === 'rect' ? el : el.querySelector('rect');
  if (!rect) throw new Error('nothing to measure');
  return {
    x: numberOf(rect, 'x'),
    y: numberOf(rect, 'y'),
    width: numberOf(rect, 'width'),
    height: numberOf(rect, 'height'),
  };
};
const contains = (box: Box, [x, y]: readonly [number, number]): boolean =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

// Each heap is drawn in address order, one slot per 8 bytes. Objects span data-size slots from
// data-address, and every cell (a reference or a double) has its own data-address.
const heap = (layout: string): Element => one(`[data-role="heap"][data-layout="${layout}"]`);
const addressOf = (el: Element): number => numberOf(el, 'data-address');
const endOf = (el: Element): number => addressOf(el) + numberOf(el, 'data-size');
const byAddress = (a: Element, b: Element): number => addressOf(a) - addressOf(b);
const objectsIn = (layout: string): Element[] =>
  [...heap(layout).querySelectorAll('[data-size]')].sort(byAddress);
const cellsIn = (layout: string): Element[] =>
  [...heap(layout).querySelectorAll('[data-address]')].filter(
    (el) => !el.hasAttribute('data-size'),
  );
const nameOf = (cell: Element): string => {
  const index = cell.getAttribute('data-index');
  if (cell.getAttribute('data-role') === 'ref') return `stored[${index}]`;
  if (cell.getAttribute('data-layout') === 'flat') return `flat[${index}]`;
  return `${cell.getAttribute('data-vector')}[${index}]`;
};
const jaggedRow = (vector: string): Element[] =>
  all(`[data-role="element"][data-layout="jagged"][data-vector="${vector}"]`);
const pointer = (j: number): Element => one(`[data-role="pointer"][data-index="${j}"]`);
// A pointer runs from its path's first point to its arrowhead's tip.
const endsOf = (el: Element): [[number, number], [number, number]] => {
  const [x, y] = (
    el
      .querySelector('path')
      ?.getAttribute('d')
      ?.match(/-?\d+(?:\.\d+)?/g) ?? []
  ).map(Number);
  const [tipX, tipY] = (el.querySelector('polygon')?.getAttribute('points') ?? '')
    .split(' ')[0]!
    .split(',')
    .map(Number);
  return [
    [x!, y!],
    [tipX!, tipY!],
  ];
};

// The cell the read cursor rings at a moment.
const cursor = (layout: string): Element => one(`[data-role="cursor"][data-layout="${layout}"]`);
const readAt = (layout: string, seconds: number): Element => {
  const ring = cursor(layout);
  const { width, height } = boxOf(ring);
  const center = [
    valueAt(ring, 'x', at(seconds), Number.NaN) + width / 2,
    valueAt(ring, 'y', at(seconds), Number.NaN) + height / 2,
  ] as const;
  const hits = cellsIn(layout).filter((cell) => contains(boxOf(cell), center));
  if (hits.length !== 1) throw new Error(`${hits.length} cells under the cursor at ${seconds} s`);
  return hits[0]!;
};
// A jump is a read that does not land on the address right after the previous read.
const jumpsIn = (reads: readonly Element[]): number =>
  reads.slice(1).filter((cell, i) => addressOf(cell) !== addressOf(reads[i]!) + 1).length;

// The jagged read takes 2 s a row from 3 s: 0.4 s on the reference, then 0.2 s a double.
const rowFrom = (j: number): number => 3 + 2 * j;
const jaggedReads = (): Element[] =>
  ROWS.flatMap((_, j) => [
    readAt('jagged', rowFrom(j) + 0.2),
    ...range(D).map((k) => readAt('jagged', rowFrom(j) + 0.5 + 0.2 * k)),
  ]);
// The flat read takes 0.2 s a double from 13 s.
const flatReads = (): Element[] => range(FLAT).map((i) => readAt('flat', 13.1 + 0.2 * i));

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('stored holds three references, each pointing to its own row of D = 8 doubles', () => {
  const refs = all('[data-role="ref"]');
  expect(refs.map((ref) => ref.getAttribute('data-index'))).toEqual(['0', '1', '2']);
  ROWS.forEach((vector, j) => {
    const cells = jaggedRow(vector);
    expect(cells.map((cell) => cell.getAttribute('data-index'))).toEqual(range(D).map(String));
    expect(pointer(j).getAttribute('data-vector')).toBe(vector);
    const [from, to] = endsOf(pointer(j));
    expect(contains(boxOf(refs[j]!), from)).toBe(true);
    expect(contains(boxOf(cells[0]!), to)).toBe(true);
  });
  const structure = [...refs, ...all('[data-role="row"]'), ...all('[data-role="pointer"]')];
  for (const el of structure) expect(shownThroughout(el, between(0, 19.95))).toBe(true);
});

test('the rows sit apart on the heap, with other objects between them', () => {
  const objects = objectsIn('jagged');
  objects.slice(1).forEach((object, i) => {
    expect(addressOf(object)).toBeGreaterThanOrEqual(endOf(objects[i]!));
  });
  const arrays = objects.filter((object) => object.getAttribute('data-role') !== 'other');
  expect(arrays).toHaveLength(1 + ROWS.length);
  arrays.slice(1).forEach((array, i) => {
    const others = objects.filter(
      (object) =>
        object.getAttribute('data-role') === 'other' &&
        addressOf(object) >= endOf(arrays[i]!) &&
        endOf(object) <= addressOf(array),
    );
    expect(others.length).toBeGreaterThan(0);
  });
});

test('each heap is drawn in address order, left to right and line by line', () => {
  for (const layout of ['jagged', 'flat']) {
    const objects = objectsIn(layout);
    const drawn = [...objects].sort((a, b) => boxOf(a).y - boxOf(b).y || boxOf(a).x - boxOf(b).x);
    expect(drawn.map(addressOf)).toEqual(objects.map(addressOf));
    for (const object of objects.filter((o) => o.getAttribute('data-role') !== 'other')) {
      const cells = cellsIn(layout).filter((cell) => object.contains(cell));
      expect(cells.map(addressOf)).toEqual(range(cells.length).map((i) => addressOf(object) + i));
      expect(cells).toHaveLength(numberOf(object, 'data-size'));
      cells.slice(1).forEach((cell, i) => {
        expect(boxOf(cell).y).toBe(boxOf(cells[i]!).y);
        expect(boxOf(cell).x).toBeGreaterThan(boxOf(cells[i]!).x);
      });
    }
  }
});

test('reading the rows chases pointers: stored[j], then row j, one row at a time', () => {
  const ring = cursor('jagged');
  expect(hiddenThroughout(ring, between(0, 2.95))).toBe(true);
  expect(shownThroughout(ring, between(3.05, 8.95))).toBe(true);
  expect(hiddenThroughout(ring, between(9.05, 19.95))).toBe(true);
  expect(jaggedReads().map(nameOf)).toEqual(
    ROWS.flatMap((vector, j) => [`stored[${j}]`, ...range(D).map((k) => `${vector}[${k}]`)]),
  );
  // While the cursor holds stored[j], the pointer it follows lights up.
  ROWS.forEach((_, j) => {
    const hop = one(`[data-role="hop"][data-index="${j}"]`);
    expect(hop.querySelector('path')?.getAttribute('d')).toBe(
      pointer(j).querySelector('path')?.getAttribute('d'),
    );
    expect(hiddenThroughout(hop, between(0, rowFrom(j) - 0.05))).toBe(true);
    expect(shownThroughout(hop, between(rowFrom(j) + 0.05, rowFrom(j) + 0.35))).toBe(true);
    expect(hiddenThroughout(hop, between(rowFrom(j) + 0.45, 19.95))).toBe(true);
  });
});

test('the jagged read loads 3 references besides the 24 doubles, and jumps 5 times', () => {
  const reads = jaggedReads();
  const references = reads.filter((cell) => cell.getAttribute('data-role') === 'ref').length;
  const doubles = reads.length - references;
  expect([references, doubles, jumpsIn(reads)]).toEqual([3, 24, 5]);
  const summary = one('[data-role="summary"][data-layout="jagged"]');
  expect(textOf(summary)).toBe(
    `${references} reference loads, ${doubles} double loads, ${jumpsIn(reads)} jumps`,
  );
  expect(hiddenThroughout(summary, between(0, 8.95))).toBe(true);
  expect(shownThroughout(summary, between(9.05, 19.95))).toBe(true);
});

test('a flat double[] fills with v1, v2, and v3 back to back, so row j starts at index j × 8', () => {
  const cells = all('[data-role="element"][data-layout="flat"]');
  expect(cells.map((cell) => cell.getAttribute('data-index'))).toEqual(range(FLAT).map(String));
  const lefts = cells.map((cell) => boxOf(cell).x);
  expect(new Set(cells.map((cell) => boxOf(cell).y)).size).toBe(1);
  lefts.slice(1).forEach((left, i) => expect(left - lefts[i]!).toBe(lefts[1]! - lefts[0]!));
  ROWS.forEach((vector, j) => {
    const filled = 10 + 0.5 * j;
    const row = cells.slice(j * D, (j + 1) * D);
    for (const cell of row) {
      expect(cell.getAttribute('data-vector')).toBe(vector);
      expect(hiddenThroughout(cell, between(0, filled - 0.05))).toBe(true);
      expect(shownThroughout(cell, between(filled + 0.05, 19.95))).toBe(true);
    }
    const start = one(`[data-role="row-start"][data-vector="${vector}"]`);
    const first = boxOf(row[0]!);
    expect(textOf(start)).toBe(String(j * D));
    expect(numberOf(start, 'x')).toBe(first.x + first.width / 2);
    expect(hiddenThroughout(start, between(0, filled - 0.05))).toBe(true);
    expect(shownThroughout(start, between(filled + 0.05, 19.95))).toBe(true);
  });
});

test('reading the flat array is one sweep from index 0 to 23, with no jumps', () => {
  const ring = cursor('flat');
  expect(hiddenThroughout(ring, between(0, 12.95))).toBe(true);
  expect(shownThroughout(ring, between(13.05, 17.75))).toBe(true);
  expect(hiddenThroughout(ring, between(17.85, 19.95))).toBe(true);
  const reads = flatReads();
  expect(reads.map(nameOf)).toEqual(range(FLAT).map((i) => `flat[${i}]`));
  expect(jumpsIn(reads)).toBe(0);
  const summary = one('[data-role="summary"][data-layout="flat"]');
  expect(textOf(summary)).toBe(`0 reference loads, ${reads.length} double loads, 0 jumps`);
  expect(hiddenThroughout(summary, between(0, 17.95))).toBe(true);
  expect(shownThroughout(summary, between(18.05, 19.95))).toBe(true);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
