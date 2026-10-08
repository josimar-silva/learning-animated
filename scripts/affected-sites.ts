#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

import { affectedSites, SITES } from './lib/affected.ts';

const [base, head = 'HEAD'] = process.argv.slice(2);
// A brand-new branch has no usable base (GitHub sends zeros), so build everything.
const changed =
  !base || /^0+$/.test(base)
    ? null
    : execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
console.log(JSON.stringify(changed === null ? SITES : affectedSites(changed)));
