import { expect, test } from 'vitest';

import { AUTHOR, FAMILY, listedFamily } from './family.ts';

test('the author links to the blog', () => expect(AUTHOR.url).toBe('https://josimar-silva.com'));
test('only Kafka is listed until Quarkus, Java, and Data launch', () =>
  expect(listedFamily().map((m) => [m.id, m.url])).toEqual([
    ['kafka', 'https://kafka-animated.josimar-silva.com/'],
  ]));
test('Data Animated joins the family unlisted, on its own subdomain', () =>
  expect(FAMILY.find((m) => m.id === 'data')).toEqual({
    id: 'data',
    name: 'Data Animated',
    tagline: 'How databases find, split, and spread data, animated one idea at a time.',
    url: 'https://data.learning-animated.com/',
    listed: false,
  }));
