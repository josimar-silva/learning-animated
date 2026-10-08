import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'vitest';

import { contentDirOf, frontmatterOf, loadEntries, loadSections } from './disk.ts';

function fixture(): URL {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  writeFileSync(
    join(dir, 'sections.json'),
    JSON.stringify([
      { id: 'b', number: 2, title: 'B', description: 'b' },
      { id: 'a', number: 1, title: 'A', description: 'a' },
    ]),
  );
  mkdirSync(join(dir, 'animations/a/one'), { recursive: true });
  writeFileSync(
    join(dir, 'animations/a/one/index.md'),
    '---\nid: one\nsection: a\norder: 1\ntitle: One\ndescription: D\nobjective: O\n---\nBody\n',
  );
  writeFileSync(join(dir, 'animations/a/one/one.svg'), '<svg/>');
  return pathToFileURL(`${dir}/`);
}

test('contentDirOf points at src/content/', () =>
  expect(contentDirOf('/repo/tracks/java').href).toBe('file:///repo/tracks/java/src/content/'));
test('loadSections validates and sorts by number', () =>
  expect(loadSections(fixture()).map((s) => s.id)).toEqual(['a', 'b']));
test('loadEntries reads frontmatter, folder, and SVGs', () => {
  const [one] = loadEntries(fixture());
  expect(one?.animation.id).toBe('one');
  expect(one?.folder).toBe('a/one');
  expect([...(one?.svgs.keys() ?? [])]).toEqual(['one.svg']);
});
test('no animations folder means no entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'empty-'));
  expect(loadEntries(pathToFileURL(`${dir}/`))).toEqual([]);
});
test('frontmatter is required', () =>
  expect(() => frontmatterOf('# no frontmatter')).toThrow(/frontmatter/));
test('a bad frontmatter names its file', () => {
  const dir = fixture();
  writeFileSync(new URL('animations/a/one/index.md', dir), '---\nid: one\n---\n');
  expect(() => loadEntries(dir)).toThrow(/a\/one\/index\.md/);
});
