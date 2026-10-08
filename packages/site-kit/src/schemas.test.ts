import { expect, test } from 'vitest';

import { animationSchema, defineTrack, sectionDataSchema } from './schemas.ts';

const SITE = {
  url: 'https://quarkus.learning-animated.com/',
  name: 'Quarkus Animated',
  shortName: 'Quarkus Animated',
  tagline: 'T',
  repoUrl: 'https://github.com/josimar-silva/learning-animated',
};
const ANIMATION = {
  id: 'io-vs-worker-threads',
  section: 'threading',
  order: 1,
  title: 'T',
  description: 'D',
  objective: 'O',
};

test('a curriculum track defaults legacyRedirects off', () => {
  expect(
    defineTrack({ id: 'quarkus', kind: 'curriculum', launched: false, site: SITE }).legacyRedirects,
  ).toBe(false);
});
test('a book track needs a source', () => {
  expect(() => defineTrack({ id: 'kafka', kind: 'book', launched: false, site: SITE })).toThrow(
    /needs a source/,
  );
});
test('site.url ends with a slash', () => {
  expect(() =>
    defineTrack({
      id: 'x',
      kind: 'home',
      launched: false,
      site: { ...SITE, url: 'https://x.dev' },
    }),
  ).toThrow(/end with \//);
});
test('an animation defaults figure to null and references to none', () => {
  const animation = animationSchema.parse(ANIMATION);
  expect(animation.figure).toBeNull();
  expect(animation.references).toEqual([]);
});
test('views come in twos or more', () => {
  expect(() =>
    animationSchema.parse({ ...ANIMATION, views: [{ id: 'before', label: 'Before' }] }),
  ).toThrow();
});
test('section data drops the id that the file loader supplies', () => {
  expect(sectionDataSchema.parse({ id: 'x', number: 1, title: 'T', description: 'D' })).toEqual({
    number: 1,
    title: 'T',
    description: 'D',
  });
});
