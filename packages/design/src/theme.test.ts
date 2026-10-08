import { expect, test } from 'vitest';

import { parseStageTheme } from './theme.ts';

const CSS = `@font-face { font-family: 'Inter'; }
@theme {
  --color-*: initial;
  --color-surface: #191426;
  --color-sky: #38bdf8;
  --font-mono: ui-monospace, monospace;
  --text-label: 13px;
}
@theme inline {
  --color-background: hsl(var(--background));
}
`;

test('reads only the stage @theme block and skips the reset', () => {
  expect([...parseStageTheme(CSS)]).toEqual([
    ['color-surface', '#191426'],
    ['color-sky', '#38bdf8'],
    ['font-mono', 'ui-monospace, monospace'],
    ['text-label', '13px'],
  ]);
});

test('reads a declaration with odd spacing', () => {
  const css = '@theme {\n\t--color-sky :#38bdf8 ;\n  --text-label:   13px;  \n}\n';
  expect([...parseStageTheme(css)]).toEqual([
    ['color-sky', '#38bdf8'],
    ['text-label', '13px'],
  ]);
});

test('fails fast when there is no stage block', () => {
  expect(() => parseStageTheme('@theme inline {\n  --color-x: red;\n}\n')).toThrow(/@theme/);
});

test('fails fast when the stage block never closes', () => {
  expect(() => parseStageTheme('@theme {\n  --color-x: red;\n')).toThrow(/@theme/);
});
