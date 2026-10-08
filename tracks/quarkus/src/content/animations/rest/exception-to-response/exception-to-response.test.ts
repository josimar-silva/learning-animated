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

import { render } from './exception-to-response.gen.ts';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./exception-to-response.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const exception = (name: string): Element =>
  one(`[data-role="exception"][data-exception="${name}"]`);
const uncaughtOnset = (layer: string, name: string): number | null =>
  onsetOf(one(`[data-role="uncaught"][data-layer="${layer}"][data-exception="${name}"]`));
const response = (status: number): Element =>
  one(`[data-role="response"][data-status="${status}"]`);
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('SeatAlreadyTaken leaves the service, then the endpoint, and neither catches it', () => {
  const thrown = exception('SeatAlreadyTaken');
  expect(hiddenThroughout(thrown, between(0, 3.4))).toBe(true);
  expect(shownThroughout(thrown, between(3.6, 6.4))).toBe(true);
  const service = uncaughtOnset('service', 'SeatAlreadyTaken');
  const endpoint = uncaughtOnset('endpoint', 'SeatAlreadyTaken');
  expect(service).not.toBeNull();
  expect(endpoint).not.toBeNull();
  expect(service!).toBeGreaterThan(at(3.4));
  expect(endpoint!).toBeGreaterThan(service!);
  expect(endpoint!).toBeLessThan(at(6.5));
  expect(one('[data-role="endpoint-code"]').textContent).not.toContain('catch (');
});

test('an @ServerExceptionMapper turns SeatAlreadyTaken into 409 Conflict', () => {
  const mapper = one('[data-role="mapper"]').textContent;
  expect(mapper).toContain('@ServerExceptionMapper');
  expect(mapper).toContain('(SeatAlreadyTaken e)');
  const match = one('[data-role="mapper-match"]');
  expect(hiddenThroughout(match, between(0, 6.4))).toBe(true);
  expect(shownThroughout(match, between(6.6, 9.4))).toBe(true);
  const conflict = response(409);
  expect(conflict.textContent).toContain('409 Conflict');
  expect(hiddenThroughout(conflict, between(0, 6.9))).toBe(true);
  expect(shownThroughout(conflict, between(7.1, 9.4))).toBe(true);
  expect(hiddenThroughout(conflict, between(9.6, 19.9))).toBe(true);
});

test('PersistenceException has no mapper, so it becomes 500', () => {
  expect(one('[data-role="mapper"]').textContent).not.toContain('PersistenceException');
  const thrown = exception('PersistenceException');
  expect(hiddenThroughout(thrown, between(0, 12.9))).toBe(true);
  expect(shownThroughout(thrown, between(13.1, 15.9))).toBe(true);
  const service = uncaughtOnset('service', 'PersistenceException');
  const endpoint = uncaughtOnset('endpoint', 'PersistenceException');
  expect(service).not.toBeNull();
  expect(endpoint!).toBeGreaterThan(service!);
  const none = one('[data-role="no-mapper"]');
  expect(hiddenThroughout(none, between(0, 15.9))).toBe(true);
  expect(shownThroughout(none, between(16.1, 19.9))).toBe(true);
  const error = response(500);
  expect(error.textContent).toContain('500 Internal Server Error');
  expect(hiddenThroughout(error, between(0, 16.4))).toBe(true);
  expect(shownThroughout(error, between(16.6, 19.9))).toBe(true);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
