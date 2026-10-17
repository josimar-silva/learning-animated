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

import { render } from './hash-sharding.gen.ts';

const LOOP = 30;
const PLAYERS = 20;
// Step 2 scans player ids 9600 to 9999, which hold the four newest players.
const SCAN = [9600, 9999] as const;
const QUERY_SENT = 10;
const QUERY_ARRIVES = 11;

const text = readFileSync(new URL('./hash-sharding.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);
const steps = lesson.steps ?? [];
const stepAt = (i: number): number => {
  const step = steps[i];
  if (!step) throw new Error(`index.md has no step ${i + 1}`);
  return step.at;
};
const PLACE = stepAt(0);
const SPREAD = stepAt(1);
const OPEN = stepAt(2);
const MOVE = stepAt(3);

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const all = (selector: string, root: ParentNode = svg): Element[] => [
  ...root.querySelectorAll(selector),
];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const shownAt = (el: Element, seconds: number): boolean => opacityAt(el, at(seconds)) === 1;
const onsetSeconds = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment * LOOP;
};
// The one element among the matches that shows at a moment, or null when none does.
const shownOne = (selector: string, seconds: number): Element | null => {
  const shown = all(selector).filter((el) => shownAt(el, seconds));
  if (shown.length > 1) throw new Error(`${shown.length} of ${selector} show at ${seconds} s`);
  return shown[0] ?? null;
};
const shownText = (selector: string, seconds: number): string | null => {
  const el = shownOne(selector, seconds);
  return el ? textOf(el) : null;
};

type Point = readonly [x: number, y: number];
// A chip is drawn around its translate, and a ring is a rect around the same point.
const centerOf = (el: Element): Point => {
  const transform = el.getAttribute('transform');
  if (transform === null) {
    return [
      numberOf(el, 'x') + numberOf(el, 'width') / 2,
      numberOf(el, 'y') + numberOf(el, 'height') / 2,
    ];
  }
  const match = /^translate\((-?[\d.]+) (-?[\d.]+)\)$/.exec(transform);
  if (!match) throw new Error(`cannot read transform="${transform}"`);
  return [Number(match[1]), Number(match[2])];
};
// The server whose box holds a point, or null when the point is in no box.
const serverOf = ([x, y]: Point): number | null => {
  const holding = all('[data-role="box"]').filter((box) => {
    const [left, top] = [numberOf(box, 'x'), numberOf(box, 'y')];
    return (
      x > left && x < left + numberOf(box, 'width') && y > top && y < top + numberOf(box, 'height')
    );
  });
  if (holding.length > 1) throw new Error(`server boxes overlap at ${x}, ${y}`);
  return holding[0] ? numberOf(holding[0], 'data-server') : null;
};

type Player = { readonly tag: string; readonly id: number; readonly hash: number };
const roster: Player[] = [
  ...new Map(
    all('[data-role="player"]').map((chip) => {
      const tag = chip.getAttribute('data-tag') ?? '';
      return [tag, { tag, id: numberOf(chip, 'data-id'), hash: numberOf(chip, 'data-hash') }];
    }),
  ).values(),
];
const movers = roster.filter(({ hash }) => hash % 4 !== hash % 5);
const tagsOf = (players: readonly Player[]): string[] => players.map(({ tag }) => tag).sort();

const chipsOf = (tag: string): Element[] => all(`[data-role="player"][data-tag="${tag}"]`);
const flightsOf = (tag: string): Element[] =>
  all(`[data-role="flight"][data-tag="${tag}"]`).sort((a, b) => onsetSeconds(a) - onsetSeconds(b));
const arrivalOf = (tag: string): number => Math.min(...chipsOf(tag).map(onsetSeconds));
const byArrival = [...roster].sort((a, b) => arrivalOf(a.tag) - arrivalOf(b.tag));
// The player's chip that sits on a server at a moment, or null while it is on the way.
const chipAt = (tag: string, seconds: number): Element | null =>
  shownOne(`[data-role="player"][data-tag="${tag}"]`, seconds);
const serverAt = (tag: string, seconds: number): number => {
  const chip = chipAt(tag, seconds);
  const server = chip ? serverOf(centerOf(chip)) : null;
  if (server === null) throw new Error(`${tag} is on no server at ${seconds} s`);
  return server;
};
const playersOn = (server: number, seconds: number): number =>
  all('[data-role="player"]').filter(
    (chip) => shownAt(chip, seconds) && serverOf(centerOf(chip)) === server,
  ).length;
const countAt = (server: number, seconds: number): string | null =>
  shownText(`[data-role="count"][data-server="${server}"]`, seconds);
const workingAt = (seconds: number): string | null => shownText('[data-role="working"]', seconds);
const movedAt = (seconds: number): string | null => shownText('[data-role="moved"]', seconds);
const sampleTimes = (from: number, to: number): number[] =>
  Array.from({ length: Math.round((to - from) / 0.1) }, (_, i) => from + 0.05 + i * 0.1);

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 30 s, told in four steps that start on whole seconds', () => {
  expect(svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
  expect(textOf(one('title'))).toBe(lesson.title);
  expect(steps).toHaveLength(4);
  for (const step of steps) expect(Number.isInteger(step.at)).toBe(true);
});

test('twenty players carry two-digit hashes whose remainders mod 20 are 0 to 19, once each', () => {
  expect(roster).toHaveLength(PLAYERS);
  expect(new Set(roster.map(({ id }) => id)).size).toBe(PLAYERS);
  for (const { hash } of roster) {
    expect(hash).toBeGreaterThanOrEqual(10);
    expect(hash).toBeLessThan(100);
  }
  expect(roster.map(({ hash }) => hash % 20).sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
});

test("every chip shows its player's tag, player id, and hash", () => {
  for (const chip of [...all('[data-role="player"]'), ...all('[data-role="flight"]')]) {
    expect(all('text', chip).map(textOf)).toEqual([
      chip.getAttribute('data-tag'),
      `#${chip.getAttribute('data-id')}`,
      chip.getAttribute('data-hash'),
    ]);
  }
});

test('each player is drawn once at a time, from the moment it reaches the router', () => {
  for (const { tag } of roster) {
    const drawn = [...chipsOf(tag), ...flightsOf(tag)];
    const first = Math.min(...flightsOf(tag).map(onsetSeconds));
    for (const s of sampleTimes(0, LOOP)) {
      const count = drawn.filter((el) => shownAt(el, s)).length;
      expect(count, `${tag} at ${s.toFixed(2)} s`).toBe(s < first ? 0 : 1);
    }
  }
});

test('in step 1 the players sign up in id order, each to server hash(player_id) mod 4', () => {
  expect(byArrival.map(({ id }) => id)).toEqual(roster.map(({ id }) => id).sort((a, b) => a - b));
  const arrivals = roster.map(({ tag }) => arrivalOf(tag));
  expect(new Set(arrivals).size).toBe(PLAYERS);
  expect(Math.max(...arrivals)).toBeLessThan(SPREAD);
  for (const { tag, hash } of roster) {
    expect(chipAt(tag, PLACE + 0.05)).toBeNull();
    for (const s of [arrivalOf(tag) + 0.05, SPREAD - 0.05]) {
      expect(serverAt(tag, s)).toBe(hash % 4);
    }
  }
});

test('in step 1 the router works out hash(player_id) mod 4 for each player it sends', () => {
  const rule = one('[data-role="rule"][data-n="4"]');
  expect(textOf(rule)).toBe('server = hash(player_id) mod 4');
  expect(shownThroughout(rule, between(PLACE, OPEN - 0.05))).toBe(true);
  for (const { tag, id, hash } of roster) {
    const [arrival] = flightsOf(tag);
    if (!arrival) throw new Error(`${tag} never reaches the router`);
    expect(workingAt(onsetSeconds(arrival) + 0.05)).toBe(
      `${tag}: hash(${id}) = ${hash}, ${hash} mod 4 = ${hash % 4}`,
    );
  }
});

test('step 1 works through Adder first: player 412, hash 47, so db-3', () => {
  expect(byArrival[0]).toEqual({ tag: 'Adder', id: 412, hash: 47 });
  expect(serverAt('Adder', SPREAD - 0.05)).toBe(3);
  expect(steps[0]?.text).toContain('Adder hashes to 47, and 47 mod 4 = 3');
});

test('in step 2 each of the four servers holds five players', () => {
  for (let server = 0; server < 4; server += 1) {
    expect(countAt(server, SPREAD - 0.05)).toBeNull();
    for (const s of [SPREAD + 0.05, OPEN - 0.05, MOVE - 0.05]) {
      expect(playersOn(server, s)).toBe(5);
      expect(countAt(server, s)).toBe('5 players');
    }
  }
});

test('in step 2 the four newest players sit on four servers, so a scan over their ids asks every server', () => {
  const newest = roster.filter(({ id }) => id >= SCAN[0] && id <= SCAN[1]);
  expect(tagsOf(newest)).toEqual(['Ferret', 'Gibbon', 'Heron', 'Iguana']);
  expect(tagsOf(byArrival.slice(-4))).toEqual(tagsOf(newest));
  const hits = all('[data-role="hit"]');
  expect(hits.map((hit) => hit.getAttribute('data-tag')).sort()).toEqual(tagsOf(newest));
  expect(new Set(hits.map((hit) => serverOf(centerOf(hit))))).toEqual(new Set([0, 1, 2, 3]));
  for (const hit of hits) {
    const chip = chipAt(hit.getAttribute('data-tag') ?? '', QUERY_ARRIVES + 0.05);
    expect(chip && centerOf(chip)).toEqual(centerOf(hit));
    expect(hiddenThroughout(hit, between(0, QUERY_ARRIVES - 0.05))).toBe(true);
    expect(shownThroughout(hit, between(QUERY_ARRIVES + 0.05, OPEN - 0.05))).toBe(true);
    expect(hiddenThroughout(hit, between(OPEN + 0.05, LOOP - 0.05))).toBe(true);
  }
  const asks = all('[data-role="ask"]');
  expect(asks.map((ask) => numberOf(ask, 'data-server')).sort()).toEqual([0, 1, 2, 3]);
  for (const ask of asks) {
    expect(hiddenThroughout(ask, between(0, QUERY_SENT - 0.05))).toBe(true);
    expect(shownThroughout(ask, between(QUERY_SENT + 0.05, OPEN - 0.05))).toBe(true);
    expect(hiddenThroughout(ask, between(OPEN + 0.05, LOOP - 0.05))).toBe(true);
  }
  expect(workingAt(QUERY_SENT + 0.05)).toBe('player_id 9600 to 9999: ask all 4 servers');
});

test('in step 3 db-4 is added, and the rule becomes hash(player_id) mod 5', () => {
  for (let server = 0; server < 5; server += 1) {
    const box = one(`[data-role="server"][data-server="${server}"]`);
    expect(all('text', box).map(textOf)).toEqual([`db-${server}`]);
    if (server < 4) expect(shownThroughout(box, between(0, LOOP - 0.05))).toBe(true);
  }
  const added = one('[data-role="server"][data-server="4"]');
  expect(hiddenThroughout(added, between(0, OPEN - 0.05))).toBe(true);
  expect(shownThroughout(added, between(OPEN + 0.05, LOOP - 0.05))).toBe(true);
  const [mod4, mod5] = [
    one('[data-role="rule"][data-n="4"]'),
    one('[data-role="rule"][data-n="5"]'),
  ];
  expect(textOf(mod5)).toBe('server = hash(player_id) mod 5');
  expect(hiddenThroughout(mod4, between(OPEN + 0.05, LOOP - 0.05))).toBe(true);
  expect(hiddenThroughout(mod5, between(0, OPEN - 0.05))).toBe(true);
  expect(shownThroughout(mod5, between(OPEN + 0.05, LOOP - 0.05))).toBe(true);
  // db-4 starts empty, and nobody moves before step 4.
  expect(playersOn(4, OPEN + 0.05)).toBe(0);
  expect(countAt(4, OPEN + 0.05)).toBe('0 players');
  for (const { tag, hash } of roster) expect(serverAt(tag, MOVE - 0.05)).toBe(hash % 4);
});

test('in step 4 every player ends on server hash(player_id) mod 5, four to a server', () => {
  const end = LOOP - 0.05;
  for (const { tag, hash } of roster) expect(serverAt(tag, end)).toBe(hash % 5);
  for (let server = 0; server < 5; server += 1) {
    expect(playersOn(server, end)).toBe(4);
    expect(countAt(server, end)).toBe('4 players');
  }
});

test('only Badger, Heron, Lemur, and Quail, whose hash mod 20 is below 4, stay where they were', () => {
  const stayers = roster.filter(({ tag }) => chipAt(tag, MOVE - 0.05) === chipAt(tag, LOOP - 0.05));
  expect(tagsOf(stayers)).toEqual(['Badger', 'Heron', 'Lemur', 'Quail']);
  expect(stayers.map(({ hash }) => hash % 20).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  for (const { tag } of stayers) {
    const chip = chipAt(tag, LOOP - 0.05);
    if (!chip) throw new Error(`${tag} is on no server`);
    expect(shownThroughout(chip, between(arrivalOf(tag) + 0.05, LOOP - 0.05))).toBe(true);
    expect(flightsOf(tag)).toHaveLength(1);
    const mark = chip.querySelector('[data-role="stayed"]');
    if (!mark) throw new Error(`${tag} has no stayed mark`);
    expect(hiddenThroughout(mark, between(0, MOVE - 0.05))).toBe(true);
    expect(shownThroughout(mark, between(MOVE + 0.05, LOOP - 0.05))).toBe(true);
  }
  expect(all('[data-role="stayed"]')).toHaveLength(stayers.length);
});

test('the other 16 move one at a time, and the counter counts each one as it lands', () => {
  expect(movers).toHaveLength(16);
  for (const { tag } of movers) {
    const departures = flightsOf(tag).map(onsetSeconds);
    expect(departures).toHaveLength(2);
    expect(departures[1]).toBeGreaterThan(MOVE);
  }
  expect(movedAt(MOVE - 0.05)).toBeNull();
  for (const s of sampleTimes(MOVE, LOOP)) {
    const flying = all('[data-role="flight"]').filter((flight) => shownAt(flight, s));
    expect(flying.length).toBeLessThanOrEqual(1);
    const landed = movers.filter(({ tag, hash }) => {
      const chip = chipAt(tag, s);
      return chip !== null && serverOf(centerOf(chip)) === hash % 5;
    }).length;
    expect(movedAt(s)).toBe(`${landed} of 20 players moved`);
  }
  expect(movedAt(LOOP - 0.05)).toBe('16 of 20 players moved');
});

test('in step 4 the router shows mod 4 and mod 5 disagree for each player that moves', () => {
  for (const { tag, hash } of movers) {
    const move = flightsOf(tag)[1];
    if (!move) throw new Error(`${tag} never moves`);
    expect(workingAt(onsetSeconds(move) + 0.05)).toBe(
      `${tag}: ${hash} mod 4 = ${hash % 4}, ${hash} mod 5 = ${hash % 5}`,
    );
  }
  expect(workingAt(LOOP - 0.05)).toBe('mod 4 and mod 5 agree only when hash mod 20 < 4');
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => {
    const next = steps[i + 1]?.at ?? LOOP;
    expect(shownThroughout(captions[i]!, between(step.at + 0.05, next - 0.05))).toBe(true);
  });
});
