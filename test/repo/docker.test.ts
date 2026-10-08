import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

const dockerfile = readFileSync(new URL('../../Dockerfile', import.meta.url), 'utf8');

test('every base image is pinned by digest', () => {
  const images = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((m) => m[1]!);
  expect(images.length).toBeGreaterThan(1);
  expect(images.filter((image) => !/@sha256:[0-9a-f]{64}$/.test(image))).toEqual([]);
});
test('one Dockerfile builds any site, with its generated nginx config', () => {
  expect(dockerfile).toMatch(/^ARG SITE$/m);
  expect(dockerfile).toContain('nginx.generated.conf');
  expect(dockerfile).toMatch(/^EXPOSE 3000$/m);
});
