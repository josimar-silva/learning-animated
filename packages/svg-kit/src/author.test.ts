import { expect, test } from 'vitest';

import { complement, escapeXml, keyTimes, move, show } from './author.ts';
import { assertKeyTimesWellFormed } from './contract.ts';
import { parseSvg } from './parse.ts';

test('keyTimes turns seconds into fractions of the loop', () => {
  expect(keyTimes([0, 6.75, 13.5], 13.5)).toBe('0.0000;0.5000;1.0000');
});
test('complement returns the gaps between intervals', () => {
  expect(
    complement(
      [
        [3, 4],
        [1, 2],
      ],
      5,
    ),
  ).toEqual([
    [0, 1],
    [2, 3],
    [4, 5],
  ]);
});
test('show builds a discrete opacity timeline', () => {
  expect(show([[1, 2]], 4)).toBe(
    '<animate attributeName="opacity" dur="4s" repeatCount="indefinite" calcMode="discrete" keyTimes="0.0000;0.2500;0.5000" values="0;1;0"/>',
  );
  expect(show([[0, 2]], 4)).toContain('keyTimes="0.0000;0.5000" values="1;0"');
});
test('move needs waypoints that span the whole loop', () => {
  expect(() =>
    move(
      [
        [1, 0, 0],
        [4, 1, 1],
      ],
      4,
    ),
  ).toThrow(/from 0 to 4/);
  expect(
    move(
      [
        [0, 0, 0],
        [4, 10, 5],
      ],
      4,
    ),
  ).toContain('values="0,0;10,5"');
});
test('show and move output passes the keyTimes contract', () => {
  const body = `<rect>${show(
    [
      [1, 2],
      [3, 3.5],
    ],
    4,
  )}</rect><g>${move(
    [
      [0, 0, 0],
      [2, 5, 5],
      [4, 0, 0],
    ],
    4,
  )}</g>`;
  expect(() =>
    assertKeyTimesWellFormed(parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`).svg),
  ).not.toThrow();
});
test('escapeXml escapes markup characters', () => {
  expect(escapeXml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
});
