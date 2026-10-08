import { expect, test } from 'vitest';

import {
  absoluteUrl,
  embedPath,
  legacySvgPath,
  pathForAnimation,
  pathForSection,
} from './routes.ts';

test('page paths', () => {
  expect(pathForSection({ id: 'threading' })).toBe('/threading/');
  expect(pathForAnimation({ id: 'io-vs-worker-threads', section: 'threading' })).toBe(
    '/threading/io-vs-worker-threads/',
  );
});
test('embed paths ignore the section', () => {
  expect(embedPath('split-regex')).toBe('/embed/split-regex.svg');
  expect(embedPath('split-regex', 'before')).toBe('/embed/split-regex.before.svg');
});
test("Kafka's legacy SVG path", () =>
  expect(legacySvgPath({ id: 'acks', section: 'ch03-kafka-producers' })).toBe(
    '/src/animations/ch03-kafka-producers/acks/acks.svg',
  ));
test('absolute URLs', () =>
  expect(absoluteUrl('https://java.learning-animated.com/', '/strings/')).toBe(
    'https://java.learning-animated.com/strings/',
  ));
