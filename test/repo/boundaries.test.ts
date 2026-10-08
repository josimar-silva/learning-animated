import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WORKSPACES = [
  '.',
  'packages/design',
  'packages/svg-kit',
  'packages/site-kit',
  'tracks/kafka',
  'tracks/quarkus',
  'tracks/java',
  'home',
];
const NESTED = new Set(['packages', 'tracks', 'home']);
const SKIP = new Set(['node_modules', 'dist', '.astro', '.git', 'coverage']);
const IMPORT =
  /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;
const ALWAYS = new Set(['vitest', 'vitest/config']);

function sources(dir: string, atRoot: boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return SKIP.has(entry.name) || (atRoot && NESTED.has(entry.name)) ? [] : sources(path, false);
    return /\.(ts|mjs|astro)$/.test(entry.name) ? [path] : [];
  });
}

const packageName = (spec: string): string =>
  spec
    .split('/')
    .slice(0, spec.startsWith('@') ? 2 : 1)
    .join('/');

function declared(ws: string): Set<string> {
  const pkg = JSON.parse(readFileSync(join(ROOT, ws, 'package.json'), 'utf8')) as {
    name: string;
    dependencies?: object;
    devDependencies?: object;
    peerDependencies?: object;
  };
  return new Set([
    pkg.name,
    ...Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }),
  ]);
}

test('every import stays in its workspace or names a declared dependency', () => {
  const problems: string[] = [];
  for (const ws of WORKSPACES) {
    const home = join(ROOT, ws);
    const allowed = declared(ws);
    for (const file of sources(home, ws === '.')) {
      for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
        const spec = (match[1] ?? match[2] ?? match[3])!;
        const where = relative(ROOT, file);
        if (spec.startsWith('.')) {
          if (relative(home, resolve(dirname(file), spec)).startsWith('..'))
            problems.push(`${where}: ${spec} leaves ${ws}`);
        } else if (!(
          spec.startsWith('node:') ||
          builtinModules.includes(spec) ||
          spec.startsWith('astro:') ||
          ALWAYS.has(spec) ||
          allowed.has(packageName(spec))
        )) {
          problems.push(`${where}: ${spec} is not declared in ${ws}/package.json`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});

test('no track depends on another track', () => {
  const offenders = ['kafka', 'quarkus', 'java'].flatMap((id) =>
    [...declared(`tracks/${id}`)]
      .filter(
        (dep) =>
          dep.startsWith('@learning-animated/track-') && dep !== `@learning-animated/track-${id}`,
      )
      .map((dep) => `${id} -> ${dep}`),
  );
  expect(offenders).toEqual([]);
});
