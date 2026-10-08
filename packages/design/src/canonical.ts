import { readFileSync } from 'node:fs';

import { buildStyleBlock } from './style-block.ts';
import { parseStageTheme } from './theme.ts';

export const THEME_PATH = new URL('../theme.css', import.meta.url);

export function canonicalStyleBlock(): string {
  return buildStyleBlock(parseStageTheme(readFileSync(THEME_PATH, 'utf8')));
}
