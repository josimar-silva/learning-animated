import { expect, test } from 'vitest';

import { AUTHOR, listedFamily } from './family.ts';

test('the author links to the blog', () => expect(AUTHOR.url).toBe('https://josimar-silva.com'));
test('only Kafka is listed until Quarkus and Java launch', () =>
  expect(listedFamily().map((m) => [m.id, m.url])).toEqual([
    ['kafka', 'https://kafka-animated.josimar-silva.com/'],
  ]));
