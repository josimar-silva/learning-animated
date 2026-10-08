// Writes sealed-hierarchy.svg through `just gen`. One story table, when each record joins the
// permits clause and when its case joins the switch, drives the hierarchy, the switch, and what
// javac answers each time it checks one against the other.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, show } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const W = 960;
const STEP_2 = 5;
const STEP_3 = 10;
const STEP_4 = 15;

type Subtype = {
  readonly name: string;
  readonly fields: string;
  readonly variable: string;
  readonly result: string;
  // One color per record, the same in the permits clause, the hierarchy, and its case.
  readonly tone: 'sky' | 'pink' | 'amber';
  readonly permitted: number;
  readonly handled: number;
};

const SUBTYPES: readonly Subtype[] = [
  {
    name: 'Decoded',
    fields: 'BoardingPass pass',
    variable: 'd',
    result: '"seat " + d.pass().seat();',
    tone: 'sky',
    permitted: 0,
    handled: 0,
  },
  {
    name: 'Rejected',
    fields: 'String reason',
    variable: 'r',
    result: '"rejected: " + r.reason();',
    tone: 'pink',
    permitted: 0,
    handled: 0,
  },
  {
    name: 'Expired',
    fields: 'BoardingPass pass',
    variable: 'e',
    result: '"expired: " + e.pass().flight();',
    tone: 'amber',
    permitted: STEP_3,
    handled: STEP_4,
  },
];

// Each time javac checks the switch against the permits clause: when it starts, when it answers,
// and until when its answer stays up.
const RUNS: ReadonlyArray<{
  readonly from: number;
  readonly answers: number;
  readonly until: number;
}> = [
  { from: STEP_2, answers: 8, until: STEP_3 },
  { from: STEP_3, answers: 12, until: STEP_4 },
  { from: STEP_4, answers: 17, until: LOOP },
];

// What javac marks on each record as it checks: covered once it finds the case, missing while
// the switch has none.
const MARKS: ReadonlyArray<{
  readonly type: string;
  readonly mark: 'covered' | 'missing';
  readonly during: Interval;
}> = [
  { type: 'Decoded', mark: 'covered', during: [6, LOOP] },
  { type: 'Rejected', mark: 'covered', during: [7, LOOP] },
  { type: 'Expired', mark: 'missing', during: [11, STEP_4] },
  { type: 'Expired', mark: 'covered', during: [16, LOOP] },
];

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'The permits clause names every subtype of DecodeResult: Decoded and Rejected. No other class can implement it.',
  ],
  [
    STEP_2,
    'The switch has a case for each permitted subtype. The compiler knows there are no others, so the switch needs no default.',
  ],
  [
    STEP_3,
    'Expired joins the permits clause. The switch has no case for it, so the build fails right at that switch.',
  ],
  [
    STEP_4,
    'With case Expired e added, the switch covers all three subtypes again and compiles, still with no default.',
  ],
];

// javac's own words for a switch that misses a permitted subtype, checked with JDK 25.
const NOT_EXHAUSTIVE = 'error: the switch expression does not cover all possible input values';

const TITLE = 'A sealed hierarchy';
const DESC =
  'On the left, sealed interface DecodeResult permits two records, Decoded and Rejected, drawn as a tree under the interface. ' +
  'On the right, a switch over a DecodeResult has one case for each record and a comment saying it has no default. ' +
  'javac checks the switch, marks Decoded and Rejected covered, and the switch compiles. ' +
  'Then a third record, Expired, joins the permits clause and the tree. ' +
  'javac checks again, finds no case for Expired, and fails at the switch with the error: the switch expression does not cover all possible input values. ' +
  'Last, the switch gets case Expired e, javac marks Expired covered, and the switch compiles again, still with no default.';

const PANEL_LEFT = 24;
const PANEL_WIDTH = W - 2 * PANEL_LEFT;
const TEXT_LEFT = 40;
const PANEL_GAP = 16;
const LABEL_DROP = 24;

const MAIN_TOP = 84;
const MAIN_HEIGHT = 216;
const DIVIDER_X = 464;

// The sealed interface is a card, and its records hang off a trunk below it.
const CARD_TOP = MAIN_TOP + 36;
const CARD_WIDTH = 360;
const CARD_HEIGHT = 52;
const CARD_TEXT_LEFT = TEXT_LEFT + 12;
const TRUNK_X = TEXT_LEFT + 20;
const BOX_LEFT = TEXT_LEFT + 36;
const BOX_TOP = CARD_TOP + CARD_HEIGHT + 12;
const BOX_WIDTH = 300;
const BOX_HEIGHT = 28;
const BOX_PITCH = 36;
const MARK_X = BOX_LEFT + BOX_WIDTH + 10;

// Code is 12 px monospace, one line every 20 px, with four spaces of indent per level.
const CODE_TOP = MAIN_TOP + 58;
const LINE = 20;
const INDENT = 29;
const SWITCH_LEFT = DIVIDER_X + 16;
// The widest character of a 12 px monospace face in the font stack, for the boxes around code.
const CHAR = 7.3;

const JAVAC_TOP = MAIN_TOP + MAIN_HEIGHT + PANEL_GAP;
const JAVAC_HEIGHT = 48;
const JAVAC_Y = JAVAC_TOP + 29;
const VERDICT_X = 104;

const CAPTION_TOP = JAVAC_TOP + JAVAC_HEIGHT + PANEL_GAP;
const CAPTION_HEIGHT = 36;
const CAPTION_Y = CAPTION_TOP + 23;
const FOOTER_Y = CAPTION_TOP + CAPTION_HEIGHT + 30;
const H = FOOTER_Y + 20;

const round = (n: number): number => Math.round(n * 10) / 10;
// The stretches between the moments, in order, the last one running to the end of the loop.
const spans = (moments: readonly number[]): Interval[] => {
  const sorted = [...new Set(moments)].sort((a, b) => a - b);
  return sorted.map((from, i) => [from, sorted[i + 1] ?? LOOP]);
};
const coveredAt = (t: number): boolean =>
  SUBTYPES.every(({ permitted, handled }) => permitted > t || handled <= t);

const CHECKING: Interval[] = RUNS.map(({ from, answers }) => [from, answers]);
const COMPILES: Interval[] = RUNS.filter(({ answers }) => coveredAt(answers)).map(
  ({ answers, until }) => [answers, until],
);
const FAILS: Interval[] = RUNS.filter(({ answers }) => !coveredAt(answers)).map(
  ({ answers, until }) => [answers, until],
);

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const code = (level: number): number => SWITCH_LEFT + level * INDENT;
const row = (n: number): number => CODE_TOP + n * LINE;
// A box around a run of code that starts at x on the given baseline.
const around = (x: number, baseline: number, chars: number): string =>
  `x="${x - 6}" y="${baseline - 14}" width="${round(chars * CHAR + 12)}" height="20" rx="4"`;
const shownFrom = (from: number): string => (from > 0 ? show([[from, LOOP]], LOOP) : '');
const typeName = ({ name, tone }: Subtype): string =>
  `<tspan data-role="type-name" data-type="${name}" class="font-semibold fill-${tone}">${name}</tspan>`;

function permitsClauses(): string[] {
  const x = CARD_TEXT_LEFT + INDENT;
  const y = CARD_TOP + 42;
  const first = SUBTYPES.filter(({ permitted }) => permitted === 0);
  return [
    `  <rect data-role="permits-highlight" class="fill-none stroke-amber stroke-1.5" ${around(x, y, `permits ${first.map(({ name }) => name).join(', ')} {}`.length)}>${show([[0, STEP_2]], LOOP)}</rect>`,
    ...spans(SUBTYPES.map(({ permitted }) => permitted)).map((during) => {
      const names = SUBTYPES.filter(({ permitted }) => permitted <= during[0]).map(typeName);
      return `  <text data-role="permits" class="font-mono text-offset fill-ink" x="${x}" y="${y}">permits ${names.join(', ')} {}${show([during], LOOP)}</text>`;
    }),
  ];
}

function subtype(s: Subtype, i: number): string {
  const top = BOX_TOP + i * BOX_PITCH;
  const mid = top + BOX_HEIGHT / 2;
  const from = i === 0 ? CARD_TOP + CARD_HEIGHT : mid - BOX_PITCH;
  return [
    `  <g data-role="subtype" data-type="${s.name}">`,
    ...(s.permitted > 0 ? [`    ${shownFrom(s.permitted)}`] : []),
    `    <path class="la-arrow" d="M ${TRUNK_X} ${from} V ${mid} H ${BOX_LEFT}"/>`,
    `    <rect class="${s.permitted > 0 ? 'la-cell-new' : 'la-cell'}" x="${BOX_LEFT}" y="${top}" width="${BOX_WIDTH}" height="${BOX_HEIGHT}" rx="6"/>`,
    `    <text class="font-mono text-offset fill-ink" x="${BOX_LEFT + 12}" y="${mid + 4}">record ${typeName(s)}(${escapeXml(s.fields)})</text>`,
    '  </g>',
  ].join('\n');
}

function mark({ type, mark: kind, during }: (typeof MARKS)[number]): string {
  const mid =
    BOX_TOP + SUBTYPES.findIndex(({ name }) => name === type) * BOX_PITCH + BOX_HEIGHT / 2;
  const [tone, glyph, words] =
    kind === 'covered'
      ? (['emerald', `M ${MARK_X} ${mid} l 4 4 l 8 -9`, 'covered'] as const)
      : (['red', `M ${MARK_X + 1} ${mid - 5} l 9 9 m 0 -9 l -9 9`, 'no case'] as const);
  return [
    `  <g data-role="mark" data-mark="${kind}" data-type="${type}">`,
    `    ${show([during], LOOP)}`,
    `    <path class="fill-none stroke-${tone} stroke-1.5" d="${glyph}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `    ${text(`font-sans text-offset font-semibold fill-${tone}`, MARK_X + 16, mid + 4, words)}`,
    '  </g>',
  ].join('\n');
}

function caseLine(s: Subtype, i: number): string {
  return `    <text data-role="case" data-type="${s.name}" class="font-mono text-offset fill-ink" x="${code(2)}" y="${row(2 + i)}">case ${typeName(s)}${escapeXml(` ${s.variable} -> ${s.result}`)}${shownFrom(s.handled)}</text>`;
}

// The lines after the cases move down a row each time a case joins the switch.
function closers(): string[] {
  return spans(SUBTYPES.map(({ handled }) => handled)).map((during) => {
    const comment = 2 + SUBTYPES.filter(({ handled }) => handled <= during[0]).length;
    return [
      '    <g data-role="closers">',
      `      ${show([during], LOOP)}`,
      `      <rect data-role="no-default-highlight" class="fill-none stroke-amber stroke-1.5" ${around(code(2), row(comment), '// no default'.length)}>${show(COMPILES, LOOP)}</rect>`,
      `      <text data-role="no-default" class="font-mono text-offset fill-ink-muted" x="${code(2)}" y="${row(comment)}">// no default</text>`,
      `      ${text('font-mono text-offset fill-ink', code(1), row(comment + 1), '};')}`,
      `      ${text('font-mono text-offset fill-ink', code(0), row(comment + 2), '}')}`,
      '    </g>',
    ].join('\n');
  });
}

function switchCode(): string {
  const switchLine = 'return switch (result) {';
  return [
    `  <rect data-role="switch-error" class="fill-none stroke-red stroke-1.5" ${around(code(1), row(1), switchLine.length)}>${show(FAILS, LOOP)}</rect>`,
    '  <g data-role="switch">',
    `    ${text('font-mono text-offset fill-ink', code(0), row(0), 'String describe(DecodeResult result) {')}`,
    `    <text data-role="switch-line" class="font-mono text-offset fill-ink" x="${code(1)}" y="${row(1)}">${escapeXml(switchLine)}</text>`,
    ...SUBTYPES.map(caseLine),
    ...closers(),
    '  </g>',
  ].join('\n');
}

function verdicts(): string[] {
  const glyph = (tone: string, d: string): string =>
    `<path class="fill-none stroke-${tone} stroke-1.5" d="${d}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const verdict = (name: string, during: Interval[], body: string[]): string =>
    [
      `  <g data-role="verdict" data-verdict="${name}">`,
      `    ${show(during, LOOP)}`,
      ...body.map((line) => `    ${line}`),
      '  </g>',
    ].join('\n');
  return [
    verdict('checking', CHECKING, [
      text(
        'la-note',
        VERDICT_X,
        JAVAC_Y,
        'checking that every subtype in the permits clause has a case',
      ),
    ]),
    verdict('compiles', COMPILES, [
      glyph('emerald', `M ${VERDICT_X} ${JAVAC_Y - 4} l 4 4 l 8 -9`),
      `<text class="font-sans text-label" x="${VERDICT_X + 20}" y="${JAVAC_Y}"><tspan class="font-semibold fill-emerald">compiles</tspan><tspan class="fill-ink-muted">: every permitted subtype has a case, so the switch needs no default</tspan></text>`,
    ]),
    verdict('error', FAILS, [
      glyph('red', `M ${VERDICT_X + 1} ${JAVAC_Y - 9} l 9 9 m 0 -9 l -9 9`),
      text('font-mono text-offset fill-red', VERDICT_X + 20, JAVAC_Y, NOT_EXHAUSTIVE),
    ]),
  ];
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
    `  ${text('la-note', 28, 64, 'The decoder returns a DecodeResult. Its permits clause lets javac check that a switch covers every subtype.')}`,
    `  <rect class="la-canvas stroke-1.5" x="${PANEL_LEFT}" y="${MAIN_TOP}" width="${PANEL_WIDTH}" height="${MAIN_HEIGHT}" rx="12"/>`,
    `  <line class="stroke-grid" x1="${DIVIDER_X}" y1="${MAIN_TOP + 12}" x2="${DIVIDER_X}" y2="${MAIN_TOP + MAIN_HEIGHT - 12}"/>`,
    `  ${text('la-label font-semibold', TEXT_LEFT, MAIN_TOP + LABEL_DROP, 'the sealed interface')}`,
    `  ${text('la-label font-semibold', SWITCH_LEFT, MAIN_TOP + LABEL_DROP, 'a switch over it')}`,
    `  <rect class="la-card" x="${TEXT_LEFT}" y="${CARD_TOP}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="8"/>`,
    `  <text class="font-mono text-offset fill-ink" x="${CARD_TEXT_LEFT}" y="${CARD_TOP + 22}"><tspan class="font-bold">sealed</tspan> interface DecodeResult</text>`,
    ...permitsClauses(),
    ...SUBTYPES.map(subtype),
    ...MARKS.map(mark),
    switchCode(),
    `  <rect class="la-canvas stroke-1.5" x="${PANEL_LEFT}" y="${JAVAC_TOP}" width="${PANEL_WIDTH}" height="${JAVAC_HEIGHT}" rx="12"/>`,
    `  ${text('la-label font-semibold', TEXT_LEFT, JAVAC_Y, 'javac')}`,
    ...verdicts(),
    `  <rect class="la-canvas" x="${PANEL_LEFT}" y="${CAPTION_TOP}" width="${PANEL_WIDTH}" height="${CAPTION_HEIGHT}" rx="8"/>`,
    ...CAPTIONS.map(caption),
    `  ${text('font-sans text-offset fill-ink-muted', 28, FOOTER_Y, "Sources: JEP 409 (Sealed Classes) and JEP 441 (Pattern Matching for switch). The error is javac's own message, checked with JDK 25.")}`,
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
