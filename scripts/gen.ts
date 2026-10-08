// Writes a generated SVG: node scripts/gen.ts <path to <id>.gen.ts>
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { svgPathFor } from './lib/gen.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/gen.ts <path to <id>.gen.ts>');
  process.exit(2);
}
const out = svgPathFor(file);
const { render } = (await import(pathToFileURL(resolve(file)).href)) as { render: () => string };
writeFileSync(out, render());
console.log(`wrote ${out}`);
