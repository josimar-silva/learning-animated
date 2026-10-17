import { readFileSync } from 'node:fs';

import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { loadEntries, loadSections } from '@learning-animated/site-kit/disk';
import { validateContent } from '@learning-animated/site-kit/model';
import { assertSvgContract } from '@learning-animated/svg-kit/contract';
import { describe, expect, test } from 'vitest';

import track from '../src/track.ts';

const contentDir = new URL('../src/content/', import.meta.url);
const sections = loadSections(contentDir);
const entries = loadEntries(contentDir);
const svgs = entries.flatMap(({ folder, svgs: files }) =>
  [...files].map(([file, text]) => [`${folder}/${file}`, text] as const),
);

test('the content is valid', () =>
  expect(() => validateContent(track, sections, entries)).not.toThrow());

test('every shipped embed id still exists', () => {
  const shipped = readFileSync(new URL('../embed-ids.txt', import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean);
  const ids = new Set(entries.map((e) => e.animation.id));
  expect(shipped.filter((id) => !ids.has(id))).toEqual([]);
});

if (svgs.length > 0) {
  describe('every SVG satisfies the contract', () => {
    const block = canonicalStyleBlock();
    test.each(svgs)('%s', (_name, text) => assertSvgContract(text, block));
  });
}
