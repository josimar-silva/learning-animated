import { readdirSync, readFileSync, statSync } from 'node:fs';

import { parseHTML } from 'linkedom';
import { expect, test } from 'vitest';

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string): Buffer => readFileSync(new URL(rel, ROOT));
const isFile = (rel: string): boolean =>
  statSync(new URL(rel, ROOT), { throwIfNoEntry: false })?.isFile() ?? false;
const sites = (): string[] =>
  ['home', ...readdirSync(new URL('tracks/', ROOT)).map((id) => `tracks/${id}`)]
    .filter((dir) => isFile(`${dir}/astro.config.ts`))
    .sort();

// Kafka Animated keeps the partition icon it had as a standalone site.
const OWN_FAVICONS = ['tracks/kafka'];

test('every site uses the family logo as its favicon, except the ones named here', () => {
  const logo = read('packages/design/logo.svg');
  const own = sites().filter((dir) => !read(`${dir}/public/favicon.svg`).equals(logo));
  expect(own).toEqual(OWN_FAVICONS);
});

test("the README's top image points at a file that exists", () => {
  const { document } = parseHTML(read('README.md').toString());
  const src = document.querySelector('img')?.getAttribute('src') ?? '';
  expect(isFile(src), `README image "${src}"`).toBe(true);
});
