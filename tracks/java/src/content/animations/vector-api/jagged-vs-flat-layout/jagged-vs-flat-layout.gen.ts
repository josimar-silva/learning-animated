// Writes jagged-vs-flat-layout.svg through `just gen`. The two heap tables place every object,
// and the story constants drive every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, keyTimes, show } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const W = 960;
const H = 540;
const D = 8;
const ROWS = ['v1', 'v2', 'v3'] as const;
const FLAT = ROWS.length * D;

// Step 2: the jagged read spends ROW_EVERY seconds a row: HOP on the reference while its pointer
// lights up, then READ on each double.
const JAGGED_FROM = 3;
const ROW_EVERY = 2;
const HOP = 0.4;
const READ = 0.2;
const JAGGED_DONE = JAGGED_FROM + ROWS.length * ROW_EVERY;
// Step 3: the flat array fills one row every FILL_EVERY seconds.
const FILL_FROM = 10;
const FILL_EVERY = 0.5;
const FLASH = 0.5;
// Step 4: the flat array is read in one sweep, READ seconds a double.
const SWEEP_FROM = 13;
const SWEEP_DONE = SWEEP_FROM + FLAT * READ;
const FLAT_SUMMARY_FROM = 18;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'A double[][] is an array of references. Each row, v1 to v3, is its own array of 8 doubles, somewhere on the heap.',
  ],
  [
    JAGGED_FROM,
    'Reading the rows chases pointers: load stored[j], jump to its row, read 8 doubles, then jump back for the next one.',
  ],
  [
    FILL_FROM,
    'A flat double[] keeps v1, v2, and v3 back to back in one array, so row j starts at index j × 8.',
  ],
  [
    SWEEP_FROM,
    'Reading it is one sweep from index 0 to 23: every read is at the next address, so the CPU can fetch ahead.',
  ],
];

const TITLE = 'Jagged vs flat memory layout';
const DESC =
  'Two panels draw the heap in address order and store the same three rows of eight doubles, v1 to v3, in two ways. ' +
  'On the left, a double[][] named stored holds three references, and dashed pointers lead from them to the three rows, ' +
  'which sit apart among other objects. ' +
  'A ring reads the rows in order: it loads a reference while its pointer lights up, jumps to that row, reads its eight doubles, ' +
  'and jumps back for the next reference, which makes 3 reference loads and 5 jumps. ' +
  'On the right, a flat double[] of 24 slots fills with v1, v2, and v3 back to back, starting at indexes 0, 8, and 16. ' +
  'A ring then reads it in one sweep from index 0 to 23, with no jumps.';

type Vector = (typeof ROWS)[number];
type HeapObject = readonly [
  address: number,
  size: number,
  kind: 'other' | 'refs' | 'flat' | Vector,
];

// One slot holds 8 bytes, and each heap is drawn in address order, line by line. The rows land
// in a different order than stored lists them, with other objects between them.
const JAGGED_HEAP: readonly HeapObject[] = [
  [0, 4, 'other'],
  [4, 5, 'other'],
  [9, 3, 'other'],
  [12, 3, 'refs'],
  [15, 7, 'other'],
  [22, 6, 'other'],
  [28, 4, 'other'],
  [32, 5, 'other'],
  [37, 6, 'other'],
  [43, 4, 'other'],
  [47, 7, 'other'],
  [54, 8, 'v3'],
  [62, 2, 'other'],
  [64, 1, 'other'],
  [65, 8, 'v1'],
  [73, 5, 'other'],
  [78, 8, 'v2'],
  [86, 6, 'other'],
  [92, 4, 'other'],
];
const FLAT_HEAP: readonly HeapObject[] = [
  [0, 4, 'other'],
  [4, 6, 'other'],
  [10, 3, 'other'],
  [13, 7, 'other'],
  [20, 4, 'other'],
  [24, FLAT, 'flat'],
  [48, 5, 'other'],
  [53, 8, 'other'],
  [61, 4, 'other'],
  [65, 7, 'other'],
];

const PANEL_TOP = 84;
const PANEL_HEIGHT = 370;
const LEFT_X = 24;
const LEFT_WIDTH = 528;
const RIGHT_X = 568;
const RIGHT_WIDTH = W - LEFT_X - RIGHT_X;
const LABEL_Y = PANEL_TOP + 24;
const CODE_Y = 132;
const ACCESS_Y = 352;
const NOTE_Y = 374;
const SUMMARY_Y = 410;

const SLOT = 14;
const CELL_W = 12;
const CELL_H = 22;
const LINE_PITCH = 56;
const LINES = 3;
const PAD = 8;
const HEAP_TOP = 146;
const FIRST_LINE = 172;
const HEAP_HEIGHT = FIRST_LINE - HEAP_TOP + (LINES - 1) * LINE_PITCH + CELL_H + 12;
const RING = 3;
const HEAD = 7;

const CAPTION_TOP = 470;
const CAPTION_HEIGHT = 36;
const FOOTER_Y = 526;

type Heap = {
  readonly layout: 'jagged' | 'flat';
  readonly x: number;
  readonly width: number;
  readonly perLine: number;
};
const heapIn = (
  layout: Heap['layout'],
  panelX: number,
  panelWidth: number,
  perLine: number,
): Heap => {
  const width = perLine * SLOT - (SLOT - CELL_W) + 2 * PAD;
  return { layout, x: panelX + (panelWidth - width) / 2, width, perLine };
};
const JAGGED = heapIn('jagged', LEFT_X, LEFT_WIDTH, 32);
const FLAT_SIDE = heapIn('flat', RIGHT_X, RIGHT_WIDTH, FLAT);

const range = (n: number): number[] => [...Array(n).keys()];
const round = (n: number): number => Math.round(n * 100) / 100;
const widthOf = (size: number): number => size * SLOT - (SLOT - CELL_W);
const slotOf = (heap: Heap, address: number): { x: number; y: number } => ({
  x: heap.x + PAD + (address % heap.perLine) * SLOT,
  y: FIRST_LINE + Math.floor(address / heap.perLine) * LINE_PITCH,
});
const addressOf = (kind: HeapObject[2], heap: readonly HeapObject[]): number => {
  const found = heap.find(([, , k]) => k === kind);
  if (!found) throw new Error(`no ${kind} on the heap`);
  return found[0];
};
const REFS = addressOf('refs', JAGGED_HEAP);
const FLAT_START = addressOf('flat', FLAT_HEAP);
// A jump is a read that does not land on the address right after the previous read.
const jumpsIn = (addresses: readonly number[]): number =>
  addresses.slice(1).filter((address, i) => address !== addresses[i]! + 1).length;

type Visit = readonly [at: number, address: number];
const JAGGED_VISITS: readonly Visit[] = ROWS.flatMap((vector, j) => {
  const from = JAGGED_FROM + j * ROW_EVERY;
  const row = addressOf(vector, JAGGED_HEAP);
  return [
    [from, REFS + j] as const,
    ...range(D).map((k) => [from + HOP + k * READ, row + k] as const),
  ];
});
const FLAT_VISITS: readonly Visit[] = range(FLAT).map(
  (i) => [SWEEP_FROM + i * READ, FLAT_START + i] as const,
);

const text = (classes: string, x: number, y: number, words: string, extra = ''): string =>
  `<text class="${classes}" x="${x}" y="${y}"${extra}>${escapeXml(words)}</text>`;
const shown = (during: readonly Interval[]): string => show(during, LOOP);
const cell = (classes: string, x: number, y: number, hooks = ''): string =>
  `<rect${hooks} class="${classes}" x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="3"/>`;

function frame(heap: Heap): string[] {
  return [
    `    <rect class="fill-stage stroke-grid" x="${heap.x}" y="${HEAP_TOP}" width="${heap.width}" height="${HEAP_HEIGHT}" rx="8"/>`,
    `    ${text('font-sans text-offset fill-ink-muted anchor-end', heap.x + heap.width - PAD, FIRST_LINE - 6, 'heap, in address order')}`,
  ];
}

function other(heap: Heap, [address, size]: HeapObject): string {
  const { x, y } = slotOf(heap, address);
  return `    <rect data-role="other" data-address="${address}" data-size="${size}" class="fill-grid" x="${x}" y="${y}" width="${widthOf(size)}" height="${CELL_H}" rx="3"/>`;
}

function label(classes: string, heap: Heap, [address, size]: HeapObject, words: string): string {
  const { x, y } = slotOf(heap, address);
  return `    ${text(`${classes} anchor-middle`, x + widthOf(size) / 2, y - 6, words)}`;
}

function refs(object: HeapObject): string[] {
  const [address, size] = object;
  return [
    `    <g data-role="refs" data-address="${address}" data-size="${size}">`,
    ...range(size).flatMap((j) => {
      const { x, y } = slotOf(JAGGED, address + j);
      return [
        `      ${cell('la-cell', x, y, ` data-role="ref" data-index="${j}" data-address="${address + j}"`)}`,
        `      <circle class="fill-ink" cx="${x + CELL_W / 2}" cy="${y + CELL_H / 2}" r="2.5"/>`,
      ];
    }),
    '    </g>',
    label('font-mono text-offset fill-ink', JAGGED, object, 'stored'),
  ];
}

function row(object: HeapObject): string[] {
  const [address, size, vector] = object;
  return [
    `    <g data-role="row" data-vector="${vector}" data-address="${address}" data-size="${size}">`,
    ...range(size).map((k) => {
      const { x, y } = slotOf(JAGGED, address + k);
      const hooks = ` data-role="element" data-layout="jagged" data-vector="${vector}" data-index="${k}" data-address="${address + k}"`;
      return `      ${cell('fill-cell stroke-pink stroke-1.5', x, y, hooks)}`;
    }),
    '    </g>',
    label('font-mono text-offset font-bold fill-pink', JAGGED, object, vector),
  ];
}

// A pointer leaves the dot in stored[j] and ends in an arrowhead on the first double of its row.
function pointerShape(j: number): { d: string; head: string } {
  const ref = slotOf(JAGGED, REFS + j);
  const target = slotOf(JAGGED, addressOf(ROWS[j]!, JAGGED_HEAP));
  const [x0, y0] = [ref.x + CELL_W / 2, ref.y + CELL_H / 2];
  const [x3, y3] = [target.x + CELL_W / 2, target.y - HEAD];
  const bend = round((y3 - y0) * 0.6);
  return {
    d: `M ${x0} ${y0} C ${x0} ${round(y0 + bend)} ${x3} ${round(y3 - bend)} ${x3} ${y3}`,
    head: `${x3},${target.y} ${x3 - 4},${y3} ${x3 + 4},${y3}`,
  };
}

function pointer(j: number): string {
  const { d, head } = pointerShape(j);
  return [
    `    <g data-role="pointer" data-index="${j}" data-vector="${ROWS[j]}">`,
    `      <path class="la-arrow" d="${d}" stroke-dasharray="4 3"/>`,
    `      <polygon class="fill-flow" points="${head}"/>`,
    '    </g>',
  ].join('\n');
}

function hop(j: number): string {
  const { d, head } = pointerShape(j);
  const from = JAGGED_FROM + j * ROW_EVERY;
  return [
    `    <g data-role="hop" data-index="${j}">`,
    `      ${shown([[from, from + HOP]])}`,
    `      <path class="fill-none stroke-amber stroke-2.5" d="${d}" stroke-linecap="round"/>`,
    `      <polygon class="fill-amber" points="${head}"/>`,
    '    </g>',
  ].join('\n');
}

function flatArray(object: HeapObject): string[] {
  const [address, size] = object;
  const filledAt = (i: number): number => FILL_FROM + Math.floor(i / D) * FILL_EVERY;
  return [
    `    <g data-role="flat" data-address="${address}" data-size="${size}">`,
    ...range(size).map((i) => {
      const { x, y } = slotOf(FLAT_SIDE, address + i);
      return `      ${cell('la-cell-tail', x, y)}`;
    }),
    ...range(size).flatMap((i) => {
      const { x, y } = slotOf(FLAT_SIDE, address + i);
      const filled = filledAt(i);
      return [
        `      <g data-role="element" data-layout="flat" data-vector="${ROWS[Math.floor(i / D)]}" data-index="${i}" data-address="${address + i}">`,
        `        ${shown([[filled, LOOP]])}`,
        `        ${cell('fill-cell stroke-pink stroke-1.5', x, y)}`,
        `        <rect class="la-cell-new" x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="3">${shown([[filled, filled + FLASH]])}</rect>`,
        '      </g>',
      ];
    }),
    '    </g>',
    ...ROWS.flatMap((vector, j) => {
      const first = slotOf(FLAT_SIDE, address + j * D);
      const filled = filledAt(j * D);
      const middle = first.x + widthOf(D) / 2;
      return [
        `    <text class="font-mono text-offset font-bold fill-pink anchor-middle" x="${middle}" y="${first.y - 6}">${vector}${shown([[filled, LOOP]])}</text>`,
        `    <text data-role="row-start" data-vector="${vector}" class="la-offset anchor-middle" x="${first.x + CELL_W / 2}" y="${first.y + CELL_H + 14}">${j * D}${shown([[filled, LOOP]])}</text>`,
      ];
    }),
  ];
}

// One ring per heap marks the slot being read, hopping between slots on a discrete beat.
function cursor(heap: Heap, visits: readonly Visit[], during: Interval): string {
  const beats: readonly Visit[] = visits[0]![0] > 0 ? [[0, visits[0]![1]], ...visits] : visits;
  const times = keyTimes(
    beats.map(([at]) => at),
    LOOP,
  );
  const xs = beats.map(([, address]) => slotOf(heap, address).x - RING);
  const ys = beats.map(([, address]) => slotOf(heap, address).y - RING);
  const discrete = (name: string, values: readonly number[]): string =>
    `<animate attributeName="${name}" dur="${LOOP}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${times}" values="${values.join(';')}"/>`;
  const moves = new Set(ys).size > 1 ? [discrete('x', xs), discrete('y', ys)] : [discrete('x', xs)];
  return [
    `    <rect data-role="cursor" data-layout="${heap.layout}" class="fill-none stroke-amber stroke-2.5" x="${xs[0]}" y="${ys[0]}" width="${CELL_W + 2 * RING}" height="${CELL_H + 2 * RING}" rx="4">`,
    `      ${shown([during])}`,
    ...moves.map((move) => `      ${move}`),
    '    </rect>',
  ].join('\n');
}

function summary(
  layout: Heap['layout'],
  x: number,
  references: number,
  visits: readonly Visit[],
  from: number,
): string {
  const addresses = visits.map(([, address]) => address);
  const words = `${references} reference loads, ${visits.length - references} double loads, ${jumpsIn(addresses)} jumps`;
  return `  <text data-role="summary" data-layout="${layout}" class="font-mono text-offset font-semibold fill-ink" x="${x}" y="${SUMMARY_Y}">${escapeXml(words)}${shown([[from, LOOP]])}</text>`;
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="font-sans text-label fill-ink anchor-middle" x="${W / 2}" y="${CAPTION_TOP + 23}">${escapeXml(words)}${shown([[at, next]])}</text>`;
}

function jaggedPanel(): string[] {
  const x = LEFT_X + 16;
  const vector = (name: string): string => `<tspan class="fill-pink">${name}</tspan>`;
  return [
    `  <rect class="la-canvas stroke-1.5" x="${LEFT_X}" y="${PANEL_TOP}" width="${LEFT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', x, LABEL_Y, 'double[][]: a reference per row, each row its own object')}`,
    `  <text class="font-mono text-label fill-ink" x="${x}" y="${CODE_Y}">double[][] stored = { ${ROWS.map(vector).join(', ')} };</text>`,
    `  <g data-role="heap" data-layout="jagged">`,
    ...frame(JAGGED),
    ...JAGGED_HEAP.filter(([, , kind]) => kind === 'other').map((object) => other(JAGGED, object)),
    ...JAGGED_HEAP.filter(([, , kind]) => kind === 'refs').flatMap(refs),
    ...JAGGED_HEAP.filter(([, , kind]) => ROWS.some((v) => v === kind)).flatMap(row),
    ...ROWS.map((_, j) => pointer(j)),
    ...ROWS.map((_, j) => hop(j)),
    cursor(JAGGED, JAGGED_VISITS, [JAGGED_FROM, JAGGED_DONE]),
    '  </g>',
    `  ${text('font-mono text-label fill-ink', x, ACCESS_Y, 'double value = stored[j][k];')}`,
    `  ${text('la-note', x, NOTE_Y, 'Two loads: the reference stored[j], then element k of its row.')}`,
    summary('jagged', x, ROWS.length, JAGGED_VISITS, JAGGED_DONE),
  ];
}

function flatPanel(): string[] {
  const x = RIGHT_X + 16;
  return [
    `  <rect class="la-canvas stroke-1.5" x="${RIGHT_X}" y="${PANEL_TOP}" width="${RIGHT_WIDTH}" height="${PANEL_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', x, LABEL_Y, 'double[]: all the rows in one array')}`,
    `  ${text('font-mono text-label fill-ink', x, CODE_Y, `double[] flat = new double[${ROWS.length} * ${D}];`)}`,
    `  <g data-role="heap" data-layout="flat">`,
    ...frame(FLAT_SIDE),
    ...FLAT_HEAP.filter(([, , kind]) => kind === 'other').map((object) => other(FLAT_SIDE, object)),
    ...FLAT_HEAP.filter(([, , kind]) => kind === 'flat').flatMap(flatArray),
    cursor(FLAT_SIDE, FLAT_VISITS, [SWEEP_FROM, SWEEP_DONE]),
    '  </g>',
    `  ${text('font-mono text-label fill-ink', x, ACCESS_Y, `double value = flat[j * ${D} + k];`)}`,
    `  ${text('la-note', x, NOTE_Y, `One load, at index j × ${D} + k.`)}`,
    summary('flat', x, 0, FLAT_VISITS, FLAT_SUMMARY_FROM),
  ];
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
    `  ${text('la-note', 28, 64, 'A double[][] keeps every row as a separate object on the heap. A flat double[] keeps all the rows in one contiguous array.')}`,
    ...jaggedPanel(),
    ...flatPanel(),
    `  <rect class="la-canvas" x="${LEFT_X}" y="${CAPTION_TOP}" width="${W - 2 * LEFT_X}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, "Sources: openjdk.org/jeps/537 (JEP 537: Vector API) and netflixtechblog.com (Optimizing recommendation systems with JDK's Vector API).")}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
