import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { buildStyleBlock, END, START } from './style-block.ts';
import { parseStageTheme } from './theme.ts';

const THEME = new Map([
  ['color-surface', '#191426'],
  ['color-sky', '#38bdf8'],
  ['font-mono', 'ui-monospace, monospace'],
  ['text-label', '13px'],
]);

test('wraps the block in the LA-STYLE markers', () => {
  const block = buildStyleBlock(THEME);
  expect(block.startsWith(START)).toBe(true);
  expect(block.endsWith(END)).toBe(true);
});

test('declares every stage variable on :root', () => {
  expect(buildStyleBlock(THEME)).toContain(
    ':root {\n  --color-surface: #191426;\n  --color-sky: #38bdf8;\n  --font-mono: ui-monospace, monospace;\n  --text-label: 13px;\n}',
  );
});

test('emits a fill and a stroke utility for every color', () => {
  const block = buildStyleBlock(THEME);
  expect(block).toContain('.fill-sky { fill: var(--color-sky); }');
  expect(block).toContain('.stroke-sky { stroke: var(--color-sky); }');
  expect(block).toContain('.fill-surface { fill: var(--color-surface); }');
});

test('emits font and text-size utilities from the theme', () => {
  const block = buildStyleBlock(THEME);
  expect(block).toContain('.font-mono { font-family: var(--font-mono); }');
  expect(block).toContain('.text-label { font-size: var(--text-label); }');
});

test('emits the fixed utilities with Tailwind names', () => {
  const block = buildStyleBlock(THEME);
  for (const rule of [
    '.fill-none { fill: none; }',
    '.stroke-1\\.5 { stroke-width: 1.5; }',
    '.stroke-2\\.5 { stroke-width: 2.5; }',
    '.font-semibold { font-weight: 600; }',
    '.anchor-middle { text-anchor: middle; }',
  ]) {
    expect(block).toContain(rule);
  }
});

test('emits the la- components', () => {
  const block = buildStyleBlock(THEME);
  for (const name of [
    'la-canvas',
    'la-card',
    'la-cell',
    'la-cell-new',
    'la-cell-tail',
    'la-offset',
    'la-title',
    'la-label',
    'la-note',
    'la-arrow',
    'la-flow-dot',
    'la-read-marker',
  ]) {
    expect(block).toContain(`.${name} {`);
  }
});

test('is deterministic', () => {
  expect(buildStyleBlock(THEME)).toBe(buildStyleBlock(new Map(THEME)));
});

test('every variable the real block uses is declared in it', () => {
  const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
  const block = buildStyleBlock(parseStageTheme(css));
  const declared = new Set([...block.matchAll(/^\s+--([a-z0-9-]+):/gm)].map((m) => m[1]));
  const used = new Set([...block.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]));
  expect([...used].filter((v) => !declared.has(v))).toEqual([]);
});
