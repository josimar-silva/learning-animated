import { readFileSync, statSync } from 'node:fs';

import { parseHTML } from 'linkedom';
import { expect, test } from 'vitest';

const ROOT = new URL('../../', import.meta.url);
const isFile = (rel: string): boolean =>
  statSync(new URL(rel, ROOT), { throwIfNoEntry: false })?.isFile() ?? false;

test("the README's top image points at a file that exists", () => {
  const { document } = parseHTML(readFileSync(new URL('README.md', ROOT), 'utf8'));
  const src = document.querySelector('img')?.getAttribute('src') ?? '';
  expect(isFile(src), `README image "${src}"`).toBe(true);
});
