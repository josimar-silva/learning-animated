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

import { render } from './btree-page-split.gen.ts';

const LOOP = 21;
// The tree before rating 4135 arrives, and once the parent has its new downlink.
const BEFORE = 0.25;
const AFTER = 20.5;
const LEAVES = ['first', 'split', 'new', 'last'] as const;
type Leaf = (typeof LEAVES)[number];

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./btree-page-split.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);
const steps = lesson.steps ?? [];

const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
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
const shownAt = (selector: string, seconds: number): Element[] =>
  all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);
const bySlot = (a: Element, b: Element): number =>
  numberOf(a, 'data-slot') - numberOf(b, 'data-slot');

// The ratings on a leaf at a moment, in slot order.
const keysOn = (leaf: Leaf, seconds: number): number[] =>
  shownAt(`[data-role="key"][data-page="${leaf}"]`, seconds)
    .sort(bySlot)
    .map((key) => Number(textOf(key)));

// A leaf's high key at a moment, or null while it has none.
function highKeyOf(leaf: Leaf, seconds: number): number | null {
  const shown = shownAt(`[data-role="high-key"][data-page="${leaf}"]`, seconds);
  if (shown.length > 1) throw new Error(`${leaf} shows ${shown.length} high keys at ${seconds} s`);
  return shown[0] ? Number(textOf(shown[0])) : null;
}

// The root at a moment: each entry's separator and the leaf its downlink leads to, in slot order.
function rootAt(seconds: number): [separator: string, leaf: Leaf][] {
  const downlinks = shownAt('[data-role="downlink"]', seconds);
  return shownAt('[data-role="entry"]', seconds)
    .sort(bySlot)
    .map((entry) => {
      const slot = entry.getAttribute('data-slot');
      const leads = downlinks.filter((downlink) => downlink.getAttribute('data-slot') === slot);
      if (leads.length !== 1) {
        throw new Error(`root slot ${slot} has ${leads.length} downlinks at ${seconds} s`);
      }
      return [textOf(entry), leads[0]!.getAttribute('data-page') as Leaf];
    });
}

type Box = { left: number; right: number; top: number; bottom: number };
function pageBox(page: Leaf | 'root'): Box {
  const outline = one(`[data-role="page"][data-page="${page}"]`).querySelector('rect');
  if (!outline) throw new Error(`page ${page} has no outline`);
  const [left, top] = [numberOf(outline, 'x'), numberOf(outline, 'y')];
  return {
    left,
    right: left + numberOf(outline, 'width'),
    top,
    bottom: top + numberOf(outline, 'height'),
  };
}

// Where a token's own translate puts it at a moment, read linearly between keyTimes.
function placeAt(token: Element, seconds: number): [x: number, y: number] {
  const motion = [...token.children].find((child) => tagOf(child) === 'animatetransform');
  if (!motion) throw new Error(`${token.getAttribute('data-role')} does not move`);
  const times = motion.getAttribute('keyTimes')!.split(';').map(Number);
  const points = motion
    .getAttribute('values')!
    .split(';')
    .map((point) => point.split(',').map(Number));
  const t = at(seconds);
  let i = times.length - 1;
  while (i > 0 && times[i]! > t) i -= 1;
  const [from, to] = [points[i]!, points[Math.min(i + 1, points.length - 1)]!];
  const progress = i === times.length - 1 ? 0 : (t - times[i]!) / (times[i + 1]! - times[i]!);
  return [from[0]! + (to[0]! - from[0]!) * progress, from[1]! + (to[1]! - from[1]!) * progress];
}

test('is the third lesson on B-tree indexes, and the drawing carries its title', () => {
  expect([lesson.id, lesson.section, lesson.order]).toEqual(['btree-page-split', 'indexes', 3]);
  expect(textOf(one('title'))).toBe(lesson.title);
});

test('a new player finishes placement at rating 4135, which goes into the index on players(rating)', () => {
  expect(textOf(one('[data-role="note"]'))).toMatch(/^An index on players\(rating\),/);
  expect(textOf(one('desc'))).toContain('index on players(rating)');
  expect(steps[0]?.text).toMatch(/^A new player finishes placement at rating 4135\. /);
});

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 21 s, told in four steps that start on whole seconds', () => {
  expect(svg.getAttribute('data-loop')).toBe(`${LOOP}s`);
  expect(steps.map((step) => step.at)).toEqual([0, 6, 11, 15]);
});

test('before the insert, the root sends ratings to three leaves, and the second one is full', () => {
  expect(rootAt(BEFORE)).toEqual([
    ['-∞', 'first'],
    ['4102', 'split'],
    ['4190', 'last'],
  ]);
  expect(keysOn('first', BEFORE)).toEqual([4012, 4061]);
  expect(keysOn('split', BEFORE)).toEqual([4102, 4150, 4171]);
  expect(keysOn('last', BEFORE)).toEqual([4190, 4246]);
  // Every leaf has three slots, and the second leaf fills all of them.
  for (const leaf of LEAVES) expect(all(`[data-role="slot"][data-page="${leaf}"]`)).toHaveLength(3);
  expect(hiddenThroughout(one('[data-role="page"][data-page="new"]'), between(0, 5.95))).toBe(true);
});

test('rating 4135 goes down through the root entry for 4102 and stops over the full leaf', () => {
  const incoming = one('[data-role="incoming"]');
  expect(textOf(incoming)).toBe('4135');
  expect(hiddenThroughout(incoming, between(0, 0.45))).toBe(true);
  expect(shownThroughout(incoming, between(0.55, 8.7))).toBe(true);

  const route = one('[data-role="route"]');
  expect([route.getAttribute('data-slot'), route.getAttribute('data-page')]).toEqual([
    '1',
    'split',
  ]);
  const comparison = one('[data-role="comparison"]');
  expect(textOf(comparison)).toBe('4102 ≤ 4135 < 4190');
  for (const el of [route, comparison]) {
    expect(hiddenThroughout(el, between(0, 0.95))).toBe(true);
    expect(shownThroughout(el, between(1.05, 5.95))).toBe(true);
    expect(hiddenThroughout(el, between(6.05, 20.95))).toBe(true);
  }

  // It waits above the root, then comes to rest between the root and the second leaf.
  const [root, split] = [pageBox('root'), pageBox('split')];
  expect(placeAt(incoming, 1.5)[1]).toBeLessThan(root.top);
  const [restX, restY] = placeAt(incoming, 5);
  expect(restX).toBeGreaterThan(split.left);
  expect(restX).toBeLessThan(split.right);
  expect(restY).toBeGreaterThan(root.bottom);
  expect(restY).toBeLessThan(split.top);

  const full = one('[data-role="full"]');
  expect(textOf(full)).toBe('full');
  expect(hiddenThroughout(full, between(0, 3.95))).toBe(true);
  expect(shownThroughout(full, between(4.05, 5.95))).toBe(true);
  expect(hiddenThroughout(full, between(6.05, 20.95))).toBe(true);
});

test('the higher keys and the high key move to a new right sibling, and 4135 goes in on the left', () => {
  expect(shownThroughout(one('[data-role="page"][data-page="new"]'), between(6.05, 20.95))).toBe(
    true,
  );
  // The new page sits between the leaf that split and that leaf's old right neighbor.
  const lefts = LEAVES.map((leaf) => pageBox(leaf).left);
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));

  expect(keysOn('split', 6.25)).toEqual([4102, 4150, 4171]);
  expect(highKeyOf('split', 6.25)).toBe(4190);
  expect(keysOn('split', 8.25)).toEqual([4102]);
  expect(highKeyOf('split', 8.25)).toBeNull();
  expect(keysOn('new', 8.25)).toEqual([4150, 4171]);
  expect(highKeyOf('new', 8.25)).toBe(4190);

  // 4135 takes the slot 4150 left, and the moving entry gives way to the stored key.
  const stored = one('[data-role="key"][data-key="4135"]');
  expect([stored.getAttribute('data-page'), stored.getAttribute('data-slot')]).toEqual([
    'split',
    '1',
  ]);
  expect(hiddenThroughout(stored, between(0, 8.7))).toBe(true);
  expect(shownThroughout(stored, between(8.8, 20.95))).toBe(true);
  expect(hiddenThroughout(one('[data-role="incoming"]'), between(8.8, 20.95))).toBe(true);
  expect(keysOn('split', 9.25)).toEqual([4102, 4135]);
});

test('the sibling links are rewired around the new page once its keys have landed', () => {
  const link = (from: Leaf, to: Leaf): Element =>
    one(`[data-role="link"][data-from="${from}"][data-to="${to}"]`);
  expect(all('[data-role="link"]')).toHaveLength(4);
  expect(shownThroughout(link('first', 'split'), between(0, 20.95))).toBe(true);
  expect(shownThroughout(link('split', 'last'), between(0, 9.45))).toBe(true);
  expect(hiddenThroughout(link('split', 'last'), between(9.55, 20.95))).toBe(true);
  for (const rewired of [link('split', 'new'), link('new', 'last')]) {
    expect(hiddenThroughout(rewired, between(0, 9.45))).toBe(true);
    expect(shownThroughout(rewired, between(9.55, 20.95))).toBe(true);
  }
  const landed = one('[data-role="key"][data-page="new"][data-key="4171"]');
  expect(onset(link('split', 'new'))).toBeGreaterThan(onset(landed));
});

test("the left page's new high key is the first key on the new page", () => {
  expect(highKeyOf('split', 11.25)).toBeNull();
  expect(highKeyOf('split', 12.75)).toBe(4150);
  expect(highKeyOf('split', 12.75)).toBe(keysOn('new', 12.75)[0]);
  // It bounds the left page's keys from above and the new page's keys from below.
  expect(Math.max(...keysOn('split', 12.75))).toBeLessThan(4150);
  expect(Math.min(...keysOn('new', 12.75))).toBeGreaterThanOrEqual(4150);
  const highKey = one('[data-role="high-key"][data-page="split"][data-key="4150"]');
  expect(hiddenThroughout(highKey, between(0, 12.45))).toBe(true);
  expect(shownThroughout(highKey, between(12.55, 20.95))).toBe(true);
});

test('the parent gets a downlink to the new page under that separator', () => {
  expect(rootAt(14.95)).toEqual([
    ['-∞', 'first'],
    ['4102', 'split'],
    ['4190', 'last'],
  ]);
  expect(rootAt(17.75)).toEqual([
    ['-∞', 'first'],
    ['4102', 'split'],
    ['4150', 'new'],
    ['4190', 'last'],
  ]);
  const separator = one('[data-role="entry"][data-key="4150"]');
  expect(hiddenThroughout(separator, between(0, 17.45))).toBe(true);
  expect(shownThroughout(separator, between(17.55, 20.95))).toBe(true);
  // The separator is copied up from the left page's high key, so it shows after that key does.
  const highKey = one('[data-role="high-key"][data-page="split"][data-key="4150"]');
  expect(onset(separator)).toBeGreaterThan(onset(highKey));
  // The root still has a free slot, so the split stops here.
  expect(all('[data-role="slot"][data-page="root"]').length).toBeGreaterThan(rootAt(AFTER).length);
});

test('every leaf stays one level below the root', () => {
  const root = pageBox('root');
  for (const leaf of LEAVES) {
    expect(pageBox(leaf).top).toBe(pageBox('first').top);
    expect(pageBox(leaf).top).toBeGreaterThan(root.bottom);
  }
  expect(rootAt(AFTER).map(([, leaf]) => leaf)).toEqual([...LEAVES]);
});

test('before and after the split, each high key matches the next separator and bounds its keys', () => {
  for (const moment of [BEFORE, AFTER]) {
    const root = rootAt(moment);
    root.forEach(([separator, leaf], i) => {
      const next = root[i + 1];
      // The last leaf has no high key: nothing lies to its right.
      expect(highKeyOf(leaf, moment)).toBe(next ? Number(next[0]) : null);
      for (const key of keysOn(leaf, moment)) {
        if (separator !== '-∞') expect(key).toBeGreaterThanOrEqual(Number(separator));
        if (next) expect(key).toBeLessThan(Number(next[0]));
      }
    });
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
