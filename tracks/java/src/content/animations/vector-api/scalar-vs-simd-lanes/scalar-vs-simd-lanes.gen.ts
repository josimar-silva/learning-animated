// Writes scalar-vs-simd-lanes.svg through `just gen`. The two arrays below drive every number on
// the stage, and the story constants drive every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, show } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const W = 960;
const H = 540;

// The series' two embeddings: the query q and the stored vector v1.
const Q = [-0.6, 0.3, 0.7, 0.9, -0.2, 0.6, 0.3, -0.1] as const;
const V1 = [-0.3, -0.2, 0.6, 0.5, 0.2, 0.5, 0.5, -0.4] as const;
const D = Q.length;
// A 256-bit species holds four 64-bit doubles, so the vector loop takes D / LANES steps.
const BITS = 256;
const LANES = BITS / 64;
const VECTOR_STEPS = D / LANES;

// Both loops start at RACE_FROM and take one step every STEP seconds. The vector loop spends one
// more step on reduceLanes, then waits for the scalar loop.
const RACE_FROM = 2;
const STEP = 1.5;
// How long a cell glows while a step writes it.
const WRITE = 0.5;
const stepFrom = (step: number): number => RACE_FROM + step * STEP;
const REDUCE_FROM = stepFrom(VECTOR_STEPS);
const VECTOR_DONE = stepFrom(VECTOR_STEPS + 1);
const SCALAR_DONE = stepFrom(D);

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'Two loops compute the same dot product, q · v1 over 8 doubles: a scalar loop on the left, a Vector API loop on the right.',
  ],
  [
    RACE_FROM,
    'Per step, the scalar loop does one multiply-add. fma() does four, one in each lane of a 256-bit DoubleVector.',
  ],
  [
    REDUCE_FROM,
    'Two steps cover all 8 doubles. Then reduceLanes(ADD) adds the 4 lanes into one: 0.14 + 0.24 + 0.57 + 0.49 = 1.44.',
  ],
  // The scalar loop's step 4 runs from 6.5 s to 8 s.
  [
    7,
    'The vector loop is done. The scalar loop is only on step 4 of 8, adding one product at a time.',
  ],
  [
    SCALAR_DONE,
    'Same result, 1.44. The scalar loop took 8 steps; the vector loop took 2 fma() steps and one reduceLanes().',
  ],
];

const TITLE = 'Scalar vs SIMD lanes with fma()';
const DESC =
  'Two arrays of eight doubles, q and v1, sit in rows of cells on the left. ' +
  'A scalar loop walks them one index per step: each step multiplies one pair and adds the product ' +
  'to a single accumulator cell that starts at zero, so the dot product takes eight steps. ' +
  'On the right, a 256-bit DoubleVector has four lanes of 64-bit doubles. ' +
  'Each step loads four doubles of q into register a and four of v1 into register b, ' +
  'and fma() multiplies and adds all four lanes into a four-lane accumulator, also zero at first, ' +
  'so two steps cover the eight elements. ' +
  'Then reduceLanes adds the four lanes into one double, 1.44, and the vector loop is done ' +
  'while the scalar loop is still on step four. ' +
  'Both loops end with the same 1.44: eight steps against two steps and one reduction.';

const fixed = (n: number): string => n.toFixed(2);
const PRODUCTS = Q.map((x, i) => x * V1[i]!);
const DOT = PRODUCTS.reduce((sum, p) => sum + p, 0);
// The scalar accumulator: zero, then the running sum after each step.
const SCALAR_STATES: number[] = [0];
for (const product of PRODUCTS) SCALAR_STATES.push(SCALAR_STATES.at(-1)! + product);
// The vector accumulator's four lanes: zero, then after each fma() step.
const ACC_STATES: number[][] = [new Array<number>(LANES).fill(0)];
for (let step = 0; step < VECTOR_STEPS; step += 1) {
  ACC_STATES.push(ACC_STATES[step]!.map((sum, lane) => sum + PRODUCTS[step * LANES + lane]!));
}
const FINAL_LANES = ACC_STATES[VECTOR_STEPS]!;

const PANEL_TOP = 84;
const PANEL_HEIGHT = 370;
const LEFT_X = 24;
const LEFT_WIDTH = 528;
const RIGHT_X = 568;
const RIGHT_WIDTH = W - LEFT_X - RIGHT_X;
const LABEL_Y = PANEL_TOP + 24;

// Cells share one size and pitch on both sides, and the rows line up across the panels.
const INDEX_Y = 132;
const CELL_W = 46;
const CELL_H = 32;
const CELL_PITCH = 50;
const ROW_TOP = { q: 142, v1: 184, acc: 226 } as const;
const WIDTH_Y = 280;
const CODE_Y = 302;
const CODE_LEADING = 16;
const INDENT = 29;
const STATUS_Y = 428;

// Left panel: the arrays, the one accumulator cell, and the scalar loop.
const TEXT_X = LEFT_X + 16;
const CELL_X = 140;
const MADD_X = CELL_X + CELL_W + 14;

// Right panel: three 256-bit registers of four lanes each, and the vector loop.
const RIGHT_TEXT_X = RIGHT_X + 16;
const LANE_X = 640;
const CHUNK_X = LANE_X + (LANES - 1) * CELL_PITCH + CELL_W + 12;

const CAPTION_TOP = 470;
const CAPTION_HEIGHT = 36;
const FOOTER_Y = 526;

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const shown = (during: readonly Interval[]): string => show(during, LOOP);
// Each state lasts until the next one starts, and the last one until the loop ends.
const untilNext = (starts: readonly number[]): Interval[] =>
  starts.map((start, i) => [start, starts[i + 1] ?? LOOP]);
const steps = (count: number): number[] => Array.from({ length: count }, (_, i) => i);
const cellAt = (x: number, top: number): string =>
  `x="${x}" y="${top}" width="${CELL_W}" height="${CELL_H}" rx="6"`;
const ring = (x: number, top: number, cells: number): string =>
  `    <rect class="fill-none stroke-amber stroke-2.5" x="${x - 3}" y="${top - 3}" width="${(cells - 1) * CELL_PITCH + CELL_W + 6}" height="${CELL_H + 6}" rx="8"/>`;
const valueText = (
  attrs: string,
  x: number,
  top: number,
  words: string,
  during: Interval,
): string =>
  `  <text ${attrs} class="font-mono text-label fill-cell-ink anchor-middle" x="${x + CELL_W / 2}" y="${top + 21}">${escapeXml(words)}${shown([during])}</text>`;
// q and v1 keep their colors wherever a result names them.
const DOT_NAME = '<tspan class="fill-sky">q</tspan> · <tspan class="fill-pink">v1</tspan>';

function element(vector: 'q' | 'v1', i: number, value: number): string {
  const stroke = vector === 'q' ? 'stroke-sky' : 'stroke-pink';
  const x = CELL_X + i * CELL_PITCH;
  return [
    `  <g data-role="element" data-vector="${vector}" data-index="${i}">`,
    `    <rect class="fill-cell ${stroke} stroke-1.5" ${cellAt(x, ROW_TOP[vector])}/>`,
    `    ${text('font-mono text-label fill-cell-ink anchor-middle', x + CELL_W / 2, ROW_TOP[vector] + 21, value.toFixed(1))}`,
    '  </g>',
  ].join('\n');
}

// The scalar loop's step k rings q[k] and v1[k].
function pair(k: number): string {
  const x = CELL_X + k * CELL_PITCH;
  return [
    `  <g data-role="pair" data-index="${k}">`,
    `    ${shown([[stepFrom(k), stepFrom(k + 1)]])}`,
    ring(x, ROW_TOP.q, 1),
    ring(x, ROW_TOP.v1, 1),
    '  </g>',
  ].join('\n');
}

// One double: zero, then the running sum after each step.
function scalarAcc(): string[] {
  const cell = cellAt(CELL_X, ROW_TOP.acc);
  const starts = [0, ...steps(D).map(stepFrom)];
  return [
    `  <rect class="la-cell" ${cell}/>`,
    `  <rect class="la-cell-new" ${cell}>${shown(steps(D).map((k) => [stepFrom(k), stepFrom(k) + WRITE]))}</rect>`,
    ...untilNext(starts).map((during, i) =>
      valueText(
        'data-role="acc" data-side="scalar"',
        CELL_X,
        ROW_TOP.acc,
        fixed(SCALAR_STATES[i]!),
        during,
      ),
    ),
  ];
}

// Beside the accumulator, the multiply-add each step does.
function madds(): string[] {
  return Q.map((x, k) => {
    const words = `= ${fixed(SCALAR_STATES[k]!)} + ${x.toFixed(1)} × ${V1[k]!.toFixed(1)}`;
    return `  <text data-role="madd" data-index="${k}" class="font-mono text-label fill-amber" x="${MADD_X}" y="${ROW_TOP.acc + 21}">${escapeXml(words)}${shown([[stepFrom(k), stepFrom(k + 1)]])}</text>`;
  });
}

// Register a holds four doubles of q and register b four of v1, reloaded on every step.
function register(name: 'a' | 'b'): string[] {
  const [source, sourceName, color, top] =
    name === 'a'
      ? ([Q, 'q', 'sky', ROW_TOP.q] as const)
      : ([V1, 'v1', 'pink', ROW_TOP.v1] as const);
  const loads = untilNext(steps(VECTOR_STEPS).map(stepFrom));
  return [
    ...steps(LANES).flatMap((lane) => [
      `  <rect data-role="lane" data-register="${name}" data-lane="${lane}" class="fill-cell stroke-${color} stroke-1.5" ${cellAt(LANE_X + lane * CELL_PITCH, top)}/>`,
      ...loads.map((during, step) =>
        valueText(
          `data-role="lane-value" data-register="${name}" data-lane="${lane}"`,
          LANE_X + lane * CELL_PITCH,
          top,
          source[step * LANES + lane]!.toFixed(1),
          during,
        ),
      ),
    ]),
    ...loads.map((during, step) => {
      const k = step * LANES;
      return `  <text data-role="chunk" data-register="${name}" class="font-mono text-offset fill-${color}" x="${CHUNK_X}" y="${top + 20}">${sourceName}[${k}..${k + LANES - 1}]${shown([during])}</text>`;
    }),
  ];
}

// Four partial sums, one per lane: zero, then after each fma() step.
function vectorAcc(): string[] {
  const states = untilNext([0, ...steps(VECTOR_STEPS).map(stepFrom)]);
  const writes = steps(VECTOR_STEPS).map((step): Interval => [
    stepFrom(step),
    stepFrom(step) + WRITE,
  ]);
  return [
    ...steps(LANES).flatMap((lane) => {
      const cell = cellAt(LANE_X + lane * CELL_PITCH, ROW_TOP.acc);
      return [
        `  <rect data-role="lane" data-register="acc" data-lane="${lane}" class="la-cell" ${cell}/>`,
        `  <rect class="la-cell-new" ${cell}>${shown(writes)}</rect>`,
        ...states.map((during, i) =>
          valueText(
            `data-role="lane-value" data-register="acc" data-lane="${lane}"`,
            LANE_X + lane * CELL_PITCH,
            ROW_TOP.acc,
            fixed(ACC_STATES[i]![lane]!),
            during,
          ),
        ),
      ];
    }),
    `  <text class="font-mono text-offset fill-amber" x="${CHUNK_X}" y="${ROW_TOP.acc + 20}">+= a × b${shown([[RACE_FROM, REDUCE_FROM]])}</text>`,
  ];
}

// Each fma() step rings all four lanes of a and b at once.
function lanes(step: number): string {
  return [
    `  <g data-role="lanes" data-step="${step + 1}">`,
    `    ${shown([[stepFrom(step), stepFrom(step + 1)]])}`,
    ring(LANE_X, ROW_TOP.q, LANES),
    ring(LANE_X, ROW_TOP.v1, LANES),
    '  </g>',
  ].join('\n');
}

function reduce(): string {
  return [
    '  <g data-role="reduce">',
    `    ${shown([[REDUCE_FROM, VECTOR_DONE]])}`,
    ring(LANE_X, ROW_TOP.acc, LANES),
    '  </g>',
  ].join('\n');
}

// What a loop is doing: its step while it runs, then its result.
function status(
  side: 'scalar' | 'vector',
  x: number,
  running: readonly [Interval, string][],
): string[] {
  const [done, result] =
    side === 'scalar'
      ? [SCALAR_DONE, `after ${D} steps`]
      : [VECTOR_DONE, `after ${VECTOR_STEPS} steps + reduceLanes`];
  return [
    ...running.map(
      ([during, words]) =>
        `  <text data-role="status" data-side="${side}" class="font-mono text-label fill-amber" x="${x}" y="${STATUS_Y}">${escapeXml(words)}${shown([during])}</text>`,
    ),
    `  <text data-role="status" data-side="${side}" class="font-mono text-label font-semibold fill-ink" x="${x}" y="${STATUS_Y}">${DOT_NAME} = ${fixed(DOT)} ${escapeXml(result)}${shown([[done, LOOP]])}</text>`,
  ];
}

function code(
  x: number,
  lines: readonly (readonly [indent: number, classes: string, words: string])[],
): string[] {
  return lines.map(
    ([indent, classes, words], i) =>
      `  ${text(`font-mono text-offset ${classes}`, x + indent * INDENT, CODE_Y + i * CODE_LEADING, words)}`,
  );
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
    `  ${text('la-note', 28, 64, 'A scalar loop does one multiply-add per step. DoubleVector.fma() does one in each lane: 4 per step at 256 bits.')}`,

    `  <rect class="la-canvas stroke-1.5" x="${LEFT_X}" y="${PANEL_TOP}" width="${LEFT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_X, LABEL_Y, 'scalar loop: one multiply-add per step')}`,
    `  ${text('font-mono text-offset fill-ink-muted', TEXT_X, INDEX_Y, 'k')}`,
    ...Q.map(
      (_, i) =>
        `  ${text('la-offset anchor-middle', CELL_X + i * CELL_PITCH + CELL_W / 2, INDEX_Y, String(i))}`,
    ),
    `  ${text('font-mono text-label font-bold fill-sky', TEXT_X, ROW_TOP.q + 21, 'q')}`,
    `  ${text('font-mono text-label font-bold fill-pink', TEXT_X, ROW_TOP.v1 + 21, 'v1')}`,
    `  ${text('font-mono text-label font-bold fill-amber', TEXT_X, ROW_TOP.acc + 21, 'acc')}`,
    ...Q.map((value, i) => element('q', i, value)),
    ...V1.map((value, i) => element('v1', i, value)),
    ...scalarAcc(),
    ...madds(),
    ...Q.map((_, k) => pair(k)),
    `  ${text('font-mono text-offset fill-ink-muted', TEXT_X, WIDTH_Y, 'double acc: 1 × 64 bits')}`,
    ...code(TEXT_X, [
      [0, 'fill-ink', 'double acc = 0;'],
      [0, 'fill-ink-muted', `for (int k = 0; k < ${D}; k++)`],
      [1, 'fill-ink', 'acc += q[k] * v1[k];'],
    ]),
    ...status(
      'scalar',
      TEXT_X,
      steps(D).map((k) => [[stepFrom(k), stepFrom(k + 1)], `step ${k + 1} of ${D}`]),
    ),

    `  <rect class="la-canvas stroke-1.5" x="${RIGHT_X}" y="${PANEL_TOP}" width="${RIGHT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', RIGHT_TEXT_X, LABEL_Y, 'Vector API loop: four lanes per step')}`,
    `  ${text('font-mono text-offset fill-ink-muted', RIGHT_TEXT_X, INDEX_Y, 'lane')}`,
    ...steps(LANES).map(
      (lane) =>
        `  ${text('la-offset anchor-middle', LANE_X + lane * CELL_PITCH + CELL_W / 2, INDEX_Y, String(lane))}`,
    ),
    `  ${text('font-mono text-label font-bold fill-sky', RIGHT_TEXT_X, ROW_TOP.q + 21, 'a')}`,
    `  ${text('font-mono text-label font-bold fill-pink', RIGHT_TEXT_X, ROW_TOP.v1 + 21, 'b')}`,
    `  ${text('font-mono text-label font-bold fill-amber', RIGHT_TEXT_X, ROW_TOP.acc + 21, 'acc')}`,
    ...register('a'),
    ...register('b'),
    ...vectorAcc(),
    ...steps(VECTOR_STEPS).map(lanes),
    reduce(),
    `  <text data-role="species" class="font-mono text-offset fill-ink-muted" x="${RIGHT_TEXT_X}" y="${WIDTH_Y}">S = DoubleVector.SPECIES_${BITS}: ${LANES} × 64 bits</text>`,
    ...code(RIGHT_TEXT_X, [
      [0, 'fill-ink', 'var acc = DoubleVector.zero(S);'],
      [0, 'fill-ink-muted', `for (int k = 0; k < ${D}; k += S.length()) {`],
      [1, 'fill-ink', 'var a = DoubleVector.fromArray(S, q, k);'],
      [1, 'fill-ink', 'var b = DoubleVector.fromArray(S, v1, k);'],
      [1, 'fill-ink', 'acc = a.fma(b, acc);'],
      [0, 'fill-ink-muted', '}'],
      [0, 'fill-ink', 'double dot = acc.reduceLanes(ADD);'],
    ]),
    ...status('vector', RIGHT_TEXT_X, [
      ...steps(VECTOR_STEPS).map((step): [Interval, string] => [
        [stepFrom(step), stepFrom(step + 1)],
        `step ${step + 1} of ${VECTOR_STEPS}`,
      ]),
      [[REDUCE_FROM, VECTOR_DONE], `${FINAL_LANES.map(fixed).join(' + ')} = ${fixed(DOT)}`],
    ]),

    `  <rect class="la-canvas" x="${LEFT_X}" y="${CAPTION_TOP}" width="${W - 2 * LEFT_X}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, "Sources: openjdk.org/jeps/537 (JEP 537: Vector API) and netflixtechblog.com (Optimizing recommendation systems with JDK's Vector API).")}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
