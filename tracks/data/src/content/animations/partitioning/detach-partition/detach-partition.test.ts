import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg, tagOf } from '@learning-animated/svg-kit/parse';
import {
  animationsIn,
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './detach-partition.gen.ts';

const LOOP = 24;
const JANUARY = 'matches_2026_01';
const PARTITIONS = ['matches_2026_01', 'matches_2026_02', 'matches_2026_03', 'matches_2026_04'];
const STAYING = PARTITIONS.slice(1);
const BOUNDS = [
  ['2026-01-01', '2026-02-01'],
  ['2026-02-01', '2026-03-01'],
  ['2026-03-01', '2026-04-01'],
  ['2026-04-01', '2026-05-01'],
];

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./detach-partition.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string, within: Element = svg): Element[] => [
  ...within.querySelectorAll(selector),
];
const one = (selector: string, within: Element = svg): Element => {
  const found = within.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment;
};
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

const partition = (name: string): Element =>
  one(`[data-role="partition"][data-partition="${name}"]`);
const rowsOf = (name: string): Element[] => all('[data-role="row"]', partition(name));
const everyRow = (): Element[] => PARTITIONS.flatMap(rowsOf);
const matchId = (row: Element): string => row.getAttribute('data-match-id')!;
const playedOn = (row: Element): string => row.getAttribute('data-played-on')!;
const recordsOf = (rows: Element[]): string[][] => rows.map((row) => [matchId(row), playedOn(row)]);
const rowCount = (names: string[]): number =>
  names.reduce((sum, name) => sum + rowsOf(name).length, 0);
// A statement's lines, read as one line of SQL.
const sqlOf = (step: string): string =>
  all('text', one(`[data-role="statement"][data-step="${step}"]`))
    .map(textOf)
    .join(' ');
const statement = (step: string): Element => one(`[data-role="statement"][data-step="${step}"]`);

// The offset an element's own translate animation gives it at a moment in the loop.
function offsetAt(el: Element, t: number): [number, number] {
  const anim = [...el.children].find((child) => tagOf(child) === 'animatetransform');
  if (!anim) return [0, 0];
  const values = anim
    .getAttribute('values')!
    .split(';')
    .map((pair) => pair.split(',').map(Number));
  const keyTimes = anim.getAttribute('keyTimes')!.split(';').map(Number);
  let i = keyTimes.length - 1;
  while (i > 0 && keyTimes[i]! > t) i -= 1;
  const [x0, y0] = values[i]!;
  if (i === keyTimes.length - 1) return [x0!, y0!];
  const [x1, y1] = values[i + 1]!;
  const progress = (t - keyTimes[i]!) / (keyTimes[i + 1]! - keyTimes[i]!);
  return [x0! + (x1! - x0!) * progress, y0! + (y1! - y0!) * progress];
}

type Box = { left: number; top: number; right: number; bottom: number };
const boxOf = (rect: Element, [dx, dy]: [number, number] = [0, 0]): Box => {
  const left = numberOf(rect, 'x') + dx;
  const top = numberOf(rect, 'y') + dy;
  return {
    left,
    top,
    right: left + numberOf(rect, 'width'),
    bottom: top + numberOf(rect, 'height'),
  };
};
const inside = (inner: Box, outer: Box): boolean =>
  inner.left >= outer.left &&
  inner.right <= outer.right &&
  inner.top >= outer.top &&
  inner.bottom <= outer.bottom;
const frameAt = (name: string, t: number): Box =>
  boxOf(one('[data-role="frame"]', partition(name)), offsetAt(partition(name), t));
// The box of the partitioned table itself, which holds the attached partitions.
const parentBox = (): Box => boxOf(one('[data-role="parent"]'));

// The partitions whose frames sit wholly under the retention window at a moment.
function keptAt(t: number): string[] {
  const span = one('[data-role="window-span"]');
  const [dx] = offsetAt(one('[data-role="window"]'), t);
  const left = numberOf(span, 'x') + dx;
  const right = left + numberOf(span, 'width');
  return PARTITIONS.filter((name) => {
    const frame = frameAt(name, t);
    return frame.left >= left && frame.right <= right;
  });
}

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 24 s, and its steps start on whole seconds', () => {
  expect(svg.getAttribute('data-loop')).toBe('24s');
  for (const step of steps) expect(Number.isInteger(step.at)).toBe(true);
});

test('matches has one partition per month of played_on, and every match sits inside its bounds', () => {
  expect(textOf(one('[data-role="partition-key"]'))).toBe('PARTITION BY RANGE (played_on)');
  expect(all('[data-role="partition"]').map((p) => p.getAttribute('data-partition'))).toEqual(
    PARTITIONS,
  );
  PARTITIONS.forEach((name, i) => {
    const [from, to] = BOUNDS[i]!;
    expect([
      partition(name).getAttribute('data-from'),
      partition(name).getAttribute('data-to'),
    ]).toEqual([from, to]);
    expect(textOf(one('[data-role="name"]', partition(name)))).toBe(name);
    expect(rowsOf(name)).toHaveLength(3);
    for (const row of rowsOf(name)) {
      expect(playedOn(row) >= from! && playedOn(row) < to!).toBe(true);
      expect(textOf(row)).toBe(`${matchId(row)} ${playedOn(row)}`);
    }
    expect(inside(frameAt(name, at(0)), parentBox())).toBe(true);
  });
});

test('every match has a five-digit id, and the ids rise in the order the matches are played', () => {
  const rows = everyRow();
  for (const row of rows) expect(matchId(row)).toMatch(/^\d{5}$/);
  const ids = rows.map((row) => Number(matchId(row)));
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual([...ids].sort((a, b) => a - b));
  const days = rows.map(playedOn);
  expect(days).toEqual([...days].sort());
});

test('no match shows up before the day it is played', () => {
  const today = all('[data-role="today"]');
  expect(today.map((el) => el.getAttribute('data-date'))).toEqual(['2026-03-31', '2026-04-01']);
  for (let seconds = 0.1; seconds < LOOP; seconds += 0.25) {
    const shown = today.filter((el) => opacityAt(el, at(seconds)) === 1);
    expect(shown).toHaveLength(1);
    const day = shown[0]!.getAttribute('data-date')!;
    expect(textOf(shown[0]!)).toBe(`-- today: ${day}`);
    for (const row of everyRow().filter((r) => opacityAt(r, at(seconds)) === 1)) {
      expect(playedOn(row) <= day).toBe(true);
    }
  }
});

test('when April begins the window moves on to February to April, and January falls out of it', () => {
  expect(keptAt(at(0.5))).toEqual(PARTITIONS.slice(0, 3));
  expect(keptAt(at(2.05))).toEqual(STAYING);
  expect(keptAt(at(4.95))).toEqual(STAYING);
  const outside = one(`[data-role="outside"][data-partition="${JANUARY}"]`);
  expect(textOf(outside)).toBe('outside the window');
  expect(hiddenThroughout(outside, between(0, 1.95))).toBe(true);
  expect(shownThroughout(outside, between(2.05, 5.45))).toBe(true);
  // April's first matches land in matches_2026_04 once the window covers April, each written in
  // amber first.
  for (const row of rowsOf('matches_2026_04')) {
    const landed = onset(row);
    expect(landed).toBeGreaterThanOrEqual(at(2));
    expect(landed).toBeLessThan(at(4.5));
    expect(onset(one('[data-role="writing"]', row))).toBe(landed);
    expect(hiddenThroughout(row, [0, landed - 0.001])).toBe(true);
    expect(shownThroughout(row, [landed, at(23.95)])).toBe(true);
  }
});

test('DETACH PARTITION takes matches_2026_01 out of matches in one step, without touching a row', () => {
  expect(sqlOf('detach')).toBe('ALTER TABLE matches DETACH PARTITION matches_2026_01;');
  expect(hiddenThroughout(statement('detach'), between(0, 4.95))).toBe(true);
  expect(shownThroughout(statement('detach'), between(5.05, 9.95))).toBe(true);
  expect(inside(frameAt(JANUARY, at(5.45)), parentBox())).toBe(true);
  expect(frameAt(JANUARY, at(7.05)).top).toBeGreaterThan(parentBox().bottom);
  // The rows only ride along with their partition: none is redrawn, rewritten, or hidden.
  for (const row of rowsOf(JANUARY)) {
    expect(animationsIn(row)).toEqual([]);
    expect(shownThroughout(row, between(0, 17.45))).toBe(true);
  }
  const untouched = one('[data-role="result"][data-step="detach"]');
  expect(textOf(untouched)).toBe('-- 0 rows read or written');
  expect(hiddenThroughout(untouched, between(0, 6.95))).toBe(true);
  expect(shownThroughout(untouched, between(7.05, 9.95))).toBe(true);
  const standalone = one('[data-role="standalone"]');
  expect(textOf(standalone)).toBe('a table of its own');
  expect(hiddenThroughout(standalone, between(0, 6.95))).toBe(true);
  expect(shownThroughout(standalone, between(7.05, 17.45))).toBe(true);
});

test("queries on matches stop seeing January, but matches_2026_01 keeps January's matches", () => {
  expect(sqlOf('count-matches')).toBe('SELECT count(*) FROM matches;');
  expect(sqlOf('count-january')).toBe(`SELECT count(*) FROM ${JANUARY};`);
  // The count on matches reads the three partitions still attached, and not January.
  const scans = all('[data-role="scan"][data-query="matches"]');
  expect(scans.map((scan) => scan.getAttribute('data-partition'))).toEqual(STAYING);
  for (const scan of scans) {
    expect(inside(frameAt(scan.getAttribute('data-partition')!, at(11)), boxOf(scan))).toBe(true);
    expect(inside(boxOf(scan), parentBox())).toBe(true);
    expect(shownThroughout(scan, between(10.55, 11.95))).toBe(true);
  }
  const onMatches = one('[data-role="result"][data-step="count-matches"]');
  expect(textOf(onMatches)).toBe(`count = ${rowCount(STAYING)}`);
  expect(textOf(one('[data-role="before"]'))).toBe(`${rowCount(PARTITIONS)} before the detach`);
  expect(hiddenThroughout(onMatches, between(0, 11.95))).toBe(true);
  expect(shownThroughout(onMatches, between(12.05, 14.95))).toBe(true);
  // The detached table still answers for every January match.
  const january = one(`[data-role="scan"][data-query="${JANUARY}"]`);
  expect(january.getAttribute('data-partition')).toBe(JANUARY);
  expect(inside(frameAt(JANUARY, at(13.5)), boxOf(january))).toBe(true);
  expect(boxOf(january).top).toBeGreaterThan(parentBox().bottom);
  expect(shownThroughout(january, between(13.05, 13.95))).toBe(true);
  const onJanuary = one('[data-role="result"][data-step="count-january"]');
  expect(textOf(onJanuary)).toBe(`count = ${rowsOf(JANUARY).length}`);
  expect(onset(onJanuary)).toBeGreaterThan(onset(onMatches));
  expect(shownThroughout(onJanuary, between(14.05, 14.95))).toBe(true);
});

test('the detached table is archived with COPY, then dropped as a whole', () => {
  expect(sqlOf('copy')).toBe(`COPY ${JANUARY} TO '/archive/${JANUARY}';`);
  expect(sqlOf('drop')).toBe(`DROP TABLE ${JANUARY};`);
  expect(shownThroughout(statement('copy'), between(15.05, 18.95))).toBe(true);
  expect(onset(statement('drop'))).toBeGreaterThan(onset(statement('copy')));
  const copied = one('[data-role="result"][data-step="copy"]');
  expect(textOf(copied)).toBe(`COPY ${rowsOf(JANUARY).length}`);
  // The archive holds the same January matches, drawn the same way.
  const archived = all('[data-role="archived-row"]');
  expect(recordsOf(archived)).toEqual(recordsOf(rowsOf(JANUARY)));
  expect(archived.map(textOf)).toEqual(rowsOf(JANUARY).map(textOf));
  for (const row of archived) {
    expect(onset(row)).toBe(onset(copied));
    expect(shownThroughout(row, [onset(copied), at(23.95)])).toBe(true);
  }
  expect(shownThroughout(partition(JANUARY), between(0, 17.45))).toBe(true);
  expect(hiddenThroughout(partition(JANUARY), between(17.55, 23.95))).toBe(true);
  expect(onset(statement('drop'))).toBeLessThan(at(17.5));
});

test('VACUUM finds no dead rows, while a bulk DELETE would have left every January match dead', () => {
  expect(sqlOf('vacuum')).toBe('VACUUM matches;');
  const none = one('[data-role="result"][data-step="vacuum"]');
  expect(textOf(none)).toBe('-- 0 dead rows to clean up');
  expect(shownThroughout(none, between(20.05, 23.95))).toBe(true);
  // VACUUM reads the three partitions still in matches before it reports.
  const vacuumed = all('[data-role="scan"][data-query="vacuum"]');
  expect(vacuumed.map((scan) => scan.getAttribute('data-partition'))).toEqual(STAYING);
  for (const scan of vacuumed) {
    expect(inside(boxOf(scan), parentBox())).toBe(true);
    expect(onset(scan)).toBeGreaterThan(onset(statement('vacuum')));
    expect(onset(scan)).toBeLessThan(onset(none));
  }
  const bulk = one('[data-role="bulk-delete"]');
  expect(hiddenThroughout(bulk, between(0, 20.45))).toBe(true);
  expect(shownThroughout(bulk, between(20.55, 23.95))).toBe(true);
  // The DELETE's bound is January's upper bound, so it would hit January's matches and no others.
  const bound = partition(JANUARY).getAttribute('data-to')!;
  expect(textOf(one('[data-role="delete"]', bulk))).toBe(
    `DELETE FROM matches WHERE played_on < '${bound}';`,
  );
  expect(recordsOf(everyRow().filter((row) => playedOn(row) < bound))).toEqual(
    recordsOf(rowsOf(JANUARY)),
  );
  // DELETE marks each January match dead, one at a time.
  const dead = all('[data-role="dead-row"]');
  expect(recordsOf(dead)).toEqual(recordsOf(rowsOf(JANUARY)));
  expect(dead.map(textOf)).toEqual(rowsOf(JANUARY).map(textOf));
  const struck = dead.map((row) => onset(one('[data-role="strike"]', row)));
  struck.forEach((moment) => expect(moment).toBeGreaterThan(at(20.5)));
  struck.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(struck[i]!));
  for (const row of dead) expect(row.closest('[data-role="bulk-delete"]')).toBe(bulk);
  const left = one('[data-role="dead-rows"]', bulk);
  expect(textOf(left)).toBe(`${dead.length} dead rows wait for VACUUM`);
  expect(onset(left)).toBeGreaterThan(struck[struck.length - 1]!);
  expect(shownThroughout(left, [onset(left), at(23.95)])).toBe(true);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
