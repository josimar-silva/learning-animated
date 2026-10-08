export const START = '/* LA-STYLE:START */';
export const END = '/* LA-STYLE:END */';

const FIXED_UTILITIES: ReadonlyArray<readonly [string, string]> = [
  ['fill-none', 'fill: none'],
  ['stroke-none', 'stroke: none'],
  ['stroke-1\\.5', 'stroke-width: 1.5'],
  ['stroke-2\\.5', 'stroke-width: 2.5'],
  ['font-semibold', 'font-weight: 600'],
  ['font-bold', 'font-weight: 700'],
  ['anchor-start', 'text-anchor: start'],
  ['anchor-middle', 'text-anchor: middle'],
  ['anchor-end', 'text-anchor: end'],
  [
    'halo',
    'paint-order: stroke; stroke: var(--color-stage); stroke-width: 3px; stroke-linejoin: round',
  ],
];

// Shapes that recur in nearly every animation. The la- prefix keeps them apart from utilities.
const COMPONENTS: ReadonlyArray<readonly [string, string]> = [
  ['la-canvas', 'fill: var(--color-surface); stroke: var(--color-grid)'],
  ['la-card', 'fill: var(--color-violet-deep); stroke: var(--color-violet); stroke-width: 1.5'],
  ['la-cell', 'fill: var(--color-cell); stroke: var(--color-cell-stroke); stroke-width: 1.5'],
  ['la-cell-new', 'fill: var(--color-cell-new); stroke: var(--color-amber); stroke-width: 1.5'],
  [
    'la-cell-tail',
    'fill: var(--color-surface); stroke: var(--color-cell-stroke); stroke-width: 1.5; stroke-dasharray: 4 3',
  ],
  [
    'la-offset',
    'font-family: var(--font-mono); font-size: var(--text-offset); fill: var(--color-cell-ink)',
  ],
  [
    'la-title',
    'font-family: var(--font-sans); font-size: var(--text-title); font-weight: 600; fill: var(--color-ink)',
  ],
  [
    'la-label',
    'font-family: var(--font-sans); font-size: var(--text-label); fill: var(--color-ink)',
  ],
  [
    'la-note',
    'font-family: var(--font-sans); font-size: var(--text-label); fill: var(--color-ink-muted)',
  ],
  ['la-arrow', 'fill: none; stroke: var(--color-flow); stroke-width: 1.5'],
  ['la-flow-dot', 'fill: var(--color-amber)'],
  ['la-read-marker', 'fill: none; stroke: var(--color-emerald); stroke-width: 2.5'],
];

const rule = (selector: string, body: string): string => `.${selector} { ${body}; }`;

function suffixes(theme: ReadonlyMap<string, string>, prefix: string): string[] {
  return [...theme.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

export function buildStyleBlock(theme: ReadonlyMap<string, string>): string {
  const variables = [...theme].map(([name, value]) => `  --${name}: ${value};`).join('\n');
  return [
    START,
    `:root {\n${variables}\n}`,
    ...suffixes(theme, 'color-').flatMap((c) => [
      rule(`fill-${c}`, `fill: var(--color-${c})`),
      rule(`stroke-${c}`, `stroke: var(--color-${c})`),
    ]),
    ...suffixes(theme, 'font-').map((f) => rule(`font-${f}`, `font-family: var(--font-${f})`)),
    ...suffixes(theme, 'text-').map((s) => rule(`text-${s}`, `font-size: var(--text-${s})`)),
    ...FIXED_UTILITIES.map(([s, b]) => rule(s, b)),
    ...COMPONENTS.map(([s, b]) => rule(s, b)),
    END,
  ].join('\n');
}
