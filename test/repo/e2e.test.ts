import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';
import { parse } from 'yaml';

type Job = { container: { image: string }; strategy: { matrix: { project: string[] } } };

const read = (rel: string): string =>
  readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json')) as { devDependencies: Record<string, string> };
const job = (): Job =>
  (parse(read('.github/workflows/ci.yaml')) as { jobs: Record<string, Job> }).jobs['test-e2e']!;

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
