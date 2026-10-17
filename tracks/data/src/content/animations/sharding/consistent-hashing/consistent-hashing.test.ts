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
import { describe, expect, test } from 'vitest';

import { render as renderOnePoint } from './consistent-hashing.one-point.gen.ts';
import { render as renderVirtualNodes } from './consistent-hashing.virtual-nodes.gen.ts';

const LOOP = 24;
const RING = 100;
const FIRST_SERVERS = ['db-0', 'db-1', 'db-2', 'db-3'];
const NEW_SERVER = 'db-4';
const SERVERS = [...FIRST_SERVERS, NEW_SERVER];
// The game's 20 players by tag, each with the hash of its player id: its spot on the ring.
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

// The beats both views share, in seconds. Each step's first change lands on the step itself, so a
// reader who picks a step while paused sees it begin.
const STEPS_AT = [0, 5, 13, 19];
const PLAYERS_HASH = 5;
const WALK = [6, 8] as const;
const STORED = 9.5;
const NEW_SERVER_JOINS = 13;
const CLAIMED = 14;
const MOVED = 15;
const LOADS = 19;
const END = LOOP - 0.1;

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];

const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);
const steps = lesson.steps ?? [];

type ViewId = 'one-point' | 'virtual-nodes';
type Drawn = {
  readonly id: ViewId;
  readonly text: string;
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(id: ViewId): Drawn {
  const text = readFileSync(new URL(`./consistent-hashing.${id}.svg`, import.meta.url), 'utf8');
  const { svg } = parseSvg(text);
  return {
    id,
    text,
    svg,
    all: (selector) => [...svg.querySelectorAll(selector)],
    one: (selector) => {
      const found = svg.querySelector(selector);
      if (!found) throw new Error(`${id}: missing ${selector}`);
      return found;
    },
  };
}

const onePoint = load('one-point');
const virtualNodes = load('virtual-nodes');

type Spot = { readonly server: string; readonly label: string; readonly position: number };
type Player = { readonly tag: string; readonly position: number; readonly el: Element };

const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const textOf = (el: Element): string => el.textContent.trim();

function onset(el: Element): number {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment * LOOP;
}

const pointsShownAt = (view: Drawn, seconds: number): Spot[] =>
  view
    .all('[data-role="point"]')
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map((el) => ({
      server: el.getAttribute('data-server') ?? '',
      label: el.getAttribute('data-label') ?? '',
      position: numberOf(el, 'data-position'),
    }));

const playersOf = (view: Drawn): Player[] =>
  view.all('[data-role="player"]').map((el) => ({
    tag: el.getAttribute('data-tag') ?? '',
    position: numberOf(el, 'data-position'),
    el,
  }));

// The server whose colour a player shows at a moment, or null while no server stores the player.
function ownerAt(player: Element, seconds: number): string | null {
  const shown = [...player.querySelectorAll('[data-role="owner"]')].filter(
    (el) => opacityAt(el, at(seconds)) === 1,
  );
  if (shown.length > 1) throw new Error(`a player shows ${shown.length} owners at ${seconds} s`);
  return shown[0]?.getAttribute('data-server') ?? null;
}

// The rule the lesson teaches: walk clockwise from the player's spot, past the top of the ring if
// need be, and stop at the first point.
function firstClockwise(position: number, points: readonly Spot[]): Spot {
  const sorted = [...points].sort((a, b) => a.position - b.position);
  const first = sorted.find((p) => p.position >= position) ?? sorted[0];
  if (!first) throw new Error('no point on the ring');
  return first;
}

const clockwiseSpan = (from: number, to: number): number => (to - from + RING) % RING;

function countsAt(view: Drawn, seconds: number): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(SERVERS.map((s) => [s, 0]));
  for (const { el } of playersOf(view)) {
    const owner = ownerAt(el, seconds);
    if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
  }
  return counts;
}

// Players whose server changes when db-4 joins, in ring order, with the servers they leave and join.
function movesIn(view: Drawn): Array<{ player: Player; from: string | null; to: string | null }> {
  return playersOf(view)
    .sort((a, b) => a.position - b.position)
    .map((player) => ({
      player,
      from: ownerAt(player.el, NEW_SERVER_JOINS - 0.1),
      to: ownerAt(player.el, END),
    }))
    .filter(({ from, to }) => from !== to);
}

function ringOf(view: Drawn): { cx: number; cy: number; r: number } {
  const ring = view.one('[data-role="ring"]');
  return { cx: numberOf(ring, 'cx'), cy: numberOf(ring, 'cy'), r: numberOf(ring, 'r') };
}

// The ring position under a drawn spot: 0 at the top, rising clockwise.
function positionAt(view: Drawn, x: number, y: number): number {
  const { cx, cy } = ringOf(view);
  const turn = Math.atan2(x - cx, cy - y) / (2 * Math.PI);
  return (((turn * RING) % RING) + RING) % RING;
}

function translateOf(el: Element): [number, number] {
  const match = /translate\((-?[\d.]+)[ ,]+(-?[\d.]+)\)/.exec(el.getAttribute('transform') ?? '');
  if (!match) throw new Error(`${el.getAttribute('data-role')} has no translate`);
  return [Number(match[1]), Number(match[2])];
}

// An arc drawn as "M x y A r r 0 large sweep x y": where it starts and ends, and which way it runs.
function arcOf(view: Drawn, path: Element) {
  const n = (path.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (n.length !== 9) throw new Error(`not a single arc: ${path.getAttribute('d')}`);
  const [x0 = 0, y0 = 0, , , , large, sweep, x1 = 0, y1 = 0] = n;
  return {
    from: positionAt(view, x0, y0),
    to: positionAt(view, x1, y1),
    large: large === 1,
    clockwise: sweep === 1,
  };
}

const closeOnRing = (a: number, b: number): boolean =>
  Math.min(clockwiseSpan(a, b), clockwiseSpan(b, a)) < 0.05;
const howMany = (points: number): string => (points === 1 ? 'one point' : `${points} points`);

describe.each([
  ['one-point', onePoint, renderOnePoint, 1],
  ['virtual-nodes', virtualNodes, renderVirtualNodes, 3],
] as const)('the %s view', (_id, view, render, pointsPerServer) => {
  test('the generator reproduces the committed SVG', () => {
    expect(render()).toBe(view.text);
  });

  test('one story lasts 24 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
  });

  test('the 20 players sit at the hashes of their player ids', () => {
    const drawn = Object.fromEntries(playersOf(view).map(({ tag, position }) => [tag, position]));
    expect(drawn).toEqual(ROSTER);
  });

  test('every server point and player sits on the ring at its position', () => {
    const { cx, cy, r } = ringOf(view);
    const placed = view.all('[data-role="point"], [data-role="player"]');
    expect(placed.length).toBeGreaterThan(0);
    for (const el of placed) {
      const turn = (2 * Math.PI * numberOf(el, 'data-position')) / RING;
      const [x, y] = translateOf(el);
      expect(x).toBeCloseTo(cx + r * Math.sin(turn), 0);
      expect(y).toBeCloseTo(cy - r * Math.cos(turn), 0);
    }
  });

  test(`db-0 to db-3 hash to ${howMany(pointsPerServer)} each, before any player shows`, () => {
    // The first server lands with the step, so a paused reader sees the hashing begin.
    expect(pointsShownAt(view, STEPS_AT[0]! + 0.01).map((p) => p.server)).toEqual(
      Array(pointsPerServer).fill(FIRST_SERVERS[0]),
    );
    const hashed = pointsShownAt(view, PLAYERS_HASH - 0.1);
    for (const server of FIRST_SERVERS) {
      expect(hashed.filter((p) => p.server === server)).toHaveLength(pointsPerServer);
    }
    expect(hashed.map((p) => p.server).filter((s) => !FIRST_SERVERS.includes(s))).toEqual([]);
    // Each server's points land together, one server after another, and stay to the end.
    const onsets = FIRST_SERVERS.map((server) => {
      const points = view.all(`[data-role="point"][data-server="${server}"]`);
      const moments = new Set(points.map(onset));
      expect(moments.size).toBe(1);
      for (const point of points) {
        expect(shownThroughout(point, between(onset(point) + 0.05, END))).toBe(true);
      }
      return [...moments][0]!;
    });
    expect(onsets).toEqual([...onsets].sort((a, b) => a - b));
    expect(new Set(onsets).size).toBe(FIRST_SERVERS.length);
    for (const { el } of playersOf(view)) {
      expect(hiddenThroughout(el, between(0, PLAYERS_HASH - 0.1))).toBe(true);
      expect(shownThroughout(el, between(PLAYERS_HASH + 0.1, END))).toBe(true);
    }
  });

  test('Egret walks clockwise to the first server point on the way', () => {
    const walk = view.one('[data-role="walk"]');
    expect(walk.getAttribute('data-tag')).toBe('Egret');
    const label = view.one('[data-role="featured"]');
    expect(textOf(label)).toBe('Egret');
    expect(shownThroughout(label, between(PLAYERS_HASH + 0.1, END))).toBe(true);
    const players = playersOf(view);
    const walker = players.find((p) => p.tag === 'Egret');
    if (!walker) throw new Error('Egret is not on the ring');
    const target = firstClockwise(walker.position, pointsShownAt(view, WALK[0]));
    expect(walk.getAttribute('data-to')).toBe(target.label);
    const trail = arcOf(view, view.one('[data-role="trail"]'));
    expect(trail.clockwise).toBe(true);
    expect(closeOnRing(trail.from, walker.position)).toBe(true);
    expect(closeOnRing(trail.to, target.position)).toBe(true);
    expect(trail.large).toBe(clockwiseSpan(walker.position, target.position) > RING / 2);
    expect(hiddenThroughout(walk, between(0, WALK[0] - 0.1))).toBe(true);
    expect(shownThroughout(walk, between(WALK[0] + 0.1, NEW_SERVER_JOINS - 0.1))).toBe(true);
    expect(hiddenThroughout(walk, between(NEW_SERVER_JOINS + 0.1, END))).toBe(true);
    // The walker is stored as soon as it arrives, before any other player.
    expect(ownerAt(walker.el, WALK[1] - 0.1)).toBeNull();
    expect(ownerAt(walker.el, WALK[1] + 0.1)).toBe(target.server);
    for (const other of players.filter((p) => p !== walker)) {
      expect(ownerAt(other.el, STORED - 0.1)).toBeNull();
    }
  });

  test('then every player is stored by the first server point clockwise from it', () => {
    const points = pointsShownAt(view, NEW_SERVER_JOINS - 0.1);
    for (const { position, el } of playersOf(view)) {
      const server = firstClockwise(position, points).server;
      expect(ownerAt(el, STORED + 0.1)).toBe(server);
      expect(ownerAt(el, NEW_SERVER_JOINS - 0.1)).toBe(server);
    }
  });

  test('each server owns the arc that ends at its point', () => {
    const points = pointsShownAt(view, NEW_SERVER_JOINS - 0.1).sort(
      (a, b) => a.position - b.position,
    );
    const arcs = view
      .all('[data-role="arc"]')
      .filter((el) => opacityAt(el, at(NEW_SERVER_JOINS - 0.1)) === 1);
    expect(arcs).toHaveLength(points.length);
    points.forEach((point, i) => {
      const previous = points[(i - 1 + points.length) % points.length]!;
      const arc = arcs.find((el) => closeOnRing(arcOf(view, el).to, point.position));
      if (!arc) throw new Error(`no arc ends at ${point.label}`);
      expect(arc.getAttribute('data-server')).toBe(point.server);
      expect(hiddenThroughout(arc, between(0, STORED - 0.1))).toBe(true);
      const { from, clockwise } = arcOf(view, arc);
      expect(clockwise).toBe(true);
      expect(closeOnRing(from, previous.position)).toBe(true);
    });
  });

  test('db-4 joins, and only the players whose walk now ends at a db-4 point move to it', () => {
    const before = pointsShownAt(view, NEW_SERVER_JOINS - 0.1);
    const after = pointsShownAt(view, NEW_SERVER_JOINS + 0.1);
    const joined = after.filter((p) => !before.some((q) => q.label === p.label));
    expect(joined.map((p) => p.server)).toEqual(Array(pointsPerServer).fill(NEW_SERVER));
    for (const point of view.all(`[data-role="point"][data-server="${NEW_SERVER}"]`)) {
      expect(hiddenThroughout(point, between(0, NEW_SERVER_JOINS - 0.1))).toBe(true);
    }
    for (const { position, el } of playersOf(view)) {
      const was = firstClockwise(position, before).server;
      const now = firstClockwise(position, after).server;
      expect(ownerAt(el, MOVED - 0.1)).toBe(was);
      expect(ownerAt(el, MOVED + 0.1)).toBe(now);
      expect(ownerAt(el, END)).toBe(now);
      const mark = el.querySelector('[data-role="moved"]');
      if (was === now) {
        expect(mark).toBeNull();
        continue;
      }
      expect(now).toBe(NEW_SERVER);
      if (!mark) throw new Error(`${el.getAttribute('data-tag')} moves unmarked`);
      expect(hiddenThroughout(mark, between(0, CLAIMED - 0.1))).toBe(true);
      expect(shownThroughout(mark, between(CLAIMED + 0.1, END))).toBe(true);
    }
    // Each db-4 point lights up the arc that now ends at it, from the point before it.
    const sorted = [...after].sort((a, b) => a.position - b.position);
    const newArcs = view.all(`[data-role="arc"][data-server="${NEW_SERVER}"]`);
    expect(newArcs).toHaveLength(pointsPerServer);
    for (const arc of newArcs) {
      const { from, to, clockwise } = arcOf(view, arc);
      const end = sorted.findIndex((p) => closeOnRing(p.position, to));
      expect(sorted[end]?.server).toBe(NEW_SERVER);
      const previous = sorted[(end - 1 + sorted.length) % sorted.length]!;
      expect(closeOnRing(from, previous.position)).toBe(true);
      expect(clockwise).toBe(true);
      expect(hiddenThroughout(arc, between(0, CLAIMED - 0.1))).toBe(true);
      expect(shownThroughout(arc, between(CLAIMED + 0.1, END))).toBe(true);
    }
  });

  test('the ring counts the moved players', () => {
    const count = view.one('[data-role="moved-count"]');
    expect(textOf(count).replace(/\s+/g, ' ')).toBe(
      `${movesIn(view).length} of ${playersOf(view).length} players moved`,
    );
    expect(hiddenThroughout(count, between(0, MOVED - 0.1))).toBe(true);
    expect(shownThroughout(count, between(MOVED + 0.1, END))).toBe(true);
  });

  test('the ring lists the moved players by tag, in ring order', () => {
    const tags = view.one('[data-role="moved-tags"]');
    expect(textOf(tags)).toBe(
      movesIn(view)
        .map(({ player }) => player.tag)
        .join(', '),
    );
    expect(hiddenThroughout(tags, between(0, MOVED - 0.1))).toBe(true);
    expect(shownThroughout(tags, between(MOVED + 0.1, END))).toBe(true);
  });

  test("each server's player count shows its load before and after db-4 joined", () => {
    const before = countsAt(view, NEW_SERVER_JOINS - 0.1);
    const after = countsAt(view, END);
    const rows = view.all('[data-role="load"]');
    expect(rows.map((row) => row.getAttribute('data-server'))).toEqual(SERVERS);
    const units = new Set<number>();
    for (const row of rows) {
      const server = row.getAttribute('data-server') ?? '';
      // Each row names its server from the moment the server exists.
      const exists = server === NEW_SERVER ? NEW_SERVER_JOINS : 0;
      if (exists > 0) expect(hiddenThroughout(row, between(0, exists - 0.1))).toBe(true);
      expect(shownThroughout(row, between(exists + 0.1, END))).toBe(true);
      const count = row.querySelector('[data-role="count"]');
      if (!count) throw new Error(`no count for ${server}`);
      expect(textOf(count)).toBe(`${before[server]} → ${after[server]}`);
      expect(hiddenThroughout(count, between(0, LOADS - 0.1))).toBe(true);
      expect(shownThroughout(count, between(LOADS + 0.1, END))).toBe(true);
      for (const [role, players] of [
        ['bar-before', before[server]],
        ['bar-after', after[server]],
      ] as const) {
        const bar = row.querySelector(`[data-role="${role}"]`);
        if (!bar) throw new Error(`no ${role} for ${server}`);
        expect(hiddenThroughout(bar, between(0, LOADS - 0.1))).toBe(true);
        expect(shownThroughout(bar, between(LOADS + 0.1, END))).toBe(true);
        if (players === 0) expect(numberOf(bar, 'width')).toBe(0);
        else units.add(numberOf(bar, 'width') / (players ?? Number.NaN));
      }
    }
    expect(units.size).toBe(1);
  });

  test('each step starts with something new on screen, for a reader who picks it while paused', () => {
    // The player controls seek 10 ms past a step's moment.
    const picked = STEPS_AT.map((moment) => moment + 0.01);
    const [hashing, walking, joining, counting] = picked as [number, number, number, number];
    expect(pointsShownAt(view, hashing).length).toBeGreaterThan(0);
    for (const { el } of playersOf(view)) expect(opacityAt(el, at(walking))).toBe(1);
    expect(pointsShownAt(view, joining).map((p) => p.server)).toContain(NEW_SERVER);
    for (const count of view.all('[data-role="count"]')) {
      expect(opacityAt(count, at(counting))).toBe(1);
    }
  });

  test('one caption shows at a time, and each step brings its own', () => {
    const captions = view.all('[data-role="caption"]');
    expect(captions).toHaveLength(steps.length);
    steps.forEach((step, i) => {
      const window = between(step.at + 0.05, (steps[i + 1]?.at ?? LOOP) - 0.05);
      captions.forEach((caption, j) => {
        const visible = j === i ? shownThroughout : hiddenThroughout;
        expect(visible(caption, window)).toBe(true);
      });
    });
  });
});

const loads = (view: Drawn, seconds: number, servers: readonly string[]): number[] => {
  const counts = countsAt(view, seconds);
  return servers.map((server) => counts[server] ?? 0);
};
const moves = (view: Drawn): string[] =>
  movesIn(view).map(({ player, from }) => `${player.tag} from ${from}`);

describe('one point per server', () => {
  test('leaves the loads uneven: 2/1/11/6 before db-4 joins, 2/1/7/6/4 after', () => {
    expect(loads(onePoint, NEW_SERVER_JOINS - 0.1, FIRST_SERVERS)).toEqual([2, 1, 11, 6]);
    expect(loads(onePoint, END, SERVERS)).toEqual([2, 1, 7, 6, 4]);
  });

  test('walks Egret to db-2, whose arc covers almost half the ring', () => {
    expect(onePoint.one('[data-role="walk"]').getAttribute('data-to')).toBe('db-2');
  });

  test('has db-4 take Egret, Stoat, Heron, and Otter, all from db-2, the neighbour it lands next to', () => {
    expect(moves(onePoint)).toEqual([
      'Egret from db-2',
      'Stoat from db-2',
      'Heron from db-2',
      'Otter from db-2',
    ]);
    const [newPoint] = onePoint.all(`[data-role="point"][data-server="${NEW_SERVER}"]`);
    if (!newPoint) throw new Error('db-4 has no point');
    const neighbour = firstClockwise(
      numberOf(newPoint, 'data-position') + 0.5,
      pointsShownAt(onePoint, NEW_SERVER_JOINS - 0.1),
    );
    expect(neighbour.server).toBe('db-2');
  });
});

describe('three points per server', () => {
  test('keep the loads nearly even: 5/5/4/6 before db-4 joins, 5/4/3/4/4 after', () => {
    expect(loads(virtualNodes, NEW_SERVER_JOINS - 0.1, FIRST_SERVERS)).toEqual([5, 5, 4, 6]);
    expect(loads(virtualNodes, END, SERVERS)).toEqual([5, 4, 3, 4, 4]);
  });

  test('walk Egret to db-2#3, a short way', () => {
    expect(virtualNodes.one('[data-role="walk"]').getAttribute('data-to')).toBe('db-2#3');
  });

  test('have db-4 take a small slice from several servers: Heron and Otter from db-3, Petrel from db-2, Newt from db-1', () => {
    expect(moves(virtualNodes)).toEqual([
      'Heron from db-3',
      'Otter from db-3',
      'Petrel from db-2',
      'Newt from db-1',
    ]);
  });
});

describe('both views', () => {
  const spots = (view: Drawn): string[] =>
    playersOf(view)
      .map(({ tag, position }) => `${tag}@${position}`)
      .sort();

  test('hash the same 20 players to the same spots', () => {
    expect(spots(virtualNodes)).toEqual(spots(onePoint));
  });

  test("keep each server's single point as its first virtual node, so a view switch leaves it in place", () => {
    const virtual = pointsShownAt(virtualNodes, END);
    for (const point of pointsShownAt(onePoint, END)) {
      expect(point.label).toBe(point.server);
      expect(virtual).toContainEqual({ ...point, label: `${point.server}#1` });
    }
  });

  test('share the steps, and the step texts hold in each', () => {
    expect(steps.map((step) => step.at)).toEqual(STEPS_AT);
    for (const view of [onePoint, virtualNodes]) {
      const moved = movesIn(view).length;
      const players = playersOf(view).length;
      expect(steps[2]?.text).toContain(`${moved} of the ${players}`);
      expect(steps[3]?.text).toContain(`other ${players - moved} players`);
    }
  });
});
