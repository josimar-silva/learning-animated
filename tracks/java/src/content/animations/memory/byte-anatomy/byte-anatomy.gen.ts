// Writes byte-anatomy.svg through `just gen`. One story table, the pattern the byte holds over
// time, drives every timing: the bits, the place values, the readout, and the number line.
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
// Drawn left to right, the way a byte is written: bit 7 first.
const BITS = [7, 6, 5, 4, 3, 2, 1, 0] as const;

// The pattern the byte holds from each moment until the next one.
const STORY: ReadonlyArray<readonly [from: number, bits: number]> = [
  [0, 0b0000_0000],
  // Step 1: each bit lights alone, from bit 0 to bit 7.
  [0.5, 0b0000_0001],
  [1.1, 0b0000_0010],
  [1.7, 0b0000_0100],
  [2.3, 0b0000_1000],
  [2.9, 0b0001_0000],
  [3.5, 0b0010_0000],
  [4.1, 0b0100_0000],
  [4.7, 0b1000_0000],
  // Step 3: bit 7 clears, then bits 6 to 0 join one at a time.
  [10, 0b0000_0000],
  [10.5, 0b0100_0000],
  [10.9, 0b0110_0000],
  [11.3, 0b0111_0000],
  [11.7, 0b0111_1000],
  [12.1, 0b0111_1100],
  [12.5, 0b0111_1110],
  [12.9, 0b0111_1111],
  // Step 4: the two ends of the range in turn.
  [17, 0b1000_0000],
];

// Step 2 starts here. Before it the readout shows the lit bit's place value; from here on it reads
// the eight bits as a Java byte.
const SIGNED_FROM = 6;
// Step 4 starts here, when the number line shows its two halves.
const RANGE_FROM = 14;
// How long the marker takes to slide to a new value.
const SLIDE = 0.15;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    "A byte is eight bits. Each bit's place value doubles, from 1 for bit 0 up to 128 for bit 7.",
  ],
  [
    SIGNED_FROM,
    "A Java byte is signed two's complement, so bit 7 counts as -128 instead of 128, and 1000_0000 reads as -128.",
  ],
  [
    10,
    'With bit 7 clear, the other seven bits add up to at most 64 + 32 + 16 + 8 + 4 + 2 + 1 = 127.',
  ],
  [
    RANGE_FROM,
    'So a byte holds 256 values, from -128 to 127. Java names the two ends Byte.MIN_VALUE and Byte.MAX_VALUE.',
  ],
];

const TITLE = 'Anatomy of a byte';
const DESC =
  'Eight bit cells sit in a row, bit 7 on the left and bit 0 on the right, under their place values 128 down to 1. ' +
  'First each bit lights up alone in turn, from bit 0 to bit 7, and a readout shows its place value. ' +
  'Then the label over bit 7 changes to -128, and the readout shows that a Java byte reads 1000_0000 as -128. ' +
  'Next bit 7 clears, and bits 6 to 0 light up one at a time while the value climbs from 0 to 127. ' +
  'Last, a number line shows the 256 byte values from -128 to 127: patterns with bit 7 set run from -128 to -1, ' +
  'and patterns with bit 7 clear run from 0 to 127. Its two ends are Byte.MIN_VALUE and Byte.MAX_VALUE.';

const PANEL_LEFT = 24;
const PANEL_WIDTH = W - 2 * PANEL_LEFT;
const TEXT_LEFT = 40;

const PANEL_GAP = 16;
const LABEL_DROP = 24;

const BYTE_TOP = 84;
const BYTE_HEIGHT = 176;
const PLACE_Y = BYTE_TOP + 66;
const CELL_TOP = BYTE_TOP + 80;
const CELL_W = 52;
const CELL_H = 56;
const CELL_PITCH = 62;
const FIRST_CELL = 140;
const DIGIT_Y = CELL_TOP + 36;
const VALUE_Y = CELL_TOP + 42;
const INDEX_Y = CELL_TOP + 76;
const EQUALS_X = 664;
const READOUT_X = 790;

const RANGE_TOP = BYTE_TOP + BYTE_HEIGHT + PANEL_GAP;
const RANGE_HEIGHT = 150;
const HALF_LABEL_Y = RANGE_TOP + 54;
const TICK_LABEL_Y = RANGE_TOP + 76;
const AXIS_Y = RANGE_TOP + 92;
const PATTERN_Y = RANGE_TOP + 114;
const CONSTANT_Y = RANGE_TOP + 132;
const AXIS_LEFT = 120;
const AXIS_RIGHT = 840;
// The labels for -1 and 0 sit this far either side of their ticks, which almost touch.
const SPLIT_GAP = 6;

const CAPTION_TOP = RANGE_TOP + RANGE_HEIGHT + PANEL_GAP;
const CAPTION_HEIGHT = 36;
const CAPTION_Y = CAPTION_TOP + 23;
const FOOTER_Y = CAPTION_TOP + CAPTION_HEIGHT + 30;
const H = FOOTER_Y + 20;

type Segment = { readonly from: number; readonly to: number; readonly bits: number };
type Tone = 'place' | 'negative' | 'non-negative';

const TONE_FILL: Readonly<Record<Tone, string>> = {
  place: 'fill-amber',
  negative: 'fill-pink',
  'non-negative': 'fill-sky',
};

const SEGMENTS: readonly Segment[] = STORY.map(([from, bits], i) => ({
  from,
  to: STORY[i + 1]?.[0] ?? LOOP,
  bits,
}));
// The same story from step 2 on, when the readout reads the bits as a Java byte.
const SIGNED: readonly Segment[] = SEGMENTS.filter(({ to }) => to > SIGNED_FROM).map((s) => ({
  ...s,
  from: Math.max(s.from, SIGNED_FROM),
}));

const isSet = (bits: number, bit: number): boolean => ((bits >> bit) & 1) === 1;
// Two's complement: bit 7 weighs -128 instead of 128, so a set bit 7 takes 256 off the plain sum.
const asByte = (bits: number): number => (isSet(bits, 7) ? bits - 256 : bits);
const toneOf = (value: number): Tone => (value < 0 ? 'negative' : 'non-negative');
const round = (n: number): number => Math.round(n * 10) / 10;
const xOf = (value: number): number =>
  round(AXIS_LEFT + ((value + 128) * (AXIS_RIGHT - AXIS_LEFT)) / 255);
const cellLeft = (bit: number): number => FIRST_CELL + (7 - bit) * CELL_PITCH;
const cellCenter = (bit: number): number => cellLeft(bit) + CELL_W / 2;
const grouped = (bits: number): string => {
  const digits = bits.toString(2).padStart(8, '0');
  return `${digits.slice(0, 4)}_${digits.slice(4)}`;
};

// Joins back-to-back intervals, so one stretch needs a single on and a single off.
function merged(intervals: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [start, end] of intervals) {
    const last = out[out.length - 1];
    if (last && last[1] === start) out[out.length - 1] = [last[0], end];
    else out.push([start, end]);
  }
  return out;
}

function clipped(intervals: readonly Interval[], [from, to]: Interval): Interval[] {
  return intervals.flatMap(([start, end]): Interval[] => {
    const [s, e] = [Math.max(start, from), Math.min(end, to)];
    return s < e ? [[s, e]] : [];
  });
}

const setDuring = (bit: number): Interval[] =>
  merged(SEGMENTS.filter(({ bits }) => isSet(bits, bit)).map(({ from, to }) => [from, to]));

type Reading = { readonly text: string; readonly tone: Tone; readonly during: Interval[] };

// What the readout shows, one entry per number and color, in the order they first appear.
function readings(): Reading[] {
  const found = new Map<string, Reading>();
  const add = (value: number, tone: Tone, during: Interval): void => {
    const key = `${tone} ${value}`;
    const reading = found.get(key) ?? { text: String(value), tone, during: [] };
    reading.during.push(during);
    found.set(key, reading);
  };
  for (const { from, to, bits } of SEGMENTS) {
    if (from >= SIGNED_FROM || bits === 0) continue;
    if ((bits & (bits - 1)) !== 0) throw new Error(`step 1 lights one bit at a time, not ${bits}`);
    add(bits, 'place', [from, Math.min(to, SIGNED_FROM)]);
  }
  for (const { from, to, bits } of SIGNED) add(asByte(bits), toneOf(asByte(bits)), [from, to]);
  return [...found.values()].map((r) => ({ ...r, during: merged(r.during) }));
}

const text = (classes: string, x: number, y: number, words: string, extra = ''): string =>
  `<text class="${classes}" x="${x}" y="${y}"${extra}>${escapeXml(words)}</text>`;

function placeValues(bit: number): string[] {
  const lit = setDuring(bit);
  // From step 2 on, bit 7 shows its weight in a Java byte, -128, instead of its place value.
  const span: Interval = bit === 7 ? [0, SIGNED_FROM] : [0, LOOP];
  const x = cellCenter(bit);
  const label = (role: string, classes: string, during: Interval[]): string =>
    `  <text data-role="${role}" data-bit="${bit}" class="${classes}" x="${x}" y="${PLACE_Y}">${2 ** bit}${show(during, LOOP)}</text>`;
  return [
    label(
      'place-value',
      'font-mono text-label fill-ink-muted anchor-middle',
      clipped(complement(lit, LOOP), span),
    ),
    label(
      'place-lit',
      'font-mono text-label font-bold fill-amber anchor-middle',
      clipped(lit, span),
    ),
  ];
}

function bitCell(bit: number): string {
  const [left, x] = [cellLeft(bit), cellCenter(bit)];
  const cell = `x="${left}" y="${CELL_TOP}" width="${CELL_W}" height="${CELL_H}" rx="6"`;
  return [
    `  <g data-role="bit" data-bit="${bit}">`,
    `    <rect class="la-cell" ${cell}/>`,
    `    ${text('font-mono font-semibold fill-ink-muted anchor-middle', x, DIGIT_Y, '0', ' font-size="22"')}`,
    `    <g data-role="bit-set" data-bit="${bit}">`,
    `      ${show(setDuring(bit), LOOP)}`,
    `      <rect class="la-cell-new" ${cell}/>`,
    `      ${text('font-mono font-bold fill-cell-ink anchor-middle', x, DIGIT_Y, '1', ' font-size="22"')}`,
    '    </g>',
    `    ${text('font-mono text-offset fill-ink-muted anchor-middle', x, INDEX_Y, String(bit))}`,
    '  </g>',
  ].join('\n');
}

function readout(): string {
  const label = (name: string, words: string, during: Interval): string =>
    `    <text data-role="reading" data-reading="${name}" class="la-note anchor-middle" x="${READOUT_X}" y="${PLACE_Y}">${escapeXml(words)}${show([during], LOOP)}</text>`;
  return [
    '  <g data-role="readout">',
    label('place-value', 'place value of the lit bit', [0, SIGNED_FROM]),
    label('java-byte', 'as a Java byte', [SIGNED_FROM, LOOP]),
    ...readings().map(
      ({ text: words, tone, during }) =>
        `    <text data-role="value" class="font-mono font-semibold ${TONE_FILL[tone]} anchor-middle" x="${READOUT_X}" y="${VALUE_Y}" font-size="34">${escapeXml(words)}${show(during, LOOP)}</text>`,
    ),
    '  </g>',
  ].join('\n');
}

function half(bit7: 0 | 1, from: number, to: number, words: string): string {
  const fill = TONE_FILL[toneOf(from)];
  const [left, right] = [xOf(from), xOf(to)];
  return [
    `  <g data-role="range-half" data-bit7="${bit7}">`,
    `    ${show([[RANGE_FROM, LOOP]], LOOP)}`,
    `    <rect class="${fill}" x="${left}" y="${AXIS_Y - 4}" width="${round(right - left)}" height="8" rx="4"/>`,
    `    ${text(`font-sans text-label font-semibold ${fill} anchor-middle`, round((left + right) / 2), HALF_LABEL_Y, words)}`,
    '  </g>',
  ].join('\n');
}

type Tick = {
  readonly value: number;
  readonly from: number;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly constant?: string;
};

function firstReaches(value: number): number {
  const reached = SIGNED.find(({ bits }) => asByte(bits) === value);
  if (!reached) throw new Error(`the story never reaches ${value}`);
  return reached.from;
}

// The two ends appear when the story first reaches them; the split at bit 7 appears in step 4.
const TICKS: readonly Tick[] = [
  { value: -128, from: firstReaches(-128), anchor: 'middle', constant: 'Byte.MIN_VALUE' },
  { value: -1, from: RANGE_FROM, anchor: 'end' },
  { value: 0, from: RANGE_FROM, anchor: 'start' },
  { value: 127, from: firstReaches(127), anchor: 'middle', constant: 'Byte.MAX_VALUE' },
];

function tick({ value, from, anchor, constant }: Tick): string {
  const x = xOf(value);
  const tone = toneOf(value);
  const labelX = anchor === 'end' ? x - SPLIT_GAP : anchor === 'start' ? x + SPLIT_GAP : x;
  const pattern = grouped(value & 0xff);
  return [
    `  <g data-role="tick" data-value="${value}">`,
    `    ${show([[from, LOOP]], LOOP)}`,
    `    <line class="stroke-${tone === 'negative' ? 'pink' : 'sky'} stroke-1.5" x1="${x}" y1="${AXIS_Y - 9}" x2="${x}" y2="${AXIS_Y + 9}"/>`,
    `    ${text(`font-mono text-label font-semibold ${TONE_FILL[tone]} anchor-${anchor}`, labelX, TICK_LABEL_Y, String(value))}`,
    `    <text data-role="pattern" class="font-mono text-offset fill-ink anchor-${anchor}" x="${labelX}" y="${PATTERN_Y}">${pattern}</text>`,
    ...(constant
      ? [
          `    <text data-role="constant" class="font-mono text-offset fill-ink-muted anchor-${anchor}" x="${labelX}" y="${CONSTANT_Y}">${constant}${show([[RANGE_FROM, LOOP]], LOOP)}</text>`,
        ]
      : []),
    '  </g>',
  ].join('\n');
}

// A dot on the number line at the value the readout shows, from step 2 on.
function marker(): string {
  const xs = SIGNED.map(({ bits }) => xOf(asByte(bits)));
  const times = [0];
  const values = [xs[0]!];
  SIGNED.forEach(({ from }, i) => {
    if (i === 0 || xs[i] === xs[i - 1]) return;
    times.push(from, from + SLIDE);
    values.push(xs[i - 1]!, xs[i]!);
  });
  times.push(LOOP);
  values.push(xs[xs.length - 1]!);
  return [
    `  <circle data-role="marker" class="fill-flow-strong stroke-stage stroke-2.5" cx="${xs[0]}" cy="${AXIS_Y}" r="6">`,
    `    ${show([[SIGNED_FROM, LOOP]], LOOP)}`,
    `    <animate attributeName="cx" dur="${LOOP}s" repeatCount="indefinite" keyTimes="${keyTimes(times, LOOP)}" values="${values.join(';')}"/>`,
    '  </circle>',
  ].join('\n');
}

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
    `  ${text('la-note', 28, 64, 'Each bit has a place value. A Java byte counts bit 7 as -128, so it holds -128 to 127.')}`,
    `  <rect class="la-canvas stroke-1.5" x="${PANEL_LEFT}" y="${BYTE_TOP}" width="${PANEL_WIDTH}" height="${BYTE_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_LEFT, BYTE_TOP + LABEL_DROP, 'one byte')}`,
    `  ${text('la-note', TEXT_LEFT, PLACE_Y, 'place value')}`,
    `  ${text('la-note', TEXT_LEFT, INDEX_Y, 'bit')}`,
    ...BITS.flatMap(placeValues),
    `  <text data-role="sign-weight" class="font-mono text-label font-bold fill-pink anchor-middle" x="${cellCenter(7)}" y="${PLACE_Y}">-128${show([[SIGNED_FROM, LOOP]], LOOP)}</text>`,
    ...BITS.map(bitCell),
    `  ${text('font-mono fill-ink-muted anchor-middle', EQUALS_X, DIGIT_Y, '=', ' font-size="24"')}`,
    readout(),
    `  <rect class="la-canvas stroke-1.5" x="${PANEL_LEFT}" y="${RANGE_TOP}" width="${PANEL_WIDTH}" height="${RANGE_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_LEFT, RANGE_TOP + LABEL_DROP, 'the range of a Java byte')}`,
    `  <line class="stroke-slate stroke-1.5" x1="${AXIS_LEFT}" y1="${AXIS_Y}" x2="${AXIS_RIGHT}" y2="${AXIS_Y}"/>`,
    half(1, -128, -1, 'bit 7 is 1: -128 to -1'),
    half(0, 0, 127, 'bit 7 is 0: 0 to 127'),
    ...TICKS.map(tick),
    marker(),
    `  <rect class="la-canvas" x="${PANEL_LEFT}" y="${CAPTION_TOP}" width="${PANEL_WIDTH}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, 'Sources: JLS (Java SE 25), 4.2 and 4.2.1 (integral types and values), and the Java SE 25 API for Byte.')}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
