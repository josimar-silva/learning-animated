#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { THEME_BOOT } from '@learning-animated/site-kit/theme-boot';

import { auditPage, existsIn, siteProblems } from './lib/audit.ts';

const problems: string[] = [];
for (const dist of process.argv.slice(2)) {
  if (!existsSync(join(dist, '_headers'))) {
    problems.push(`${dist}: no _headers; was the site built?`);
    continue;
  }
  const site = {
    headers: readFileSync(join(dist, '_headers'), 'utf8'),
    robots: readFileSync(join(dist, 'robots.txt'), 'utf8'),
  };
  problems.push(...siteProblems(site).map((p) => `${dist}: ${p}`));
  const exists = existsIn(dist, existsSync);
  for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const file = join(entry.parentPath, entry.name);
    const page = relative(dist, file).split(sep).join('/');
    problems.push(
      ...auditPage(page, readFileSync(file, 'utf8'), exists, THEME_BOOT).map((p) => `${dist}/${p}`),
    );
  }
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Every built site passed the link and CSP audit.');
