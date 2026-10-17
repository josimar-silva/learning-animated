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

import { render } from './scatter-gather.gen.ts';

const LOOP = 20;
const SERVERS = ['db-0', 'db-1', 'db-2', 'db-3'] as const;
type Server = (typeof SERVERS)[number];

// The track's roster: tag, player_id, hash(player_id), rating.
const ROSTER = [
  ['Adder', 412, 47, 6720],
  ['Badger', 2981, 82, 6450],
  ['Coyote', 7702, 35, 5560],
  ['Dingo', 5214, 64, 7650],
  ['Egret', 7915, 13, 8150],
  ['Ferret', 9612, 58, 9870],
  ['Gibbon', 9745, 91, 8330],
  ['Heron', 9861, 20, 6980],
  ['Iguana', 9980, 37, 4610],
  ['Jackal', 8240, 29, 7020],
  ['Koala', 1042, 66, 8640],
  ['Lemur', 8577, 41, 9310],
  ['Marten', 3560, 52, 5230],
  ['Newt', 8903, 99, 9540],
  ['Otter', 9128, 25, 8770],
  ['Petrel', 6120, 70, 7890],
  ['Quail', 7038, 43, 7410],
  ['Raven', 2046, 88, 8920],
  ['Stoat', 9406, 14, 5870],
  ['Tapir', 4127, 56, 8410],
] as const;
type Entry = (typeof ROSTER)[number];
// hash(player_id) mod 4 picks each player's server.
const serverFor = ([, , hash]: Entry): Server => SERVERS[hash % SERVERS.length]!;
const byRating = (a: Entry, b: Entry): number => b[3] - a[3];
const resultRow = (e: Entry): string => `${e[1]} ${e[0]} ${e[3]} from ${serverFor(e)}`;
// Each server's own top 3 by rating.
const TOP_3: Record<Server, readonly string[]> = {
  'db-0': ['Raven', 'Tapir', 'Dingo'],
  'db-1': ['Lemur', 'Otter', 'Egret'],
  'db-2': ['Ferret', 'Koala', 'Petrel'],
  'db-3': ['Newt', 'Gibbon', 'Quail'],
};

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
// Samples a moment just before a change.
const NUDGE = at(0.05);

const text = readFileSync(new URL('./scatter-gather.svg', import.meta.url), 'utf8');
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
const textOf = (el: Element): string => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const serverOf = (el: Element): string | null => el.getAttribute('data-server');
const rowOf = (el: Element): string | null => el.getAttribute('data-row');
const tagOf = (el: Element): string | null => el.getAttribute('data-tag');
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment;
};

const server = (id: Server): Element => one(`[data-role="server"][data-server="${id}"]`);
const playersOn = (id: Server): Element[] => all('[data-role="player"]', server(id));
const playerRow = (id: Server, tag: string): Element => one(`[data-tag="${tag}"]`, server(id));
const field = (row: Element, name: 'player_id' | 'tag' | 'rating'): Element =>
  one(`[data-field="${name}"]`, row);
// The rect that draws one cell of a player row.
const cell = (row: Element, name: 'player_id' | 'tag' | 'rating'): Element =>
  one('rect', field(row, name));
const of = (role: string, query: string, id?: Server): Element[] =>
  all(`[data-role="${role}"][data-query="${query}"]${id ? `[data-server="${id}"]` : ''}`);
const only = (role: string, query: string, id?: Server): Element => {
  const found = of(role, query, id);
  expect(found, `one ${role} for ${query} ${id ?? ''}`).toHaveLength(1);
  return found[0]!;
};
// The result rows on show at a moment, top to bottom.
const rowsAt = (query: string, moment: number): string[] =>
  of('result-row', query)
    .filter((row) => opacityAt(row, moment) === 1)
    .sort((a, b) => numberOf(one('rect', a), 'y') - numberOf(one('rect', b), 'y'))
    .map(textOf);

// A server reads the given players' rows in order, one at a time, from the moment the request
// lands until it sends its answer. Each row lights up as it is read, the server's box is marked
// as working for exactly that long, and the answer counts the rows.
function expectReturns(query: string, id: Server, tags: readonly string[]): void {
  const reads = of('read', query, id);
  expect(reads.map(rowOf)).toEqual(tags.map((tag) => rowOf(playerRow(id, tag))));
  const request = only('request', query, id);
  const first = onset(reads[0]!);
  expect(opacityAt(request, first - NUDGE)).toBe(1);
  expect(opacityAt(request, first)).toBe(0);
  reads.forEach((read, i) => {
    const box = cell(playerRow(id, tags[i]!), 'player_id');
    expect(numberOf(read, 'y')).toBeLessThan(numberOf(box, 'y'));
    expect(numberOf(read, 'y') + numberOf(read, 'height')).toBeGreaterThan(
      numberOf(box, 'y') + numberOf(box, 'height'),
    );
    const next = reads[i + 1];
    if (next) {
      expect(onset(next)).toBeGreaterThan(onset(read));
      expect(opacityAt(read, onset(next))).toBe(0);
    }
  });
  const matches = of('match', query, id);
  expect(matches.map(tagOf)).toEqual([...tags]);
  matches.forEach((match, i) => expect(onset(match)).toBe(onset(reads[i]!)));
  const answer = only('answer', query, id);
  expect(textOf(answer)).toBe(`${tags.length} ${tags.length === 1 ? 'row' : 'rows'}`);
  const last = reads.at(-1)!;
  expect(opacityAt(last, onset(answer) - NUDGE)).toBe(1);
  expect(opacityAt(last, onset(answer))).toBe(0);
  const working = only('working', query, id);
  expect(onset(working)).toBe(first);
  expect(shownThroughout(working, [first, onset(answer) - NUDGE])).toBe(true);
  expect(opacityAt(working, onset(answer))).toBe(0);
}

// The router has an answer the moment its chip, in flight just before, disappears.
function expectArrivesAt(answer: Element, moment: number): void {
  expect(opacityAt(answer, moment - NUDGE)).toBe(1);
  expect(opacityAt(answer, moment)).toBe(0);
}

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('is lesson 5 of the sharding section, on one 20 s loop', () => {
  expect([lesson.id, lesson.section, lesson.order]).toEqual(['scatter-gather', 'sharding', 5]);
  expect(svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
});

test('each server holds the five players hash(player_id) mod 4 puts there, best rating first', () => {
  expect(all('[data-role="server"]').map(serverOf)).toEqual([...SERVERS]);
  for (const id of SERVERS) {
    expect(textOf(one('[data-role="server-name"]', server(id)))).toBe(id);
    expect(textOf(one('[data-role="players"]', server(id)))).toBe('5 players');
    const placed = ROSTER.filter((e) => serverFor(e) === id).sort(byRating);
    expect(placed).toHaveLength(5);
    expect(
      playersOn(id).map((row) => [
        tagOf(row),
        textOf(field(row, 'player_id')),
        textOf(field(row, 'tag')),
        textOf(field(row, 'rating')),
      ]),
    ).toEqual(placed.map(([tag, pid, , rating]) => [tag, String(pid), tag, String(rating)]));
  }
});

test('db-2 alone is marked busy, for the whole loop', () => {
  const busy = all('[data-role="busy"]');
  expect(busy).toHaveLength(1);
  expect(all('[data-role="busy"]', server('db-2'))).toHaveLength(1);
  expect(textOf(busy[0]!)).toBe('busy');
  expect(shownThroughout(busy[0]!, between(0, 19.95))).toBe(true);
});

test('in step 1 the router and every server mark player_id as the shard key', () => {
  expect(textOf(one('[data-role="router"]'))).toContain('shard key: player_id');
  const marks = all('[data-role="shard-key"]');
  expect(marks.map(serverOf)).toEqual([null, ...SERVERS]);
  for (const mark of marks) {
    expect(shownThroughout(mark, between(0, 3.95))).toBe(true);
    expect(hiddenThroughout(mark, between(4.05, 19.95))).toBe(true);
  }
  // Each server's mark frames its player_id column and leaves the tags out.
  for (const id of SERVERS) {
    const mark = one(`[data-role="shard-key"][data-server="${id}"]`);
    const [left, top] = [numberOf(mark, 'x'), numberOf(mark, 'y')];
    const [right, bottom] = [left + numberOf(mark, 'width'), top + numberOf(mark, 'height')];
    for (const row of playersOn(id)) {
      const [pid, tag] = [cell(row, 'player_id'), cell(row, 'tag')];
      expect(left).toBeLessThan(numberOf(pid, 'x'));
      expect(right).toBeGreaterThan(numberOf(pid, 'x') + numberOf(pid, 'width'));
      expect(right).toBeLessThan(numberOf(tag, 'x'));
      expect(top).toBeLessThan(numberOf(pid, 'y'));
      expect(bottom).toBeGreaterThan(numberOf(pid, 'y') + numberOf(pid, 'height'));
    }
  }
});

test("the profile query names Lemur's player_id and runs from 4 s to 10 s", () => {
  const query = only('query', 'profile');
  expect(textOf(query)).toBe("Lemur's profile SELECT * FROM players WHERE player_id = 8577");
  expect(hiddenThroughout(query, between(0, 3.95))).toBe(true);
  expect(shownThroughout(query, between(4.05, 9.95))).toBe(true);
  expect(hiddenThroughout(query, between(10.05, 19.95))).toBe(true);
});

test('the router hashes player 8577 to db-1 and asks db-1 alone', () => {
  const lemur = ROSTER.find(([tag]) => tag === 'Lemur')!;
  expect([lemur[1], serverFor(lemur)]).toEqual([8577, 'db-1']);
  const lookup = only('lookup', 'profile');
  expect(textOf(lookup)).toBe('hash(8577) mod 4 = 1: ask db-1');
  for (const role of ['request', 'working', 'answer']) {
    expect(of(role, 'profile').map(serverOf), role).toEqual(['db-1']);
  }
  expect(onset(lookup)).toBeGreaterThan(at(4));
  expect(onset(only('request', 'profile'))).toBeGreaterThan(onset(lookup));
  // The other servers never see the query.
  for (const id of ['db-0', 'db-2', 'db-3'] as const) {
    for (const role of ['working', 'read', 'match']) {
      for (const el of all(`[data-role="${role}"][data-server="${id}"]`)) {
        expect(hiddenThroughout(el, between(4, 10))).toBe(true);
      }
    }
  }
});

test("db-1 reads Lemur's row alone and answers with it", () => {
  expectReturns('profile', 'db-1', ['Lemur']);
});

test("the result shows Lemur's profile the moment db-1's answer arrives", () => {
  const done = only('done', 'profile');
  expect(textOf(done)).toBe('done');
  expectArrivesAt(only('answer', 'profile', 'db-1'), onset(done));
  expect(rowsAt('profile', onset(done) - NUDGE)).toEqual([]);
  expect(rowsAt('profile', onset(done))).toEqual(['8577 Lemur 9310 from db-1']);
  for (const el of [...of('result-row', 'profile'), done]) {
    expect(shownThroughout(el, [onset(done), at(10) - NUDGE])).toBe(true);
    expect(hiddenThroughout(el, between(10.05, 19.95))).toBe(true);
  }
  expect(of('partial', 'profile')).toEqual([]);
  const waiting = only('waiting', 'profile');
  expect(textOf(waiting)).toBe('waiting for db-1');
  expect(onset(waiting)).toBe(onset(only('request', 'profile')));
  expect(opacityAt(waiting, onset(done))).toBe(0);
});

test('the leaderboard query names no player and runs from 10 s to the end of the loop', () => {
  const query = only('query', 'leaderboard');
  expect(textOf(query)).toBe(
    'Global top 3 by rating SELECT * FROM players ORDER BY rating DESC LIMIT 3',
  );
  expect(hiddenThroughout(query, between(0, 9.95))).toBe(true);
  expect(shownThroughout(query, between(10.05, 19.95))).toBe(true);
});

test('with no player_id to hash, the router asks every server at once', () => {
  const lookup = only('lookup', 'leaderboard');
  expect(textOf(lookup)).toBe('no player_id: ask every server');
  const requests = of('request', 'leaderboard');
  expect(requests.map(serverOf)).toEqual([...SERVERS]);
  for (const request of requests) {
    expect(onset(request)).toBe(onset(requests[0]!));
    expect(onset(request)).toBeGreaterThan(onset(lookup));
  }
  expect(onset(lookup)).toBeGreaterThan(at(10));
});

test('every server reads and returns its own top 3 at the same time', () => {
  const firstReads = SERVERS.map((id) => onset(of('read', 'leaderboard', id)[0]!));
  expect(new Set(firstReads).size).toBe(1);
  for (const id of SERVERS) {
    const best = ROSTER.filter((e) => serverFor(e) === id)
      .sort(byRating)
      .slice(0, 3)
      .map(([tag]) => tag);
    expect(best).toEqual(TOP_3[id]);
    expectReturns('leaderboard', id, TOP_3[id]);
  }
});

test('busy db-2 reads slower than every other server, so it answers last', () => {
  const pace = (id: Server): number => {
    const [first, second] = of('read', 'leaderboard', id);
    return onset(second!) - onset(first!);
  };
  const slowest = onset(only('answer', 'leaderboard', 'db-2'));
  for (const id of ['db-0', 'db-1', 'db-3'] as const) {
    expect(pace('db-2')).toBeGreaterThan(pace(id));
    expect(onset(only('answer', 'leaderboard', id))).toBeLessThan(slowest);
  }
});

test('as each answer arrives, the result holds the three best ratings so far', () => {
  const waiting = of('waiting', 'leaderboard').sort((a, b) => onset(a) - onset(b));
  const done = onset(only('done', 'leaderboard'));
  const arrivals = [...waiting.slice(1).map(onset), done];
  const order = arrivals.map((moment) =>
    SERVERS.find((id) => {
      const answer = only('answer', 'leaderboard', id);
      return opacityAt(answer, moment - NUDGE) === 1 && opacityAt(answer, moment) === 0;
    }),
  );
  expect(order).toEqual(['db-0', 'db-1', 'db-3', 'db-2']);
  expect(rowsAt('leaderboard', arrivals[0]! - NUDGE)).toEqual([]);
  order.forEach((_, k) => {
    const answered = order.slice(0, k + 1);
    const best = ROSTER.filter((e) => answered.includes(serverFor(e)))
      .filter((e) => TOP_3[serverFor(e)].includes(e[0]))
      .sort(byRating)
      .slice(0, 3)
      .map(resultRow);
    expect(rowsAt('leaderboard', arrivals[k]!)).toEqual(best);
    expect(rowsAt('leaderboard', arrivals[k]! - NUDGE)).not.toEqual(best);
  });
  const partial = only('partial', 'leaderboard');
  expect(textOf(partial)).toBe('so far');
  expect(onset(partial)).toBe(arrivals[0]);
  expect(shownThroughout(partial, [arrivals[0]!, done - NUDGE])).toBe(true);
  expect(opacityAt(partial, done)).toBe(0);
});

test("only db-2's answer completes the leaderboard: Ferret, Newt, and Lemur", () => {
  const done = only('done', 'leaderboard');
  expect(textOf(done)).toBe('done');
  expectArrivesAt(only('answer', 'leaderboard', 'db-2'), onset(done));
  expect(hiddenThroughout(done, [at(10), onset(done) - NUDGE])).toBe(true);
  expect(shownThroughout(done, [onset(done), at(LOOP) - NUDGE])).toBe(true);
  const final = [
    '9612 Ferret 9870 from db-2',
    '8903 Newt 9540 from db-3',
    '8577 Lemur 9310 from db-1',
  ];
  expect(rowsAt('leaderboard', onset(done))).toEqual(final);
  expect(rowsAt('leaderboard', at(LOOP) - NUDGE)).toEqual(final);
  // Until db-2 answers, the best rating of all is missing and Raven holds third place.
  expect(rowsAt('leaderboard', onset(done) - NUDGE)).toEqual([
    '8903 Newt 9540 from db-3',
    '8577 Lemur 9310 from db-1',
    '2046 Raven 8920 from db-0',
  ]);
});

test('the router names the servers it still waits for, down to db-2 alone', () => {
  const waiting = of('waiting', 'leaderboard').sort((a, b) => onset(a) - onset(b));
  expect(waiting.map(textOf)).toEqual([
    'waiting for db-0, db-1, db-2, db-3',
    'waiting for db-1, db-2, db-3',
    'waiting for db-2, db-3',
    'waiting for db-2',
  ]);
  expect(onset(waiting[0]!)).toBe(onset(only('request', 'leaderboard', 'db-0')));
  const done = onset(only('done', 'leaderboard'));
  waiting.forEach((line, i) => {
    const until = waiting[i + 1] ? onset(waiting[i + 1]!) : done;
    expect(shownThroughout(line, [onset(line), until - NUDGE])).toBe(true);
    expect(opacityAt(line, until)).toBe(0);
  });
  // The last step opens as the first answer comes back.
  expect(at(steps.at(-1)!.at)).toBeCloseTo(onset(waiting[1]!), 6);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => {
    expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1);
    for (const other of captions.filter((_, j) => j !== i)) {
      expect(opacityAt(other, at(step.at + 0.05))).toBe(0);
    }
  });
});
