import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './index-only-scan.gen.ts';

const LOOP = 26;
const text = readFileSync(new URL('./index-only-scan.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);
const steps = lesson.steps ?? [];

// The beats in the order the page lists its steps.
const [PLAIN, COVERING, ALL_VISIBLE, CHANGED] = [0, 1, 2, 3] as const;
const startOf = (beat: number): number => steps[beat]?.at ?? LOOP;

// Moments are fractions of the loop. A window stops just short of its ends,
// where the neighbouring beat takes over.
const MARGIN = 0.05;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [
  at(from + MARGIN),
  at(to - MARGIN),
];
const during = (beat: number): [number, number] => between(startOf(beat), startOf(beat + 1));
const from = (beat: number): [number, number] => between(startOf(beat), LOOP);
const before = (beat: number): [number, number] => between(0, startOf(beat));
const endOf = (beat: number): number => at(startOf(beat + 1) - MARGIN);

const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const words = (el: Element): string => el.textContent?.trim() ?? '';
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment;
};
const ofPass = (role: string, pass: number): Element =>
  one(`[data-role="${role}"][data-pass="${pass}"]`);
const visits = (pass: number, count: number): Element =>
  one(`[data-role="table-visits"][data-pass="${pass}"][data-count="${count}"]`);
const bit = (page: string, allVisible: boolean): Element =>
  one(`[data-role="bit"][data-page="${page}"][data-all-visible="${allVisible}"]`);
const definition = (covering: boolean): Element =>
  one(`[data-role="index-definition"][data-covering="${covering}"]`);

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('is the fourth lesson on B-tree indexes', () => {
  expect(lesson.id).toBe('index-only-scan');
  expect(lesson.section).toBe('indexes');
  expect(lesson.order).toBe(4);
});

test('one 26 s loop tells the story in four steps that start on whole seconds', () => {
  expect(svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
  expect(steps).toHaveLength(4);
  for (const step of steps) expect(Number.isInteger(step.at)).toBe(true);
});

test('the query asks the players table for the tag of player 4127', () => {
  expect(words(one('[data-role="query"]'))).toBe('SELECT tag FROM players WHERE player_id = 4127;');
});

test('the leaf entry for 4127 points to table page 3, where its row holds the tag Tapir', () => {
  expect(words(one('[data-role="entry"][data-key="4127"] [data-role="pointer"]'))).toBe('page 3');
  const row = one('[data-role="table-page"][data-page="3"] [data-role="row"][data-key="4127"]');
  expect(words(row.querySelector('[data-role="tag"]')!)).toBe('Tapir');
});

test('each of the three lookups descends to the leaf and finds 4127 first', () => {
  for (const pass of [1, 2, 3]) {
    const found = ofPass('found', pass);
    expect(found.getAttribute('data-key')).toBe('4127');
    expect(onset(found)).toBeGreaterThan(onset(ofPass('descent', pass)));
  }
});

test('the plain index on player_id keeps no tag in its leaf entries', () => {
  expect(words(definition(false))).toBe('CREATE INDEX ON players (player_id);');
  expect(shownThroughout(definition(false), during(PLAIN))).toBe(true);
  expect(hiddenThroughout(definition(true), during(PLAIN))).toBe(true);
  const tags = all('[data-role="leaf-page"] [data-role="included"]');
  expect(tags.length).toBeGreaterThan(0);
  for (const tag of tags) expect(hiddenThroughout(tag, during(PLAIN))).toBe(true);
});

test('an index scan follows the pointer and reads the tag from table page 3', () => {
  expect(shownThroughout(one('[data-role="plan"][data-plan="Index Scan"]'), during(PLAIN))).toBe(
    true,
  );
  const fetch = ofPass('fetch', 1);
  expect(onset(fetch)).toBeGreaterThan(onset(ofPass('found', 1)));
  expect(onset(ofPass('visit', 1))).toBeGreaterThan(onset(fetch));
  const read = ofPass('read', 1);
  expect(read.getAttribute('data-from')).toBe('table');
  expect(opacityAt(read, endOf(PLAIN))).toBe(1);
  const result = ofPass('result', 1);
  expect(words(result)).toBe('Tapir, from table page 3');
  expect(opacityAt(result, endOf(PLAIN))).toBe(1);
  expect(opacityAt(visits(1, 1), endOf(PLAIN))).toBe(1);
});

test('an index scan never consults the visibility map', () => {
  expect(hiddenThroughout(one('[data-role="visibility-map"]'), during(PLAIN))).toBe(true);
  expect(svg.querySelector('[data-role="check"][data-pass="1"]')).toBeNull();
});

test('INCLUDE (tag) adds the tag to every leaf entry for the rest of the loop', () => {
  expect(words(definition(true))).toBe('CREATE INDEX ON players (player_id) INCLUDE (tag);');
  expect(shownThroughout(definition(true), from(COVERING))).toBe(true);
  expect(hiddenThroughout(definition(false), from(COVERING))).toBe(true);
  const entries = all('[data-role="leaf-page"] [data-role="entry"]');
  expect(entries.length).toBeGreaterThan(1);
  for (const entry of entries) {
    const tag = entry.querySelector('[data-role="included"]');
    expect(tag, `entry ${entry.getAttribute('data-key')}`).not.toBeNull();
    expect(shownThroughout(tag!, from(COVERING))).toBe(true);
  }
});

test("the leaf's copy of the tag matches row 4127", () => {
  expect(words(one('[data-role="entry"][data-key="4127"] [data-role="included"]'))).toBe(
    words(one('[data-role="row"][data-key="4127"] [data-role="tag"]')),
  );
});

test('with the covering index, the lookup finds the tag in the leaf', () => {
  expect(
    shownThroughout(one('[data-role="plan"][data-plan="Index Only Scan"]'), from(COVERING)),
  ).toBe(true);
  expect(onset(ofPass('descent', 2))).toBeGreaterThan(at(startOf(COVERING)));
  const read = ofPass('read', 2);
  expect(read.getAttribute('data-from')).toBe('leaf');
  expect(opacityAt(read, endOf(COVERING))).toBe(1);
});

test('the visibility map appears with every table page all-visible', () => {
  const map = one('[data-role="visibility-map"]');
  expect(hiddenThroughout(map, before(ALL_VISIBLE))).toBe(true);
  expect(shownThroughout(map, from(ALL_VISIBLE))).toBe(true);
  const pages = all('[data-role="table-page"]').map((page) => page.getAttribute('data-page')!);
  expect(pages).toContain('3');
  for (const page of pages) {
    expect(words(bit(page, true))).toBe('1');
    expect(shownThroughout(bit(page, true), during(ALL_VISIBLE))).toBe(true);
  }
});

test("page 3's bit is set, so the lookup skips the table", () => {
  const check = ofPass('check', 2);
  expect(onset(check)).toBeGreaterThan(at(startOf(ALL_VISIBLE)));
  const checked = ofPass('bit-read', 2);
  expect(checked.getAttribute('data-page')).toBe('3');
  expect(onset(checked)).toBeGreaterThan(onset(check));
  expect(svg.querySelector('[data-role="fetch"][data-pass="2"]')).toBeNull();
  expect(all('[data-role="visit"]').map((visit) => visit.getAttribute('data-pass'))).toEqual([
    '1',
    '3',
  ]);
  for (const visit of all('[data-role="visit"]')) {
    expect(hiddenThroughout(visit, between(startOf(COVERING), startOf(CHANGED)))).toBe(true);
  }
  expect(shownThroughout(visits(2, 0), during(ALL_VISIBLE))).toBe(true);
  expect(svg.querySelector('[data-role="table-visits"][data-pass="2"][data-count="1"]')).toBeNull();
});

test('the tag comes from the leaf when the table is skipped', () => {
  const result = ofPass('result', 2);
  expect(result.getAttribute('data-from')).toBe('leaf');
  expect(words(result)).toBe('Tapir, from the leaf');
  expect(onset(result)).toBeGreaterThan(onset(ofPass('bit-read', 2)));
  expect(opacityAt(result, endOf(ALL_VISIBLE))).toBe(1);
});

test("after a match, an UPDATE to player 4130's rating, also on page 3, clears the bit for page 3 alone", () => {
  const update = one('[data-role="update"]');
  expect(words(update)).toMatch(/^UPDATE players SET rating = .+ WHERE player_id = 4130;$/s);
  expect(hiddenThroughout(update, before(CHANGED))).toBe(true);
  expect(shownThroughout(update, from(CHANGED))).toBe(true);
  const row = one('[data-role="table-page"][data-page="3"] [data-role="row"][data-key="4130"]');
  const changed = row.querySelector('[data-role="changed"]')!;
  expect(words(changed)).not.toBe(words(row.querySelector('[data-role="rating"]')!));
  expect(onset(changed)).toBeGreaterThan(at(startOf(CHANGED)));
  const cleared = bit('3', false);
  expect(words(cleared)).toBe('0');
  expect(onset(cleared)).toBe(onset(changed));
  expect(shownThroughout(cleared, [onset(cleared), at(LOOP - MARGIN)])).toBe(true);
  expect(hiddenThroughout(bit('3', true), [onset(cleared), at(LOOP - MARGIN)])).toBe(true);
  expect(
    all('[data-role="bit"][data-all-visible="false"]').map((b) => b.getAttribute('data-page')),
  ).toEqual(['3']);
});

test('the cleared bit sends the lookup to table page 3 to check row 4127', () => {
  const check = ofPass('check', 3);
  expect(onset(check)).toBeGreaterThan(onset(bit('3', false)));
  const fetch = ofPass('fetch', 3);
  expect(onset(fetch)).toBeGreaterThan(onset(check));
  const visit = ofPass('visit', 3);
  expect(onset(visit)).toBeGreaterThan(onset(fetch));
  expect(opacityAt(visit, endOf(CHANGED))).toBe(1);
  expect(opacityAt(visits(3, 1), endOf(CHANGED))).toBe(1);
});

test('the tag still comes from the leaf after that visit', () => {
  expect(ofPass('read', 3).getAttribute('data-from')).toBe('leaf');
  const result = ofPass('result', 3);
  expect(result.getAttribute('data-from')).toBe('leaf');
  expect(words(result)).toBe('Tapir, from the leaf');
  expect(onset(result)).toBeGreaterThan(onset(ofPass('visit', 3)));
  expect(opacityAt(result, endOf(CHANGED))).toBe(1);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(words)).toEqual(steps.map((step) => step.text));
  captions.forEach((caption, beat) => expect(shownThroughout(caption, during(beat))).toBe(true));
});
