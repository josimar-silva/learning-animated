import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';
import { parse } from 'yaml';

const DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));

export const WORKFLOWS = [
  'ci.yaml',
  'codeql.yaml',
  'security-scorecard.yaml',
  'deploy.yaml',
  'docker.yaml',
];

type Step = { uses?: string };
type Workflow = { permissions?: unknown; jobs: Record<string, { steps?: Step[] }> };

function workflows(): Array<[string, string]> {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => [f, readFileSync(DIR + f, 'utf8')]);
}

test('the house-style workflows exist', () => {
  expect(workflows().map(([f]) => f)).toEqual(expect.arrayContaining(WORKFLOWS));
});

test('every action is pinned to a full commit SHA with a version comment', () => {
  const loose = workflows().flatMap(([f, text]) =>
    [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/gm)]
      .filter(([, ref, rest]) => !/@[0-9a-f]{40}$/.test(ref!) || !/#\s*v?\d/.test(rest!))
      .map(([line]) => `${f}: ${line.trim()}`),
  );
  expect(loose).toEqual([]);
});

test('every job hardens the runner before anything else', () => {
  const unhardened = workflows().flatMap(([f, text]) =>
    Object.entries((parse(text) as Workflow).jobs)
      .filter(([, job]) => !job.steps?.[0]?.uses?.startsWith('step-security/harden-runner@'))
      .map(([name]) => `${f}#${name}`),
  );
  expect(unhardened).toEqual([]);
});

test('every workflow declares permissions at the top level', () => {
  const missing = workflows()
    .filter(([, text]) => (parse(text) as Workflow).permissions === undefined)
    .map(([f]) => f);
  expect(missing).toEqual([]);
});
