import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg, tagOf } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './btree-lookup.gen.ts';

const LOOP = 20;
// Players from the track's shared roster whose ids this index holds: [tag, rating] by player id.
const ROSTER: ReadonlyMap<number, readonly [tag: string, rating: number]> = new Map([
  [1042, ['Koala', 8640]],
  [2981, ['Badger', 6450]],
  [4127, ['Tapir', 8410]],
  [5214, ['Dingo', 7650]],
]);
// The player who signs in.
const PLAYER_ID = 4127;
const END = (LOOP - 0.05) / LOOP;
const at = (seconds: number): number => seconds / LOOP;
const text = readFileSync(new URL('./btree-lookup.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);
const steps = lesson.steps ?? [];
// Where each step starts and ends, as fractions of the loop.
const stepWindow = (i: number): [number, number] => [
  at(steps[i]!.at),
  at(steps[i + 1]?.at ?? LOOP),
];

const all = (selector: string, within: Element = svg): Element[] => [
  ...within.querySelectorAll(selector),
];
const one = (selector: string, within: Element = svg): Element => {
  const found = within.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const numberOf = (el: Element, name: string): number => Number(el.getAttribute(name));
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment;
};
// The one text among the matches that shows at a moment, or null when none does.
const shownAt = (selector: string, moment: number): string | null => {
  const shown = all(selector).filter((el) => opacityAt(el, moment) === 1);
  if (shown.length > 1) throw new Error(`${shown.length} of ${selector} show at ${moment}`);
  return shown[0] ? textOf(shown[0]) : null;
};

type Page = { id: string; level: number; keys: number[]; frame: Element };
const pages: Page[] = all('[data-role="page"]').map((g) => ({
  id: g.getAttribute('data-page')!,
  level: numberOf(g, 'data-level'),
  keys: all('[data-role="entry"]', g).map((entry) => Number(textOf(entry))),
  frame: one('[data-role="frame"]', g),
}));
const page = (id: string): Page => {
  const found = pages.find((p) => p.id === id);
  if (!found) throw new Error(`no page ${id}`);
  return found;
};
const onLevel = (level: number): Page[] => pages.filter((p) => p.level === level);
const childrenOf = (id: string): string[] =>
  all(`[data-role="downlink"][data-from="${id}"]`)
    .sort((a, b) => numberOf(a, 'data-slot') - numberOf(b, 'data-slot'))
    .map((link) => link.getAttribute('data-to')!);
// The downlink a search for the player id takes: the one past every separator at or below it.
const slotFor = (p: Page): number => p.keys.filter((key) => key <= PLAYER_ID).length;
const leafKeys = (): number[] => onLevel(0).flatMap((p) => p.keys);
const profileOf = (id: number): string => {
  const player = ROSTER.get(id);
  if (!player) throw new Error(`player ${id} is not on the roster`);
  return `${id} ${player.join(' ')}`;
};
const reading = (p: Page): Element => one(`[data-role="reading"][data-page="${p.id}"]`);
const readMark = (p: Page): Element => one(`[data-role="read"][data-page="${p.id}"]`);
const readPages = all('[data-role="read"]').map((mark) => page(mark.getAttribute('data-page')!));

// Where a group's own translate puts it at a moment of the loop.
function positionAt(el: Element, moment: number): [x: number, y: number] {
  const motion = [...el.children].find((child) => tagOf(child) === 'animatetransform');
  if (!motion) throw new Error(`${el.getAttribute('data-role')} does not move`);
  const keyTimes = motion.getAttribute('keyTimes')!.split(';').map(Number);
  const values = motion
    .getAttribute('values')!
    .split(';')
    .map((pair) => pair.split(',').map(Number) as [number, number]);
  let i = keyTimes.length - 1;
  while (i > 0 && keyTimes[i]! > moment) i -= 1;
  const [from, to] = [values[i]!, values[i + 1] ?? values[i]!];
  const span = (keyTimes[i + 1] ?? 1) - keyTimes[i]!;
  const progress = span > 0 ? (moment - keyTimes[i]!) / span : 0;
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
}

test('opens the B-tree section and cites the B-tree structure and its search', () => {
  expect(lesson.id).toBe('btree-lookup');
  expect(lesson.section).toBe('indexes');
  expect(lesson.order).toBe(1);
  expect(lesson.references.map((reference) => reference.url)).toEqual([
    'https://www.postgresql.org/docs/current/btree.html#BTREE-STRUCTURE',
    'https://github.com/postgres/postgres/blob/master/src/backend/access/nbtree/README',
  ]);
});

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story of four steps lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
  expect(steps.map((step) => step.at)).toEqual([0, 4, 8, 12]);
});

test('player 4127 signs in, and the game asks for the profile by player id', () => {
  const query = one('[data-role="query"]');
  expect(textOf(query)).toBe(`SELECT * FROM players WHERE player_id = ${PLAYER_ID}`);
  expect(shownThroughout(query, [0, END])).toBe(true);
});

test('the index on player_id is a B-tree with a root, three internal pages, and nine leaves', () => {
  expect(onLevel(2).map((p) => p.id)).toEqual(['root']);
  expect(onLevel(1)).toHaveLength(3);
  expect(onLevel(0)).toHaveLength(9);
  for (const p of pages) expect(p.keys).toEqual([...p.keys].sort((a, b) => a - b));
  const ids = leafKeys();
  expect(ids).toEqual([...ids].sort((a, b) => a - b));
  expect(ids).toContain(PLAYER_ID);

  // Each downlink leads one level down, to a page whose keys lie between the separators around it.
  const reached: string[] = [];
  const descend = (id: string, low: number, high: number): void => {
    const p = page(id);
    reached.push(id);
    for (const key of p.keys) {
      expect(key).toBeGreaterThanOrEqual(low);
      expect(key).toBeLessThan(high);
    }
    const children = childrenOf(id);
    if (p.level === 0) {
      expect(children).toEqual([]);
      return;
    }
    expect(children).toHaveLength(p.keys.length + 1);
    const bounds = [low, ...p.keys, high];
    children.forEach((child, slot) => {
      expect(page(child).level).toBe(p.level - 1);
      descend(child, bounds[slot]!, bounds[slot + 1]!);
    });
  };
  descend('root', -Infinity, Infinity);
  expect(reached.sort()).toEqual(pages.map((p) => p.id).sort());
});

test('the lookup reads one page per level, each the child its parent sent it to', () => {
  expect(readPages.map((p) => p.level)).toEqual([2, 1, 0]);
  expect(all('[data-role="reading"]').map((mark) => mark.getAttribute('data-page'))).toEqual(
    readPages.map((p) => p.id),
  );
  const [root, internal, leaf] = readPages as [Page, Page, Page];
  expect(childrenOf(root.id)[slotFor(root)]).toBe(internal.id);
  expect(childrenOf(internal.id)[slotFor(internal)]).toBe(leaf.id);
  expect(
    all('[data-role="followed"]').map((link) => [
      link.getAttribute('data-from'),
      link.getAttribute('data-to'),
    ]),
  ).toEqual([
    [root.id, internal.id],
    [internal.id, leaf.id],
  ]);
});

test('each step reads its level: the page is read during the step and stays marked read', () => {
  readPages.forEach((p, i) => {
    const [start, end] = stepWindow(i);
    expect(onset(reading(p))).toBeGreaterThanOrEqual(start);
    expect(onset(reading(p))).toBeLessThan(end);
    expect(hiddenThroughout(reading(p), [0, Math.max(0, onset(reading(p)) - at(0.05))])).toBe(true);
    expect(hiddenThroughout(reading(p), [end, END])).toBe(true);
    expect(hiddenThroughout(readMark(p), [0, onset(reading(p))])).toBe(true);
    expect(shownThroughout(readMark(p), [end, END])).toBe(true);
  });
});

test('the search key arrives over each page as its read starts', () => {
  const key = one('[data-role="search-key"]');
  expect(textOf(key)).toBe(String(PLAYER_ID));
  for (const p of readPages) {
    const moment = onset(reading(p)) + at(0.1);
    const [x, y] = positionAt(key, moment);
    const [left, top] = [numberOf(p.frame, 'x'), numberOf(p.frame, 'y')];
    expect(opacityAt(key, moment)).toBe(1);
    expect(x).toBeGreaterThan(left);
    expect(x).toBeLessThan(left + numberOf(p.frame, 'width'));
    expect(y).toBeGreaterThan(top - 30);
    expect(y).toBeLessThan(top);
  }
});

test("step 1: the root's separators send player 4127 to the child whose range holds it", () => {
  const root = readPages[0]!;
  expect(slotFor(root)).toBe(1);
  const compare = one(`[data-role="compare"][data-page="${root.id}"]`);
  expect(textOf(compare)).toBe(`${root.keys[0]} < ${PLAYER_ID} < ${root.keys[1]}`);
  expect(onset(compare)).toBeGreaterThan(onset(reading(root)));
  expect(onset(compare)).toBeLessThan(stepWindow(0)[1]);
});

test('step 2: an internal page narrows it down again, to the leftmost leaf below it', () => {
  const internal = readPages[1]!;
  expect(slotFor(internal)).toBe(0);
  const compare = one(`[data-role="compare"][data-page="${internal.id}"]`);
  expect(textOf(compare)).toBe(`${PLAYER_ID} < ${internal.keys[0]}`);
  const [start, end] = stepWindow(1);
  expect(onset(compare)).toBeGreaterThan(start);
  expect(onset(compare)).toBeLessThan(end);
  expect(hiddenThroughout(compare, [0, start])).toBe(true);
});

test('the players table shows roster players, and the index holds an entry for each row', () => {
  expect(textOf(one('[data-role="table"]'))).toContain('players');
  const rows = all('[data-role="row"]');
  const byId = (a: number, b: number): number => a - b;
  expect(rows.map((row) => numberOf(row, 'data-player')).sort(byId)).toEqual(
    [...ROSTER.keys()].sort(byId),
  );
  for (const row of rows) {
    const id = numberOf(row, 'data-player');
    expect(textOf(row)).toBe(profileOf(id));
    expect(leafKeys()).toContain(id);
  }
});

test("step 3: the leaf holds 4127 and a pointer to Tapir's row in players", () => {
  const leaf = readPages[2]!;
  expect(leaf.keys).toContain(PLAYER_ID);
  const found = one(`[data-role="found"][data-key="${PLAYER_ID}"]`);
  const pointer = one(`[data-role="row-pointer"][data-player="${PLAYER_ID}"]`);
  const fetched = one(`[data-role="fetched"][data-player="${PLAYER_ID}"]`);
  expect(textOf(fetched)).toBe('4127 Tapir 8410');
  const story = [onset(reading(leaf)), onset(found), onset(pointer), onset(fetched)];
  story.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(story[i]!));
  expect(onset(fetched)).toBeLessThan(stepWindow(2)[1]);
  for (const el of [found, pointer, fetched]) {
    expect(hiddenThroughout(el, [0, onset(reading(leaf))])).toBe(true);
    expect(shownThroughout(el, [stepWindow(3)[0], END])).toBe(true);
  }
});

test('the counter adds one page read per level and ends at the height of the tree', () => {
  const count = (moment: number): string | null => shownAt('[data-role="read-count"]', moment);
  expect(count(0)).toBe('0');
  readPages.forEach((p, i) => expect(count(onset(reading(p)) + at(0.05))).toBe(String(i + 1)));
  expect(count(END)).toBe('3');
  expect(new Set(pages.map((p) => p.level)).size).toBe(3);
});

test('step 4: one more level would multiply the keys within reach by the fanout', () => {
  const fanout = childrenOf('root').length;
  expect(fanout).toBe(3);
  for (const p of [...onLevel(2), ...onLevel(1)]) expect(childrenOf(p.id)).toHaveLength(fanout);
  const keys = leafKeys().length;
  const cell = (levels: number, column: string): string =>
    textOf(one(`[data-role="reach"][data-levels="${levels}"] [data-column="${column}"]`));
  expect(cell(3, 'keys')).toBe(String(keys));
  expect(cell(4, 'reads')).toBe('4');
  expect(cell(4, 'keys')).toBe(String(keys * fanout));

  const now = one('[data-role="reach"][data-levels="3"]');
  const more = one('[data-role="reach"][data-levels="4"]');
  const extra = one('[data-role="extra-level"]');
  expect(shownThroughout(now, [0, END])).toBe(true);
  const [start] = stepWindow(3);
  for (const el of [more, extra]) {
    expect(hiddenThroughout(el, [0, start - at(0.05)])).toBe(true);
    expect(shownThroughout(el, [start, END])).toBe(true);
  }
  // The new root's downlinks reach the old root and two more trees like it.
  const links = all('[data-role="extra-downlink"]', extra);
  expect(links).toHaveLength(fanout);
  expect(links.filter((link) => link.getAttribute('data-to') === 'root')).toHaveLength(1);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
