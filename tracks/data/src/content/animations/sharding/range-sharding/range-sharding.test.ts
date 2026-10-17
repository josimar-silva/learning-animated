import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
  valueAt,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './range-sharding.gen.ts';

const LOOP = 30;
// The game's 20 players by tag and player id, the same in every Data lesson.
const ROSTER: Readonly<Record<string, number>> = {
  Adder: 412,
  Badger: 2981,
  Coyote: 7702,
  Dingo: 5214,
  Egret: 7915,
  Ferret: 9612,
  Gibbon: 9745,
  Heron: 9861,
  Iguana: 9980,
  Jackal: 8240,
  Koala: 1042,
  Lemur: 8577,
  Marten: 3560,
  Newt: 8903,
  Otter: 9128,
  Petrel: 6120,
  Quail: 7038,
  Raven: 2046,
  Stoat: 9406,
  Tapir: 4127,
};
// Each server owns the ids from its lower bound up to, but not including, its upper bound. The
// top range has no upper bound, so every id above 7500, however high, lands on db-3.
const RANGES = [
  { server: 'db-0', lower: 0, upper: 2500 },
  { server: 'db-1', lower: 2500, upper: 5000 },
  { server: 'db-2', lower: 5000, upper: 7500 },
  { server: 'db-3', lower: 7500, upper: Infinity },
] as const;
type Range = (typeof RANGES)[number];
const BOUNDARIES = RANGES.slice(1).map((range) => range.lower);
const written = (bound: number): string => (Number.isFinite(bound) ? String(bound) : '∞');
function rangeOf(id: number): Range {
  const range = RANGES.find(({ lower, upper }) => lower <= id && id < upper);
  if (!range) throw new Error(`no server owns player ${id}`);
  return range;
}
const ownerOf = (id: number): string => rangeOf(id).server;
// Ids grow as players sign up, so the newest players hold the highest ids.
const BY_ID = Object.entries(ROSTER).sort(([, a], [, b]) => a - b);
const NEWEST = BY_ID.slice(-4);

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./range-sharding.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);
const steps = lesson.steps ?? [];
// A step runs from its start to the next step's, or to the end of the loop.
const stepWindow = (n: number): [start: number, end: number] => [
  steps[n - 1]!.at,
  steps[n]?.at ?? LOOP,
];

const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const serverOf = (el: Element): string | null => el.getAttribute('data-server');
const tagOf = (el: Element): string => el.getAttribute('data-tag') ?? '';
const shownAt = (el: Element, seconds: number): boolean => opacityAt(el, at(seconds)) === 1;
const visibleAt = (selector: string, seconds: number): Element[] =>
  all(selector).filter((el) => shownAt(el, seconds));
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment * LOOP;
};

// Where a moving element sits at a moment, read from its translate the way valueAt reads an animate.
function positionAt(el: Element, seconds: number): [x: number, y: number] {
  const motion = el.querySelector('animateTransform');
  if (!motion) throw new Error(`${el.getAttribute('data-role')} never moves`);
  const times = motion.getAttribute('keyTimes')!.split(';').map(Number);
  const points = motion
    .getAttribute('values')!
    .split(';')
    .map((point) => point.split(',').map(Number));
  const t = at(seconds);
  let i = times.length - 1;
  while (i > 0 && times[i]! > t) i -= 1;
  if (i === times.length - 1) return [points[i]![0]!, points[i]![1]!];
  const progress = (t - times[i]!) / (times[i + 1]! - times[i]!);
  const [from, to] = [points[i]!, points[i + 1]!];
  return [from[0]! + (to[0]! - from[0]!) * progress, from[1]! + (to[1]! - from[1]!) * progress];
}

type Box = { left: number; top: number; right: number; bottom: number };
// The box an element draws: its own rect, or the first rect inside it.
function boxOf(el: Element): Box {
  const rect = el.tagName.toLowerCase() === 'rect' ? el : el.querySelector('rect');
  if (!rect) throw new Error(`${el.getAttribute('data-role')} has no rect`);
  const [left, top] = [numberOf(rect, 'x'), numberOf(rect, 'y')];
  return {
    left,
    top,
    right: left + numberOf(rect, 'width'),
    bottom: top + numberOf(rect, 'height'),
  };
}
const inside = ([x, y]: [number, number], box: Box): boolean =>
  x > box.left && x < box.right && y > box.top && y < box.bottom;
const within = (inner: Box, outer: Box): boolean =>
  inner.left >= outer.left &&
  inner.right <= outer.right &&
  inner.top >= outer.top &&
  inner.bottom <= outer.bottom;

const boundaryX = (id: number): number =>
  numberOf(one(`[data-role="boundary"][data-at="${id}"]`), 'x1');
// Where an id sits on the axis, measured from the first two boundaries.
function xAt(id: number): number {
  const [first, second] = [BOUNDARIES[0]!, BOUNDARIES[1]!];
  const scale = (boundaryX(second) - boundaryX(first)) / (second - first);
  return boundaryX(first) + (id - first) * scale;
}
// The axis stays open past its last boundary, and its open end is marked ∞.
const openEndX = (): number => numberOf(one('[data-role="open-end"] text'), 'x');
// The stretch of the axis a range covers, up to the open end for the top range.
const stretchOf = ({ lower, upper }: Range): [left: number, right: number] => [
  xAt(lower),
  Number.isFinite(upper) ? xAt(upper) : openEndX(),
];
const players = all('[data-role="player"]');
const idOf = (el: Element): number => Number(el.getAttribute('data-id'));
const playersOf = (server: string): Element[] => players.filter((p) => serverOf(p) === server);
const playerTagged = (tag: string): Element => {
  const found = players.find((p) => tagOf(p) === tag);
  if (!found) throw new Error(`no player tagged ${tag}`);
  return found;
};
const panelOf = (server: string): Box =>
  boxOf(one(`[data-role="server"][data-server="${server}"]`));
// A server's rows from top to bottom.
const rowsOf = (server: string): Element[] =>
  playersOf(server).sort((a, b) => boxOf(a).top - boxOf(b).top);

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('opens the sharding section with five steps on whole seconds of a 30 s loop', () => {
  expect([lesson.id, lesson.section, lesson.order]).toEqual(['range-sharding', 'sharding', 1]);
  expect(lesson.title).toBe('Splitting players by id range');
  expect(svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
  expect(steps).toHaveLength(5);
  for (const step of steps) expect(Number.isInteger(step.at)).toBe(true);
});

test('cites range partitioning, partitions that are foreign tables, and the MAXVALUE bound', () => {
  expect(lesson.references.map((reference) => reference.url)).toEqual([
    'https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-OVERVIEW-RANGE',
    'https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE',
    'https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-PARTITION',
  ]);
});

test('four servers own [0, 2500), [2500, 5000), [5000, 7500), and [7500, ∞) of the id axis', () => {
  // Equal ranges draw equally wide, so the boundaries sit evenly along the axis.
  const [first, second, third] = BOUNDARIES.map(boundaryX);
  expect(third! - second!).toBeCloseTo(second! - first!, 6);
  const ticks = all('[data-role="tick"]');
  expect(ticks.map(textOf)).toEqual(['0', '2500', '5000', '7500']);
  for (const tick of ticks) expect(numberOf(tick, 'x')).toBeCloseTo(xAt(Number(textOf(tick))), 6);

  const servers = all('[data-role="server"]');
  expect(servers.map(serverOf)).toEqual(RANGES.map((range) => range.server));
  for (const [i, range] of RANGES.entries()) {
    const { server, lower, upper } = range;
    const [left, right] = stretchOf(range);
    expect(textOf(servers[i]!)).toContain(server);
    expect(textOf(servers[i]!)).toContain(`[${lower}, ${written(upper)})`);
    // Each server sits under its own stretch of the axis, and its bar spans that stretch.
    expect(panelOf(server).left).toBeGreaterThanOrEqual(left);
    expect(panelOf(server).right).toBeLessThanOrEqual(right);
    const bar = boxOf(one(`[data-role="range"][data-server="${server}"]`));
    expect(bar.left).toBeGreaterThanOrEqual(left);
    expect(bar.right).toBeLessThanOrEqual(right);
    expect(bar.right - bar.left).toBeGreaterThan(0.9 * (right - left));
  }
  const drawn = [...ticks, ...servers, ...all('[data-role="boundary"], [data-role="range"]')];
  for (const el of drawn) expect(shownThroughout(el, [0, 1])).toBe(true);
});

test('the top range is open, so the axis runs on past the newest player with no boundary above 7500', () => {
  expect(all('[data-role="boundary"]').map((b) => numberOf(b, 'data-at'))).toEqual(BOUNDARIES);
  const openEnd = one('[data-role="open-end"]');
  expect(serverOf(openEnd)).toBe(RANGES.at(-1)!.server);
  expect(textOf(openEnd)).toBe('∞');
  expect(openEndX()).toBeGreaterThan(xAt(Math.max(...Object.values(ROSTER))));
  expect(shownThroughout(openEnd, [0, 1])).toBe(true);
});

test('each player sits on the server whose range holds its id, in id order', () => {
  expect(players).toHaveLength(Object.keys(ROSTER).length);
  expect(Object.fromEntries(players.map((p) => [tagOf(p), idOf(p)]))).toEqual(ROSTER);
  for (const player of players) {
    const [tag, id] = [tagOf(player), idOf(player)];
    expect(textOf(player)).toContain(String(id));
    expect(textOf(player)).toContain(tag);
    expect(serverOf(player), tag).toBe(ownerOf(id));
    expect(within(boxOf(player), panelOf(ownerOf(id))), tag).toBe(true);
    expect(shownThroughout(player, [0, 1])).toBe(true);
  }
  for (const { server } of RANGES) {
    const ids = rowsOf(server).map(idOf);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  }
});

test('step 1 shows the split alone, before any lookup', () => {
  const [start, end] = stepWindow(1);
  const roles = [
    'lookup',
    'scan',
    'bound',
    'match',
    'found',
    'dot',
    'signup',
    'count',
    'hit',
    'verdict',
    'hot',
  ];
  for (const role of roles) {
    const marks = all(`[data-role="${role}"]`);
    expect(marks.length, role).toBeGreaterThan(0);
    for (const el of marks) {
      expect(hiddenThroughout(el, between(start, end - 0.05)), role).toBe(true);
    }
  }
});

test('in step 2, a lookup compares 6120 with the boundaries and finds Petrel on db-2', () => {
  const [start, end] = stepWindow(2);
  const lookup = one('[data-role="lookup"]');
  const id = idOf(lookup);
  expect(id).toBe(ROSTER.Petrel);
  expect(textOf(lookup)).toBe(String(id));
  expect(onset(lookup)).toBeGreaterThan(start);
  expect(onset(lookup)).toBeLessThan(start + 1);

  // The chip stops between the two boundaries around the id, and the comparison shows.
  const range = rangeOf(id);
  const { lower, upper, server } = range;
  const bounds = all('[data-role="bound"][data-for="lookup"]');
  expect(bounds.map(textOf)).toEqual([`${lower} ≤`, `< ${written(upper)}`]);
  const compared = onset(bounds[0]!);
  expect(compared).toBeGreaterThan(onset(lookup));
  const [x] = positionAt(lookup, compared + 0.05);
  const [left, right] = stretchOf(range);
  expect(x).toBeGreaterThan(left);
  expect(x).toBeLessThan(right);
  const match = one('[data-role="match"][data-for="lookup"]');
  expect(serverOf(match)).toBe(server);
  expect(onset(match)).toBe(compared);

  // The chip drops onto Petrel's own row on db-2, which lights up for the rest of the step.
  const found = one('[data-role="found"][data-for="lookup"]');
  const landed = onset(found);
  expect([tagOf(found), serverOf(found)]).toEqual(['Petrel', 'db-2']);
  expect(serverOf(playerTagged('Petrel'))).toBe(server);
  expect(boxOf(found)).toEqual(boxOf(playerTagged('Petrel')));
  expect(inside(positionAt(lookup, landed), boxOf(found))).toBe(true);
  expect(landed).toBeGreaterThan(compared);
  expect(hiddenThroughout(found, between(0, landed - 0.05))).toBe(true);
  expect(shownThroughout(found, between(landed + 0.05, end - 0.05))).toBe(true);
  expect(shownThroughout(match, between(compared + 0.05, end - 0.05))).toBe(true);
  for (const el of [lookup, ...bounds]) {
    expect(hiddenThroughout(el, between(landed + 0.05, LOOP))).toBe(true);
  }
  expect(visibleAt('[data-role="found"]', end - 0.05)).toEqual([found]);
});

test('in step 3, the four newest players all live on db-3, so a scan over their ids reads one server', () => {
  const [start, end] = stepWindow(3);
  const scan = one('[data-role="scan"]');
  const [from, to] = [numberOf(scan, 'data-from'), numberOf(scan, 'data-to')];
  expect([from, to]).toEqual([NEWEST[0]![1], NEWEST.at(-1)![1]]);
  expect(textOf(scan)).toBe(`${from} to ${to}`);
  expect(onset(scan)).toBeGreaterThan(start);
  expect(onset(scan)).toBeLessThan(start + 1);

  // The whole id range sits inside one server's range, the top one, which has no upper bound.
  expect(rangeOf(from)).toBe(rangeOf(to));
  const range = rangeOf(from);
  const { lower, upper, server } = range;
  expect(server).toBe('db-3');
  const bounds = all('[data-role="bound"][data-for="scan"]');
  expect(bounds.map(textOf)).toEqual([`${lower} ≤`, `< ${written(upper)}`]);
  const compared = onset(bounds[0]!);
  expect(compared).toBeGreaterThan(onset(scan));
  const [x] = positionAt(scan, compared + 0.05);
  const [left, right] = stretchOf(range);
  expect(x).toBeGreaterThan(left);
  expect(x).toBeLessThan(right);
  const match = one('[data-role="match"][data-for="scan"]');
  expect(serverOf(match)).toBe(server);
  expect(onset(match)).toBe(compared);

  // Exactly the four newest players light up, all on db-3.
  const found = visibleAt('[data-role="found"]', end - 0.05);
  expect(found.map(tagOf).sort()).toEqual(NEWEST.map(([tag]) => tag).sort());
  expect(new Set(found.map(serverOf))).toEqual(new Set([server]));
  for (const el of found) {
    expect(el.getAttribute('data-for')).toBe('scan');
    expect(boxOf(el)).toEqual(boxOf(playerTagged(tagOf(el))));
    expect(onset(el)).toBeGreaterThan(compared);
    expect(hiddenThroughout(el, between(0, onset(el) - 0.05))).toBe(true);
    expect(shownThroughout(el, between(onset(el) + 0.05, end - 0.05))).toBe(true);
  }
  // Neighbouring ids stay together: no other player's row sits between them.
  const rows = rowsOf(server).map(tagOf);
  const places = found.map((el) => rows.indexOf(tagOf(el))).sort((a, b) => a - b);
  expect(places.at(-1)! - places[0]!).toBe(found.length - 1);
  const lit = Math.min(...found.map(onset));
  expect(hiddenThroughout(scan, between(lit + 0.05, LOOP))).toBe(true);
});

test('in step 4, the players appear along the id axis in sign-up order, and db-3 holds 11 of the 20', () => {
  const [start, end] = stepWindow(4);
  const dots = all('[data-role="dot"]');
  expect(dots.map(tagOf).sort()).toEqual(Object.keys(ROSTER).sort());
  const settled = end - 0.05;
  for (const dot of dots) {
    expect(hiddenThroughout(dot, between(0, start))).toBe(true);
    expect(shownAt(dot, settled)).toBe(true);
    expect(positionAt(dot, settled)[0]).toBeCloseTo(xAt(ROSTER[tagOf(dot)]!), 6);
  }
  expect(new Set(dots.map((dot) => positionAt(dot, settled)[1])).size).toBe(1);
  // Ids grow as players sign up, so the dots appear from the lowest id to the highest.
  const appearances = BY_ID.map(([tag]) => onset(one(`[data-role="dot"][data-tag="${tag}"]`)));
  appearances.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(appearances[i]!));

  const counts = RANGES.map(({ server }) => playersOf(server).length);
  expect(counts).toEqual([3, 3, 3, 11]);
  expect(counts[3]!).toBeGreaterThan(counts[0]! + counts[1]! + counts[2]!);
  for (const { server } of RANGES) {
    const count = one(`[data-role="count"][data-server="${server}"]`);
    expect(textOf(count)).toBe(`${playersOf(server).length} players`);
    expect(onset(count)).toBeGreaterThan(start);
    expect(shownThroughout(count, between(settled, LOOP))).toBe(true);
  }
});

test('in step 4, db-3 takes the next sign-up, because a new id is higher than every id so far', () => {
  const [start, end] = stepWindow(4);
  const next = Math.max(...Object.values(ROSTER)) + 1;
  const signup = one('[data-role="signup"]');
  expect(serverOf(signup)).toBe(ownerOf(next));
  expect(ownerOf(next)).toBe('db-3');
  expect(textOf(signup)).toBe('next sign-up');
  // The slot is db-3's next row, under its newest player.
  const newest = rowsOf('db-3').at(-1)!;
  expect(tagOf(newest)).toBe(NEWEST.at(-1)![0]);
  expect(boxOf(signup).top).toBeGreaterThan(boxOf(newest).bottom);
  expect(within(boxOf(signup), panelOf('db-3'))).toBe(true);
  const opens = onset(signup);
  expect(opens).toBeGreaterThan(start);
  expect(opens).toBeLessThan(end);
  expect(hiddenThroughout(signup, between(0, opens - 0.05))).toBe(true);
  expect(shownThroughout(signup, between(opens + 0.05, LOOP))).toBe(true);
});

test("in step 5, each player sends one request, and it lands on that player's row", () => {
  const [start] = stepWindow(5);
  for (const dot of all('[data-role="dot"]')) {
    const tag = tagOf(dot);
    expect(serverOf(dot), tag).toBe(ownerOf(ROSTER[tag]!));
    expect(shownAt(dot, start), tag).toBe(true);
    const hit = one(`[data-role="hit"][data-tag="${tag}"]`);
    const arrived = onset(hit);
    expect(serverOf(hit)).toBe(serverOf(dot));
    expect(arrived).toBeGreaterThan(start);
    expect(boxOf(hit)).toEqual(boxOf(playerTagged(tag)));
    expect(inside(positionAt(dot, arrived), boxOf(hit)), tag).toBe(true);
    expect(hiddenThroughout(dot, between(arrived + 0.01, LOOP)), tag).toBe(true);
  }
});

test('in step 5, db-3 answers 11 of the 20 requests and runs hot while the others sit mostly idle', () => {
  const [start] = stepWindow(5);
  const widthAt = (server: string, seconds: number): number =>
    valueAt(one(`[data-role="load"][data-server="${server}"]`), 'width', at(seconds), 0);
  const track = numberOf(one('[data-role="load-track"][data-server="db-3"]'), 'width');
  const unit = track / playersOf('db-3').length;
  for (const { server } of RANGES) {
    expect(numberOf(one(`[data-role="load-track"][data-server="${server}"]`), 'width')).toBe(track);
    expect(widthAt(server, start)).toBe(0);
    // The meter grows by one unit as each of the server's requests arrives.
    const arrivals = all(`[data-role="hit"][data-server="${server}"]`)
      .map(onset)
      .sort((a, b) => a - b);
    expect(arrivals).toHaveLength(playersOf(server).length);
    arrivals.forEach((moment, i) => {
      expect(widthAt(server, moment - 0.01)).toBeCloseTo(unit * i, 5);
      expect(widthAt(server, moment + 0.01)).toBeCloseTo(unit * (i + 1), 5);
    });
  }
  expect(widthAt('db-3', LOOP - 0.05)).toBeCloseTo(track, 5);

  const verdicts = RANGES.map(({ server }) =>
    one(`[data-role="verdict"][data-server="${server}"]`),
  );
  expect(verdicts.map(textOf)).toEqual(['mostly idle', 'mostly idle', 'mostly idle', 'runs hot']);
  const settled = onset(verdicts[3]!);
  expect(visibleAt('[data-role="dot"]', settled)).toEqual([]);
  const hot = one('[data-role="hot"]');
  expect(serverOf(hot)).toBe('db-3');
  for (const el of [...verdicts, hot]) {
    expect(onset(el)).toBe(settled);
    expect(hiddenThroughout(el, between(0, settled - 0.05))).toBe(true);
    expect(shownThroughout(el, between(settled + 0.05, LOOP))).toBe(true);
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((_, i) => {
    const [from, to] = stepWindow(i + 1);
    expect(shownThroughout(captions[i]!, between(from + 0.01, to - 0.01))).toBe(true);
  });
});
