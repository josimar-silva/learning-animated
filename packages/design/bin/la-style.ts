#!/usr/bin/env node
// Re-embeds the canonical LA-STYLE block into every SVG under the given roots.
// With --check it writes nothing and exits 1 when any block has drifted.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalStyleBlock } from '../src/canonical.ts';
import { syncFiles } from '../src/sync.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
const files = args
  .filter((a) => a !== '--check' && existsSync(a))
  .flatMap((root) =>
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.svg'))
      .map((e) => join(e.parentPath, e.name)),
  )
  .sort();

const changed = syncFiles(files, canonicalStyleBlock(), { check });
for (const file of changed) console.log(`${check ? 'drifted' : 'updated'}: ${file}`);
console.log(`${changed.length} of ${files.length} SVG(s) ${check ? 'drifted' : 'updated'}`);
if (check && changed.length > 0) {
  console.error('LA-STYLE blocks drifted from theme.css. Run `just style` and commit the result.');
  process.exit(1);
}
