// Writes memory-units-ladder.svg through `just gen`. One story table, the rung each ladder lights
// and how many gap bars have grown, drives every timing: rungs, sizes, multipliers, and bars.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  complement,
  escapeXml,
  type Interval,
  keyTimes,
  show,
} from '@learning-animated/svg-kit/author';

const LOOP = 20;
const W = 960;

type Ladder = 'binary' | 'decimal';
// Level 0 is the byte both ladders stand on; levels 1 to 4 are kilo, mega, giga, and tera.
type Level = 0 | 1 | 2 | 3 | 4;
const PREFIXED: readonly Level[] = [1, 2, 3, 4];

// Steps 2, 3, and 4 start here.
const DECIMAL_FROM = 6;
const GAP_FROM = 11;
const TERA_FROM = 16;

// From each moment until the next one: the rung each ladder lights, and how many gap bars have grown.
const STORY: ReadonlyArray<
  readonly [from: number, binary: Level | null, decimal: Level | null, gaps: number]
> = [
  [0, null, null, 0],
  // Step 1: the binary ladder climbs from the byte to TiB.
  [0.5, 0, null, 0],
  [1.5, 1, null, 0],
  [2.5, 2, null, 0],
  [3.5, 3, null, 0],
  [4.5, 4, null, 0],
  // Step 2: the decimal ladder climbs beside it.
  [DECIMAL_FROM, null, 0, 0],
  [6.5, null, 1, 0],
  [7.5, null, 2, 0],
  [8.5, null, 3, 0],
  [9.5, null, 4, 0],
  // Step 3: the gap bars grow, kilo first.
  [GAP_FROM, null, null, 0],
  [11.5, null, null, 1],
  [12.5, null, null, 2],
  [13.5, null, null, 3],
  [14.5, null, null, 4],
  // Step 4: both tera rungs light together.
  [TERA_FROM, 4, 4, 4],
];
// How long a gap bar takes to grow to its full width.
const GROW = 0.4;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'Binary units climb by 1024, the power of two closest to 1000: 1 KiB is 1024 bytes, and 1 MiB is 1024 KiB.',
  ],
  [
    DECIMAL_FROM,
    'The decimal units beside them climb by 1000: 1 kB is 1000 bytes, and 1 MB is 1000 kB.',
  ],
  [
    GAP_FROM,
    '1024 is only 2.4% more than 1000, but the gap compounds at every rung, to about 10% at tera.',
  ],
  [TERA_FROM, 'So a disk sold as 1 TB holds a trillion bytes, which is about 0.91 TiB.'],
];

const TITLE = 'The 1024 ladder of memory units';
const NOTE =
  'Binary units climb by 1024 and decimal units by 1000, so the binary unit pulls further ahead at every rung.';
const DESC =
  'Two ladders of memory units stand on one byte. ' +
  'First the binary rungs light up from the bottom, KiB, MiB, GiB, and TiB, each 1024 times the rung below, ' +
  'and each shows its power of two and its exact byte count. ' +
  'Next the decimal rungs appear beside them, kB, MB, GB, and TB, each 1000 times the rung below. ' +
  'Then a bar beside each pair grows to show how much more the binary unit holds: ' +
  '2.4% at kilo, 4.9% at mega, 7.4% at giga, and 10.0% at tera. ' +
  'Last, the two tera rungs light up together, because a 1 TB disk holds only about 0.91 TiB.';
const FOOTER =
  'Source: NIST, Prefixes for binary multiples: the IEC names and symbols, beside the SI prefixes they derive from.';

type Unit = { readonly symbol: string; readonly name: string };
const BYTE: Unit = { symbol: 'B', name: 'byte (8 bits)' };
const UNITS: Readonly<Record<Ladder, readonly Unit[]>> = {
  binary: [
    BYTE,
    { symbol: 'KiB', name: 'kibibyte' },
    { symbol: 'MiB', name: 'mebibyte' },
    { symbol: 'GiB', name: 'gibibyte' },
    { symbol: 'TiB', name: 'tebibyte' },
  ],
  decimal: [
    BYTE,
    { symbol: 'kB', name: 'kilobyte' },
    { symbol: 'MB', name: 'megabyte' },
    { symbol: 'GB', name: 'gigabyte' },
    { symbol: 'TB', name: 'terabyte' },
  ],
};
// Each rung holds `factor` of the rung below, which is `base` raised to `exponent`.
const STEP: Readonly<
  Record<Ladder, { readonly factor: number; readonly base: number; readonly exponent: number }>
> = {
  binary: { factor: 1024, base: 2, exponent: 10 },
  decimal: { factor: 1000, base: 10, exponent: 3 },
};
const HEADER: Readonly<Record<Ladder, string>> = {
  binary: 'binary (IEC)',
  decimal: 'decimal (SI)',
};
const INK: Readonly<Record<Ladder, string>> = { binary: 'fill-amber', decimal: 'fill-sky' };
const LIT: Readonly<Record<Ladder, string>> = {
  binary: 'la-cell-new',
  decimal: 'fill-cell stroke-sky stroke-2.5',
};

const PANEL_LEFT = 24;
const PANEL_WIDTH = W - 2 * PANEL_LEFT;
const PANEL_TOP = 84;
const PANEL_HEIGHT = 342;
const PANEL_GAP = 16;
const TEXT_LEFT = 40;
const LABEL_DROP = 24;

const HEADER_Y = PANEL_TOP + 48;
// The tera rung sits at the top and the byte at the bottom.
const LADDER_TOP = HEADER_Y + 14;
const ROW_H = 44;
const ROW_PITCH = 54;
// Baselines inside a rung: the symbol and byte count, then the name and power below them.
const LINE_1 = 19;
const LINE_2 = 35;
const PAD = 14;

const LEFT: Readonly<Record<Ladder, number>> = { binary: 108, decimal: 364 };
const RUNG_W = 240;
const TIMES_X: Readonly<Record<Ladder, number>> = { binary: 72, decimal: 640 };
const GAP_LEFT = 684;
const TRACK_W = 180;
// Pixels per percentage point, so the bar at tera, about 10%, nearly fills its track.
const PX_PER_POINT = 18;
const GAP_LABEL_X = W - PANEL_LEFT - 16;

const CAPTION_TOP = PANEL_TOP + PANEL_HEIGHT + PANEL_GAP;
const CAPTION_HEIGHT = 36;
const CAPTION_Y = CAPTION_TOP + 23;
const FOOTER_Y = CAPTION_TOP + CAPTION_HEIGHT + 30;
const H = FOOTER_Y + 20;

type Segment = {
  readonly from: number;
  readonly to: number;
  readonly binary: Level | null;
  readonly decimal: Level | null;
  readonly gaps: number;
};

const SEGMENTS: readonly Segment[] = STORY.map(([from, binary, decimal, gaps], i) => ({
  from,
  to: STORY[i + 1]?.[0] ?? LOOP,
  binary,
  decimal,
  gaps,
}));

const bytesOf = (ladder: Ladder, level: Level): number => STEP[ladder].factor ** level;
const percentOf = (level: Level): number =>
  (bytesOf('binary', level) / bytesOf('decimal', level) - 1) * 100;
const round = (n: number): number => Math.round(n * 10) / 10;
const rowTop = (level: Level): number => LADDER_TOP + (4 - level) * ROW_PITCH;

function withCommas(n: number): string {
  const digits = String(n);
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return groups.join(',');
}

const litDuring = (ladder: Ladder, level: Level): Interval[] =>
  SEGMENTS.filter((s) => s[ladder] === level).map(({ from, to }) => [from, to]);

function reachOf(ladder: Ladder, level: Level): number {
  const reached = SEGMENTS.find((s) => s[ladder] === level);
  if (!reached) throw new Error(`the ${ladder} climb never reaches level ${level}`);
  return reached.from;
}

function growOf(level: Level): number {
  const grown = SEGMENTS.find((s) => s.gaps >= level);
  if (!grown) throw new Error(`the gap bar at level ${level} never grows`);
  return grown.from;
}

const within = (intervals: readonly Interval[], [from, to]: Interval): Interval[] =>
  intervals.flatMap(([start, end]): Interval[] => {
    const [s, e] = [Math.max(start, from), Math.min(end, to)];
    return s < e ? [[s, e]] : [];
  });

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;

const box = (left: number, top: number, width: number): string =>
  `x="${left}" y="${top}" width="${width}" height="${ROW_H}" rx="8"`;

const litRect = (ladder: Ladder, level: Level, left: number, width: number): string =>
  `<rect data-role="rung-lit" data-ladder="${ladder}" data-level="${level}" class="${LIT[ladder]}" ${box(left, rowTop(level), width)}>${show(litDuring(ladder, level), LOOP)}</rect>`;

const unitLabels = (unit: Unit, fill: string, left: number, top: number): string[] => [
  `    <text data-role="symbol" class="font-mono font-bold ${fill}" x="${left + PAD}" y="${top + LINE_1}" font-size="15">${escapeXml(unit.symbol)}</text>`,
  `    <text data-role="name" class="font-sans text-offset fill-ink-muted" x="${left + PAD}" y="${top + LINE_2}">${escapeXml(unit.name)}</text>`,
];

// The rung's byte count, and the power of its base that count is, both right-aligned in its column.
function values(ladder: Ladder, level: Level): string {
  const [right, top] = [LEFT[ladder] + RUNG_W - PAD, rowTop(level)];
  const { base, exponent } = STEP[ladder];
  return [
    `    <g data-role="values" data-ladder="${ladder}" data-level="${level}">`,
    `      ${show([[reachOf(ladder, level), LOOP]], LOOP)}`,
    `      <text data-role="count" class="font-mono text-label fill-ink anchor-end" x="${right}" y="${top + LINE_1}">${withCommas(bytesOf(ladder, level))}</text>`,
    `      <text data-role="power" class="font-mono text-offset fill-ink-muted anchor-end" x="${right}" y="${top + LINE_2}">${base}<tspan dy="-5" font-size="9">${exponent * level}</tspan></text>`,
    '    </g>',
  ].join('\n');
}

// One rung that both ladders share. It widens to stand under both once the decimal ladder appears.
function byteRung(): string {
  const [left, top] = [LEFT.binary, rowTop(0)];
  const both = LEFT.decimal + RUNG_W - left;
  const widen = `<animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes([0, DECIMAL_FROM], LOOP)}" values="${RUNG_W};${both}"/>`;
  return [
    '  <g data-role="rung" data-level="0">',
    `    <rect class="la-cell" ${box(left, top, both)}>${widen}</rect>`,
    `    ${litRect('binary', 0, left, RUNG_W)}`,
    `    ${litRect('decimal', 0, left, both)}`,
    ...unitLabels(BYTE, 'fill-ink', left, top),
    values('binary', 0),
    values('decimal', 0),
    '  </g>',
  ].join('\n');
}

function rung(ladder: Ladder, level: Level): string {
  const [left, top] = [LEFT[ladder], rowTop(level)];
  return [
    `  <g data-role="rung" data-ladder="${ladder}" data-level="${level}">`,
    ...(ladder === 'decimal' ? [`    ${show([[DECIMAL_FROM, LOOP]], LOOP)}`] : []),
    `    <rect class="la-cell" ${box(left, top, RUNG_W)}/>`,
    `    ${litRect(ladder, level, left, RUNG_W)}`,
    ...unitLabels(UNITS[ladder][level]!, INK[ladder], left, top),
    values(ladder, level),
    '  </g>',
  ].join('\n');
}

// The multiplier from the rung below up to this one: bold while this rung is lit, muted after.
function times(ladder: Ladder, level: Level): string {
  const on = litDuring(ladder, level);
  const off = within(complement(on, LOOP), [reachOf(ladder, level), LOOP]);
  const y = rowTop(level) + ROW_H + (ROW_PITCH - ROW_H) / 2 + 4;
  const label = (state: string, classes: string, during: readonly Interval[]): string =>
    `    <text data-state="${state}" class="font-mono text-offset ${classes} anchor-middle" x="${TIMES_X[ladder]}" y="${y}">× ${STEP[ladder].factor}${show(during, LOOP)}</text>`;
  return [
    `  <g data-role="times" data-ladder="${ladder}" data-level="${level}">`,
    label('muted', 'fill-ink-muted', off),
    label('lit', `font-bold ${INK[ladder]}`, on),
    '  </g>',
  ].join('\n');
}

// How much more the binary unit holds than the decimal one beside it, as a bar and a percentage.
function gap(level: Level): string {
  const middle = rowTop(level) + ROW_H / 2;
  const grow = growOf(level);
  const width = round(percentOf(level) * PX_PER_POINT);
  const bar = `x="${GAP_LEFT}" y="${middle - 6}" height="12" rx="3"`;
  return [
    `  <g data-role="gap" data-level="${level}">`,
    `    ${show([[GAP_FROM, LOOP]], LOOP)}`,
    `    <rect class="fill-stage stroke-grid" ${bar} width="${TRACK_W}"/>`,
    `    <rect data-role="gap-bar" class="fill-amber" ${bar} width="0">`,
    `      <animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" keyTimes="${keyTimes([0, grow, grow + GROW, LOOP], LOOP)}" values="0;0;${width};${width}"/>`,
    '    </rect>',
    `    <text data-role="gap-label" class="font-mono text-offset font-semibold fill-amber anchor-end" x="${GAP_LABEL_X}" y="${middle + 4}">+${percentOf(level).toFixed(1)}%${show([[grow, LOOP]], LOOP)}</text>`,
    '  </g>',
  ].join('\n');
}

function header(column: string, from: number, lines: readonly string[]): string {
  return [
    `  <g data-role="header" data-column="${column}">`,
    ...(from > 0 ? [`    ${show([[from, LOOP]], LOOP)}`] : []),
    ...lines.map((line) => `    ${line}`),
    '  </g>',
  ].join('\n');
}

const ladderHeader = (ladder: Ladder, from: number): string =>
  header(ladder, from, [
    text(
      `font-sans text-label font-semibold ${INK[ladder]}`,
      LEFT[ladder] + PAD,
      HEADER_Y,
      HEADER[ladder],
    ),
    text(
      'font-sans text-offset fill-ink-muted anchor-end',
      LEFT[ladder] + RUNG_W - PAD,
      HEADER_Y,
      'bytes',
    ),
  ]);

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="font-sans text-label fill-ink anchor-middle" x="${W / 2}" y="${CAPTION_Y}">${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
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
    `  ${text('la-note', 28, 64, NOTE)}`,
    `  <rect class="la-canvas stroke-1.5" x="${PANEL_LEFT}" y="${PANEL_TOP}" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_LEFT, PANEL_TOP + LABEL_DROP, 'two ladders from one byte')}`,
    ladderHeader('binary', 0),
    ladderHeader('decimal', DECIMAL_FROM),
    header('gap', GAP_FROM, [
      text(
        'font-sans text-label font-semibold fill-ink',
        GAP_LEFT,
        HEADER_Y,
        'binary over decimal',
      ),
    ]),
    byteRung(),
    ...PREFIXED.map((level) => rung('binary', level)),
    ...PREFIXED.map((level) => rung('decimal', level)),
    ...PREFIXED.map((level) => times('binary', level)),
    ...PREFIXED.map((level) => times('decimal', level)),
    ...PREFIXED.map((level) => gap(level)),
    `  <rect class="la-canvas" x="${PANEL_LEFT}" y="${CAPTION_TOP}" width="${PANEL_WIDTH}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, FOOTER)}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
