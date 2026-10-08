// Writes embeddings-and-cosine.svg through `just gen`. The two arrays below drive every number on
// the stage, and the story constants drive every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, keyTimes, show } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const W = 960;
const H = 540;

// The two embeddings the lesson multiplies: the query q and the stored vector v1.
const Q = [-0.6, 0.3, 0.7, 0.9, -0.2, 0.6, 0.3, -0.1] as const;
const V1 = [-0.3, -0.2, 0.6, 0.5, 0.2, 0.5, 0.5, -0.4] as const;

// Step 1: the angle between the two arrows appears.
const THETA_FROM = 1;
// Step 2: pair i multiplies at PRODUCTS_FROM + i * PRODUCT_EVERY.
const PRODUCTS_FROM = 4.5;
const PRODUCT_EVERY = 0.5;
// Step 3: the lengths and the formula, then the worked cosine and v1's score.
const LENGTHS_FROM = 9;
const COSINE_FROM = 10;
// Step 4: two more stored vectors join, then the closest one is marked.
const CLOSEST_FROM = 17;
// How long a score bar takes to grow.
const GROW = 0.5;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'An embedding is an array of D doubles, here D = 8. Drawn as arrows from one origin, q and v1 meet at an angle θ.',
  ],
  [
    4,
    'The dot product q · v1 multiplies the two arrays element by element, then adds up the 8 products: 1.44.',
  ],
  [
    LENGTHS_FROM,
    'Divide the dot product by both lengths: 1.44 / (1.5 × 1.2) = 0.80, the cosine of θ, so θ is about 37°.',
  ],
  [
    14,
    'A smaller angle gives a higher score: v2 at 20° scores 0.94, v1 at 37° scores 0.80, and v3 at 70° scores 0.34.',
  ],
];

const TITLE = 'Embeddings and cosine similarity';
const DESC =
  'Two embeddings, q and v1, sit in rows of eight cells, one double per cell. ' +
  'Beside them, q and v1 are drawn as arrows from one origin, with the angle theta between them. ' +
  'Then the two doubles at each index multiply, one pair at a time, into a third row, ' +
  'and a running sum adds the eight products into the dot product, 1.44. ' +
  'Next the lengths of q and v1 appear, 1.5 and 1.2, and the dot product divided by both lengths gives 0.80, ' +
  'the cosine of theta, so theta is about 37 degrees. ' +
  'Last, two more stored vectors appear: v2, 20 degrees from q, scores 0.94, and v3, 70 degrees away, scores 0.34. ' +
  'The smallest angle gets the highest score.';

const D = Q.length;
const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const lengthOf = (a: readonly number[]): number => Math.sqrt(dot(a, a));
const radians = (deg: number): number => (deg * Math.PI) / 180;
const round = (n: number): number => Math.round(n * 100) / 100;

const DOT = dot(Q, V1);
const COSINE = DOT / (lengthOf(Q) * lengthOf(V1));
const turnOf = (i: number): number => PRODUCTS_FROM + i * PRODUCT_EVERY;

const PANEL_TOP = 84;
const PANEL_HEIGHT = 370;
const LEFT_X = 24;
const LEFT_WIDTH = 528;
const RIGHT_X = 568;
const RIGHT_WIDTH = W - LEFT_X - RIGHT_X;
const LABEL_Y = PANEL_TOP + 24;

// Left panel: the arrays, then the arithmetic under them.
const TEXT_X = LEFT_X + 16;
const INDEX_Y = 132;
const CELL_X = 140;
const CELL_W = 46;
const CELL_H = 32;
const CELL_PITCH = 50;
const ROW_TOP = { q: 142, v1: 184, product: 226 } as const;
const SUM_Y = 296;
const LENGTH_Y = { q: 328, v1: 354 } as const;
const FORMULA_Y = 398;
const COSINE_Y = 428;

// Right panel: every vector as an arrow from one origin, drawn at its angle from q.
const ORIGIN = { x: 662, y: 338 } as const;
const UNIT = 138;
const Q_DIRECTION = 25;
const HEAD = 10;
const SCORE_Y = 374;
const SCORE_PITCH = 28;
const NAME_X = RIGHT_X + 16;
const ANGLE_X = 650;
const TRACK_X = 662;
const TRACK_W = 180;
const VALUE_X = 852;

const CAPTION_TOP = 470;
const CAPTION_HEIGHT = 36;
const FOOTER_Y = 526;

type Stored = {
  readonly name: string;
  // The angle from q, and which side of q it is drawn on.
  readonly degrees: number;
  readonly side: 1 | -1;
  readonly length: number;
  readonly from: number;
  // Where the angle's arc runs, and the direction its label sits in.
  readonly arc: number;
  readonly labelAt: number;
};

const V1_DEGREES = (Math.acos(COSINE) * 180) / Math.PI;
const STORED: readonly Stored[] = [
  {
    name: 'v1',
    degrees: V1_DEGREES,
    side: 1,
    length: lengthOf(V1),
    from: COSINE_FROM,
    arc: 52,
    labelAt: V1_DEGREES / 2,
  },
  { name: 'v2', degrees: 20, side: -1, length: 0.9, from: 14.5, arc: 96, labelAt: 10 },
  // v3's arc crosses v1's arrow, so its label sits past v1, halfway to v3.
  {
    name: 'v3',
    degrees: 70,
    side: 1,
    length: 1.4,
    from: 15.5,
    arc: 78,
    labelAt: (V1_DEGREES + 70) / 2,
  },
];
const BY_ANGLE = [...STORED].sort((a, b) => a.degrees - b.degrees);

const directionOf = (s: Stored): number => Q_DIRECTION + s.side * s.degrees;
const polar = (deg: number, r: number): { x: number; y: number } => ({
  x: ORIGIN.x + r * Math.cos(radians(deg)),
  y: ORIGIN.y - r * Math.sin(radians(deg)),
});
const pointAt = (deg: number, r: number): { x: number; y: number } => {
  const { x, y } = polar(deg, r);
  return { x: round(x), y: round(y) };
};
const scoreOf = (s: Stored): number => Math.cos(radians(s.degrees));
const degreesLabel = (deg: number): string => `${Math.round(deg)}°`;

const text = (classes: string, x: number, y: number, words: string, extra = ''): string =>
  `<text class="${classes}" x="${x}" y="${y}"${extra}>${escapeXml(words)}</text>`;
const shown = (during: readonly Interval[]): string => show(during, LOOP);
// q and v1 keep their colors wherever a formula names them.
const Q_NAME = '<tspan class="fill-sky">q</tspan>';
const V1_NAME = '<tspan class="fill-pink">v1</tspan>';

function element(vector: 'q' | 'v1', i: number, value: number): string {
  const stroke = vector === 'q' ? 'stroke-sky' : 'stroke-pink';
  const x = CELL_X + i * CELL_PITCH;
  return [
    `  <g data-role="element" data-vector="${vector}" data-index="${i}">`,
    `    <rect class="fill-cell ${stroke} stroke-1.5" x="${x}" y="${ROW_TOP[vector]}" width="${CELL_W}" height="${CELL_H}" rx="6"/>`,
    `    ${text('font-mono text-label fill-cell-ink anchor-middle', x + CELL_W / 2, ROW_TOP[vector] + 21, value.toFixed(1))}`,
    '  </g>',
  ].join('\n');
}

function pair(i: number): string {
  const x = CELL_X + i * CELL_PITCH - 3;
  const ring = (top: number): string =>
    `    <rect class="fill-none stroke-amber stroke-2.5" x="${x}" y="${top - 3}" width="${CELL_W + 6}" height="${CELL_H + 6}" rx="8"/>`;
  return [
    `  <g data-role="pair" data-index="${i}">`,
    `    ${shown([[turnOf(i), turnOf(i) + PRODUCT_EVERY]])}`,
    ring(ROW_TOP.q),
    ring(ROW_TOP.v1),
    '  </g>',
  ].join('\n');
}

function product(i: number): string {
  const x = CELL_X + i * CELL_PITCH;
  const cell = `x="${x}" y="${ROW_TOP.product}" width="${CELL_W}" height="${CELL_H}" rx="6"`;
  const turn = turnOf(i);
  return [
    `  <rect class="la-cell-tail" ${cell}/>`,
    `  <g data-role="product" data-index="${i}">`,
    `    ${shown([[turn, LOOP]])}`,
    `    <rect class="la-cell" ${cell}/>`,
    `    <rect class="la-cell-new" ${cell}>${shown([[turn, turn + PRODUCT_EVERY]])}</rect>`,
    `    ${text('font-mono text-label fill-cell-ink anchor-middle', x + CELL_W / 2, ROW_TOP.product + 21, (Q[i]! * V1[i]!).toFixed(2))}`,
    '  </g>',
  ].join('\n');
}

// The running sum after each product, then the dot product itself.
function sums(): string[] {
  let sum = 0;
  return Q.map((x, i) => {
    sum += x * V1[i]!;
    const last = i === D - 1;
    const words = last ? `${Q_NAME} · ${V1_NAME} = ${sum.toFixed(2)}` : `sum = ${sum.toFixed(2)}`;
    const classes = last
      ? 'font-mono text-label font-semibold fill-ink'
      : 'font-mono text-label fill-amber';
    const until = last ? LOOP : turnOf(i + 1);
    return `  <text data-role="sum" class="${classes}" x="${TEXT_X}" y="${SUM_Y}">${words}${shown([[turnOf(i), until]])}</text>`;
  });
}

function lengthLine(vector: 'q' | 'v1', values: readonly number[]): string {
  const fill = vector === 'q' ? 'fill-sky' : 'fill-pink';
  const words = `|${vector}| = √(${vector} · ${vector}) = ${lengthOf(values).toFixed(1)}`;
  return `  <text data-role="length" data-vector="${vector}" class="font-mono text-label ${fill}" x="${TEXT_X}" y="${LENGTH_Y[vector]}">${escapeXml(words)}${shown([[LENGTHS_FROM, LOOP]])}</text>`;
}

function cosineLines(): string[] {
  const worked = `cos θ = ${DOT.toFixed(2)} / (${lengthOf(Q).toFixed(1)} × ${lengthOf(V1).toFixed(1)}) = `;
  return [
    `  <text data-role="formula" class="font-mono fill-ink" x="${TEXT_X}" y="${FORMULA_Y}" font-size="15">cos θ = (${Q_NAME} · ${V1_NAME}) / (|${Q_NAME}| × |${V1_NAME}|)${shown([[LENGTHS_FROM, LOOP]])}</text>`,
    `  <text data-role="cosine" class="font-mono fill-ink" x="${TEXT_X}" y="${COSINE_Y}" font-size="15">${escapeXml(worked)}<tspan class="font-bold fill-amber">${COSINE.toFixed(2)}</tspan>${shown([[COSINE_FROM, LOOP]])}</text>`,
  ];
}

function arrow(
  name: string,
  deg: number,
  length: number,
  color: 'sky' | 'pink',
  during?: Interval,
): string {
  const r = length * UNIT;
  const tip = pointAt(deg, r);
  const end = pointAt(deg, r - HEAD + 1);
  const base = polar(deg, r - HEAD);
  const [nx, ny] = [5 * Math.sin(radians(deg)), 5 * Math.cos(radians(deg))];
  const head = [
    tip,
    { x: round(base.x + nx), y: round(base.y + ny) },
    { x: round(base.x - nx), y: round(base.y - ny) },
  ]
    .map(({ x, y }) => `${x},${y}`)
    .join(' ');
  const label = pointAt(deg, r + 14);
  return [
    `  <g data-role="arrow" data-vector="${name}">`,
    ...(during ? [`    ${shown([during])}`] : []),
    `    <line class="stroke-${color} stroke-2.5" x1="${ORIGIN.x}" y1="${ORIGIN.y}" x2="${end.x}" y2="${end.y}" stroke-linecap="round"/>`,
    `    <polygon class="fill-${color}" points="${head}"/>`,
    `    ${text(`font-mono text-label font-bold fill-${color} anchor-middle halo`, label.x, round(label.y + 4), name)}`,
    '  </g>',
  ].join('\n');
}

function angle(s: Stored): string {
  const [from, to] = [Q_DIRECTION, directionOf(s)].sort((a, b) => a - b) as [number, number];
  const [start, end] = [pointAt(from, s.arc), pointAt(to, s.arc)];
  const spot = pointAt(Q_DIRECTION + s.side * s.labelAt, s.arc + 13);
  const label = (words: string, during?: Interval): string =>
    `    <text data-role="angle-label" data-vector="${s.name}" class="font-mono text-offset fill-amber anchor-middle halo" x="${spot.x}" y="${round(spot.y + 4)}">${escapeXml(words)}${during ? shown([during]) : ''}</text>`;
  // v1's angle is drawn from step 1 as θ, and reads in degrees once its cosine is known.
  const labels =
    s.name === 'v1'
      ? [label('θ', [0, COSINE_FROM]), label(degreesLabel(s.degrees), [COSINE_FROM, LOOP])]
      : [label(degreesLabel(s.degrees))];
  return [
    `  <g data-role="angle" data-vector="${s.name}">`,
    `    ${shown([[s.name === 'v1' ? THETA_FROM : s.from, LOOP]])}`,
    `    <path class="fill-none stroke-amber stroke-1.5" d="M ${start.x} ${start.y} A ${s.arc} ${s.arc} 0 0 0 ${end.x} ${end.y}"/>`,
    ...labels,
    '  </g>',
  ].join('\n');
}

function scoreRow(s: Stored, row: number): string {
  const y = SCORE_Y + row * SCORE_PITCH;
  const width = round(scoreOf(s) * TRACK_W);
  const grow = `<animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" keyTimes="${keyTimes([0, s.from, s.from + GROW, LOOP], LOOP)}" values="0;0;${width};${width}"/>`;
  return [
    `  <g data-role="score" data-vector="${s.name}">`,
    `    ${shown([[s.from, LOOP]])}`,
    `    ${text('font-mono text-label font-bold fill-pink', NAME_X, y, s.name)}`,
    `    <text data-role="score-angle" class="font-mono text-offset fill-amber anchor-end" x="${ANGLE_X}" y="${y}">${degreesLabel(s.degrees)}</text>`,
    `    <rect data-role="track" class="fill-grid" x="${TRACK_X}" y="${y - 9}" width="${TRACK_W}" height="10" rx="5"/>`,
    `    <rect data-role="bar" class="fill-pink" x="${TRACK_X}" y="${y - 9}" width="0" height="10" rx="5">${grow}</rect>`,
    `    <text data-role="score-value" class="font-mono text-label fill-ink" x="${VALUE_X}" y="${y}">${scoreOf(s).toFixed(2)}</text>`,
    '  </g>',
  ].join('\n');
}

// The rows list the stored vectors by angle, so the closest one is the first row.
function closest(): string {
  const best = BY_ANGLE[0]!;
  return `  <rect data-role="closest" data-vector="${best.name}" class="fill-none stroke-emerald stroke-1.5" x="${RIGHT_X + 8}" y="${SCORE_Y - 19}" width="${RIGHT_WIDTH - 16}" height="27" rx="8">${shown([[CLOSEST_FROM, LOOP]])}</rect>`;
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
    `  ${text('la-note', 28, 64, 'Cosine similarity scores two embeddings by the angle between them: their dot product over the product of their lengths.')}`,
    `  <rect class="la-canvas stroke-1.5" x="${LEFT_X}" y="${PANEL_TOP}" width="${LEFT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_X, LABEL_Y, 'two embeddings, D = 8 doubles each')}`,
    `  ${text('font-mono text-offset fill-ink-muted', TEXT_X, INDEX_Y, 'i')}`,
    ...Q.map(
      (_, i) =>
        `  ${text('la-offset anchor-middle', CELL_X + i * CELL_PITCH + CELL_W / 2, INDEX_Y, String(i))}`,
    ),
    `  ${text('font-mono text-label font-bold fill-sky', TEXT_X, ROW_TOP.q + 21, 'q')}`,
    `  ${text('font-mono text-label font-bold fill-pink', TEXT_X, ROW_TOP.v1 + 21, 'v1')}`,
    `  ${text('font-mono text-offset fill-amber', TEXT_X, ROW_TOP.product + 21, 'q[i] × v1[i]')}`,
    ...Q.map((value, i) => element('q', i, value)),
    ...V1.map((value, i) => element('v1', i, value)),
    ...Q.map((_, i) => product(i)),
    ...Q.map((_, i) => pair(i)),
    ...sums(),
    lengthLine('q', Q),
    lengthLine('v1', V1),
    ...cosineLines(),
    `  <rect class="la-canvas stroke-1.5" x="${RIGHT_X}" y="${PANEL_TOP}" width="${RIGHT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', RIGHT_X + 16, LABEL_Y, 'the angle from q to each stored vector')}`,
    ...STORED.map(angle),
    ...STORED.map((s) =>
      arrow(s.name, directionOf(s), s.length, 'pink', s.name === 'v1' ? undefined : [s.from, LOOP]),
    ),
    arrow('q', Q_DIRECTION, lengthOf(Q), 'sky'),
    `  <circle class="fill-ink-muted" cx="${ORIGIN.x}" cy="${ORIGIN.y}" r="3"/>`,
    ...BY_ANGLE.map((s, row) => scoreRow(s, row)),
    closest(),
    `  <rect class="la-canvas" x="${LEFT_X}" y="${CAPTION_TOP}" width="${W - 2 * LEFT_X}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, "Sources: openjdk.org/jeps/537 (JEP 537: Vector API) and netflixtechblog.com (Optimizing recommendation systems with JDK's Vector API).")}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
