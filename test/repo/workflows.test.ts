import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));
const TRACKS = fileURLToPath(new URL('../../tracks/', import.meta.url));

export const WORKFLOWS = [
  'ci.yaml',
  'codeql.yaml',
  'security-scorecard.yaml',
  'deploy.yaml',
  'docker.yaml',
  'cd.yaml',
];

type Step = {
  id?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};
type Job = {
  needs?: string | string[];
  if?: string;
  container?: unknown;
  env?: Record<string, unknown>;
  outputs?: Record<string, string>;
  permissions?: Record<string, string>;
  strategy?: { matrix?: { include?: unknown } };
  steps?: Step[];
};
type Workflow = {
  on?: unknown;
  permissions?: unknown;
  concurrency?: unknown;
  env?: Record<string, unknown>;
  jobs: Record<string, Job>;
};

function workflows(): Array<[string, string]> {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => [f, readFileSync(DIR + f, 'utf8')]);
}

// Every job of every workflow, named `<file>#<job>`.
function jobs(): Array<{ id: string; workflow: Workflow; job: Job }> {
  return workflows().flatMap(([file, text]) => {
    const workflow = parse(text) as Workflow;
    return Object.entries(workflow.jobs).map(([name, job]) => ({
      id: `${file}#${name}`,
      workflow,
      job,
    }));
  });
}

const workflow = (file: string): Workflow => parse(readFileSync(DIR + file, 'utf8')) as Workflow;
const DEPLOY = workflow('deploy.yaml');
const CD = workflow('cd.yaml');

const ENDPOINT = /^(\*\.)?[a-z0-9.-]+:[0-9]+$/;

// The inputs of a job's Harden-Runner step.
function hardening(job: Job): Record<string, string> {
  return job.steps?.find((s) => s.uses?.startsWith('step-security/harden-runner@'))?.with ?? {};
}

// The endpoints a job's Harden-Runner step lets through when it blocks egress.
const endpoints = (job: Job): string[] =>
  (hardening(job)['allowed-endpoints'] ?? '').split(/\s+/).filter(Boolean);

// Whether an allow-list entry, `host:port` with an optional leading `*.`, lets `host` through.
function allows(endpoint: string, host: string): boolean {
  const allowed = endpoint.slice(0, endpoint.lastIndexOf(':'));
  return allowed.startsWith('*.') ? host.endsWith(allowed.slice(1)) : host === allowed;
}

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'workflow-step-'));
  scratch.push(dir);
  return dir;
}

// Runs a step's script the way a runner does, with `bash -e`. The directory leads PATH,
// so an executable placed there stands in for a real command.
function run(step: Step | undefined, dir: string, env: Record<string, string> = {}): string {
  const output = join(dir, 'github-output');
  writeFileSync(output, '');
  return execFileSync('bash', ['-e', '-c', step?.run ?? ''], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env, GITHUB_OUTPUT: output, PATH: `${dir}:${process.env.PATH}` },
  });
}

// The check that decides whether to deploy, run on a checkout whose package.json holds `version`.
function versionCheck(version: string): { release: string | undefined; log: string } {
  const dir = scratchDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version }));
  const check = DEPLOY.jobs.version?.steps?.find((s) => s.id === 'check');
  const log = run(check, dir);
  const output = readFileSync(join(dir, 'github-output'), 'utf8');
  return { release: /^release=(.*)$/m.exec(output)?.[1], log };
}

// Runs a step with a stand-in gh that records its arguments instead of calling GitHub.
function ghCalls(step: Step | undefined, env: Record<string, string>): string[] {
  const dir = scratchDir();
  const calls = join(dir, 'gh-calls');
  writeFileSync(calls, '');
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\necho "$*" >> "$GH_CALLS"\n', { mode: 0o755 });
  run(step, dir, { ...env, GH_CALLS: calls });
  return readFileSync(calls, 'utf8').split('\n').filter(Boolean);
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
  const unhardened = jobs()
    .filter(({ job }) => !job.steps?.[0]?.uses?.startsWith('step-security/harden-runner@'))
    .map(({ id }) => id);
  expect(unhardened).toEqual([]);
});

test('every job blocks egress, except container jobs, which Harden-Runner can only audit', () => {
  const policies = jobs().map(({ id, job }) => [id, hardening(job)['egress-policy']]);
  const expected = jobs().map(({ id, job }) => [id, job.container ? 'audit' : 'block']);
  expect(policies).toEqual(expected);
});

test('every job on the VM allows a non-empty, sorted list of host:port endpoints', () => {
  for (const { id, job } of jobs().filter(({ job }) => !job.container)) {
    const allowed = endpoints(job);
    expect(allowed, id).not.toEqual([]);
    expect(
      allowed.filter((endpoint) => !ENDPOINT.test(endpoint)),
      id,
    ).toEqual([]);
    expect(allowed, id).toEqual(allowed.toSorted());
  }
});

test('no job lets Astro telemetry out', () => {
  const leaking = jobs().filter(({ job }) =>
    endpoints(job).some((endpoint) => allows(endpoint, 'telemetry.astro.build')),
  );
  expect(leaking.map(({ id }) => id)).toEqual([]);
});

// Astro comes with the workspace, so any job that installs it can run Astro.
test('every job that installs the workspace turns off Astro telemetry', () => {
  const installing = jobs().filter(({ job }) =>
    job.steps?.some((step) => /\bjust ci\b/.test(step.run ?? '')),
  );
  expect(installing).not.toEqual([]);
  const reporting = installing.filter(({ workflow, job }) =>
    (job.steps ?? []).some(
      (step) =>
        String({ ...workflow.env, ...job.env, ...step.env }.ASTRO_TELEMETRY_DISABLED) !== '1',
    ),
  );
  expect(reporting.map(({ id }) => id)).toEqual([]);
});

test('every workflow declares permissions at the top level', () => {
  const missing = workflows()
    .filter(([, text]) => (parse(text) as Workflow).permissions === undefined)
    .map(([f]) => f);
  expect(missing).toEqual([]);
});

describe('Deploy', () => {
  test('runs only on release tags and by hand', () =>
    expect(DEPLOY.on).toEqual({ push: { tags: ['v*'] }, workflow_dispatch: null }));

  test('waits for the version check', () => {
    expect(DEPLOY.jobs.deploy).toMatchObject({
      needs: 'version',
      if: "needs.version.outputs.release == 'true'",
    });
    expect(DEPLOY.jobs.version?.outputs).toEqual({ release: '${{ steps.check.outputs.release }}' });
  });

  test('deploys a release version', () => expect(versionCheck('1.2.3').release).toBe('true'));

  test('skips a SNAPSHOT version and says why', () => {
    const { release, log } = versionCheck('1.2.4-SNAPSHOT');
    expect(release).toBe('false');
    expect(log).toMatch(/^::notice::.*1\.2\.4-SNAPSHOT/m);
  });

  test('ships every site to its own Pages project', () => {
    const tracks = readdirSync(TRACKS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const sites = [
      { site: 'home', dir: 'home', project: 'learning-animated-home' },
      ...tracks.map((track) => ({
        site: track,
        dir: `tracks/${track}`,
        project: `learning-animated-${track}`,
      })),
    ];
    const include = DEPLOY.jobs.deploy?.strategy?.matrix?.include;
    expect(include).toEqual(expect.arrayContaining(sites));
    expect(include).toHaveLength(sites.length);
  });

  test('publishes to production, whatever ref it runs on', () => {
    const pages = DEPLOY.jobs.deploy?.steps?.find((s) =>
      s.uses?.startsWith('cloudflare/wrangler-action@'),
    );
    const branches = pages?.with?.command?.split(/\s+/).filter((arg) => arg.startsWith('--branch'));
    expect(branches).toEqual(['--branch=main']);
  });

  test('runs one deploy at a time and never cancels one halfway', () =>
    expect(DEPLOY.concurrency).toEqual({ group: 'deploy', 'cancel-in-progress': false }));

  test('sends Wrangler no metrics, which the allow-list would block', () =>
    expect(DEPLOY.jobs.deploy?.env?.WRANGLER_SEND_METRICS).toBe(false));
});

describe('CD', () => {
  const steps = CD.jobs.release?.steps ?? [];
  const indexOf = (command: string) => steps.findIndex((s) => s.run?.includes(command));

  test('dispatches Deploy on the release tag right after pushing it', () => {
    const dispatch = steps[indexOf('git push origin "v') + 1];
    expect(dispatch?.env).toEqual({ GH_TOKEN: '${{ github.token }}' });
    expect(ghCalls(dispatch, { RELEASE_VERSION: '1.2.3' })).toEqual([
      'workflow run deploy.yaml --ref v1.2.3',
    ]);
  });

  test('dispatches Deploy before pushing to main, which the ruleset may reject', () => {
    const dispatch = indexOf('gh workflow run deploy.yaml');
    expect(dispatch).toBeGreaterThan(-1);
    expect(dispatch).toBeLessThan(indexOf('git push origin HEAD:main'));
  });

  test('may dispatch workflows', () =>
    expect(CD.jobs.release?.permissions).toMatchObject({ actions: 'write' }));
});
