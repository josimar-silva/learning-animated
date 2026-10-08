import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { END, START } from './style-block.ts';
import { embedBlock, syncFiles } from './sync.ts';

const BLOCK = `${START}\n.x { fill: none; }\n${END}`;
const svg = (inner: string) => `<svg><style>${inner}</style></svg>`;

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'la-style-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

test('embedBlock replaces only the marker span', () => {
  expect(embedBlock(svg(`${START}\nold\n${END}`), BLOCK)).toBe(svg(BLOCK));
});

test('check mode reports drift without writing', () => {
  const dir = fixture({ 'a.svg': svg(BLOCK), 'b.svg': svg(`${START}\nold\n${END}`) });
  const files = ['a.svg', 'b.svg'].map((f) => join(dir, f));
  expect(syncFiles(files, BLOCK, { check: true })).toEqual([join(dir, 'b.svg')]);
  expect(readFileSync(join(dir, 'b.svg'), 'utf8')).toContain('old');
});

test('sync mode rewrites drifted files', () => {
  const dir = fixture({ 'b.svg': svg(`${START}\nold\n${END}`) });
  syncFiles([join(dir, 'b.svg')], BLOCK);
  expect(readFileSync(join(dir, 'b.svg'), 'utf8')).toBe(svg(BLOCK));
});

test('names the file that lacks markers', () => {
  const dir = fixture({ 'c.svg': svg('') });
  expect(() => syncFiles([join(dir, 'c.svg')], BLOCK)).toThrow(
    /c\.svg is missing the LA-STYLE markers/,
  );
});
