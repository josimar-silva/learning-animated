import { readdirSync, readFileSync, statSync } from 'node:fs';

import { expect, test } from 'vitest';
import { parse } from 'yaml';

import { SITES } from '../../e2e-tests/_shared/sites.ts';

type Job = { container: { image: string }; strategy: { matrix: { project: string[] } } };

const read = (rel: string): string =>
  readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json')) as { devDependencies: Record<string, string> };
const job = (): Job =>
  (parse(read('.github/workflows/ci.yaml')) as { jobs: Record<string, Job> }).jobs['test-e2e']!;
const isFile = (rel: string): boolean =>
  statSync(new URL(`../../${rel}`, import.meta.url), { throwIfNoEntry: false })?.isFile() ?? false;
// The folders `just build-all` builds: home, and each track with an Astro config.
const siteDirs = (): string[] =>
  ['home', ...readdirSync(new URL('../../tracks/', import.meta.url)).map((id) => `tracks/${id}`)]
    .filter((dir) => isFile(`${dir}/astro.config.ts`))
    .sort();

test('the CI container runs the Playwright version the package pins', () => {
  const { image } = job().container;
  expect(image).toMatch(/^mcr\.microsoft\.com\/playwright:v[\d.]+-noble@sha256:[0-9a-f]{64}$/);
  expect(image).toContain(`:v${pkg.devDependencies['@playwright/test']}-noble@`);
});

test('CI runs every Playwright project', () => {
  const projects = [...read('playwright.config.ts').matchAll(/name: '([a-z-]+)'/g)].map(
    (m) => m[1],
  );
  expect(job().strategy.matrix.project).toEqual(projects);
});

test('the suite previews every site', () =>
  expect(SITES.map((site) => site.dir).sort()).toEqual(siteDirs()));

test('every site previews on a port of its own', () =>
  expect(new Set(SITES.map((site) => site.port)).size).toBe(SITES.length));
