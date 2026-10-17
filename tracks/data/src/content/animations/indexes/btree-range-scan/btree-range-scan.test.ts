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

import { render } from './btree-range-scan.gen.ts';

const LOOP = 16;
// Matchmaking asks for the ratings from FROM to TO, both included: the opponents for a
// player rated 4165.
const FROM = 4120;
const TO = 4210;

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./btree-range-scan.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string, within: Element = svg): Element[] => [
  ...within.querySelectorAll(selector),
];
const one = (selector: string, within: Element = svg): Element => {
  const found = within.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment;
};
const byOnset = (a: Element, b: Element): number => onset(a) - onset(b);
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// The tree, read back from the drawing.
const page = (id: string): Element => one(`[data-role="page"][data-page="${id}"]`);
const idOf = (el: Element): string =>
  el.closest('[data-role="page"]')?.getAttribute('data-page') ?? '';
const leftOf = (el: Element): number => Number(one('[data-role="frame"]', el).getAttribute('x'));
const byLeft = (a: Element, b: Element): number => leftOf(a) - leftOf(b);
const levelOf = (level: string): string[] =>
  all(`[data-role="page"][data-level="${level}"]`).sort(byLeft).map(idOf);
const LEAVES = levelOf('leaf');
const keyOf = (el: Element): number =>
  Number(el.closest('[data-role="key"]')?.getAttribute('data-key'));
const keysOn = (id: string): number[] => all('[data-role="key"]', page(id)).map(keyOf);
const childrenOf = (id: string): string[] =>
  all(`[data-role="page"][data-parent="${id}"]`).sort(byLeft).map(idOf);
const separatorOf = (id: string): number =>
  Number(one('[data-role="separator"]', page(id)).getAttribute('data-key'));
const ends = (el: Element): string =>
  `${el.getAttribute('data-from')} to ${el.getAttribute('data-to')}`;

// The pages a search for a key passes through. A page above the leaves sends keys
// below its separator to its left child and the rest to its right child.
function descend(key: number, id = 'root'): string[] {
  if (page(id).getAttribute('data-level') === 'leaf') return [id];
  const [left, right] = childrenOf(id);
  return [id, ...descend(key, (key < separatorOf(id) ? left : right) ?? '')];
}

// The one element of a role that shows at a moment, or null when none does.
function shownAt(role: string, seconds: number): Element | null {
  const shown = all(`[data-role="${role}"]`).filter((el) => opacityAt(el, at(seconds)) === 1);
  if (shown.length > 1) throw new Error(`${shown.length} of ${role} show at ${seconds} s`);
  return shown[0] ?? null;
}
// The page the scan holds at a moment, or null while it moves between pages.
const pageAt = (seconds: number): string | null => {
  const held = shownAt('reading', seconds);
  return held ? idOf(held) : null;
};
// The key the scan reads at a moment, or null when it reads none.
const keyAt = (seconds: number): number | null => {
  const read = shownAt('read', seconds);
  return read ? keyOf(read) : null;
};
const reading = (id: string): Element => one('[data-role="reading"]', page(id));
const readOf = (key: number): Element =>
  one(`[data-role="key"][data-key="${key}"] [data-role="read"]`);
const pagesRead = (): string[] =>
  all('[data-role="reading"]')
    .filter((el) => onsetOf(el) !== null)
    .sort(byOnset)
    .map(idOf);
const trails = (): string[] => all('[data-role="trail"]').sort(byOnset).map(ends);
const trailOf = (from: string, to: string): Element =>
  one(`[data-role="trail"][data-from="${from}"][data-to="${to}"]`);

type Point = [x: number, y: number];
const pointsOf = (path: Element): Point[] =>
  [...(path.getAttribute('d') ?? '').matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
// Where a dot stands at a moment, read off the linear translate that moves it.
function positionAt(dot: Element, seconds: number): Point {
  const motion = one('animateTransform', dot);
  const times = (motion.getAttribute('keyTimes') ?? '').split(';').map(Number);
  const spots = (motion.getAttribute('values') ?? '')
    .split(';')
    .map((pair): Point => [Number(pair.split(',')[0]), Number(pair.split(',')[1])]);
  const t = at(seconds);
  const i = Math.max(
    0,
    times.findLastIndex((k) => k <= t),
  );
  const j = Math.min(i + 1, times.length - 1);
  const progress = times[j]! > times[i]! ? (t - times[i]!) / (times[j]! - times[i]!) : 0;
  const [[x1, y1], [x2, y2]] = [spots[i]!, spots[j]!];
  return [x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress];
}
const near = ([x, y]: Point): Point => [expect.closeTo(x, 0), expect.closeTo(y, 0)];
const midpoint = ([x1, y1]: Point, [x2, y2]: Point): Point => [(x1 + x2) / 2, (y1 + y2) / 2];

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 16 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('16s');
});

test('matchmaking asks the index on players (rating) for the ratings 4120 to 4210', () => {
  expect(textOf(one('[data-role="query"]'))).toBe(
    `SELECT player_id, tag FROM players WHERE rating BETWEEN ${FROM} AND ${TO};`,
  );
  expect(textOf(one('[data-role="index"]'))).toContain('players (rating)');
});

test('the index has a root page, two internal pages, and four leaf pages', () => {
  expect(levelOf('root')).toEqual(['root']);
  expect(levelOf('internal')).toEqual(['internal-1', 'internal-2']);
  expect(LEAVES).toEqual(['leaf-1', 'leaf-2', 'leaf-3', 'leaf-4']);
  expect(childrenOf('root')).toEqual(['internal-1', 'internal-2']);
  expect(childrenOf('internal-1')).toEqual(['leaf-1', 'leaf-2']);
  expect(childrenOf('internal-2')).toEqual(['leaf-3', 'leaf-4']);
  const hung = all('[data-role="page"][data-parent]').map(
    (child) => `${child.getAttribute('data-parent')} to ${idOf(child)}`,
  );
  expect(all('[data-role="downlink"]').map(ends).sort()).toEqual(hung.sort());
});

test('the leaves hold 16 keys in order from left to right, and each links to the next', () => {
  const keys = LEAVES.flatMap(keysOn);
  expect(keys).toHaveLength(16);
  expect(keys).toEqual([...keys].sort((a, b) => a - b));
  expect(new Set(keys).size).toBe(keys.length);
  expect(all('[data-role="right-link"]').map(ends)).toEqual(
    LEAVES.slice(1).map((id, i) => `${LEAVES[i]} to ${id}`),
  );
});

test('the separators send every key down to the leaf that holds it', () => {
  const held = LEAVES.flatMap((leaf) => keysOn(leaf).map((key) => [key, leaf] as const));
  expect(held).toHaveLength(16);
  for (const [key, leaf] of held) expect(descend(key).at(-1)).toBe(leaf);
});

test('the scan goes down once, from the root page to the leaf that holds 4120', () => {
  expect(descend(FROM)).toEqual(['root', 'internal-1', 'leaf-2']);
  expect([0.25, 1, 1.75, 2.5, 3.25, 4.5].map(pageAt)).toEqual([
    null,
    'root',
    null,
    'internal-1',
    null,
    'leaf-2',
  ]);
  expect(trails().slice(0, 2)).toEqual(['root to internal-1', 'internal-1 to leaf-2']);
  expect(keyAt(4.5)).toBe(FROM);
});

test('a page above the leaves says which way 4120 goes while the scan reads it', () => {
  const turns = { root: '4120 < 4180: go left', 'internal-1': '4120 > 4090: go right' };
  for (const [id, words] of Object.entries(turns)) {
    const turn = one('[data-role="compare"]', page(id));
    expect(textOf(turn)).toBe(words);
    for (let t = 0; t < LOOP; t += 0.25) {
      expect(opacityAt(turn, at(t))).toBe(opacityAt(reading(id), at(t)));
    }
  }
});

test('on the leaf, the scan reads to the right from 4120, one key at a time', () => {
  expect([4.5, 5.5, 7].map(keyAt)).toEqual([4120, 4150, 4165]);
  // 4090 sits left of 4120 on the same leaf, so the scan never reads it.
  expect(all('[data-role="read"]', page('leaf-2')).map(keyOf)).toEqual([4120, 4150, 4165]);
  const lefts = all('[data-role="read"]')
    .sort(byOnset)
    .map((read) => Number(read.getAttribute('x')));
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
});

test('every key from 4120 to 4210 becomes a match the moment the scan reads it', () => {
  const inRange = LEAVES.flatMap(keysOn).filter((key) => key >= FROM && key <= TO);
  const matches = all('[data-role="match"]');
  expect(matches.map(keyOf)).toEqual(inRange);
  for (const match of matches) {
    expect(onset(match)).toBe(onset(readOf(keyOf(match))));
    expect(shownThroughout(match, [onset(match), 1])).toBe(true);
  }
});

test('at the end of the leaf, the scan follows the right-link to the next leaf, not a parent', () => {
  const hop = trailOf('leaf-2', 'leaf-3');
  expect(all('[data-role="right-link"]').map(ends)).toContain('leaf-2 to leaf-3');
  expect(onset(hop)).toBeGreaterThan(onset(readOf(4165)));
  expect(onset(hop)).toBeLessThan(onset(readOf(4180)));
  expect([pageAt(8.5), keyAt(8.5)]).toEqual([null, null]);
  expect([9.5, 10.5, 11.5].map(keyAt)).toEqual([4180, 4195, 4210]);
  expect([9.5, 11.5].map(pageAt)).toEqual(['leaf-3', 'leaf-3']);
  // The next leaf hangs under the other internal page, and the scan reads no page above the leaves again.
  expect(descend(4180)).toEqual(['root', 'internal-2', 'leaf-3']);
  expect(pagesRead()).toEqual(['root', 'internal-1', 'leaf-2', 'leaf-3']);
  for (const id of ['root', 'internal-1']) {
    expect(hiddenThroughout(reading(id), between(3.5, LOOP))).toBe(true);
  }
  expect(trails()).toEqual(['root to internal-1', 'internal-1 to leaf-2', 'leaf-2 to leaf-3']);
  for (const trail of all('[data-role="trail"]')) {
    expect(shownThroughout(trail, [onset(trail), 1])).toBe(true);
  }
});

test('the scan crosses each link it follows, and only between the two pages the link joins', () => {
  const crossings = [
    { link: 'downlink', from: 'root', to: 'internal-1', during: [1.5, 2] },
    { link: 'downlink', from: 'internal-1', to: 'leaf-2', during: [3, 3.5] },
    { link: 'right-link', from: 'leaf-2', to: 'leaf-3', during: [8, 9] },
  ] as const;
  for (const { link, from, to, during } of crossings) {
    const [start, end] = during;
    const trail = trailOf(from, to);
    const path = one(`[data-role="${link}"][data-from="${from}"][data-to="${to}"]`);
    expect(one('[data-role="line"]', trail).getAttribute('d')).toBe(path.getAttribute('d'));
    const dot = one('[data-role="dot"]', trail);
    expect(hiddenThroughout(dot, between(0, start - 0.05))).toBe(true);
    expect(shownThroughout(dot, between(start + 0.05, end - 0.05))).toBe(true);
    expect(hiddenThroughout(dot, between(end + 0.05, LOOP))).toBe(true);
    expect([pageAt(start - 0.1), pageAt(end + 0.1)]).toEqual([from, to]);
    const [first, last] = pointsOf(path) as [Point, Point];
    expect(positionAt(dot, start)).toEqual(near(first));
    expect(positionAt(dot, (start + end) / 2)).toEqual(near(midpoint(first, last)));
    expect(positionAt(dot, end)).toEqual(near(last));
  }
});

test('the scan stops at 4240, the first key past 4210, after reading four of the seven pages', () => {
  expect(LEAVES.flatMap(keysOn).find((key) => key > TO)).toBe(4240);
  expect([12.5, 15.9].map(keyAt)).toEqual([4240, 4240]);
  const stop = one('[data-role="stop"]');
  expect(textOf(stop)).toBe('4240 > 4210: stop');
  expect(onset(stop)).toBe(onset(readOf(4240)));
  expect(hiddenThroughout(stop, between(0, 11.9))).toBe(true);
  expect(shownThroughout(stop, [onset(stop), 1])).toBe(true);
  expect(
    all('[data-role="read"]')
      .map(keyOf)
      .filter((key) => key > 4240),
  ).toEqual([]);
  expect(pagesRead()).toHaveLength(4);
  expect(all('[data-role="page"]')).toHaveLength(7);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  steps.forEach((step, i) => {
    const next = steps[i + 1]?.at ?? LOOP;
    expect(shownThroughout(captions[i]!, between(step.at + 0.05, next - 0.05))).toBe(true);
  });
  for (let t = 0.1; t < LOOP; t += 0.5) expect(shownAt('caption', t)).not.toBeNull();
});

test('each step starts when the moment it describes begins', () => {
  const [down, right, across, stop] = steps.map((step) => at(step.at));
  expect(down).toBe(0);
  expect(onset(reading('leaf-2'))).toBeLessThan(right!);
  expect(onset(readOf(4150))).toBeCloseTo(right!, 4);
  expect(onset(trailOf('leaf-2', 'leaf-3'))).toBeCloseTo(across!, 4);
  expect(onset(one('[data-role="stop"]'))).toBeCloseTo(stop!, 4);
});
