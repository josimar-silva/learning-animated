import { readFileSync } from 'node:fs';

import { parseStageTheme } from '@learning-animated/design/theme';
import { contrastRatio } from '@learning-animated/svg-kit/contrast';
import { expect, test } from 'vitest';

const theme = parseStageTheme(
  readFileSync(new URL('../../packages/design/theme.css', import.meta.url), 'utf8'),
);
const color = (name: string): string => {
  const value = theme.get(`color-${name}`);
  if (!value) throw new Error(`theme.css has no --color-${name}`);
  return value;
};

// [foreground, background, kind, what it is]. Text needs 4.5:1, graphical marks 3:1.
const PAIRS: ReadonlyArray<readonly [string, string, 'text' | 'graphic', string]> = [
  ['ink', 'surface', 'text', 'titles and labels on the diagram surface'],
  ['ink-muted', 'stage', 'text', 'muted text on the stage'],
  ['ink-muted', 'surface', 'text', 'muted text on the diagram surface'],
  ['cell-ink', 'cell', 'text', 'offsets on a stored cell'],
  ['cell-ink', 'cell-new', 'text', 'offsets on a newly written cell'],
  ['surface', 'green', 'text', 'producer label on the producer fill'],
  ['surface', 'sky', 'text', 'consumer label on the consumer fill'],
  ['surface', 'amber', 'text', 'leader label on the leader fill'],
  ['ink', 'lime-deep', 'text', 'registry label on the registry fill'],
  ['ink', 'violet-deep', 'text', 'labels on a card'],
  ['red', 'surface', 'text', 'failure marks and verdicts'],
  ['emerald', 'surface', 'text', 'success marks and verdicts'],
  ['cell-stroke', 'surface', 'graphic', 'cell outline'],
  ['flow', 'surface', 'graphic', 'flow arrows'],
  ['pink', 'surface', 'graphic', 'replication marks'],
  ['violet', 'surface', 'graphic', 'card outline'],
  ['lime', 'surface', 'graphic', 'registry outline'],
  ['slate', 'surface', 'graphic', 'follower outline'],
  ['amber', 'surface', 'graphic', 'new-cell glow and flow dot'],
  ['emerald', 'cell', 'graphic', 'read marker on a stored cell'],
  ['sky', 'surface', 'graphic', 'consumer shape'],
  ['green', 'surface', 'graphic', 'producer shape'],
];

for (const [fg, bg, kind, label] of PAIRS) {
  const min = kind === 'text' ? 4.5 : 3;
  test(`${label}: --color-${fg} on --color-${bg} reaches ${min}:1`, () => {
    expect(contrastRatio(color(fg), color(bg))).toBeGreaterThanOrEqual(min);
  });
}
