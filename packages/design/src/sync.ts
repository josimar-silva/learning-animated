import { readFileSync, writeFileSync } from 'node:fs';

import { END, START } from './style-block.ts';

export function embedBlock(svgText: string, block: string): string {
  const start = svgText.indexOf(START);
  const end = svgText.indexOf(END);
  if (start === -1 || end === -1 || end < start) throw new Error('missing LA-STYLE markers');
  return svgText.slice(0, start) + block + svgText.slice(end + END.length);
}

export function syncFiles(
  files: readonly string[],
  block: string,
  { check = false }: { check?: boolean } = {},
): string[] {
  const changed: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    let next: string;
    try {
      next = embedBlock(text, block);
    } catch {
      throw new Error(`${file} is missing the LA-STYLE markers`);
    }
    if (next === text) continue;
    changed.push(file);
    if (!check) writeFileSync(file, next);
  }
  return changed;
}
