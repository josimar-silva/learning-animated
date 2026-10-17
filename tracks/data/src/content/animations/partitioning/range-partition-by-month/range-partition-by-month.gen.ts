// Writes range-partition-by-month.svg through `just gen`. The story table below drives every
// timing: when each month's partition appears, and when each match is looked up, stored, or rejected.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  complement,
  escapeXml,
  type Interval,
  move,
  show,
} from '@learning-animated/svg-kit/author';

const LOOP = 30;
const WIDTH = 1000;
const HEIGHT = 496;

type Point = readonly [x: number, y: number];
type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

// A row of matches as the stage shows it: its id and the day it was played. Only played_on decides
// where the row goes.
type Row = { readonly id: number; readonly on: string };

// One partition per month of 2026. April's partition is only created in the last step.
type Month = {
  readonly name: string;
  readonly partition: string;
  readonly from: string;
  readonly to: string;
  readonly days: number;
  // When the partition appears, and the matches it already holds then.
  readonly created: number;
  readonly earlier: readonly Row[];
};
const MONTHS: readonly Month[] = [
  {
    name: 'January',
    partition: 'matches_2026_01',
    from: '2026-01-01',
    to: '2026-02-01',
    days: 31,
    created: 0.5,
    earlier: [
      { id: 50117, on: '2026-01-05' },
      { id: 50786, on: '2026-01-27' },
    ],
  },
  {
    name: 'February',
    partition: 'matches_2026_02',
    from: '2026-02-01',
    to: '2026-03-01',
    days: 28,
    created: 1.2,
    earlier: [{ id: 50903, on: '2026-02-03' }],
  },
  {
    name: 'March',
    partition: 'matches_2026_03',
    from: '2026-03-01',
    to: '2026-04-01',
    days: 31,
    created: 1.9,
    earlier: [],
  },
  {
    name: 'April',
    partition: 'matches_2026_04',
    from: '2026-04-01',
    to: '2026-05-01',
    days: 30,
    created: 23,
    earlier: [],
  },
];
const FEBRUARY = 1;
const MARCH = 2;
const APRIL = 3;
const APRIL_CREATED = MONTHS[APRIL]!.created;

// A finished match the game inserts. Its winner is a player id from the roster.
type Match = Row & { readonly winner: number; readonly map: number };
const FEBRUARY_14: Match = { id: 51190, winner: 412, map: 3, on: '2026-02-14' };
const MARCH_1: Match = { id: 51468, winner: 2981, map: 1, on: '2026-03-01' };
const APRIL_9: Match = { id: 52235, winner: 7702, map: 5, on: '2026-04-09' };

// One try at inserting a match. Its statement shows on the insert line, and a chip with its
// played_on date slides over the date line, where the router looks the date up.
type Insert = {
  readonly match: Match;
  readonly attempt: number;
  readonly appears: number;
  readonly reaches: number;
};
// A stored match lights up the range that covers it, then drops into that partition.
type Stored = Insert & {
  readonly decides: number;
  readonly departs: number;
  readonly lands: number;
};
// A rejected match turns red where it stands, then disappears.
type Rejected = Insert & { readonly fails: number; readonly leaves: number };
const isStored = (insert: Stored | Rejected): insert is Stored => 'lands' in insert;
const endOf = (insert: Stored | Rejected): number =>
  isStored(insert) ? insert.lands : insert.leaves;

const FEBRUARY_INSERT: Stored = {
  match: FEBRUARY_14,
  attempt: 1,
  appears: 4,
  reaches: 5.5,
  decides: 5.5,
  departs: 6,
  lands: 7,
};
const MARCH_INSERT: Stored = {
  match: MARCH_1,
  attempt: 1,
  appears: 9,
  reaches: 10.5,
  decides: 12,
  departs: 13,
  lands: 14,
};
const APRIL_INSERT: Rejected = {
  match: APRIL_9,
  attempt: 1,
  appears: 16,
  reaches: 17.5,
  fails: 19.6,
  leaves: 22,
};
// Once April's partition exists, the game retries the insert that failed.
const APRIL_RETRY: Stored = {
  match: APRIL_9,
  attempt: 2,
  appears: 24.5,
  reaches: 26,
  decides: 26,
  departs: 26.5,
  lands: 27.5,
};
const INSERTS: ReadonlyArray<Stored | Rejected> = [
  FEBRUARY_INSERT,
  MARCH_INSERT,
  APRIL_INSERT,
  APRIL_RETRY,
];
const STORED = INSERTS.filter(isStored);

// A chip rests on the insert line this long before it slides.
const SETTLE = 0.5;
// Step 3: February's TO and March's FROM explain the shared bound before March is picked.
const BOUNDS: Interval = [11, 16];
// Step 4: the router finds no range for 9 April, then no default partition, then gives up.
const GAP: Interval = [18, APRIL_CREATED];
const NO_DEFAULT: Interval = [18.8, APRIL_CREATED];
const ERROR: Interval = [APRIL_INSERT.fails, APRIL_CREATED];
// A stored row glows as new this long, and so does April's new partition.
const GLOW = 1.5;
const CREATED_GLOW = 2;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'The matches table is split into one partition per month. The parent stores no rows of its own; it only routes them.',
  ],
  [
    FEBRUARY_INSERT.appears,
    "A match played on 14 February falls inside February's range, so it goes to matches_2026_02.",
  ],
  [
    MARCH_INSERT.appears,
    'A match played on 1 March goes to March, because a range includes its lower bound (FROM) and excludes its upper bound (TO).',
  ],
  [
    APRIL_INSERT.appears,
    'No partition covers 9 April and there is no DEFAULT partition to take the row, so the insert fails.',
  ],
  [
    APRIL_CREATED,
    "So create next month's partition ahead of time. With matches_2026_04 in place, the same match lands in April.",
  ],
];

const TITLE = 'Routing a match to its month';
const NOTE =
  'The partitioned table holds no rows. Each match goes to the partition whose range covers its played_on date.';
const DESC =
  'An animation in five steps. An online game records its matches in a table partitioned by range on played_on, with one partition per month for January, February, and March 2026, and the parent table stores no rows itself. ' +
  `Match ${FEBRUARY_14.id}, played on 14 February 2026, is looked up on a date line by its played_on date and stored in matches_2026_02. ` +
  `Match ${MARCH_1.id}, played on 1 March 2026, lands on the bound that February and March share. February's TO excludes that date and March's FROM includes it, so the match is stored in matches_2026_03. ` +
  `Match ${APRIL_9.id}, played on 9 April 2026, finds no partition and no default partition, so the insert fails with an error. ` +
  'Then matches_2026_04 is created for April, and the same match is inserted again and stored in it.';

// The parent table is a dashed panel, since it has no storage of its own.
const PARENT: Box = { left: 32, top: 88, width: 936, height: 148 };
const HEADER_Y = 112;
const INSERT_Y = 138;
// Each match's chip starts in the slot under the insert line.
const CHIP = { width: 100, height: 22 } as const;
const INBOX: Point = [56 + CHIP.width / 2, 156];
// The date line: a tick on the first of each month, and above it a bar for each partition's range.
const LINE_LEFT = 80;
const MONTH_WIDTH = 176;
const BAR = { top: 178, height: 20, inset: 2 } as const;
const BASELINE_Y = 204;
const TICK = { top: 174, bottom: 210, labelY: 226 } as const;
// Each partition hangs under its month, with its rows at the bottom.
const PANEL = { top: 252, height: 128, inset: 6 } as const;
const PANEL_WIDTH = MONTH_WIDTH - 2 * PANEL.inset;
const NAME_Y = 272;
const FROM_Y = 292;
const TO_Y = 308;
const SLOT = { height: 22, gap: 6, top: 320 } as const;
const MESSAGE_Y = 320;
const DEFAULT_SLOT: Box = { left: 800, top: PANEL.top, width: 144, height: PANEL.height };
const CONSOLE: Box = { left: 32, top: 394, width: 936, height: 52 };
const CAPTION_Y = 478;

const round = (n: number): number => Math.round(n * 10) / 10;
const tickX = (i: number): number => LINE_LEFT + i * MONTH_WIDTH;
const panelLeft = (i: number): number => tickX(i) + PANEL.inset;
const slotTop = (slot: number): number => SLOT.top + slot * (SLOT.height + SLOT.gap);
const slotCenter = (i: number, slot: number): Point => [
  panelLeft(i) + PANEL_WIDTH / 2,
  slotTop(slot) + SLOT.height / 2,
];
const barBox = (i: number): Box => ({
  left: tickX(i) + BAR.inset,
  top: BAR.top,
  width: MONTH_WIDTH - 2 * BAR.inset,
  height: BAR.height,
});
const panelBox = (i: number): Box => ({
  left: panelLeft(i),
  top: PANEL.top,
  width: PANEL_WIDTH,
  height: PANEL.height,
});
const chipBox = ([x, y]: Point): Box => ({
  left: x - CHIP.width / 2,
  top: y - CHIP.height / 2,
  width: CHIP.width,
  height: CHIP.height,
});
const CHIP_SHAPE = chipBox([0, 0]);

// The month whose range covers a date: FROM is included and TO is not.
function monthOf(date: string): number {
  const i = MONTHS.findIndex((m) => date >= m.from && date < m.to);
  if (i === -1) throw new Error(`${date} is off the date line`);
  return i;
}

// A date's place on the line: its month's tick, plus the share of the month gone by.
function dateX(date: string): number {
  const i = monthOf(date);
  return round(tickX(i) + ((Number(date.slice(8)) - 1) / MONTHS[i]!.days) * MONTH_WIDTH);
}

// Every row a partition holds, in the order it arrives: the earlier matches, then the stored ones.
type Placed = Row & {
  readonly month: number;
  readonly slot: number;
  readonly from: number;
  readonly glow: Interval | null;
};
const PLACED: readonly Placed[] = MONTHS.flatMap((m, month) => [
  ...m.earlier.map((row, slot) => ({ ...row, month, slot, from: m.created, glow: null })),
  ...STORED.filter((insert) => monthOf(insert.match.on) === month).map((insert, k) => ({
    id: insert.match.id,
    on: insert.match.on,
    month,
    slot: m.earlier.length + k,
    from: insert.lands,
    glow: [insert.lands, insert.lands + GLOW] as const,
  })),
]);

function landingOf(insert: Stored): Point {
  const placed = PLACED.find((p) => p.id === insert.match.id)!;
  return slotCenter(placed.month, placed.slot);
}

const text = (classes: string, x: number, y: number, words: string, attrs = ''): string =>
  `<text${attrs} class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;

const rect = (classes: string, box: Box, rx: number, attrs = '', inner = ''): string => {
  const shape = `<rect${attrs} class="${classes}" x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="${rx}"`;
  return inner ? `${shape}>${inner}</rect>` : `${shape}/>`;
};

const indent = (lines: readonly string[], depth = 2): string[] =>
  lines.map((line) => `${' '.repeat(depth)}${line}`);

// The header declares the columns, in the order each INSERT lists its values.
function parent(): string {
  return [
    '  <g data-role="parent">',
    ...indent(
      [
        rect('la-card', PARENT, 12, ' data-role="panel" stroke-dasharray="8 5"'),
        `<text class="fill-ink-muted font-mono text-offset" x="56" y="${HEADER_Y}"><tspan class="fill-ink text-label font-semibold">matches</tspan> (match_id, winner_id, map_id, played_on) PARTITION BY RANGE (played_on)</text>`,
        text(
          'fill-ink-muted font-sans text-offset anchor-end',
          PARENT.left + PARENT.width - 24,
          HEADER_Y,
          'holds no rows of its own',
        ),
        rect('la-cell-tail', chipBox(INBOX), 4),
      ],
      4,
    ),
    '  </g>',
  ].join('\n');
}

function dateLine(): string {
  const firsts = [...MONTHS.map((m) => m.from), MONTHS[MONTHS.length - 1]!.to];
  return [
    `  <line class="stroke-ink-muted" x1="${tickX(0)}" y1="${BASELINE_Y}" x2="${tickX(MONTHS.length)}" y2="${BASELINE_Y}"/>`,
    ...firsts.map((date, i) =>
      [
        `  <g data-role="tick" data-date="${date}">`,
        `    <line class="stroke-ink-muted stroke-1.5" x1="${tickX(i)}" y1="${TICK.top}" x2="${tickX(i)}" y2="${TICK.bottom}"/>`,
        `    ${text('fill-ink-muted font-mono text-offset anchor-middle', tickX(i), TICK.labelY, date)}`,
        '  </g>',
      ].join('\n'),
    ),
  ].join('\n');
}

const barLabel = (i: number): string =>
  text('la-offset anchor-middle', tickX(i) + MONTH_WIDTH / 2, BAR.top + 14, MONTHS[i]!.name);

function partitions(): string {
  return MONTHS.map((m, i) => {
    const x = panelLeft(i) + 10;
    return [
      `  <g data-role="partition" data-partition="${m.partition}" data-from="${m.from}" data-to="${m.to}">`,
      ...indent(
        [
          show([[m.created, LOOP]], LOOP),
          rect('la-cell', barBox(i), 4, ' data-role="range"'),
          barLabel(i),
          rect('la-card', panelBox(i), 10, ' data-role="panel"'),
          text(
            'fill-ink font-mono text-offset font-semibold',
            x,
            NAME_Y,
            m.partition,
            ' data-role="name"',
          ),
          text(
            'fill-ink-muted font-mono text-offset',
            x,
            FROM_Y,
            `FROM ('${m.from}')`,
            ' data-role="from"',
          ),
          text(
            'fill-ink-muted font-mono text-offset',
            x,
            TO_Y,
            `TO ('${m.to}')`,
            ' data-role="to"',
          ),
        ],
        4,
      ),
      '  </g>',
    ].join('\n');
  }).join('\n');
}

function rows(): string {
  return PLACED.map((p) => {
    const [x, y] = slotCenter(p.month, p.slot);
    const cell = chipBox([x, y]);
    return [
      `  <g data-role="row" data-partition="${MONTHS[p.month]!.partition}" data-match-id="${p.id}" data-played-on="${p.on}">`,
      ...indent(
        [
          show([[p.from, LOOP]], LOOP),
          rect('la-cell', cell, 4, ' data-role="cell"'),
          ...(p.glow ? [rect('la-cell-new', cell, 4, '', show([p.glow], LOOP))] : []),
          text('la-offset anchor-middle', x, y + 4, p.on),
        ],
        4,
      ),
      '  </g>',
    ].join('\n');
  }).join('\n');
}

// April's partition glows amber for a moment once it is created.
function created(): string {
  const { partition } = MONTHS[APRIL]!;
  return [
    `  <g data-role="created" data-partition="${partition}">`,
    ...indent(
      [
        show([[APRIL_CREATED, APRIL_CREATED + CREATED_GLOW]], LOOP),
        rect('la-cell-new', barBox(APRIL), 4),
        barLabel(APRIL),
        rect('fill-none stroke-amber stroke-2.5', panelBox(APRIL), 10),
      ],
      4,
    ),
    '  </g>',
  ].join('\n');
}

// The range that covers a stored match lights up until the match lands.
function coverings(): string {
  return STORED.map((insert) => {
    const i = monthOf(insert.match.on);
    return [
      `  <g data-role="covering" data-partition="${MONTHS[i]!.partition}" data-played-on="${insert.match.on}">`,
      ...indent(
        [
          show([[insert.decides, insert.lands]], LOOP),
          rect('la-cell-new', barBox(i), 4),
          barLabel(i),
        ],
        4,
      ),
      '  </g>',
    ].join('\n');
  }).join('\n');
}

function gap(): string {
  const { from, to } = MONTHS[APRIL]!;
  const panel = panelBox(APRIL);
  return [
    `  <g data-role="gap" data-from="${from}" data-to="${to}">`,
    ...indent(
      [
        show([GAP], LOOP),
        rect('fill-none stroke-red stroke-1.5', barBox(APRIL), 4, ' stroke-dasharray="5 4"'),
        rect('fill-surface stroke-red stroke-1.5', panel, 10, ' stroke-dasharray="5 4"'),
        text(
          'fill-red font-sans text-offset anchor-middle',
          panel.left + panel.width / 2,
          MESSAGE_Y,
          'no partition for April',
        ),
      ],
      4,
    ),
    '  </g>',
  ].join('\n');
}

function noDefault(): string {
  return [
    '  <g data-role="default">',
    ...indent(
      [
        show([NO_DEFAULT], LOOP),
        rect('fill-surface stroke-red stroke-1.5', DEFAULT_SLOT, 10, ' stroke-dasharray="5 4"'),
        text(
          'fill-red font-sans text-offset anchor-middle',
          DEFAULT_SLOT.left + DEFAULT_SLOT.width / 2,
          MESSAGE_Y,
          'no DEFAULT partition',
        ),
      ],
      4,
    ),
    '  </g>',
  ].join('\n');
}

// Step 3: 1 March is February's TO and March's FROM. Each mark frames that line on its panel and
// says, beside the chip, which way the bound goes.
function bounds(): string {
  const boundary = dateX(MARCH_1.on);
  const labelY = INBOX[1] + 4;
  const frame = (i: number, baseline: number): Box => ({
    left: panelLeft(i) + 4,
    top: baseline - 13,
    width: PANEL_WIDTH - 8,
    height: 17,
  });
  return [
    `  <g data-role="excluded" data-partition="${MONTHS[FEBRUARY]!.partition}" data-bound="to">`,
    ...indent(
      [
        show([BOUNDS], LOOP),
        rect(
          'fill-none stroke-slate stroke-1.5',
          frame(FEBRUARY, TO_Y),
          3,
          ' data-role="frame" stroke-dasharray="3 2"',
        ),
        text(
          'fill-ink-muted font-sans text-offset anchor-end',
          boundary - CHIP.width / 2 - 12,
          labelY,
          "February's TO excludes it",
        ),
      ],
      4,
    ),
    '  </g>',
    `  <g data-role="included" data-partition="${MONTHS[MARCH]!.partition}" data-bound="from">`,
    ...indent(
      [
        show([BOUNDS], LOOP),
        rect('fill-none stroke-amber stroke-1.5', frame(MARCH, FROM_Y), 3, ' data-role="frame"'),
        text(
          'fill-amber font-sans text-offset font-semibold',
          boundary + CHIP.width / 2 + 12,
          labelY,
          "March's FROM includes it",
        ),
      ],
      4,
    ),
    '  </g>',
  ].join('\n');
}

// The insert line shows the statement of the match in flight, with its played_on value in amber,
// and the bare INSERT INTO matches between matches.
function insertLine(): string {
  const flights: Interval[] = INSERTS.map((insert) => [insert.appears, endOf(insert)]);
  const idle = `  <text data-role="insert" class="fill-ink-muted font-mono text-offset" x="56" y="${INSERT_Y}">INSERT INTO matches${show(complement(flights, LOOP), LOOP)}</text>`;
  const statements = INSERTS.map((insert) => {
    const { id, winner, map, on } = insert.match;
    return `  <text data-role="insert" data-match-id="${id}" data-attempt="${insert.attempt}" class="fill-ink font-mono text-offset" x="56" y="${INSERT_Y}">INSERT INTO matches VALUES (${id}, ${winner}, ${map}, <tspan data-role="key" class="fill-amber">'${on}'</tspan>);${show([[insert.appears, endOf(insert)]], LOOP)}</text>`;
  });
  return [idle, ...statements].join('\n');
}

const insertAttrs = (insert: Insert): string =>
  `data-played-on="${insert.match.on}" data-attempt="${insert.attempt}"`;

// A dashed line drops from the chip to the match's date, where the router looks it up.
function probe(insert: Stored | Rejected): string {
  const x = dateX(insert.match.on);
  return [
    `  <g data-role="probe" ${insertAttrs(insert)}>`,
    `    ${show([[insert.reaches, endOf(insert)]], LOOP)}`,
    `    <line class="stroke-amber stroke-1.5" x1="${x}" y1="${INBOX[1] + CHIP.height / 2}" x2="${x}" y2="${BASELINE_Y}" stroke-dasharray="3 3"/>`,
    `    <circle class="fill-amber" cx="${x}" cy="${BASELINE_Y}" r="4"/>`,
    '  </g>',
  ].join('\n');
}

function chip(insert: Stored | Rejected): string {
  const { id, on } = insert.match;
  const above: Point = [dateX(on), INBOX[1]];
  const slides = insert.appears + SETTLE;
  const opening = `  <g data-role="match" data-match-id="${id}" ${insertAttrs(insert)}>`;
  const fresh = [rect('la-cell-new', CHIP_SHAPE, 4), text('la-offset anchor-middle', 0, 4, on)];
  if (isStored(insert)) {
    const landing = landingOf(insert);
    return [
      opening,
      ...indent(
        [
          show([[insert.appears, insert.lands]], LOOP),
          move(
            [
              [0, ...INBOX],
              [slides, ...INBOX],
              [insert.reaches, ...above],
              [insert.departs, ...above],
              [insert.lands, ...landing],
              [LOOP, ...landing],
            ],
            LOOP,
          ),
          ...fresh,
        ],
        4,
      ),
      '  </g>',
    ].join('\n');
  }
  return [
    opening,
    ...indent(
      [
        show([[insert.appears, insert.leaves]], LOOP),
        move(
          [
            [0, ...INBOX],
            [slides, ...INBOX],
            [insert.reaches, ...above],
            [LOOP, ...above],
          ],
          LOOP,
        ),
        '<g>',
        ...indent([show([[insert.appears, insert.fails]], LOOP), ...fresh]),
        '</g>',
        '<g data-role="rejected">',
        ...indent([
          show([[insert.fails, insert.leaves]], LOOP),
          rect('fill-surface stroke-red stroke-1.5', CHIP_SHAPE, 4),
          text('fill-red font-mono text-offset anchor-middle', 0, 4, on),
          text('fill-red font-sans text-offset font-bold', CHIP.width / 2 + 8, 4, 'rejected'),
        ]),
        '</g>',
      ],
      4,
    ),
    '  </g>',
  ].join('\n');
}

type Line = readonly [classes: string, indent: number, words: string];

function terminal(role: string, shown: Interval, lines: readonly Line[]): string {
  return [
    `  <g data-role="${role}">`,
    ...indent(
      [
        show([shown], LOOP),
        rect('la-canvas', CONSOLE, 8),
        ...lines.map(([classes, depth, words], i) =>
          text(
            `${classes} font-mono text-offset`,
            CONSOLE.left + 16 + depth * 16,
            CONSOLE.top + 21 + i * 18,
            words,
          ),
        ),
      ],
      4,
    ),
    '  </g>',
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="la-label" x="32" y="${CAPTION_Y}">${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
}

export function render(): string {
  const april = MONTHS[APRIL]!;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" data-loop="${LOOP}s">`,
    `  <title>${escapeXml(TITLE)}</title>`,
    `  <desc>${escapeXml(DESC)}</desc>`,
    '  <style>',
    '/* LA-STYLE:START */',
    '/* LA-STYLE:END */',
    '</style>',
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  ${text('la-title', 32, 44, TITLE)}`,
    `  ${text('la-note', 32, 68, NOTE)}`,
    parent(),
    dateLine(),
    partitions(),
    rows(),
    created(),
    coverings(),
    gap(),
    noDefault(),
    bounds(),
    insertLine(),
    ...INSERTS.map(probe),
    ...INSERTS.map(chip),
    terminal('error', ERROR, [
      ['fill-red', 0, 'ERROR: no partition of relation "matches" found for row'],
      [
        'fill-ink-muted',
        0,
        `DETAIL: Partition key of the failing row contains (played_on) = (${APRIL_9.on}).`,
      ],
    ]),
    terminal(
      'create',
      [APRIL_CREATED, LOOP],
      [
        ['fill-ink', 0, `CREATE TABLE ${april.partition} PARTITION OF matches`],
        ['fill-ink', 1, `FOR VALUES FROM ('${april.from}') TO ('${april.to}');`],
      ],
    ),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
