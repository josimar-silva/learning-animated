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

import { render } from './range-partition-by-month.gen.ts';

const LOOP = 30;
// The second each step starts on.
const STEP = { split: 0, february: 4, boundary: 9, rejected: 16, created: 23 } as const;
const MONTHS = ['matches_2026_01', 'matches_2026_02', 'matches_2026_03'] as const;
const APRIL = 'matches_2026_04';
const FIRSTS = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'] as const;
// One match row in the table's column order: match_id, winner_id, map_id, played_on.
const INSERT = /^INSERT INTO matches VALUES \((\d{5}), (\d{1,4}), (\d+), '(\d{4}-\d{2}-\d{2})'\);$/;
// Every twentieth of a second in the loop.
const MOMENTS = Array.from({ length: LOOP * 20 }, (_, i) => i / 20);

const at = (seconds: number): number => seconds / LOOP;
// A window in seconds, trimmed at both ends so that a change on its first or last instant falls outside.
const between = (from: number, to: number): [number, number] => [at(from + 0.05), at(to - 0.05)];

const text = readFileSync(new URL('./range-partition-by-month.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const page = readFileSync(new URL('./index.md', import.meta.url), 'utf8');
const lesson = animationSchema.parse(frontmatterOf(page));

const all = (selector: string, within: Element = svg): Element[] => [
  ...within.querySelectorAll(selector),
];
const one = (selector: string, within: Element = svg): Element => {
  const found = all(selector, within);
  if (found.length !== 1) throw new Error(`expected one ${selector}, found ${found.length}`);
  return found[0]!;
};
const textOf = (el: Element): string => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const shownAt = (el: Element, seconds: number): boolean => opacityAt(el, at(seconds)) === 1;
// The second an element's own opacity first reaches 1.
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment * LOOP;
};

type Box = { left: number; top: number; right: number; bottom: number };
const boxOf = (rect: Element): Box => {
  const [x, y, width, height] = ['x', 'y', 'width', 'height'].map((name) => numberOf(rect, name));
  return { left: x!, top: y!, right: x! + width!, bottom: y! + height! };
};
const contains = (outer: Box, inner: Box): boolean =>
  inner.left >= outer.left &&
  inner.right <= outer.right &&
  inner.top >= outer.top &&
  inner.bottom <= outer.bottom;

const partition = (name: string): Element =>
  one(`[data-role="partition"][data-partition="${name}"]`);
const bounds = (name: string): [from: string, to: string] => [
  textOf(one('[data-role="from"]', partition(name))),
  textOf(one('[data-role="to"]', partition(name))),
];
const rangeOf = (name: string): Box => boxOf(one('[data-role="range"]', partition(name)));
const tickX = (date: string): number =>
  numberOf(one('line', one(`[data-role="tick"][data-date="${date}"]`)), 'x1');
const row = (date: string): Element => one(`[data-role="row"][data-played-on="${date}"]`);
// The chip that carries a match's played_on date from the insert line to the date line.
const match = (date: string, attempt = 1): Element =>
  one(`[data-role="match"][data-played-on="${date}"][data-attempt="${attempt}"]`);
const idOf = (el: Element): string => el.getAttribute('data-match-id')!;
// The INSERT statement a match chip comes from.
const insertOf = (chip: Element): Element =>
  one(
    `[data-role="insert"][data-match-id="${idOf(chip)}"][data-attempt="${chip.getAttribute('data-attempt')}"]`,
  );
const probe = (date: string, attempt = 1): Element =>
  one(`[data-role="probe"][data-played-on="${date}"][data-attempt="${attempt}"]`);
// Where on the date line the router looks the match up.
const probeX = (date: string, attempt = 1): number =>
  numberOf(one('circle', probe(date, attempt)), 'cx');
const covering = (date: string): Element => one(`[data-role="covering"][data-played-on="${date}"]`);
// A mark's frame surrounds one bound line of a partition panel.
const frames = (mark: Element, line: Element): boolean => {
  const frame = boxOf(one('[data-role="frame"]', mark));
  const [x, y] = [numberOf(line, 'x'), numberOf(line, 'y')];
  return x > frame.left && x < frame.right && y > frame.top && y <= frame.bottom;
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one 30 s story, told in five steps', () => {
  expect(svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
  expect(lesson.steps?.map((step) => step.at)).toEqual(Object.values(STEP));
});

test('the date line marks the first of each month, January to May 2026', () => {
  const ticks = all('[data-role="tick"]');
  expect(ticks.map((tick) => tick.getAttribute('data-date'))).toEqual([...FIRSTS]);
  expect(ticks.map(textOf)).toEqual([...FIRSTS]);
  FIRSTS.slice(1).forEach((date, i) => expect(tickX(date)).toBeGreaterThan(tickX(FIRSTS[i]!)));
  for (const tick of ticks) expect(shownThroughout(tick, between(0, LOOP))).toBe(true);
});

test('matches holds no rows of its own and splits into one partition per month', () => {
  const parent = one('[data-role="parent"]');
  expect(textOf(parent)).toContain(
    'matches (match_id, winner_id, map_id, played_on) PARTITION BY RANGE (played_on)',
  );
  expect(textOf(parent)).toContain('holds no rows of its own');
  expect(shownThroughout(parent, between(0, LOOP))).toBe(true);

  expect(all('[data-role="partition"]').map((p) => p.getAttribute('data-partition'))).toEqual([
    ...MONTHS,
    APRIL,
  ]);
  const onsets = MONTHS.map((name) => onset(partition(name)));
  onsets.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(onsets[i]!));
  for (const name of MONTHS) {
    expect(onset(partition(name))).toBeLessThan(STEP.february);
    expect(shownThroughout(partition(name), between(STEP.february, LOOP))).toBe(true);
    expect(textOf(one('[data-role="name"]', partition(name)))).toBe(name);
  }
});

test('each partition covers one month: FROM its first day, TO the first day of the next', () => {
  [...MONTHS, APRIL].forEach((name, i) => {
    const [from, to] = [FIRSTS[i]!, FIRSTS[i + 1]!];
    expect([
      partition(name).getAttribute('data-from'),
      partition(name).getAttribute('data-to'),
    ]).toEqual([from, to]);
    expect(bounds(name)).toEqual([`FROM ('${from}')`, `TO ('${to}')`]);
    // Its bar on the date line runs from tick to tick, so next to each other the bars leave no gap.
    expect(Math.abs(rangeOf(name).left - tickX(from))).toBeLessThanOrEqual(3);
    expect(Math.abs(rangeOf(name).right - tickX(to))).toBeLessThanOrEqual(3);
  });
});

test('each insert is a whole match row, and its chip carries the played_on date the router reads', () => {
  const chips = all('[data-role="match"]');
  expect(chips.map((chip) => chip.getAttribute('data-played-on'))).toEqual([
    '2026-02-14',
    '2026-03-01',
    '2026-04-09',
    '2026-04-09',
  ]);
  for (const chip of chips) {
    const statement = insertOf(chip);
    const date = chip.getAttribute('data-played-on')!;
    const values = INSERT.exec(textOf(statement));
    expect(values, textOf(statement)).not.toBeNull();
    expect([values![1], values![4]]).toEqual([idOf(chip), date]);
    expect(textOf(one('[data-role="key"]', statement))).toBe(`'${date}'`);
    expect(textOf(all('text', chip)[0]!)).toBe(date);
    // The statement stays up for exactly as long as its chip is on its way.
    expect(MOMENTS.filter((s) => shownAt(statement, s) !== shownAt(chip, s))).toEqual([]);
  }
});

test('the insert line shows one statement at a time, and the bare INSERT INTO matches between matches', () => {
  const statements = all('[data-role="insert"]');
  expect(MOMENTS.filter((s) => statements.filter((el) => shownAt(el, s)).length !== 1)).toEqual([]);
  const idle = statements.filter((el) => !el.hasAttribute('data-match-id'));
  expect(idle.map(textOf)).toEqual(['INSERT INTO matches']);
  expect(shownThroughout(idle[0]!, between(0, STEP.february))).toBe(true);
});

test('every row is a match in the partition whose range covers its date, never in matches itself', () => {
  const parent = boxOf(one('[data-role="panel"]', one('[data-role="parent"]')));
  const rows = all('[data-role="row"]');
  expect(rows.length).toBeGreaterThan(3);
  for (const stored of rows) {
    const date = stored.getAttribute('data-played-on')!;
    const home = partition(stored.getAttribute('data-partition')!);
    expect(date >= home.getAttribute('data-from')! && date < home.getAttribute('data-to')!).toBe(
      true,
    );
    expect(textOf(stored)).toBe(date);
    const cell = boxOf(one('[data-role="cell"]', stored));
    expect(contains(boxOf(one('[data-role="panel"]', home)), cell)).toBe(true);
    expect(cell.top).toBeGreaterThan(parent.bottom);
    expect(onset(stored)).toBeGreaterThanOrEqual(onset(home));
  }
  // Match ids have five digits, so they never read as player ids, and they grow as matches are played.
  const ids = rows
    .toSorted((a, b) =>
      a.getAttribute('data-played-on')!.localeCompare(b.getAttribute('data-played-on')!),
    )
    .map(idOf);
  for (const id of ids) expect(id).toMatch(/^\d{5}$/);
  ids.slice(1).forEach((id, i) => expect(Number(id)).toBeGreaterThan(Number(ids[i])));
});

test('a match played on 14 February goes to matches_2026_02', () => {
  const chip = match('2026-02-14');
  const stored = row('2026-02-14');
  expect(textOf(chip)).toBe('2026-02-14');
  // One id names one match across the course, and partitioned-index already uses 51042.
  expect(idOf(chip)).toBe('51190');
  expect(page).toContain(`match ${idOf(chip)}`);
  expect(hiddenThroughout(chip, between(0, STEP.february))).toBe(true);
  expect(shownAt(chip, STEP.february + 0.05)).toBe(true);

  expect(stored.getAttribute('data-partition')).toBe('matches_2026_02');
  expect(idOf(stored)).toBe(idOf(chip));
  const lands = onset(stored);
  expect(lands).toBeGreaterThan(STEP.february);
  expect(lands).toBeLessThan(STEP.boundary);
  expect(hiddenThroughout(stored, between(0, lands))).toBe(true);
  expect(shownThroughout(stored, between(lands, LOOP))).toBe(true);
  expect(hiddenThroughout(chip, between(lands, LOOP))).toBe(true);

  const picked = covering('2026-02-14');
  expect(picked.getAttribute('data-partition')).toBe('matches_2026_02');
  expect(onset(picked)).toBeLessThan(lands);
  expect(shownAt(picked, lands - 0.05)).toBe(true);
  expect(probeX('2026-02-14')).toBeGreaterThan(rangeOf('matches_2026_02').left);
  expect(probeX('2026-02-14')).toBeLessThan(rangeOf('matches_2026_02').right);
});

test('a match played on 1 March goes to March: FROM includes the bound date and TO excludes it', () => {
  const stored = row('2026-03-01');
  expect(stored.getAttribute('data-partition')).toBe('matches_2026_03');
  expect(idOf(stored)).toBe(idOf(match('2026-03-01')));
  const lands = onset(stored);
  expect(lands).toBeGreaterThan(STEP.boundary);
  expect(lands).toBeLessThan(STEP.rejected);
  expect(hiddenThroughout(stored, between(0, lands))).toBe(true);
  expect(shownThroughout(stored, between(lands, LOOP))).toBe(true);

  // 1 March sits exactly on the bound that February and March share.
  expect(probeX('2026-03-01')).toBe(tickX('2026-03-01'));
  expect(bounds('matches_2026_02')[1]).toBe("TO ('2026-03-01')");
  expect(bounds('matches_2026_03')[0]).toBe("FROM ('2026-03-01')");

  const excluded = one('[data-role="excluded"]');
  const included = one('[data-role="included"]');
  expect([excluded.getAttribute('data-partition'), excluded.getAttribute('data-bound')]).toEqual([
    'matches_2026_02',
    'to',
  ]);
  expect([included.getAttribute('data-partition'), included.getAttribute('data-bound')]).toEqual([
    'matches_2026_03',
    'from',
  ]);
  expect(textOf(excluded)).toContain('excludes');
  expect(textOf(included)).toContain('includes');
  expect(frames(excluded, one('[data-role="to"]', partition('matches_2026_02')))).toBe(true);
  expect(frames(included, one('[data-role="from"]', partition('matches_2026_03')))).toBe(true);
  for (const mark of [excluded, included]) {
    expect(hiddenThroughout(mark, between(0, STEP.boundary))).toBe(true);
    expect(onset(mark)).toBeGreaterThan(onset(probe('2026-03-01')));
    expect(shownThroughout(mark, between(onset(mark), lands))).toBe(true);
  }

  // The router settles on March only once the bounds have spoken.
  const picked = covering('2026-03-01');
  expect(picked.getAttribute('data-partition')).toBe('matches_2026_03');
  expect(onset(picked)).toBeGreaterThan(onset(included));
  expect(shownAt(picked, lands - 0.05)).toBe(true);
});

test('a match played on 9 April is rejected: no partition covers it and there is no DEFAULT partition', () => {
  const chip = match('2026-04-09', 1);
  expect(hiddenThroughout(chip, between(0, STEP.rejected))).toBe(true);
  expect(shownAt(chip, STEP.rejected + 0.05)).toBe(true);
  expect(hiddenThroughout(chip, between(STEP.created, LOOP))).toBe(true);
  expect(hiddenThroughout(partition(APRIL), between(0, STEP.created))).toBe(true);
  expect(hiddenThroughout(row('2026-04-09'), between(0, STEP.created))).toBe(true);
  expect(probeX('2026-04-09', 1)).toBeGreaterThan(tickX('2026-04-01'));
  expect(probeX('2026-04-09', 1)).toBeLessThan(tickX('2026-05-01'));

  const gap = one('[data-role="gap"]');
  expect([gap.getAttribute('data-from'), gap.getAttribute('data-to')]).toEqual([
    '2026-04-01',
    '2026-05-01',
  ]);
  expect(textOf(gap)).toContain('no partition');
  const noDefault = one('[data-role="default"]');
  expect(textOf(noDefault)).toBe('no DEFAULT partition');
  const rejected = one('[data-role="rejected"]', chip);
  expect(textOf(rejected)).toContain('rejected');
  const error = one('[data-role="error"]');
  expect(textOf(error)).toContain('ERROR: no partition of relation "matches" found for row');
  expect(textOf(error)).toContain('(played_on) = (2026-04-09)');

  // The router finds no range, then no default partition, and only then rejects the row.
  expect(onset(gap)).toBeGreaterThan(onset(probe('2026-04-09', 1)));
  expect(onset(noDefault)).toBeGreaterThan(onset(gap));
  expect(onset(rejected)).toBeGreaterThan(onset(noDefault));
  expect(onset(error)).toBe(onset(rejected));
  for (const el of [gap, noDefault, error]) {
    expect(hiddenThroughout(el, between(0, STEP.rejected))).toBe(true);
    expect(shownThroughout(el, between(onset(el), STEP.created))).toBe(true);
    expect(hiddenThroughout(el, between(STEP.created, LOOP))).toBe(true);
  }
});

test("next month's partition is created, and the same April match then lands in it", () => {
  const create = one('[data-role="create"]');
  expect(textOf(create)).toBe(
    "CREATE TABLE matches_2026_04 PARTITION OF matches FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');",
  );
  expect(hiddenThroughout(create, between(0, STEP.created))).toBe(true);
  expect(shownThroughout(create, between(STEP.created, LOOP))).toBe(true);
  expect(onset(partition(APRIL))).toBe(onset(create));
  expect(shownThroughout(partition(APRIL), between(STEP.created, LOOP))).toBe(true);

  // The game retries the insert it lost: the same match id, the same row.
  const [first, retry] = [match('2026-04-09', 1), match('2026-04-09', 2)];
  expect(idOf(retry)).toBe(idOf(first));
  expect(textOf(insertOf(retry))).toBe(textOf(insertOf(first)));

  const stored = row('2026-04-09');
  expect(onset(retry)).toBeGreaterThan(onset(partition(APRIL)));
  expect(stored.getAttribute('data-partition')).toBe(APRIL);
  expect(idOf(stored)).toBe(idOf(retry));
  expect(covering('2026-04-09').getAttribute('data-partition')).toBe(APRIL);
  expect(onset(stored)).toBeGreaterThan(onset(retry));
  expect(shownThroughout(stored, between(onset(stored), LOOP))).toBe(true);
  expect(hiddenThroughout(retry, between(onset(stored), LOOP))).toBe(true);

  // March was created the same way: its partition was there, empty, before its first match.
  const firstMarchMatch = onset(row('2026-03-01'));
  expect(onset(partition('matches_2026_03'))).toBeLessThan(STEP.february);
  for (const stored of all('[data-role="row"][data-partition="matches_2026_03"]')) {
    expect(onset(stored)).toBeGreaterThanOrEqual(firstMarchMatch);
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const steps = lesson.steps ?? [];
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => {
    const next = steps[i + 1]?.at ?? LOOP;
    expect(shownThroughout(captions[i]!, between(step.at, next))).toBe(true);
  });
});
