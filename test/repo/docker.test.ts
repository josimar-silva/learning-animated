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
test('the build stage turns off Astro telemetry before it builds the site', () => {
  const lines = dockerfile.split('\n');
  const stage = lines.findIndex((line) => /^FROM \S+ AS builder$/.test(line));
  const off = lines.indexOf('ENV ASTRO_TELEMETRY_DISABLED=1');
  const build = lines.findIndex((line) => line.includes('npm run build'));
  expect(stage).toBeGreaterThan(-1);
  expect(off).toBeGreaterThan(stage);
  expect(off).toBeLessThan(build);
});
