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

import { render } from './byte-anatomy.gen.ts';

const LOOP = 20;
// Drawn left to right, the way a byte is written: bit 7 first.
const BITS = [7, 6, 5, 4, 3, 2, 1, 0] as const;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./byte-anatomy.svg', import.meta.url), 'utf8');
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

const grouped = (bits: string): string => `${bits.slice(0, 4)}_${bits.slice(4)}`;
const alone = (bit: number): string => grouped(BITS.map((b) => (b === bit ? '1' : '0')).join(''));
// The pattern the eight cells show at a moment, bit 7 first, such as 1000_0000.
const patternAt = (seconds: number): string =>
  grouped(
    BITS.map((bit) =>
      opacityAt(one(`[data-role="bit-set"][data-bit="${bit}"]`), at(seconds)) === 1 ? '1' : '0',
    ).join(''),
  );
// JLS 4.2: a byte is two's complement, so bit 7 weighs -128 and bits 6 to 0 keep 64 down to 1.
const asByte = (pattern: string): number =>
  [...pattern]
    .filter((c) => c !== '_')
    .reduce((sum, c, i) => sum + (c === '1' ? (i === 0 ? -128 : 2 ** (7 - i)) : 0), 0);
const readoutAt = (seconds: number): string | null => {
  const shown = all('[data-role="value"]').filter((value) => opacityAt(value, at(seconds)) === 1);
  if (shown.length > 1) throw new Error(`the readout shows ${shown.length} values at ${seconds} s`);
  return shown[0] ? textOf(shown[0]) : null;
};
const reading = (name: string): Element => one(`[data-role="reading"][data-reading="${name}"]`);
const tick = (value: number): Element => one(`[data-role="tick"][data-value="${value}"]`);
const tickX = (value: number): number =>
  Number(tick(value).querySelector('line')?.getAttribute('x1'));

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('bit 7 sits on the left, bit 0 on the right, and the place values double from 1 to 128', () => {
  const lefts = BITS.map((bit) =>
    Number(one(`[data-role="bit"][data-bit="${bit}"] rect`).getAttribute('x')),
  );
  lefts.slice(1).forEach((left, i) => expect(left).toBeGreaterThan(lefts[i]!));
  for (const bit of BITS) {
    expect(textOf(one(`[data-role="place-value"][data-bit="${bit}"]`))).toBe(String(2 ** bit));
    expect(textOf(one(`[data-role="place-lit"][data-bit="${bit}"]`))).toBe(String(2 ** bit));
  }
});

test('in step 1 each bit lights alone, from bit 0 to bit 7, and the readout shows its place value', () => {
  for (let bit = 0; bit < 8; bit += 1) {
    const turn = 0.8 + 0.6 * bit;
    expect(patternAt(turn)).toBe(alone(bit));
    expect(readoutAt(turn)).toBe(String(2 ** bit));
    expect(opacityAt(one(`[data-role="place-lit"][data-bit="${bit}"]`), at(turn))).toBe(1);
  }
  expect(shownThroughout(reading('place-value'), between(0, 5.9))).toBe(true);
  expect(hiddenThroughout(reading('java-byte'), between(0, 5.9))).toBe(true);
});

test('from step 2 on, bit 7 counts as -128, so 1000_0000 reads as -128', () => {
  const sign = one('[data-role="sign-weight"]');
  expect(textOf(sign)).toBe('-128');
  expect(hiddenThroughout(sign, between(0, 5.9))).toBe(true);
  expect(shownThroughout(sign, between(6.1, 19.9))).toBe(true);
  for (const label of ['place-value', 'place-lit']) {
    expect(hiddenThroughout(one(`[data-role="${label}"][data-bit="7"]`), between(6.1, 19.9))).toBe(
      true,
    );
  }
  for (const moment of [6.5, 8, 9.5]) {
    expect(patternAt(moment)).toBe('1000_0000');
    expect(readoutAt(moment)).toBe('-128');
  }
  expect(shownThroughout(reading('java-byte'), between(6.1, 19.9))).toBe(true);
  expect(hiddenThroughout(reading('place-value'), between(6.1, 19.9))).toBe(true);
});

test('with bit 7 clear, bits 6 to 0 join one at a time and the value climbs to 127', () => {
  const climb: ReadonlyArray<readonly [seconds: number, pattern: string, value: string]> = [
    [10.25, '0000_0000', '0'],
    [10.7, '0100_0000', '64'],
    [11.1, '0110_0000', '96'],
    [11.5, '0111_0000', '112'],
    [11.9, '0111_1000', '120'],
    [12.3, '0111_1100', '124'],
    [12.7, '0111_1110', '126'],
    [13.5, '0111_1111', '127'],
  ];
  for (const [moment, pattern, value] of climb) {
    expect(patternAt(moment)).toBe(pattern);
    expect(readoutAt(moment)).toBe(value);
  }
});

test('the number line runs from -128 to 127, and bit 7 splits it into halves', () => {
  expect(hiddenThroughout(tick(-128), between(0, 5.9))).toBe(true);
  expect(shownThroughout(tick(-128), between(6.1, 19.9))).toBe(true);
  expect(hiddenThroughout(tick(127), between(0, 12.8))).toBe(true);
  expect(shownThroughout(tick(127), between(13, 19.9))).toBe(true);
  const half = (bit7: string): Element => one(`[data-role="range-half"][data-bit7="${bit7}"]`);
  const constant = (value: number): Element =>
    one(`[data-role="tick"][data-value="${value}"] [data-role="constant"]`);
  expect(textOf(half('1'))).toContain('-128 to -1');
  expect(textOf(half('0'))).toContain('0 to 127');
  expect(textOf(constant(-128))).toBe('Byte.MIN_VALUE');
  expect(textOf(constant(127))).toBe('Byte.MAX_VALUE');
  for (const late of [tick(-1), tick(0), half('1'), half('0'), constant(-128), constant(127)]) {
    expect(hiddenThroughout(late, between(0, 13.9))).toBe(true);
    expect(shownThroughout(late, between(14.1, 19.9))).toBe(true);
  }
  expect(patternAt(15.5)).toBe('0111_1111');
  expect(patternAt(18.5)).toBe('1000_0000');
});

test("every pattern on the number line reads as its value in two's complement", () => {
  const ticks = all('[data-role="tick"]');
  expect(ticks.map((t) => Number(t.getAttribute('data-value')))).toEqual([-128, -1, 0, 127]);
  for (const t of ticks) {
    const pattern = t.querySelector('[data-role="pattern"]');
    expect(asByte(pattern ? textOf(pattern) : '')).toBe(Number(t.getAttribute('data-value')));
  }
});

test('from step 2 on, the readout and the marker show the lit bits read as a Java byte', () => {
  const marker = one('[data-role="marker"]');
  const left = tickX(-128);
  const right = tickX(127);
  const xOf = (value: number): number => left + ((value + 128) * (right - left)) / 255;
  expect(hiddenThroughout(marker, between(0, 5.9))).toBe(true);
  for (let k = 0; k < 140; k += 1) {
    const moment = 6.05 + k / 10;
    expect(readoutAt(moment)).toBe(String(asByte(patternAt(moment))));
    expect(opacityAt(marker, at(moment))).toBe(1);
  }
  for (const moment of [8, 10.25, 10.7, 11.1, 11.5, 11.9, 12.3, 12.7, 13.5, 15.5, 18.5]) {
    expect(valueAt(marker, 'cx', at(moment), Number.NaN)).toBeCloseTo(
      xOf(asByte(patternAt(moment))),
      0,
    );
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
