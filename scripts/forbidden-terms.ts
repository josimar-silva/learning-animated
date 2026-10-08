#!/usr/bin/env node
// Scans tracked files, and with --commits <range> the author, committer, and message
// of each commit, for terms from FORBIDDEN_TERMS or a git-ignored .forbidden-terms file.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type Finding, findInText, report, termsFrom } from './lib/forbidden.ts';

const BINARY = /\.(woff2?|png|jpe?g|gif|ico|webp)$/i;
const git = (...args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// A worktree has no copy of the git-ignored list, so also look in the main clone that owns it.
const mainClone = dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir').trim());
const listFile = ['.forbidden-terms', join(mainClone, '.forbidden-terms')].find((file) =>
  existsSync(file),
);
const terms = termsFrom(
  process.env.FORBIDDEN_TERMS || (listFile ? readFileSync(listFile, 'utf8') : undefined),
);
if (terms.length === 0) {
  if (process.env.GITHUB_ACTIONS)
    console.log('::warning::FORBIDDEN_TERMS is not set, so the forbidden-terms scan did not run.');
  console.log('No forbidden terms configured; skipping the scan.');
  process.exit(0);
}

const findings: Finding[] = git('ls-files', '-z')
  .split('\0')
  .filter((file) => file && !BINARY.test(file))
  .flatMap((file) => findInText(file, readFileSync(file, 'utf8'), terms));

const flag = process.argv.indexOf('--commits');
if (flag !== -1) {
  const log = git(
    'log',
    '--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e',
    process.argv[flag + 1]!,
  );
  for (const record of log
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)) {
    const [sha, ...fields] = record.split('\x1f');
    findings.push(...findInText(`commit ${sha!.slice(0, 12)}`, fields.join('\n'), terms));
  }
}

if (findings.length > 0) {
  console.error(report(findings));
  process.exit(1);
}
console.log(`No forbidden terms found (${terms.length} checked).`);
