import { expect, test } from 'vitest';

import { affectedSites } from '../../scripts/lib/affected.ts';

const ids = (files: string[]) => affectedSites(files).map((s) => s.site);

test('shared code rebuilds every site', () =>
  expect(ids(['packages/design/theme.css'])).toEqual(['home', 'kafka', 'quarkus', 'java']));
test('a track change rebuilds that track and the home page, which counts it', () =>
  expect(ids(['tracks/java/src/content/animations/strings/split/index.md'])).toEqual([
    'home',
    'java',
  ]));
test('a home change rebuilds home only', () =>
  expect(ids(['home/src/pages/index.astro'])).toEqual(['home']));
test('docs alone rebuild nothing', () => expect(ids(['README.md', 'docs/adrs/x.md'])).toEqual([]));
test('a site carries its folder and Pages project', () =>
  expect(affectedSites(['tracks/kafka/src/track.ts'])[1]).toEqual({
    site: 'kafka',
    dir: 'tracks/kafka',
    project: 'learning-animated-kafka',
  }));
