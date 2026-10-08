// Writes dot-product-hotspot.svg through `just gen`. The ten arrays below drive every score on
// the stage, and the story constants drive every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, show } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const W = 960;
const H = 540;

// The queries and the stored vectors, D = 8 doubles each. q1 and v1 are the cosine lesson's q and
// v1, and v2 and v3 sit 20° and 70° from q1, as they do there.
export const QUERIES: readonly (readonly number[])[] = [
  [-0.6, 0.3, 0.7, 0.9, -0.2, 0.6, 0.3, -0.1],
  [0.8, -0.6, -0.3, -0.5, 0.5, -0.2, -0.2, 0.3],
  [-0.3, 0.3, 0.9, -0.3, 0.3, 0.2, 0.2, 0.3],
  [0.4, -0.3, -0.7, 0.4, 0.4, 0.4, 0.6, 0.4],
];
export const STORED: readonly (readonly number[])[] = [
  [-0.3, -0.2, 0.6, 0.5, 0.2, 0.5, 0.5, -0.4],
  [-0.4, 0.2, 0.6, 0.8, -0.4, 0.6, -0.1, -0.1],
  [-0.8, -0.9, 0.8, -0.2, -0.2, 0.6, -0.5, -0.4],
  [0.4, -0.6, -0.3, -0.4, 0.2, -0.1, -0.3, 0.5],
  [-0.6, 0.1, 0.8, -0.2, 0.6, 0.2, -0.2, 0.3],
  [0.5, -0.7, -0.3, 0.6, 0.4, 0.6, 0.9, 0.2],
];

// Step 2: the first dot product runs slowly, one multiply-add every MULTIPLY_EVERY seconds.
const FIRST_FROM = 2;
const MULTIPLY_EVERY = 0.25;
// Step 3: every other dot product takes PAIR_EVERY seconds, in loop order.
const PAIRS_FROM = 4;
const PAIR_EVERY = 0.5;
// Step 4: the k loop is marked as the hotspot.
const HOTSPOT_FROM = 16;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'Score M = 4 queries against N = 6 stored vectors of D = 8 doubles. All have length 1, so a dot product is their cosine.',
  ],
  [
    FIRST_FROM,
    'One pair is one dot product: the k loop does D = 8 multiply-adds, and q1 · v1 comes out at 0.80.',
  ],
  [
    PAIRS_FROM,
    'The nested loop repeats that for every pair, one at a time and row by row, until all 4 × 6 = 24 cells hold a score.',
  ],
  [
    HOTSPOT_FROM,
    'The 24 dot products cost 24 × 8 = 192 multiply-adds, M × N × D. They take most of the time, so the k loop is the hotspot.',
  ],
];

const TITLE = 'The M × N dot-product hotspot';
const DESC =
  'On the left, a nested loop scores every query against every stored vector by calling dot(), ' +
  'whose inner loop does one multiply-add per double. ' +
  'On the right, a table has a row for each of four queries, q1 to q4, and a column for each of six stored vectors, v1 to v6. ' +
  'First, one dot product runs slowly: the inner loop steps eight times, and the cell for q1 and v1 fills with 0.80. ' +
  'Then the loop takes every other pair in turn, row by row, and each cell fills with its score ' +
  'while the counters climb to 24 dot products and 192 multiply-adds. ' +
  'Last, the inner loop is marked as the hotspot: M times N times D, or 4 times 6 times 8, gives 192 multiply-adds.';

const M = QUERIES.length;
const N = STORED.length;
const D = QUERIES[0]!.length;
const PAIRS = M * N;
const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const cosineOf = (a: readonly number[], b: readonly number[]): number =>
  dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));

// Pair n runs in loop order: the outer loop walks the queries and the inner loop the stored vectors.
const turnOf = (n: number): Interval =>
  n === 0
    ? [FIRST_FROM, PAIRS_FROM]
    : [PAIRS_FROM + (n - 1) * PAIR_EVERY, PAIRS_FROM + n * PAIR_EVERY];
const DONE = turnOf(PAIRS - 1)[1];

const PANEL_TOP = 84;
const PANEL_HEIGHT = 370;
const LEFT_X = 24;
const LEFT_WIDTH = 528;
const RIGHT_X = 568;
const RIGHT_WIDTH = W - LEFT_X - RIGHT_X;
const LABEL_Y = PANEL_TOP + 24;

// Left panel: the loop as code, then the two counters under it.
const TEXT_X = LEFT_X + 16;
const INDENT = 18;
const CODE_TOP = 140;
const LINE_PITCH = 22;
const COMMENT_X = 330;
const NOTE_X = 292;
const COUNT_Y = { 'dot-products': 386, 'multiply-adds': 412 } as const;
const COUNT_VALUE_X = 232;
const FORMULA_X = 244;

// Right panel: the score table, one cell per pair, with its legend under it.
const TABLE_TEXT_X = RIGHT_X + 16;
const CELL_X = 616;
const CELL_W = 46;
const CELL_H = 32;
const CELL_PITCH = 50;
const ROW_TOP = 150;
const ROW_PITCH = 42;
const COLUMN_Y = 138;
const RING_W = 32;
const RING_H = 24;
const LEGEND_Y = 346;
const LEGEND_PITCH = 24;

const CAPTION_TOP = 470;
const CAPTION_HEIGHT = 36;
const FOOTER_Y = 526;

type Segment = string | readonly [words: string, color: string];
type CodeLine = {
  readonly indent: number;
  readonly segments: readonly Segment[];
  readonly comment?: string;
};

const keyword = (word: string): Segment => [word, 'fill-violet'];
// The code the lesson runs, one entry per line, null for the blank line between the two methods.
const CODE: readonly (CodeLine | null)[] = [
  {
    indent: 0,
    segments: [keyword('for'), ' (', keyword('int'), ' i = 0; i < M; i++)'],
    comment: '// M queries',
  },
  {
    indent: 1,
    segments: [keyword('for'), ' (', keyword('int'), ' j = 0; j < N; j++)'],
    comment: '// N stored vectors',
  },
  {
    indent: 2,
    segments: ['score[i][j] = dot(', ['q', 'fill-sky'], '[i], ', ['v', 'fill-pink'], '[j]);'],
  },
  null,
  {
    indent: 0,
    segments: [
      keyword('static'),
      ' ',
      keyword('double'),
      ' dot(',
      keyword('double'),
      '[] a, ',
      keyword('double'),
      '[] b) {',
    ],
  },
  { indent: 1, segments: [keyword('double'), ' sum = 0;'] },
  {
    indent: 1,
    segments: [keyword('for'), ' (', keyword('int'), ' k = 0; k < D; k++)'],
    comment: '// D doubles',
  },
  { indent: 2, segments: ['sum += a[k] * b[k];'] },
  { indent: 1, segments: [keyword('return'), ' sum;'] },
  { indent: 0, segments: ['}'] },
];
const lineY = (index: number): number => CODE_TOP + index * LINE_PITCH;
// The k loop: its header and the multiply-add line under it.
const K_LOOP = 6;
const MULTIPLY_ADD = K_LOOP + 1;
const K_BOX = {
  x: TEXT_X + INDENT - 8,
  y: lineY(K_LOOP) - 17,
  width: 230,
  height: lineY(MULTIPLY_ADD) - lineY(K_LOOP) + 25,
} as const;

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const shown = (during: readonly Interval[]): string => show(during, LOOP);
const box = (attributes: string, b: typeof K_BOX, inner = ''): string =>
  `<rect ${attributes} x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="6">${inner}</rect>`;

function codeLine(line: CodeLine | null, index: number): string[] {
  if (!line) return [];
  const words = line.segments
    .map((s) =>
      typeof s === 'string' ? escapeXml(s) : `<tspan class="${s[1]}">${escapeXml(s[0])}</tspan>`,
    )
    .join('');
  const y = lineY(index);
  return [
    `  <text data-role="code" class="font-mono text-label fill-ink" x="${TEXT_X + line.indent * INDENT}" y="${y}">${words}</text>`,
    ...(line.comment
      ? [`  ${text('font-mono text-label fill-ink-muted', COMMENT_X, y, line.comment)}`]
      : []),
  ];
}

// The loop index k while the first dot product runs slowly.
function watch(): string[] {
  return Array.from({ length: D }, (_, k) => {
    const from = FIRST_FROM + k * MULTIPLY_EVERY;
    return `  <text data-role="k" class="font-mono text-label fill-amber" x="${NOTE_X}" y="${lineY(MULTIPLY_ADD)}">k = ${k}${shown([[from, from + MULTIPLY_EVERY]])}</text>`;
  });
}

// A counter shows each value from its moment to the next one, amber while the loop runs.
type Tick = readonly [at: number, value: number];
function counter(of: keyof typeof COUNT_Y, ticks: readonly Tick[]): string[] {
  return ticks.map(([from, value], i) => {
    const next = ticks[i + 1];
    const classes = next
      ? 'font-mono text-label fill-amber anchor-end'
      : 'font-mono text-label font-semibold fill-ink anchor-end';
    return `  <text data-role="count" data-of="${of}" class="${classes}" x="${COUNT_VALUE_X}" y="${COUNT_Y[of]}">${value}${shown([[from, next?.[0] ?? LOOP]])}</text>`;
  });
}

const DOT_TICKS: readonly Tick[] = [
  [0, 0],
  ...Array.from({ length: PAIRS }, (_, n): Tick => [turnOf(n)[1], n + 1]),
];
const MULTIPLY_TICKS: readonly Tick[] = [
  [0, 0],
  ...Array.from({ length: D }, (_, k): Tick => [FIRST_FROM + k * MULTIPLY_EVERY, k + 1]),
  ...Array.from({ length: PAIRS - 1 }, (_, n): Tick => [turnOf(n + 1)[1], D * (n + 2)]),
];

function counters(): string[] {
  const rows = [
    {
      of: 'dot-products',
      label: 'dot products',
      formula: `M × N = ${M} × ${N}`,
      ticks: DOT_TICKS,
    },
    {
      of: 'multiply-adds',
      label: 'multiply-adds',
      formula: `M × N × D = ${M} × ${N} × ${D}`,
      ticks: MULTIPLY_TICKS,
    },
  ] as const;
  return rows.flatMap(({ of, label, formula, ticks }) => [
    `  ${text('la-note', TEXT_X, COUNT_Y[of], label)}`,
    ...counter(of, ticks),
    `  <text data-role="formula" data-of="${of}" class="font-mono text-label fill-ink" x="${FORMULA_X}" y="${COUNT_Y[of]}">= ${escapeXml(formula)}${shown([[HOTSPOT_FROM, LOOP]])}</text>`,
  ]);
}

// The row and the column of pair n.
const cellOf = (n: number): [row: number, column: number] => [Math.floor(n / N), n % N];
const columnMiddle = (c: number): number => CELL_X + c * CELL_PITCH + CELL_W / 2;
const rowTop = (r: number): number => ROW_TOP + r * ROW_PITCH;

function headers(): string[] {
  return [
    ...STORED.map(
      (_, c) =>
        `  <text data-role="column" data-vector="v${c + 1}" class="font-mono text-label font-bold fill-pink anchor-middle" x="${columnMiddle(c)}" y="${COLUMN_Y}">v${c + 1}</text>`,
    ),
    ...QUERIES.map(
      (_, r) =>
        `  <text data-role="row" data-vector="q${r + 1}" class="font-mono text-label font-bold fill-sky" x="${TABLE_TEXT_X}" y="${rowTop(r) + 21}">q${r + 1}</text>`,
    ),
  ];
}

function scoreCell(n: number): string {
  const [r, c] = cellOf(n);
  const [start, end] = turnOf(n);
  const x = CELL_X + c * CELL_PITCH;
  const geometry = `x="${x}" y="${rowTop(r)}" width="${CELL_W}" height="${CELL_H}" rx="6"`;
  const score = cosineOf(QUERIES[r]!, STORED[c]!).toFixed(2);
  return [
    `  <g data-role="score" data-query="q${r + 1}" data-vector="v${c + 1}">`,
    `    <rect data-role="slot" class="la-cell-tail" ${geometry}/>`,
    `    <rect data-role="writing" class="la-cell-new" ${geometry}>${shown([[start, end]])}</rect>`,
    `    <g data-role="done">`,
    `      ${shown([[end, LOOP]])}`,
    `      <rect class="la-cell" ${geometry}/>`,
    `      <text data-role="score-value" class="font-mono text-label fill-cell-ink anchor-middle" x="${x + CELL_W / 2}" y="${rowTop(r) + 21}">${score}</text>`,
    '    </g>',
    '  </g>',
  ].join('\n');
}

// Rings on the query and the stored vector whose dot product is running.
function pair(n: number): string {
  const [r, c] = cellOf(n);
  const ring = (x: number, y: number): string =>
    `    <rect class="fill-none stroke-amber stroke-2.5" x="${x}" y="${y}" width="${RING_W}" height="${RING_H}" rx="8"/>`;
  return [
    `  <g data-role="pair" data-query="q${r + 1}" data-vector="v${c + 1}">`,
    `    ${shown([turnOf(n)])}`,
    ring(TABLE_TEXT_X - 7, rowTop(r) + 4),
    ring(columnMiddle(c) - RING_W / 2, COLUMN_Y - 18),
    '  </g>',
  ].join('\n');
}

function legend(): string[] {
  const name = (words: string, color: string): string =>
    `<tspan class="font-mono font-bold ${color}">${words}</tspan>`;
  const line = (i: number, words: string): string =>
    `  <text class="font-sans text-label fill-ink-muted" x="${TABLE_TEXT_X}" y="${LEGEND_Y + i * LEGEND_PITCH}">${words}</text>`;
  return [
    line(
      0,
      `${name('q1', 'fill-sky')} to ${name(`q${M}`, 'fill-sky')}: M = ${M} queries, one row each`,
    ),
    line(
      1,
      `${name('v1', 'fill-pink')} to ${name(`v${N}`, 'fill-pink')}: N = ${N} stored vectors, one column each`,
    ),
    line(2, `each vector: D = ${D} doubles, length 1`),
  ];
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="font-sans text-label fill-ink anchor-middle" x="${W / 2}" y="${CAPTION_TOP + 23}">${escapeXml(words)}${shown([[at, next]])}</text>`;
}

export function render(): string {
  const pairs = Array.from({ length: PAIRS }, (_, n) => n);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" data-loop="${LOOP}s">`,
    `  <title>${escapeXml(TITLE)}</title>`,
    `  <desc>${escapeXml(DESC)}</desc>`,
    '  <style>',
    '/* LA-STYLE:START */',
    '/* LA-STYLE:END */',
    '</style>',
    `  <rect class="fill-stage" width="${W}" height="${H}"/>`,
    `  ${text('la-title', 28, 40, TITLE)}`,
    `  ${text('la-note', 28, 64, 'Scoring M queries against N stored vectors takes M × N dot products, and their multiply-adds take most of the time.')}`,
    `  <rect class="la-canvas stroke-1.5" x="${LEFT_X}" y="${PANEL_TOP}" width="${LEFT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_X, LABEL_Y, 'the scoring loop, one dot() call per pair')}`,
    `  ${box('data-role="hotspot" class="la-cell-new"', K_BOX, shown([[HOTSPOT_FROM, LOOP]]))}`,
    `  ${box('data-role="running" class="fill-none stroke-amber stroke-1.5"', K_BOX, shown([[FIRST_FROM, DONE]]))}`,
    ...CODE.flatMap(codeLine),
    ...watch(),
    `  <text data-role="hotspot-label" class="font-sans text-label font-semibold fill-amber" x="${NOTE_X}" y="${lineY(MULTIPLY_ADD)}">hotspot${shown([[HOTSPOT_FROM, LOOP]])}</text>`,
    ...counters(),
    `  <rect class="la-canvas stroke-1.5" x="${RIGHT_X}" y="${PANEL_TOP}" width="${RIGHT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TABLE_TEXT_X, LABEL_Y, 'the score table, one dot product per cell')}`,
    ...headers(),
    ...pairs.map(scoreCell),
    ...pairs.map(pair),
    ...legend(),
    `  <rect class="la-canvas" x="${LEFT_X}" y="${CAPTION_TOP}" width="${W - 2 * LEFT_X}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, "Sources: openjdk.org/jeps/537 (JEP 537: Vector API) and netflixtechblog.com (Optimizing recommendation systems with JDK's Vector API).")}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
