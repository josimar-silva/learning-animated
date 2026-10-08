import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string): string => readFileSync(ROOT + rel, 'utf8');

// Committed and new-but-not-ignored files, so a test run before `git add` still sees them.
function files(): string[] {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
}

function recipes(justfile: string): Set<string> {
  return new Set(
    [...justfile.matchAll(/^([a-z][a-z0-9-]*)(?:\s+[^:=\n]*)?:(?!=)/gm)].map((m) => m[1]!),
  );
}

export const REQUIRED_RECIPES = [
  'default',
  'install',
  'ci',
  'test',
  'lint',
  'format',
  'check',
  'clean',
  'pre-commit',
  'style',
  'style-check',
  'dev',
  'build',
  'preview',
  'build-all',
  'forbidden-terms',
  'check-dist',
  'build-image',
  'start-container',
  'pre-release',
];

export const META_FILES = [
  'LICENSE',
  'LICENSE-CC-BY-NC',
  'README.md',
  'AGENTS.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  '.editorconfig',
  '.prettierrc',
  '.nvmrc',
];

const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const TEXT =
  /\.(md|ts|mjs|js|json|astro|css|svg|ya?ml|toml|txt|html)$|(^|\/)(justfile|Dockerfile|LICENSE)$/;

describe('repository conventions', () => {
  test('the justfile defines the standard recipes', () => {
    const defined = recipes(read('justfile'));
    expect(REQUIRED_RECIPES.filter((r) => !defined.has(r))).toEqual([]);
  });

  test('every dependency is pinned to an exact version', () => {
    const loose: string[] = [];
    for (const file of files().filter((f) => /(^|\/)package\.json$/.test(f))) {
      const pkg = JSON.parse(read(file)) as Record<string, Record<string, string> | undefined>;
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
        for (const [name, version] of Object.entries(pkg[field] ?? {})) {
          const internal = name.startsWith('@learning-animated/') && version === '*';
          if (!internal && !EXACT.test(version)) loose.push(`${file}: ${name}@${version}`);
        }
      }
    }
    expect(loose).toEqual([]);
  });

  test('the Node types follow the Node major in .nvmrc', () => {
    const pkg = JSON.parse(read('package.json')) as { devDependencies: Record<string, string> };
    const major = pkg.devDependencies['@types/node']?.split('.')[0];
    expect(major).toBe(read('.nvmrc').trim());
  });

  test('no text file contains an em dash or an en dash', () => {
    const offenders = files()
      .filter((f) => TEXT.test(f) && f !== 'package-lock.json')
      .filter((f) => /[\u2013\u2014]/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  test('the shared meta and config files exist', () => {
    const present = new Set(files());
    expect(META_FILES.filter((f) => !present.has(f))).toEqual([]);
  });
});
