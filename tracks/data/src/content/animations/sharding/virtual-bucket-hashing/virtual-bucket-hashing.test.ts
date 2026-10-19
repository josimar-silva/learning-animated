import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg, tagOf } from '@learning-animated/svg-kit/parse';
import {
  animationsIn,
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './virtual-bucket-hashing.gen.ts';

const LOOP = 24;
const BUCKETS = 16;
// The game's players by tag, with hash(player_id) for each, shared with the other hash lessons.
const ROSTER: Readonly<Record<string, number>> = {
  Adder: 47,
  Badger: 82,
  Coyote: 35,
  Dingo: 64,
  Egret: 13,
  Ferret: 58,
  Gibbon: 91,
  Heron: 20,
  Iguana: 37,
  Jackal: 29,
  Koala: 66,
  Lemur: 41,
  Marten: 52,
  Newt: 99,
  Otter: 25,
  Petrel: 70,
  Quail: 43,
  Raven: 88,
  Stoat: 14,
  Tapir: 56,
};
const hashOf = (tag: string): number => {
  const hash = ROSTER[tag];
  if (hash === undefined) throw new Error(`${tag} is not on the roster`);
  return hash;
};
// The story turns three times: the map appears, db-4 joins, and a lookup reads the new map.
const MAP_AT = 6;
const JOINS_AT = 11;
const LOOKUP_AT = 17;
const END = LOOP - 0.05;
const BEFORE = {
  'db-0': [0, 1, 2, 3],
  'db-1': [4, 5, 6, 7],
  'db-2': [8, 9, 10, 11],
  'db-3': [12, 13, 14, 15],
};
const AFTER = {
  'db-0': [0, 1, 2],
  'db-1': [4, 5, 6],
  'db-2': [8, 9, 10],
  'db-3': [12, 13, 14],
  'db-4': [3, 7, 11, 15],
};

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./virtual-bucket-hashing.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);
const steps = lesson.steps ?? [];

const all = (selector: string, within: Element = svg): Element[] => [
  ...within.querySelectorAll(selector),
];
const one = (selector: string, within: Element = svg): Element => {
  const found = within.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
// The moment, in seconds, an element first shows.
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment * LOOP;
};

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

// The translation an element's own animateTransform gives it at a moment of the loop, linear
// between keyTimes. Only animated translations are understood; a static transform fails loudly.
function shiftAt(el: Element, t: number): [number, number] {
  if (el.hasAttribute('transform')) throw new Error(`${tagOf(el)} has a static transform`);
  const motion = [...el.children].find((child) => tagOf(child) === 'animatetransform');
  if (!motion) return [0, 0];
  expect(motion.getAttribute('type')).toBe('translate');
  const times = motion.getAttribute('keyTimes')!.split(';').map(Number);
  const points = motion
    .getAttribute('values')!
    .split(';')
    .map((point) => point.split(',').map(Number));
  let i = times.length - 1;
  while (i > 0 && times[i]! > t) i -= 1;
  const from = points[i]!;
  const to = points[Math.min(i + 1, times.length - 1)]!;
  const progress = i === times.length - 1 ? 0 : (t - times[i]!) / (times[i + 1]! - times[i]!);
  return [from[0]! + (to[0]! - from[0]!) * progress, from[1]! + (to[1]! - from[1]!) * progress];
}

// Where an element's first rect is drawn at a moment, after every translation above it.
function boxAt(el: Element, seconds: number): Box {
  const rect =
    tagOf(el) === 'rect' ? el : [...el.children].find((child) => tagOf(child) === 'rect');
  if (!rect) throw new Error(`${el.getAttribute('data-role')} draws no rect`);
  let [x, y] = [Number(rect.getAttribute('x')), Number(rect.getAttribute('y'))];
  for (
    let layer: Element | null = rect;
    layer && tagOf(layer) !== 'svg';
    layer = layer.parentElement
  ) {
    const [dx, dy] = shiftAt(layer, at(seconds));
    x += dx;
    y += dy;
  }
  const [width, height] = [Number(rect.getAttribute('width')), Number(rect.getAttribute('height'))];
  return { x, y, width, height };
}

const inside = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const bucket = (b: number): Element => one(`[data-role="bucket"][data-bucket="${b}"]`);
const playersIn = (b: number): Element[] => all('[data-role="player"]', bucket(b));
const player = (tag: string): Element => one(`[data-role="player"][data-player="${tag}"]`);
const entry = (b: number): Element => one(`[data-role="map-entry"][data-bucket="${b}"]`);
const labelOf = (server: Element): string => textOf(one('[data-role="server-name"]', server));
const serverNamed = (name: string): Element => {
  const found = all('[data-role="server"]').find((server) => labelOf(server) === name);
  if (!found) throw new Error(`no server is named ${name}`);
  return found;
};

// The server whose frame holds an element at a moment, or null when no shown frame does.
function serverHolding(el: Element, seconds: number): string | null {
  const box = boxAt(el, seconds);
  const holders = all('[data-role="server"]').filter(
    (server) => opacityAt(server, at(seconds)) === 1 && inside(box, boxAt(server, seconds)),
  );
  if (holders.length > 1) throw new Error(`${holders.length} servers hold one box at ${seconds} s`);
  return holders[0] ? labelOf(holders[0]) : null;
}

// The server a map entry names at a moment, or null while it names none.
function ownerAt(b: number, seconds: number): string | null {
  const shown = all('[data-role="owner"]', entry(b)).filter(
    (owner) => opacityAt(owner, at(seconds)) === 1,
  );
  if (shown.length > 1) throw new Error(`map entry ${b} names ${shown.length} servers`);
  return shown[0] ? textOf(shown[0]) : null;
}

// The whole map at a moment, as the buckets each server owns.
function mapAt(seconds: number): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (let b = 0; b < BUCKETS; b += 1) {
    const owner = ownerAt(b, seconds);
    if (owner) (map[owner] ??= []).push(b);
  }
  return map;
}

const numbered = (count: number): string[] => Array.from({ length: count }, (_, i) => String(i));

test('the lesson is the fourth in the sharding section', () => {
  expect([lesson.id, lesson.section, lesson.order]).toEqual([
    'virtual-bucket-hashing',
    'sharding',
    4,
  ]);
});

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 24 s, and its four steps start where the story turns', () => {
  expect(svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
  expect(steps.map((step) => step.at)).toEqual([0, MAP_AT, JOINS_AT, LOOKUP_AT]);
});

test('in step 1, 20 players hash into 16 buckets with hash(player_id) mod 16, and stay there', () => {
  const formula = one('[data-role="formula"]');
  expect(textOf(formula)).toBe('bucket = hash(player_id) mod 16');
  expect(shownThroughout(formula, between(0, END))).toBe(true);
  const buckets = all('[data-role="bucket"]');
  expect(buckets.map((cell) => textOf(one('[data-role="index"]', cell)))).toEqual(
    numbered(BUCKETS),
  );
  for (const cell of buckets) expect(shownThroughout(cell, between(0, END))).toBe(true);
  const players = all('[data-role="player"]');
  expect(players.map(textOf).sort()).toEqual(Object.keys(ROSTER).sort());
  for (const p of players) {
    const tag = textOf(p);
    expect(p.getAttribute('data-player')).toBe(tag);
    const home = p.closest('[data-role="bucket"]')!;
    expect(Number(home.getAttribute('data-bucket'))).toBe(hashOf(tag) % BUCKETS);
    for (const moment of [0, END]) expect(inside(boxAt(p, moment), boxAt(home, moment))).toBe(true);
  }
});

test('in step 1, each player leaves the player list, which shows its hash, and lands in its bucket before the map appears', () => {
  const list = one('[data-role="player-list"]');
  for (const p of all('[data-role="player"]')) {
    const tag = textOf(p);
    const hash = one(`[data-role="hash"][data-player="${tag}"]`, list);
    expect(textOf(hash)).toBe(String(hashOf(tag)));
    expect(shownThroughout(hash, between(0, MAP_AT - 0.05))).toBe(true);
    const flight = one(`[data-role="flight"][data-player="${tag}"]`);
    expect(textOf(flight)).toBe(tag);
    const landed = onset(p);
    expect(landed).toBeLessThan(MAP_AT);
    expect(inside(boxAt(flight, 0), boxAt(list, 0))).toBe(true);
    expect(boxAt(flight, landed + 0.05)).toEqual(boxAt(p, landed + 0.05));
    expect(shownThroughout(flight, between(0, landed - 0.05))).toBe(true);
    expect(hiddenThroughout(flight, between(landed + 0.05, END))).toBe(true);
    expect(hiddenThroughout(p, between(0, landed - 0.05))).toBe(true);
    expect(shownThroughout(p, between(landed + 0.05, END))).toBe(true);
  }
});

test('in step 2, the map gives each of the four servers four buckets', () => {
  expect(all('[data-role="map-entry"]').map((e) => textOf(one('[data-role="index"]', e)))).toEqual(
    numbered(BUCKETS),
  );
  expect(mapAt(MAP_AT - 0.05)).toEqual({});
  expect(mapAt(JOINS_AT - 0.05)).toEqual(BEFORE);
  for (const [name, buckets] of Object.entries(BEFORE)) {
    // A server appears together with the four map entries that name it, around its buckets.
    const server = serverNamed(name);
    const appears = onset(server);
    expect(appears).toBeGreaterThanOrEqual(MAP_AT);
    expect(appears).toBeLessThan(JOINS_AT);
    expect(hiddenThroughout(server, between(0, appears - 0.05))).toBe(true);
    expect(shownThroughout(server, between(appears + 0.05, END))).toBe(true);
    for (const b of buckets) {
      expect(ownerAt(b, appears - 0.05)).toBeNull();
      expect(ownerAt(b, appears + 0.05)).toBe(name);
      expect(serverHolding(bucket(b), appears + 0.05)).toBe(name);
    }
  }
});

test('in step 3, db-4 joins and takes one bucket from each server', () => {
  const added = serverNamed('db-4');
  expect(hiddenThroughout(added, between(0, JOINS_AT - 0.05))).toBe(true);
  expect(shownThroughout(added, between(JOINS_AT + 0.05, END))).toBe(true);
  expect(mapAt(LOOKUP_AT - 0.05)).toEqual(AFTER);
  for (let b = 0; b < BUCKETS; b += 1) {
    expect(serverHolding(bucket(b), LOOKUP_AT - 0.05)).toBe(ownerAt(b, LOOKUP_AT - 0.05));
  }
});

test('in step 3, a map entry names db-4 only once its bucket has arrived there', () => {
  for (const b of AFTER['db-4']) {
    const named = all('[data-role="owner"]', entry(b)).find((owner) => textOf(owner) === 'db-4');
    const changes = onset(named!);
    expect(changes).toBeGreaterThan(JOINS_AT);
    expect(changes).toBeLessThan(LOOKUP_AT);
    expect(ownerAt(b, changes - 0.05)).toBe(ownerAt(b, JOINS_AT - 0.05));
    expect(serverHolding(bucket(b), changes)).toBe('db-4');
  }
});

test('in step 3, the players inside move with their bucket', () => {
  for (let b = 0; b < BUCKETS; b += 1) {
    for (const p of playersIn(b)) {
      const motions = animationsIn(p).filter((animation) => tagOf(animation) !== 'animate');
      expect(motions).toEqual([]);
      expect(serverHolding(p, JOINS_AT - 0.05)).toBe(ownerAt(b, JOINS_AT - 0.05));
      expect(serverHolding(p, LOOKUP_AT - 0.05)).toBe(ownerAt(b, LOOKUP_AT - 0.05));
    }
  }
});

test('in step 4, a lookup hashes the player id, then reads the new map', () => {
  const lookup = one('[data-role="lookup"]');
  const tag = lookup.getAttribute('data-player')!;
  const hash = hashOf(tag);
  const b = hash % BUCKETS;
  expect(textOf(one('[data-role="lookup-tag"]', lookup))).toBe(`lookup ${tag}`);
  const lines = all('[data-role="lookup-step"]', lookup);
  expect(lines.map(textOf)).toEqual([
    `hash(player_id) = ${hash}`,
    `bucket = ${hash} mod 16 = ${b}`,
    `server = map[${b}] = ${ownerAt(b, END)}`,
  ]);
  // The player's bucket moved, so the new map sends the lookup somewhere new.
  expect(ownerAt(b, END)).toBe('db-4');
  expect(textOf(one('[data-role="was"]', lookup))).toBe(
    `map[${b}] was ${ownerAt(b, JOINS_AT - 0.05)} until db-4 joined`,
  );
  expect(serverHolding(player(tag), END)).toBe('db-4');
  // Each line and read marker appears in turn: the hash, the bucket, the map entry, then the
  // bucket on db-4.
  const entryRead = one('[data-role="read"][data-of="map-entry"]');
  const bucketRead = one('[data-role="read"][data-of="bucket"]');
  const sequence = [lookup, ...lines, entryRead, bucketRead];
  for (const el of sequence) {
    expect(hiddenThroughout(el, between(0, LOOKUP_AT - 0.05))).toBe(true);
    expect(shownThroughout(el, between(onset(el) + 0.05, END))).toBe(true);
  }
  const moments = [lookup, ...lines, bucketRead].map(onset);
  moments.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(moments[i]!));
  expect(onset(entryRead)).toBe(onset(lines[2]!));
  expect(inside(boxAt(entry(b), END), boxAt(entryRead, END))).toBe(true);
  expect(inside(boxAt(bucket(b), END), boxAt(bucketRead, END))).toBe(true);
});

test('in step 4, only the players in the four moved buckets changed server: 5 of 20', () => {
  const players = all('[data-role="player"]');
  const moved = players.filter((p) => serverHolding(p, JOINS_AT - 0.05) !== serverHolding(p, END));
  expect(moved.map(textOf).sort()).toEqual(
    AFTER['db-4'].flatMap((b) => playersIn(b).map(textOf)).sort(),
  );
  expect(moved).toHaveLength(5);
  const count = one('[data-role="moved-count"]');
  expect(textOf(count)).toBe(`${moved.length} of ${players.length} players moved`);
  expect(hiddenThroughout(count, between(0, LOOKUP_AT))).toBe(true);
  expect(shownThroughout(count, between(onset(count) + 0.05, END))).toBe(true);
  const tags = one('[data-role="moved-tags"]');
  expect(textOf(tags).split(', ').sort()).toEqual(moved.map(textOf).sort());
  expect(onset(tags)).toBe(onset(count));
  // Every moved player is marked from the moment it moves, and no other player is.
  for (const p of players) {
    const mark = p.querySelector('[data-role="moved"]');
    expect(mark !== null).toBe(moved.includes(p));
    if (!mark) continue;
    expect(hiddenThroughout(mark, between(0, JOINS_AT))).toBe(true);
    expect(shownThroughout(mark, between(LOOKUP_AT - 0.05, END))).toBe(true);
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => {
    const next = steps[i + 1]?.at ?? LOOP;
    expect(shownThroughout(captions[i]!, between(step.at + 0.05, next - 0.05))).toBe(true);
  });
});
