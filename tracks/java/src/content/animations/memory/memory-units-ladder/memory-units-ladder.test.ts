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

import { render } from './memory-units-ladder.gen.ts';

const LOOP = 20;
type Ladder = 'binary' | 'decimal';
// Level 0 is the byte both ladders stand on; levels 1 to 4 are kilo, mega, giga, and tera.
const LEVELS = [0, 1, 2, 3, 4] as const;
const PREFIXED = [1, 2, 3, 4] as const;
// When the climb reaches each rung and its size shows: the binary ladder in step 1, the decimal one in step 2.
const REACH: Readonly<Record<Ladder, readonly number[]>> = {
  binary: [0.5, 1.5, 2.5, 3.5, 4.5],
  decimal: [6, 6.5, 7.5, 8.5, 9.5],
};
// When each gap bar starts to grow, in step 3.
const GROW = [11.5, 12.5, 13.5, 14.5];

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./memory-units-ladder.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string, within: Element = svg): Element => {
  const found = within.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// The byte at level 0 is one rung that both ladders share.
const rung = (ladder: Ladder, level: number): Element =>
  one(
    level === 0
      ? '[data-role="rung"][data-level="0"]'
      : `[data-role="rung"][data-ladder="${ladder}"][data-level="${level}"]`,
  );
const boxOf = (ladder: Ladder, level: number) => {
  const rect = one('rect', rung(ladder, level));
  const [left, top, width] = ['x', 'y', 'width'].map((name) => Number(rect.getAttribute(name)));
  return { left: left!, top: top!, width: width! };
};
const symbolOf = (ladder: Ladder, level: number): string =>
  textOf(one('[data-role="symbol"]', rung(ladder, level)));
const nameOf = (ladder: Ladder, level: number): string =>
  textOf(one('[data-role="name"]', rung(ladder, level)));
const values = (ladder: Ladder, level: number): Element =>
  one(`[data-role="values"][data-ladder="${ladder}"][data-level="${level}"]`);
const bytes = (ladder: Ladder, level: number): number =>
  Number(
    textOf(one('[data-role="count"]', values(ladder, level)))
      .split(',')
      .join(''),
  );
// The power is drawn as its base followed by a raised exponent, such as 2 and 10.
const powerOf = (ladder: Ladder, level: number): [base: number, exponent: number] => {
  const power = one('[data-role="power"]', values(ladder, level));
  return [Number(power.firstChild?.textContent), Number(textOf(one('tspan', power)))];
};
const lit = (ladder: Ladder, level: number): Element =>
  one(`[data-role="rung-lit"][data-ladder="${ladder}"][data-level="${level}"]`);
const litAt = (ladder: Ladder, seconds: number): number[] =>
  LEVELS.filter((level) => opacityAt(lit(ladder, level), at(seconds)) === 1);
const times = (ladder: Ladder, level: number, state: 'lit' | 'muted'): Element =>
  one(
    `[data-role="times"][data-ladder="${ladder}"][data-level="${level}"] [data-state="${state}"]`,
  );
const gap = (level: number): Element => one(`[data-role="gap"][data-level="${level}"]`);
const gapLabel = (level: number): Element => one('[data-role="gap-label"]', gap(level));
const widthAt = (level: number, seconds: number): number =>
  valueAt(one('[data-role="gap-bar"]', gap(level)), 'width', at(seconds), Number.NaN);
// Moments a tenth of a second apart, offset so none lands on a change.
const MOMENTS = Array.from({ length: LOOP * 10 }, (_, k) => k / 10 + 0.05);

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('the binary ladder climbs from one byte at the bottom to a tebibyte at the top', () => {
  expect(LEVELS.map((level) => symbolOf('binary', level))).toEqual([
    'B',
    'KiB',
    'MiB',
    'GiB',
    'TiB',
  ]);
  expect(LEVELS.map((level) => nameOf('binary', level))).toEqual([
    'byte (8 bits)',
    'kibibyte',
    'mebibyte',
    'gibibyte',
    'tebibyte',
  ]);
  const tops = LEVELS.map((level) => boxOf('binary', level).top);
  tops.slice(1).forEach((top, i) => expect(top).toBeLessThan(tops[i]!));
});

test('each binary rung holds 1024 times the rung below it, ten more powers of two', () => {
  expect(bytes('binary', 0)).toBe(1);
  for (const level of PREFIXED) {
    expect(bytes('binary', level)).toBe(1024 * bytes('binary', level - 1));
  }
  for (const level of LEVELS) {
    expect(powerOf('binary', level)).toEqual([2, 10 * level]);
    expect(2 ** (10 * level)).toBe(bytes('binary', level));
  }
});

test('each multiplier sits between the rung it leads to and the rung below it', () => {
  for (const ladder of ['binary', 'decimal'] as const) {
    const middle = (level: number): number => boxOf(ladder, level).top + 22;
    for (const level of PREFIXED) {
      for (const state of ['lit', 'muted'] as const) {
        const y = Number(times(ladder, level, state).getAttribute('y'));
        expect(y).toBeGreaterThan(middle(level));
        expect(y).toBeLessThan(middle(level - 1));
      }
    }
  }
  for (const level of PREFIXED) {
    for (const state of ['lit', 'muted'] as const) {
      expect(textOf(times('binary', level, state))).toBe('× 1024');
    }
  }
});

test('in step 1 the binary rungs light one at a time, from the byte up to TiB, and show their sizes', () => {
  const climb: ReadonlyArray<readonly [seconds: number, lit: readonly number[]]> = [
    [0.25, []],
    [1, [0]],
    [2, [1]],
    [3, [2]],
    [4, [3]],
    [5, [4]],
    [5.75, [4]],
  ];
  for (const [moment, levels] of climb) {
    expect(litAt('binary', moment)).toEqual(levels);
    expect(litAt('decimal', moment)).toEqual([]);
  }
  for (const level of LEVELS) {
    const reach = REACH.binary[level]!;
    expect(
      shownThroughout(one('[data-role="symbol"]', rung('binary', level)), between(0, 19.9)),
    ).toBe(true);
    expect(hiddenThroughout(values('binary', level), between(0, reach - 0.1))).toBe(true);
    expect(shownThroughout(values('binary', level), between(reach + 0.1, 19.9))).toBe(true);
  }
  for (const level of PREFIXED) {
    expect(hiddenThroughout(rung('decimal', level), between(0, 5.9))).toBe(true);
  }
});

test('from step 2 the decimal rung beside each binary rung multiplies by 1000', () => {
  expect(LEVELS.map((level) => symbolOf('decimal', level))).toEqual(['B', 'kB', 'MB', 'GB', 'TB']);
  expect(LEVELS.map((level) => nameOf('decimal', level))).toEqual([
    'byte (8 bits)',
    'kilobyte',
    'megabyte',
    'gigabyte',
    'terabyte',
  ]);
  expect(bytes('decimal', 0)).toBe(1);
  for (const level of PREFIXED) {
    expect(bytes('decimal', level)).toBe(1000 * bytes('decimal', level - 1));
    const [binary, decimal] = [boxOf('binary', level), boxOf('decimal', level)];
    expect(decimal.top).toBe(binary.top);
    expect(decimal.left).toBeGreaterThan(binary.left + binary.width);
    for (const state of ['lit', 'muted'] as const) {
      expect(textOf(times('decimal', level, state))).toBe('× 1000');
    }
  }
  for (const level of LEVELS) expect(powerOf('decimal', level)).toEqual([10, 3 * level]);
  const climb: ReadonlyArray<readonly [seconds: number, lit: readonly number[]]> = [
    [6.25, [0]],
    [7, [1]],
    [8, [2]],
    [9, [3]],
    [10, [4]],
    [10.75, [4]],
  ];
  for (const [moment, levels] of climb) {
    expect(litAt('decimal', moment)).toEqual(levels);
    expect(litAt('binary', moment)).toEqual([]);
  }
  for (const level of PREFIXED) {
    expect(shownThroughout(rung('decimal', level), between(6.1, 19.9))).toBe(true);
  }
  // The byte holds up the binary ladder alone, then widens to stand under both.
  const byte = one('rect', rung('binary', 0));
  const kilo = { binary: boxOf('binary', 1), decimal: boxOf('decimal', 1) };
  expect(valueAt(byte, 'width', at(5.9), Number.NaN)).toBe(kilo.binary.width);
  expect(boxOf('binary', 0).left + valueAt(byte, 'width', at(6.1), Number.NaN)).toBe(
    kilo.decimal.left + kilo.decimal.width,
  );
  for (const level of LEVELS) {
    const reach = REACH.decimal[level]!;
    expect(hiddenThroughout(values('decimal', level), between(0, reach - 0.1))).toBe(true);
    expect(shownThroughout(values('decimal', level), between(reach + 0.1, 19.9))).toBe(true);
  }
});

test('each multiplier lights while the rung it leads to is lit, and stays muted after', () => {
  for (const ladder of ['binary', 'decimal'] as const) {
    for (const level of PREFIXED) {
      for (const moment of MOMENTS) {
        const on = opacityAt(lit(ladder, level), at(moment));
        const reached = moment > REACH[ladder][level]!;
        expect(opacityAt(times(ladder, level, 'lit'), at(moment))).toBe(on);
        expect(opacityAt(times(ladder, level, 'muted'), at(moment))).toBe(
          reached && on === 0 ? 1 : 0,
        );
      }
    }
  }
});

test('the gap grows at every rung, from 2.4% at kilo to about 10% at tera', () => {
  const percent = (level: number): number =>
    (bytes('binary', level) / bytes('decimal', level) - 1) * 100;
  const labels = PREFIXED.map((level) => textOf(gapLabel(level)));
  expect(labels).toEqual(['+2.4%', '+4.9%', '+7.4%', '+10.0%']);
  PREFIXED.forEach((level, i) => expect(labels[i]).toBe(`+${percent(level).toFixed(1)}%`));
  const full = PREFIXED.map((level) => widthAt(level, 19.9));
  full.slice(1).forEach((width, i) => expect(width).toBeGreaterThan(full[i]!));
  PREFIXED.forEach((level, i) =>
    expect(full[i]! / percent(level)).toBeCloseTo(full[3]! / percent(4), 1),
  );
  PREFIXED.forEach((level, i) => {
    const grow = GROW[i]!;
    expect(hiddenThroughout(gap(level), between(0, 10.9))).toBe(true);
    expect(widthAt(level, grow - 0.05)).toBe(0);
    expect(widthAt(level, grow + 0.5)).toBe(full[i]);
    expect(hiddenThroughout(gapLabel(level), between(0, grow - 0.1))).toBe(true);
    expect(shownThroughout(gapLabel(level), between(grow + 0.1, 19.9))).toBe(true);
  });
  for (const moment of [11.25, 12, 13, 14, 15, 15.75]) {
    expect(litAt('binary', moment)).toEqual([]);
    expect(litAt('decimal', moment)).toEqual([]);
  }
});

test('in step 4 both tera rungs light together, and 1 TB comes to about 0.91 TiB', () => {
  for (const moment of [16.25, 17, 18, 19, 19.75]) {
    expect(litAt('binary', moment)).toEqual([4]);
    expect(litAt('decimal', moment)).toEqual([4]);
  }
  expect((bytes('decimal', 4) / bytes('binary', 4)).toFixed(2)).toBe('0.91');
  expect(steps[3]?.text).toContain('0.91 TiB');
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) =>
    captions.forEach((caption, j) =>
      expect(opacityAt(caption, at(step.at + 0.05))).toBe(i === j ? 1 : 0),
    ),
  );
});
