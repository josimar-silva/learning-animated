import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './partition-pruning.gen.ts';

const LOOP = 30;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./partition-pruning.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => (el.textContent ?? '').trim().replace(/\s+/g, ' ');
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

const PARTITIONS = [
  { name: 'matches_2026_01', from: '2026-01-01', to: '2026-02-01' },
  { name: 'matches_2026_02', from: '2026-02-01', to: '2026-03-01' },
  { name: 'matches_2026_03', from: '2026-03-01', to: '2026-04-01' },
  { name: 'matches_2026_04', from: '2026-04-01', to: '2026-05-01' },
] as const;
const EVERY_MONTH = PARTITIONS.map((p) => p.name);
const MARCH = 'matches_2026_03';
// Player 1042 is Koala on the course's roster of 20 players, whose ids every Data lesson shares.
const KOALA = '1042';
const ROSTER = [
  412, 2981, 7702, 5214, 7915, 9612, 9745, 9861, 9980, 8240, 1042, 8577, 3560, 8903, 9128, 6120,
  7038, 2046, 9406, 4127,
].map(String);

type Query = 'march' | 'winner';
// When each query is on screen, when the planner starts checking each partition (the last
// moment ends the checks and starts the scan), and how long the scan takes to read one row.
const STORY = {
  march: { shown: [0, 16], checks: [4, 5.5, 7, 8.5, 10], read: 1 },
  winner: { shown: [16, 30], checks: [17, 18, 19, 20, 21], read: 0.5 },
} as const;
// The rows each query's WHERE clause keeps, written out from its SQL.
const WHERE: Record<Query, (row: Element) => boolean> = {
  march: (row) => {
    const day = row.getAttribute('data-played-on')!;
    return day >= '2026-03-01' && day < '2026-04-01';
  },
  winner: (row) => row.getAttribute('data-winner-id') === KOALA,
};
const VERDICTS = {
  pruned: "can't hold wanted rows: pruned",
  kept: 'may hold wanted rows: kept',
} as const;

const select = (role: string, query: Query, partition?: string): string =>
  `[data-role="${role}"][data-query="${query}"]${partition ? `[data-partition="${partition}"]` : ''}`;
const keyOf = (el: Element): string =>
  `${el.getAttribute('data-partition')} ${el.getAttribute('data-played-on')}`;
const nameOf = (el: Element): string =>
  ['data-role', 'data-query', 'data-partition', 'data-played-on']
    .map((attribute) => el.getAttribute(attribute))
    .filter(Boolean)
    .join(' ');

// Shown just inside [from, to), and hidden through the rest of the loop.
function onlyDuring(el: Element, from: number, to: number): void {
  const name = nameOf(el);
  if (from > 0) {
    expect(hiddenThroughout(el, between(0, from - 0.05)), `${name} hides before ${from} s`).toBe(
      true,
    );
  }
  expect(
    shownThroughout(el, between(from + 0.05, to - 0.05)),
    `${name} shows from ${from} s to ${to} s`,
  ).toBe(true);
  if (to < LOOP) {
    expect(
      hiddenThroughout(el, between(to + 0.05, LOOP - 0.05)),
      `${name} hides after ${to} s`,
    ).toBe(true);
  }
}

// The one count of its kind that shows at a moment, or null when none does.
function countAt(of: 'partitions' | 'rows', seconds: number): string | null {
  const shown = all(`[data-role="count"][data-of="${of}"]`).filter(
    (el) => opacityAt(el, at(seconds)) === 1,
  );
  if (shown.length > 1) throw new Error(`${shown.length} ${of} counts show at ${seconds} s`);
  return shown[0] ? textOf(shown[0]) : null;
}

const rowsOf = (partition: string): Element[] =>
  all(`[data-role="row"][data-partition="${partition}"]`);

// The rows a query's scan reads, in order, each with the moment its read starts.
function scanOf(query: Query, kept: readonly string[]): Array<[row: Element, start: number]> {
  const { checks, read } = STORY[query];
  return kept.flatMap(rowsOf).map((row, i) => [row, checks[4] + i * read]);
}

function assertChecks(query: Query): void {
  const { checks } = STORY[query];
  PARTITIONS.forEach(({ name, from, to }, i) => {
    const [start, end] = [checks[i]!, checks[i + 1]!];
    const ring = one(select('check', query, name));
    onlyDuring(ring, start, end);
    // The ring frames the bounds drawn on the partition.
    const bounds = one(`[data-role="bounds"][data-partition="${name}"]`);
    expect(numberOf(ring, 'y')).toBeLessThan(numberOf(bounds, 'y') - 10);
    expect(numberOf(ring, 'y') + numberOf(ring, 'height')).toBeGreaterThan(numberOf(bounds, 'y'));
    const compare = one(select('compare', query, name));
    expect(textOf(compare)).toBe(`${name} ${from} to ${to}`);
    onlyDuring(compare, start, end);
  });
}

function assertVerdicts(query: Query, kept: readonly string[]): void {
  const { shown, checks } = STORY[query];
  PARTITIONS.forEach(({ name }, i) => {
    const verdict = one(select('verdict', query, name));
    const expected = kept.includes(name) ? 'kept' : 'pruned';
    expect(verdict.getAttribute('data-verdict')).toBe(expected);
    expect(textOf(verdict)).toBe(VERDICTS[expected]);
    onlyDuring(verdict, checks[i + 1]!, shown[1]);
  });
}

function assertScan(query: Query, kept: readonly string[]): void {
  const { read } = STORY[query];
  const scan = scanOf(query, kept);
  const reads = all(select('read', query));
  expect(reads.map(keyOf)).toEqual(scan.map(([row]) => keyOf(row)));
  reads.forEach((highlight, i) => onlyDuring(highlight, scan[i]![1], scan[i]![1] + read));
  const scanning = all(select('scanning', query));
  expect(scanning.map((el) => el.getAttribute('data-partition'))).toEqual([...kept]);
  scanning.forEach((outline, p) => {
    const starts = scan.filter(([row]) => row.getAttribute('data-partition') === kept[p]);
    onlyDuring(outline, starts[0]![1], starts[starts.length - 1]![1] + read);
  });
}

function assertReturned(query: Query, kept: readonly string[]): void {
  const { shown, read } = STORY[query];
  const found = scanOf(query, kept).filter(([row]) => WHERE[query](row));
  const marks = all(select('returned', query));
  expect(marks.map(keyOf)).toEqual(found.map(([row]) => keyOf(row)));
  marks.forEach((mark, i) => onlyDuring(mark, found[i]![1] + read, shown[1]));
}

function assertCounts(query: Query, kept: readonly string[]): void {
  const { shown, checks } = STORY[query];
  expect(countAt('partitions', shown[0] + 0.05)).toBe('0 of 4');
  expect(countAt('rows', shown[0] + 0.05)).toBe('0');
  expect(countAt('rows', checks[4] - 0.05)).toBe('0');
  scanOf(query, kept).forEach(([row, start], i) => {
    const partition = kept.indexOf(row.getAttribute('data-partition')!);
    expect(countAt('partitions', start + 0.05)).toBe(`${partition + 1} of 4`);
    expect(countAt('rows', start + 0.05)).toBe(String(i + 1));
  });
}

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 30 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('30s');
});

test("matches has one partition per month of played_on, January to April 2026, and each row sits inside its partition's bounds", () => {
  expect(textOf(one('[data-role="table"]'))).toBe('matches partitioned by the month of played_on');
  const partitions = all('[data-role="partition"]');
  expect(
    partitions.map((p) => ['data-partition', 'data-from', 'data-to'].map((a) => p.getAttribute(a))),
  ).toEqual(PARTITIONS.map(({ name, from, to }) => [name, from, to]));
  for (const { name, from, to } of PARTITIONS) {
    expect(textOf(one(`[data-role="bounds"][data-partition="${name}"]`))).toBe(`${from} to ${to}`);
    const rows = rowsOf(name);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const day = row.getAttribute('data-played-on')!;
      expect(day >= from && day < to, `${day} belongs in ${name}`).toBe(true);
      expect(textOf(row)).toBe(`${day} winner ${row.getAttribute('data-winner-id')}`);
      expect(shownThroughout(row, between(0, 29.95))).toBe(true);
    }
  }
});

test('every match was won by a player on the course roster', () => {
  const winners = all('[data-role="row"]').map((row) => row.getAttribute('data-winner-id')!);
  expect(winners).toHaveLength(12);
  expect(winners.filter((id) => !ROSTER.includes(id))).toEqual([]);
});

test("a query asks for March's matches by played_on, and the planner reads its range", () => {
  const query = one('[data-role="query"][data-query="march"]');
  expect(textOf(query)).toContain('SELECT * FROM matches');
  expect(textOf(query)).toContain("WHERE played_on >= '2026-03-01'");
  expect(textOf(query)).toContain("AND played_on < '2026-04-01'");
  onlyDuring(query, 0, 16);
  const wants = one(select('wants', 'march'));
  expect(textOf(wants)).toBe('2026-03-01 to 2026-04-01');
  onlyDuring(wants, 1, 16);
  // The query travels to the planner before the planner shows the range.
  const handoff = one(select('handoff', 'march'));
  expect(onsetOf(handoff)).toBeLessThan(onsetOf(wants)!);
  expect(opacityAt(handoff, onsetOf(wants)!)).toBe(0);
});

test("the planner compares the range with each partition's bounds, one partition at a time", () => {
  assertChecks('march');
});

test('only March can hold rows in the range, so the planner prunes January, February, and April', () => {
  assertVerdicts('march', [MARCH]);
  const plan = one(select('plan', 'march'));
  expect(textOf(plan)).toBe(`plan scan ${MARCH} only`);
  onlyDuring(plan, 10, 16);
});

test('only matches_2026_03 is scanned, one row at a time, while the pruned months stay dark', () => {
  PARTITIONS.forEach(({ name }, i) => {
    const dark = svg.querySelector(select('pruned', 'march', name));
    if (name === MARCH) expect(dark).toBeNull();
    else onlyDuring(dark!, STORY.march.checks[i + 1]!, 16);
  });
  assertScan('march', [MARCH]);
  assertReturned('march', [MARCH]);
  assertCounts('march', [MARCH]);
  expect(countAt('partitions', 15.95)).toBe('1 of 4');
  expect(countAt('rows', 15.95)).toBe('3');
});

test("a query for Koala's wins filters on winner_id, so the planner keeps every month", () => {
  const query = one('[data-role="query"][data-query="winner"]');
  expect(textOf(query)).toContain('SELECT * FROM matches');
  expect(textOf(query)).toContain(`WHERE winner_id = ${KOALA}`);
  expect(textOf(query)).not.toContain('played_on');
  onlyDuring(query, 16, 30);
  const wants = one(select('wants', 'winner'));
  expect(textOf(wants)).toBe('any played_on');
  onlyDuring(wants, 17, 30);
  const handoff = one(select('handoff', 'winner'));
  expect(onsetOf(handoff)).toBeLessThan(onsetOf(wants)!);
  expect(opacityAt(handoff, onsetOf(wants)!)).toBe(0);
  assertChecks('winner');
  assertVerdicts('winner', EVERY_MONTH);
  expect(all(select('pruned', 'winner'))).toEqual([]);
  const plan = one(select('plan', 'winner'));
  expect(textOf(plan)).toBe('plan scan all 4 partitions');
  onlyDuring(plan, 21, 30);
});

test("every month is scanned for Koala's wins: 12 rows read to return 2", () => {
  assertScan('winner', EVERY_MONTH);
  assertReturned('winner', EVERY_MONTH);
  const found = all(select('returned', 'winner')).map((mark) =>
    mark.getAttribute('data-partition'),
  );
  expect(found).toHaveLength(2);
  // At least one month holds none of Koala's wins and is read all the same.
  expect(EVERY_MONTH.some((name) => !found.includes(name))).toBe(true);
  assertCounts('winner', EVERY_MONTH);
  expect(countAt('partitions', 29.95)).toBe('4 of 4');
  expect(countAt('rows', 29.95)).toBe('12');
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
