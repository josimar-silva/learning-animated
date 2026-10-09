import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './sealed-hierarchy.gen.ts';

const LOOP = 20;
const TWO = ['Decoded', 'Rejected'];
const THREE = ['Decoded', 'Rejected', 'Expired'];
// javac's own words for a switch that misses a permitted subtype, checked with JDK 25.
const NOT_EXHAUSTIVE = 'error: the switch expression does not cover all possible input values';
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./sealed-hierarchy.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string, within: Element = svg): Element[] => [
  ...within.querySelectorAll(selector),
];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const typeOf = (el: Element): string => el.getAttribute('data-type') ?? '';
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// Every tenth of a second, half a tenth off the beat so no sample lands on a keyTime.
const MOMENTS = Array.from({ length: LOOP * 10 }, (_, k) => k / 10 + 0.05);
const shownAt = (selector: string, seconds: number): Element[] =>
  all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);
const permittedAt = (seconds: number): string[] => {
  const clauses = shownAt('[data-role="permits"]', seconds);
  if (clauses.length !== 1) throw new Error(`${clauses.length} permits clauses at ${seconds} s`);
  return all('[data-role="type-name"]', clauses[0]!).map(typeOf);
};
const drawnAt = (seconds: number): string[] =>
  shownAt('[data-role="subtype"]', seconds).map(typeOf);
const casesAt = (seconds: number): string[] => shownAt('[data-role="case"]', seconds).map(typeOf);
const uncoveredAt = (seconds: number): string[] =>
  permittedAt(seconds).filter((type) => !casesAt(seconds).includes(type));
const verdict = (name: string): Element => one(`[data-role="verdict"][data-verdict="${name}"]`);
const mark = (name: string, type: string): Element =>
  one(`[data-role="mark"][data-mark="${name}"][data-type="${type}"]`);
const frames = (box: Element, line: Element): boolean => {
  const [top, y] = [numberOf(box, 'y'), numberOf(line, 'y')];
  return y > top && y < top + numberOf(box, 'height');
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('the permits clause names Decoded and Rejected until Expired joins it at 10 s', () => {
  for (const clause of all('[data-role="permits"]')) {
    const names = all('[data-role="type-name"]', clause).map(typeOf);
    expect(textOf(clause)).toBe(`permits ${names.join(', ')} {}`);
  }
  for (const moment of MOMENTS) expect(permittedAt(moment)).toEqual(moment < 10 ? TWO : THREE);
  const highlight = one('[data-role="permits-highlight"]');
  expect(shownThroughout(highlight, between(0, 4.95))).toBe(true);
  expect(hiddenThroughout(highlight, between(5.05, 19.95))).toBe(true);
});

test('the hierarchy draws exactly the records the permits clause names', () => {
  for (const box of all('[data-role="subtype"]')) {
    expect(textOf(box).startsWith(`record ${typeOf(box)}(`)).toBe(true);
  }
  for (const moment of MOMENTS) expect(drawnAt(moment)).toEqual(permittedAt(moment));
});

test('the switch has one case per handled subtype and never a default label', () => {
  for (const line of all('[data-role="case"]')) {
    expect(textOf(line).startsWith(`case ${typeOf(line)} `)).toBe(true);
  }
  const code = all('[data-role="switch"] text');
  expect(code.filter((line) => textOf(line).startsWith('default'))).toEqual([]);
  for (const moment of MOMENTS) {
    expect(casesAt(moment)).toEqual(moment < 15 ? TWO : THREE);
    expect(shownAt('[data-role="no-default"]', moment).map(textOf)).toEqual(['// no default']);
    const rows = code
      .filter((line) => opacityAt(line, at(moment)) === 1)
      .map((line) => numberOf(line, 'y'));
    expect(new Set(rows).size).toBe(rows.length);
  }
});

test('Decoded and Rejected are marked covered as javac finds their cases', () => {
  expect(hiddenThroughout(mark('covered', 'Decoded'), between(0, 5.95))).toBe(true);
  expect(shownThroughout(mark('covered', 'Decoded'), between(6.05, 19.95))).toBe(true);
  expect(hiddenThroughout(mark('covered', 'Rejected'), between(0, 6.95))).toBe(true);
  expect(shownThroughout(mark('covered', 'Rejected'), between(7.05, 19.95))).toBe(true);
});

test('in step 2 javac checks the two-case switch and accepts it with no default', () => {
  expect(hiddenThroughout(verdict('checking'), between(0, 4.95))).toBe(true);
  expect(shownThroughout(verdict('checking'), between(5.05, 7.95))).toBe(true);
  expect(textOf(verdict('compiles')).startsWith('compiles')).toBe(true);
  expect(hiddenThroughout(verdict('compiles'), between(0, 7.95))).toBe(true);
  expect(shownThroughout(verdict('compiles'), between(8.05, 9.95))).toBe(true);
  for (const moment of MOMENTS) {
    const lit = shownAt('[data-role="no-default-highlight"]', moment);
    expect(lit.length).toBe(opacityAt(verdict('compiles'), at(moment)) === 1 ? 1 : 0);
    for (const box of lit)
      expect(frames(box, shownAt('[data-role="no-default"]', moment)[0]!)).toBe(true);
  }
});

test('adding Expired fails the build at the switch until it gets a case', () => {
  const error = verdict('error');
  expect(textOf(error)).toBe(NOT_EXHAUSTIVE);
  expect(hiddenThroughout(error, between(0, 11.95))).toBe(true);
  expect(shownThroughout(error, between(12.05, 14.95))).toBe(true);
  expect(hiddenThroughout(error, between(15.05, 19.95))).toBe(true);
  expect(hiddenThroughout(mark('missing', 'Expired'), between(0, 10.95))).toBe(true);
  expect(shownThroughout(mark('missing', 'Expired'), between(11.05, 14.95))).toBe(true);
  expect(hiddenThroughout(mark('missing', 'Expired'), between(15.05, 19.95))).toBe(true);
  const flag = one('[data-role="switch-error"]');
  const line = one('[data-role="switch-line"]');
  expect(textOf(line)).toBe('return switch (result) {');
  expect(frames(flag, line)).toBe(true);
  expect(hiddenThroughout(flag, between(0, 11.95))).toBe(true);
  expect(shownThroughout(flag, between(12.05, 14.95))).toBe(true);
  expect(hiddenThroughout(flag, between(15.05, 19.95))).toBe(true);
});

test('with case Expired e added, javac marks Expired covered and the switch compiles again', () => {
  expect(shownThroughout(verdict('checking'), between(15.05, 16.95))).toBe(true);
  expect(hiddenThroughout(mark('covered', 'Expired'), between(0, 15.95))).toBe(true);
  expect(shownThroughout(mark('covered', 'Expired'), between(16.05, 19.95))).toBe(true);
  expect(hiddenThroughout(verdict('compiles'), between(10.05, 16.95))).toBe(true);
  expect(shownThroughout(verdict('compiles'), between(17.05, 19.95))).toBe(true);
});

test("javac's marks and verdict always match the code on screen", () => {
  for (const moment of MOMENTS) {
    const uncovered = uncoveredAt(moment);
    for (const covered of shownAt('[data-role="mark"][data-mark="covered"]', moment)) {
      expect(casesAt(moment)).toContain(typeOf(covered));
    }
    for (const missing of shownAt('[data-role="mark"][data-mark="missing"]', moment)) {
      expect(uncovered).toContain(typeOf(missing));
    }
    if (opacityAt(verdict('compiles'), at(moment)) === 1) expect(uncovered).toEqual([]);
    if (opacityAt(verdict('error'), at(moment)) === 1) expect(uncovered).not.toEqual([]);
    expect(shownAt('[data-role="verdict"]', moment).length).toBeLessThanOrEqual(1);
  }
});

test('each subtype keeps one color in the permits clause, the hierarchy, and its case', () => {
  const colors = THREE.map((type) => {
    const names = all(`[data-role="type-name"][data-type="${type}"]`);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(names.map(textOf).every((name) => name === type)).toBe(true);
    const fills = new Set(
      names.map((name) =>
        (name.getAttribute('class') ?? '').split(' ').find((c) => c.startsWith('fill-')),
      ),
    );
    expect(fills.size).toBe(1);
    return [...fills][0];
  });
  expect(new Set(colors).size).toBe(THREE.length);
});

test('the drawn captions and the page steps tell the same story', () => {
  expect(steps.map((step) => step.at)).toEqual([0, 5, 10, 15]);
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
