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

import { render } from './dead-letter-paths.gen.ts';

const LOOP = 25;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./dead-letter-paths.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string, scope: Element = svg): Element => {
  const found = scope.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// The moment each failed record lands on the dead-letter topic.
const LANDS = { declined: 4.5, unreadable: 10.5, unavailable: 22.5 } as const;
type Path = keyof typeof LANDS;
const PATHS = Object.keys(LANDS) as Path[];

const dlq = one('[data-role="dlq"]');
const deadLetter = (path: Path): Element =>
  one(`[data-role="dead-letter"][data-path="${path}"]`, dlq);
const header = (path: Path, name: string): string | undefined =>
  one(
    `[data-role="header"][data-header="${name}"] [data-role="value"]`,
    deadLetter(path),
  ).textContent?.trim();
const record = (path: Path): Element => one(`[data-role="record"][data-path="${path}"]`);
const position = (offset: number): Element =>
  one(`[data-role="position"][data-offset="${offset}"]`);
const status = (offset: number, word: string): Element =>
  one(`[data-role="status"][data-offset="${offset}"][data-status="${word}"]`);

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 25 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('25s');
});

test('all three failed records end on ticket-orders-dlq', () => {
  expect(dlq.getAttribute('data-topic')).toBe('ticket-orders-dlq');
  for (const path of PATHS) {
    const landed = LANDS[path];
    expect(deadLetter(path).getAttribute('data-from')).toBe(
      record(path).getAttribute('data-offset'),
    );
    expect(hiddenThroughout(deadLetter(path), between(0, landed - 0.1))).toBe(true);
    expect(shownThroughout(deadLetter(path), between(landed + 0.1, LOOP - 0.1))).toBe(true);
    expect(shownThroughout(record(path), between(landed - 0.6, landed - 0.1))).toBe(true);
    expect(hiddenThroughout(record(path), between(landed + 0.1, LOOP - 0.1))).toBe(true);
  }
});

test('a 400 and an unreadable record skip the retry topics, and a 503 walks all three', () => {
  const topics = [...svg.querySelectorAll('[data-role="retry-topic"]')].map((topic) =>
    topic.getAttribute('data-topic')!,
  );
  expect(topics).toEqual([
    'ticket-orders_retry_10000',
    'ticket-orders_retry_20000',
    'ticket-orders_retry_50000',
  ]);
  for (const topic of svg.querySelectorAll('[data-role="retry-topic"]')) {
    expect(topic.closest('[data-role="lane"]')?.getAttribute('data-path')).toBe('unavailable');
  }
  expect(header('declined', 'delayed-retry-count')).toBe('0');
  expect(header('unreadable', 'delayed-retry-count')).toBe('0');
  expect(header('unavailable', 'delayed-retry-count')).toBe('3');
  const failed = topics.map((topic) =>
    onsetOf(one(`[data-role="retry-failed"][data-topic="${topic}"]`)),
  );
  expect(failed).not.toContain(null);
  expect(failed).toEqual([...failed].sort((a, b) => a! - b!));
  expect(failed[0]!).toBeGreaterThan(onsetOf(record('unavailable'))!);
  expect(onsetOf(deadLetter('unavailable'))!).toBeGreaterThan(failed[2]!);
  expect(shownThroughout(record('unavailable'), between(14.5, LANDS.unavailable - 0.1))).toBe(true);
});

test('every dead letter says why it failed in delayed-retry-reason', () => {
  expect(header('declined', 'delayed-retry-reason')).toContain('400');
  expect(header('unreadable', 'delayed-retry-reason')).toContain('JSON');
  expect(header('unavailable', 'delayed-retry-reason')).toContain('503');
  expect(one('[data-role="payload"]', deadLetter('unreadable')).textContent).toContain(
    'original bytes',
  );
});

test('the partition keeps moving past every failed offset', () => {
  expect(shownThroughout(position(41), between(0, LANDS.declined - 0.1))).toBe(true);
  expect(shownThroughout(position(42), between(LANDS.declined + 0.1, LANDS.unreadable - 0.1))).toBe(
    true,
  );
  expect(onsetOf(position(43))).toBeCloseTo(at(LANDS.unreadable), 4);
  const parked = onsetOf(status(43, 'retry'))!;
  expect(shownThroughout(status(43, 'retry'), [parked, at(LANDS.unavailable - 0.1)])).toBe(true);
  for (const offset of [44, 45]) {
    const paid = onsetOf(status(offset, 'paid'));
    expect(paid).not.toBeNull();
    expect(paid!).toBeGreaterThan(parked);
    expect(paid!).toBeLessThan(at(LANDS.unavailable));
  }
  const pastAll = between(17, LOOP - 0.1);
  expect(shownThroughout(position(46), pastAll)).toBe(true);
  for (const offset of [41, 42, 43, 44, 45]) {
    expect(hiddenThroughout(position(offset), pastAll)).toBe(true);
  }
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
