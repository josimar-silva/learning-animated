import { expect, test } from 'vitest';

import { svgPathFor } from '../../scripts/lib/gen.ts';

test('a generator writes the SVG beside it', () => {
  expect(svgPathFor('tracks/quarkus/src/content/animations/threading/x/x.gen.ts')).toBe(
    'tracks/quarkus/src/content/animations/threading/x/x.svg',
  );
});

test('only generator files are accepted', () => {
  expect(() => svgPathFor('x.test.ts')).toThrow(/not a generator/);
});
