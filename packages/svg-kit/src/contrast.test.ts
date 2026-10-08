import { expect, test } from 'vitest';

import { contrastRatio, parseHex } from './contrast.ts';

test('parses short and long hex', () => {
  expect(parseHex('#abc')).toEqual([170, 187, 204]);
  expect(parseHex('#38bdf8')).toEqual([56, 189, 248]);
});
test('rejects anything that is not hex', () => expect(() => parseHex('red')).toThrow(/hex/));
test('black on white is 21:1 and a color on itself is 1:1', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  expect(contrastRatio('#38bdf8', '#38bdf8')).toBe(1);
});
