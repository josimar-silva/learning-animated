import { expect, test } from 'vitest';

import { parseSvg } from './parse.ts';
import {
  animationsIn,
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
  valueAt,
} from './timeline.ts';

const doc = (body: string) =>
  parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`).svg;
const el = (body: string, id = 'a') => doc(body).querySelector(`#${id}`)!;

test('valueAt reads the static attribute when nothing animates it', () => {
  expect(valueAt(el('<rect id="a" x="4"/>'), 'x', 0.5)).toBe(4);
  expect(valueAt(el('<rect id="a"/>'), 'x', 0.5, 7)).toBe(7);
});
test('valueAt interpolates a linear timeline', () => {
  const r = el('<rect id="a"><animate attributeName="x" values="0;10" keyTimes="0;1"/></rect>');
  expect(valueAt(r, 'x', 0.25)).toBe(2.5);
});
test('valueAt holds discrete values until the next keyTime', () => {
  const r = el(
    '<rect id="a"><animate attributeName="x" calcMode="discrete" values="0;10" keyTimes="0;0.5"/></rect>',
  );
  expect(valueAt(r, 'x', 0.49)).toBe(0);
  expect(valueAt(r, 'x', 0.5)).toBe(10);
});
test("valueAt reads only the element's own animate", () => {
  const g = el(
    '<g id="a"><rect><animate attributeName="x" values="0;10" keyTimes="0;1"/></rect></g>',
  );
  expect(valueAt(g, 'x', 0.5, 3)).toBe(3);
});
test('valueAt fails loudly on a timeline it cannot read', () => {
  const r = el('<rect id="a"><animate attributeName="x" from="0" to="1"/></rect>');
  expect(() => valueAt(r, 'x', 0.5)).toThrow(/values and keyTimes/);
});
test('opacityAt multiplies through ancestors', () => {
  const r = el('<g opacity="0.5"><rect id="a" opacity="0.5"/></g>');
  expect(opacityAt(r, 0)).toBe(0.25);
});
test('shownThroughout and hiddenThroughout catch a blip inside the window', () => {
  const r = el(
    '<rect id="a"><animate attributeName="opacity" calcMode="discrete" values="1;0;1" keyTimes="0;0.4;0.45"/></rect>',
  );
  expect(shownThroughout(r, [0, 0.39])).toBe(true);
  expect(shownThroughout(r, [0, 1])).toBe(false);
  expect(hiddenThroughout(r, [0.41, 0.44])).toBe(true);
});
test('onsetOf finds the first full show, or null', () => {
  expect(
    onsetOf(
      el(
        '<rect id="a"><animate attributeName="opacity" values="0;1" keyTimes="0;0.3" calcMode="discrete"/></rect>',
      ),
    ),
  ).toBe(0.3);
  expect(onsetOf(el('<rect id="a" opacity="0"/>'))).toBe(null);
  expect(onsetOf(el('<rect id="a"/>'))).toBe(0);
});
test('animationsIn lists every SMIL element under a node', () => {
  const g = doc(
    '<g id="g"><rect><animate attributeName="x"/></rect><set attributeName="y"/></g>',
  ).querySelector('#g')!;
  expect(animationsIn(g)).toHaveLength(2);
});
