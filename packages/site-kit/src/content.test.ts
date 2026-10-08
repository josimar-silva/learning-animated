import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import {
  animationPaths,
  type GetCollection,
  homeProps,
  readContent,
  sectionPaths,
} from './content.ts';
import { defineTrack } from './schemas.ts';

const SITE = {
  url: 'https://kafka.learning-animated.com/',
  name: 'K',
  shortName: 'K',
  tagline: 'T',
  repoUrl: 'https://github.com/josimar-silva/learning-animated',
};
const BOOK = defineTrack({
  id: 'kafka',
  kind: 'book',
  launched: false,
  legacyRedirects: true,
  site: SITE,
  source: {
    title: 'B',
    edition: '2nd Edition',
    authors: ['A'],
    publisher: 'P',
    year: 2021,
    url: 'https://example.com/',
  },
});
const sections = [
  { id: 'ch02', data: { number: 2, title: 'Two', description: 'd' } },
  { id: 'ch01', data: { number: 1, title: 'One', description: 'd' } },
];
const animation = (id: string, order: number) => ({
  id: `ch01/${id}`,
  data: { id, section: 'ch01', order, title: id, description: 'd', objective: 'o', figure: '1-1' },
});
const getCollection: GetCollection = async (name) =>
  name === 'sections' ? sections : [animation('b', 2), animation('a', 1)];

function siteRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'site-'));
  for (const id of ['a', 'b']) {
    mkdirSync(join(root, 'src/content/animations/ch01', id), { recursive: true });
    writeFileSync(
      join(root, 'src/content/animations/ch01', id, 'index.md'),
      `---\nid: ${id}\nsection: ch01\norder: 1\ntitle: ${id}\ndescription: d\nobjective: o\n---\n`,
    );
    writeFileSync(
      join(root, 'src/content/animations/ch01', id, `${id}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 400" data-loop="12s"></svg>`,
    );
  }
  return root;
}

test('readContent validates, sorts sections, and keeps the raw entries', async () => {
  const content = await readContent(getCollection);
  expect(content.sections.map((s) => s.id)).toEqual(['ch01', 'ch02']);
  expect(content.entries.get('a')?.id).toBe('ch01/a');
});
test('only populated sections get a page', async () => {
  const paths = await sectionPaths(BOOK, getCollection);
  expect(paths.map((p) => p.params)).toEqual([{ section: 'ch01' }]);
  expect(paths[0]?.props.animations.map((a) => a.id)).toEqual(['a', 'b']);
});
test('animation paths carry views sized from the SVG, the loop, and neighbors', async () => {
  const [first, second] = await animationPaths(BOOK, getCollection, siteRoot());
  expect(first?.params).toEqual({ section: 'ch01', id: 'a' });
  expect(first?.props.views).toEqual([
    { id: null, label: null, src: '/embed/a.svg', width: 900, height: 400 },
  ]);
  expect(first?.props.loop).toBe(12);
  expect(first?.props.next?.id).toBe('b');
  expect(second?.props.prev?.id).toBe('a');
});
test('a legacy track gets the old-link map on its home page', async () =>
  expect((await homeProps(BOOK, getCollection)).legacyMap).toEqual({
    a: '/ch01/a/',
    b: '/ch01/b/',
  }));
