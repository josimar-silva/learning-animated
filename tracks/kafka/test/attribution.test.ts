import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import track from '../src/track.ts';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const attribution = read('../ATTRIBUTION.md');
const book = track.source!;

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`no "## ${heading}" section`);
  const end = markdown.indexOf('\n## ', start + 1);
  return markdown.slice(start, end === -1 ? undefined : end);
}

test('ATTRIBUTION.md credits the book and states the companion is unofficial', () => {
  expect(attribution).toContain(book.title);
  for (const author of book.authors) expect(attribution).toContain(author);
  expect(attribution).toContain(book.publisher);
  expect(attribution).toContain(String(book.year));
  expect(attribution).toContain(book.url);
  expect(attribution).toMatch(/unofficial/i);
  expect(attribution).toMatch(/not affiliated/i);
  expect(attribution).toMatch(/trademark/i);
});

test('the code is under the PolyForm Noncommercial License, with its required notice', () => {
  const license = read('../../../LICENSE');
  expect(license).toContain('PolyForm Noncommercial License 1.0.0');
  expect(license).toMatch(/^Required Notice: /m);
});

test('the lessons are under CC BY-NC 4.0', () => {
  expect(read('../../../LICENSE-CC-BY-NC')).toContain(
    'Attribution-NonCommercial 4.0 International',
  );
});

test('ATTRIBUTION.md links both licenses', () => {
  expect(attribution).toContain('](../../LICENSE-CC-BY-NC)');
  expect(attribution).toContain('](../../LICENSE)');
});

test("the root README's License section points at the attribution notice", () => {
  expect(section(read('../../../README.md'), '📄 License')).toContain(
    '](tracks/kafka/ATTRIBUTION.md)',
  );
});
