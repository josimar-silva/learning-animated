// Writes batching-into-matmul.svg through `just gen`. The rows below drive every number on the
// stage, and the story constants drive every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, show } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const W = 960;
const H = 540;

type Row = { readonly name: string; readonly values: readonly number[] };

// The queries pack into A and the stored vectors into B. q1 and v1 are the cosine lesson's q and
// v1, and v2 and v3 meet q1 at that lesson's scores, 0.94 and 0.34.
const QUERIES: readonly Row[] = [
  { name: 'q1', values: [-0.6, 0.3, 0.7, 0.9, -0.2, 0.6, 0.3, -0.1] },
  { name: 'q2', values: [0.3, 0.5, -0.4, 0.3, -0.6, -0.4, 0.1, 0.3] },
  { name: 'q3', values: [-0.3, 0.1, 0.8, -0.3, -0.2, 0.3, -0.3, -0.8] },
];
const STORED: readonly Row[] = [
  { name: 'v1', values: [-0.3, -0.2, 0.6, 0.5, 0.2, 0.5, 0.5, -0.4] },
  { name: 'v2', values: [-0.2, 0.2, 0.5, 0.5, -0.3, 0.3, 0.2, 0.1] },
  { name: 'v3', values: [-0.2, -0.5, 0.9, -0.1, -0.6, 0.2, -0.3, -0.6] },
  { name: 'v4', values: [0.2, 0.2, -0.6, 0.2, -0.4, -0.4, 0.4, 0.5] },
];

// Step 1: the loop makes call n at CALLS_FROM + n * CALL_EVERY, query by query.
const CALLS_FROM = 1;
const CALL_EVERY = 0.4;
// Step 2: the rows become two matrices, then every row is divided by its length.
const PACK_FROM = 6.5;
const NORMALIZE_FROM = 8;
// Step 3: both matrices go into one multiply, which writes every entry of C.
const IN_FLIGHT_FROM = 11.5;
const MULTIPLY_FROM = 12;
// Step 4: each row of C marks its maximum.
const CLOSEST_FROM = 16.5;
// How long a rewritten cell glows.
const WRITE = 0.5;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'Without batching, a nested loop makes one cosine call per pair: 3 queries × 4 stored vectors = 12 calls, one at a time.',
  ],
  [
    6,
    'Batching packs the queries into A (3 × 8) and the stored vectors into B (4 × 8), then divides each row by its length, once.',
  ],
  [
    11,
    'One matrix multiply, C = A × Bᵀ, computes all 12 dot products in a single call, and C holds the same 12 scores as the loop.',
  ],
  [
    16,
    "Each row of C scores one query against every stored vector, so the row's maximum names that query's closest stored vector.",
  ],
];

// A formula token keeps the color of what it names: queries and A in sky, stored vectors and B in pink.
type Part = string | readonly [words: string, color: 'sky' | 'pink'];
const Q: Part = ['q', 'sky'];
const V: Part = ['v', 'pink'];
const A: Part = ['A', 'sky'];
const B: Part = ['B', 'pink'];
const B_T: Part = ['Bᵀ', 'pink'];
const FORMULAS: ReadonlyArray<readonly [from: number, to: number, parts: readonly Part[]]> = [
  [0, 6, ['cos(', Q, ', ', V, ') = (', Q, ' · ', V, ') / (|', Q, '| × |', V, '|), once per pair']],
  [6, 11, [A, '[i] = ', Q, ' / |', Q, '| and ', B, '[j] = ', V, ' / |', V, '|, once per row']],
  [
    11,
    LOOP,
    ['C = ', A, ' × ', B_T, ', so C[i][j] = ', A, '[i] · ', B, '[j] = cos(', Q, ', ', V, ')'],
  ],
];

const TITLE = 'Batching into a matrix multiply';
const DESC =
  'Three queries, q1 to q3, and four stored vectors, v1 to v4, sit in rows of eight cells, one double per cell. ' +
  'First a nested loop scores one pair per call: it rings a query row and a stored row, ' +
  'writes their cosine into a table of 3 rows by 4 columns, and counts 12 calls, one at a time. ' +
  'Then the query rows are packed into a matrix A, 3 by 8, and the stored rows into a matrix B, 4 by 8, ' +
  'and each row is divided by its length, so every row has length 1. ' +
  'Next one matrix multiply, C equals A times B transposed, reads both matrices ' +
  'and writes all 12 entries of a second table at the same moment, in one call. ' +
  'Every entry of C matches the score the loop wrote in the same place. ' +
  "Last, the highest score in each row of C is ringed, naming that query's closest stored vector: " +
  'v2 for q1, v4 for q2, and v3 for q3.';

const D = QUERIES[0]!.values.length;
const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const lengthOf = (a: readonly number[]): number => Math.sqrt(dot(a, a));
const unitOf = (a: readonly number[]): number[] => a.map((x) => x / lengthOf(a));
// What one call of the loop returns, and what the multiply writes for the same pair.
const cosine = (q: Row, v: Row): number =>
  dot(q.values, v.values) / (lengthOf(q.values) * lengthOf(v.values));
const product = (q: Row, v: Row): number => dot(unitOf(q.values), unitOf(v.values));
const PAIRS = QUERIES.flatMap((q, i) => STORED.map((v, j) => ({ q, i, v, j })));
const turnOf = (call: number): number => CALLS_FROM + call * CALL_EVERY;

const PANEL_TOP = 84;
const PANEL_HEIGHT = 370;
const LEFT_X = 24;
const LEFT_WIDTH = 528;
const RIGHT_X = 568;
const RIGHT_WIDTH = W - LEFT_X - RIGHT_X;
const LABEL_Y = PANEL_TOP + 24;

// Left panel: the rows, the matrices they pack into, and the formula under them.
const TEXT_X = LEFT_X + 16;
const ROW_LABEL_X = 64;
const LENGTH_X = 130;
const INDEX_Y = 132;
const CELL_X = 140;
const CELL_W = 46;
const CELL_H = 32;
const CELL_PITCH = 50;
const ROW_PITCH = 38;
const ROW_W = D * CELL_PITCH - (CELL_PITCH - CELL_W);
const MATRIX_TOP = { A: 144, B: 272 } as const;
const FORMULA_Y = 444;

// Right panel: the loop's table on top and C under it, sharing their columns.
const TABLE_X = RIGHT_X + 16;
const ENTRY_X = 620;
const ENTRY_PITCH = 54;
const COUNT_X = RIGHT_X + RIGHT_WIDTH - 16;
const CLOSEST_X = ENTRY_X + STORED.length * ENTRY_PITCH + 12;
type Table = { readonly label: number; readonly header: number; readonly top: number };
const LOOP_TABLE: Table = { label: LABEL_Y, header: INDEX_Y, top: MATRIX_TOP.A };
const C_TABLE: Table = { label: 290, header: 314, top: 324 };

const CAPTION_TOP = 470;
const CAPTION_HEIGHT = 36;
const FOOTER_Y = 526;

const text = (classes: string, x: number, y: number, words: string, extra = ''): string =>
  `<text class="${classes}" x="${x}" y="${y}"${extra}>${escapeXml(words)}</text>`;
const VALUE_TEXT = 'font-mono text-label fill-cell-ink anchor-middle';
const shown = (during: readonly Interval[]): string => show(during, LOOP);
const box = (x: number, y: number, width: number, height: number, rx: number): string =>
  `x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}"`;
const spans = (parts: readonly Part[]): string =>
  parts
    .map((part) =>
      typeof part === 'string'
        ? escapeXml(part)
        : `<tspan class="fill-${part[1]}">${escapeXml(part[0])}</tspan>`,
    )
    .join('');

type Matrix = {
  readonly name: 'A' | 'B';
  readonly rows: readonly Row[];
  readonly color: 'sky' | 'pink';
};
const MATRIX_A: Matrix = { name: 'A', rows: QUERIES, color: 'sky' };
const MATRIX_B: Matrix = { name: 'B', rows: STORED, color: 'pink' };
const MATRICES: readonly Matrix[] = [MATRIX_A, MATRIX_B];
const rowTop = (m: Matrix, i: number): number => MATRIX_TOP[m.name] + i * ROW_PITCH;
const blockHeight = (m: Matrix): number => m.rows.length * ROW_PITCH - (ROW_PITCH - CELL_H);
const outlineOf = (m: Matrix): string =>
  box(CELL_X - 4, MATRIX_TOP[m.name] - 4, ROW_W + 8, blockHeight(m) + 8, 10);

// One row of D cells. Its values switch from the raw doubles to the row divided by its length,
// and every cell glows while it is rewritten. Each group's class styles its children.
function row(m: Matrix, i: number): string {
  const { name, values } = m.rows[i]!;
  const top = rowTop(m, i);
  const xOf = (k: number): number => CELL_X + k * CELL_PITCH;
  const cells = values.map((_, k) => box(xOf(k), top, CELL_W, CELL_H, 6));
  const numbers = (
    role: 'raw' | 'unit',
    during: Interval,
    format: (x: number) => string,
  ): string[] => [
    `    <g class="${VALUE_TEXT}">`,
    `      ${shown([during])}`,
    ...values.map(
      (x, k) =>
        `      <text data-role="${role}" x="${xOf(k) + CELL_W / 2}" y="${top + 21}">${format(x)}</text>`,
    ),
    '    </g>',
  ];
  return [
    `  <g data-role="row" data-vector="${name}">`,
    `    <g class="fill-cell stroke-${m.color} stroke-1.5">`,
    ...cells.map((cell, k) => `      <rect data-role="element" data-index="${k}" ${cell}/>`),
    '    </g>',
    '    <g class="la-cell-new">',
    `      ${shown([[NORMALIZE_FROM, NORMALIZE_FROM + WRITE]])}`,
    ...cells.map((cell) => `      <rect ${cell}/>`),
    '    </g>',
    ...numbers('raw', [0, NORMALIZE_FROM], (x) => x.toFixed(1)),
    ...numbers('unit', [NORMALIZE_FROM, LOOP], (x) => (x / lengthOf(values)).toFixed(2)),
    '  </g>',
  ].join('\n');
}

function rowLabels(m: Matrix, i: number): string[] {
  const { name, values } = m.rows[i]!;
  const y = rowTop(m, i) + 21;
  return [
    `  ${text(`font-mono text-label font-bold fill-${m.color}`, ROW_LABEL_X, y, name)}`,
    `  <text data-role="length" data-vector="${name}" class="font-mono text-offset fill-${m.color} anchor-end" x="${LENGTH_X}" y="${y}">÷ ${lengthOf(values).toFixed(1)}${shown([[NORMALIZE_FROM, LOOP]])}</text>`,
  ];
}

function matrix(m: Matrix): string {
  const middle = MATRIX_TOP[m.name] + blockHeight(m) / 2;
  return [
    `  <g data-role="matrix" data-matrix="${m.name}">`,
    `    ${shown([[PACK_FROM, LOOP]])}`,
    `    <rect data-role="outline" class="fill-none stroke-${m.color} stroke-1.5" ${outlineOf(m)}/>`,
    `    ${text(`font-mono font-bold fill-${m.color}`, TEXT_X, middle + 6, m.name, ' font-size="17"')}`,
    '  </g>',
  ].join('\n');
}

// Both matrices glow while the multiply reads them.
const inFlight = (m: Matrix): string =>
  `  <rect data-role="in-flight" data-matrix="${m.name}" class="fill-none stroke-amber stroke-2.5" ${outlineOf(m)}>${shown([[IN_FLIGHT_FROM, MULTIPLY_FROM + WRITE]])}</rect>`;

function pair(call: number): string {
  const { q, i, v, j } = PAIRS[call]!;
  const turn = turnOf(call);
  const ring = (top: number): string =>
    `    <rect class="fill-none stroke-amber stroke-2.5" ${box(CELL_X - 3, top - 3, ROW_W + 6, CELL_H + 6, 8)}/>`;
  return [
    `  <g data-role="pair" data-query="${q.name}" data-vector="${v.name}">`,
    `    ${shown([[turn, turn + CALL_EVERY]])}`,
    ring(rowTop(MATRIX_A, i)),
    ring(rowTop(MATRIX_B, j)),
    '  </g>',
  ].join('\n');
}

function formula([from, to, parts]: readonly [number, number, readonly Part[]]): string {
  return `  <text data-role="formula" class="font-mono text-label fill-ink" x="${TEXT_X}" y="${FORMULA_Y}">${spans(parts)}${shown([[from, to]])}</text>`;
}

const entryX = (j: number): number => ENTRY_X + j * ENTRY_PITCH;
const entryTop = (table: Table, i: number): number => table.top + i * ROW_PITCH;
const entryBox = (table: Table, i: number, j: number): string =>
  box(entryX(j), entryTop(table, i), CELL_W, CELL_H, 6);
const entryText = (table: Table, i: number, j: number): string =>
  `x="${entryX(j) + CELL_W / 2}" y="${entryTop(table, i) + 21}"`;

function tableFrame(table: Table, words: string): string[] {
  return [
    `  ${text('la-label font-semibold', TABLE_X, table.label, words)}`,
    ...STORED.map(
      (v, j) =>
        `  ${text('font-mono text-label font-bold fill-pink anchor-middle', entryX(j) + CELL_W / 2, table.header, v.name)}`,
    ),
    ...QUERIES.map(
      (q, i) =>
        `  ${text('font-mono text-label font-bold fill-sky', TABLE_X, entryTop(table, i) + 21, q.name)}`,
    ),
  ];
}

// The loop writes its table one call at a time, and each score glows while it is written.
function loopTable(): string[] {
  return [
    `  <g class="${VALUE_TEXT}">`,
    ...PAIRS.map(({ i, j }) => `    <rect class="la-cell-tail" ${entryBox(LOOP_TABLE, i, j)}/>`),
    ...PAIRS.map(({ q, i, v, j }, call) => {
      const turn = turnOf(call);
      return [
        `    <g data-role="call" data-query="${q.name}" data-vector="${v.name}">`,
        `      ${shown([[turn, LOOP]])}`,
        `      <rect class="la-cell" ${entryBox(LOOP_TABLE, i, j)}/>`,
        `      <rect class="la-cell-new" ${entryBox(LOOP_TABLE, i, j)}>${shown([[turn, turn + CALL_EVERY]])}</rect>`,
        `      <text ${entryText(LOOP_TABLE, i, j)}>${cosine(q, v).toFixed(2)}</text>`,
        '    </g>',
      ].join('\n');
    }),
    '  </g>',
  ];
}

// The multiply writes every entry of C at once, and they all glow together.
function productTable(): string[] {
  const cells = PAIRS.map(({ i, j }) => `        <rect ${entryBox(C_TABLE, i, j)}/>`);
  return [
    `  <g class="${VALUE_TEXT}">`,
    ...PAIRS.map(({ i, j }) => `    <rect class="la-cell-tail" ${entryBox(C_TABLE, i, j)}/>`),
    '    <g data-role="multiply">',
    `      ${shown([[MULTIPLY_FROM, LOOP]])}`,
    '      <g class="la-cell">',
    ...cells,
    '      </g>',
    '      <g class="la-cell-new">',
    `        ${shown([[MULTIPLY_FROM, MULTIPLY_FROM + WRITE]])}`,
    ...cells,
    '      </g>',
    ...PAIRS.map(
      ({ q, i, v, j }) =>
        `      <text data-role="score" data-query="${q.name}" data-vector="${v.name}" ${entryText(C_TABLE, i, j)}>${product(q, v).toFixed(2)}</text>`,
    ),
    '    </g>',
    '  </g>',
  ];
}

// The loop's call count runs in amber while the loop runs, and settles in ink at 12.
function loopCounts(): string[] {
  return PAIRS.map((_, call) => {
    const last = call === PAIRS.length - 1;
    const classes = last
      ? 'font-mono text-label font-semibold fill-ink anchor-end'
      : 'font-mono text-label fill-amber anchor-end';
    const until = last ? LOOP : turnOf(call + 1);
    return `  <text data-role="count" data-table="loop" class="${classes}" x="${COUNT_X}" y="${LOOP_TABLE.label}">calls: ${call + 1}${shown([[turnOf(call), until]])}</text>`;
  });
}

function closest(q: Row, i: number): string {
  const scores = STORED.map((v) => product(q, v));
  const j = scores.indexOf(Math.max(...scores));
  const [x, y] = [entryX(j), entryTop(C_TABLE, i)];
  return [
    `  <g data-role="closest" data-query="${q.name}" data-vector="${STORED[j]!.name}">`,
    `    ${shown([[CLOSEST_FROM, LOOP]])}`,
    `    <rect class="fill-none stroke-emerald stroke-1.5" ${box(x - 3, y - 3, CELL_W + 6, CELL_H + 6, 8)}/>`,
    `    ${text('font-mono text-label font-bold fill-pink', CLOSEST_X, y + 21, STORED[j]!.name)}`,
    '  </g>',
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="font-sans text-label fill-ink anchor-middle" x="${W / 2}" y="${CAPTION_TOP + 23}">${escapeXml(words)}${shown([[at, next]])}</text>`;
}

export function render(): string {
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
    `  ${text('la-note', 28, 64, 'Packed into two matrices, the queries and the stored vectors need one matrix multiply instead of one cosine call per pair.')}`,
    `  <rect class="la-canvas stroke-1.5" x="${LEFT_X}" y="${PANEL_TOP}" width="${LEFT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_X, LABEL_Y, `${QUERIES.length} queries and ${STORED.length} stored vectors, D = ${D} doubles each`)}`,
    ...QUERIES[0]!.values.map(
      (_, k) =>
        `  ${text('la-offset anchor-middle', CELL_X + k * CELL_PITCH + CELL_W / 2, INDEX_Y, String(k))}`,
    ),
    ...MATRICES.map(matrix),
    ...MATRICES.flatMap((m) => m.rows.flatMap((_, i) => rowLabels(m, i))),
    ...MATRICES.flatMap((m) => m.rows.map((_, i) => row(m, i))),
    ...PAIRS.map((_, call) => pair(call)),
    ...MATRICES.map(inFlight),
    ...FORMULAS.map(formula),
    `  <rect class="la-canvas stroke-1.5" x="${RIGHT_X}" y="${PANEL_TOP}" width="${RIGHT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    ...tableFrame(LOOP_TABLE, 'nested loop: one cosine call per pair'),
    ...loopTable(),
    ...loopCounts(),
    ...tableFrame(C_TABLE, 'one matrix multiply: C = A × Bᵀ'),
    ...productTable(),
    `  <text data-role="count" data-table="matmul" class="font-mono text-label font-semibold fill-ink anchor-end" x="${COUNT_X}" y="${C_TABLE.label}">calls: 1${shown([[MULTIPLY_FROM, LOOP]])}</text>`,
    `  <text class="font-sans text-offset fill-ink-muted" x="${CLOSEST_X}" y="${C_TABLE.header}">closest${shown([[CLOSEST_FROM, LOOP]])}</text>`,
    ...QUERIES.map(closest),
    `  <rect class="la-canvas" x="${LEFT_X}" y="${CAPTION_TOP}" width="${W - 2 * LEFT_X}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, "Sources: openjdk.org/jeps/537 (JEP 537: Vector API) and netflixtechblog.com (Optimizing recommendation systems with JDK's Vector API).")}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
