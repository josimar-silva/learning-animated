// Writes partitioned-index.svg through `just gen`. STEPS is the story table: every moment on the
// stage counts from a step's start. MONTHS holds every match the trees index.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  escapeXml,
  type Interval,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 30;
const W = 1124;
const H = 640;

type Match = readonly [id: number, playedOn: string];
type Month = {
  readonly partition: string;
  readonly month: string;
  readonly name: string;
  // In match_id order: the first two fill the left leaf and the last two the right leaf.
  readonly matches: readonly [Match, Match, Match, Match];
};

// Match ids rise with time and have five digits, so they never read as player ids.
const MONTHS: readonly Month[] = [
  {
    partition: 'matches_2026_01',
    month: '2026-01',
    name: 'January 2026',
    matches: [
      [50918, '2026-01-04'],
      [50963, '2026-01-12'],
      [51007, '2026-01-23'],
      [51042, '2026-01-31'],
    ],
  },
  {
    partition: 'matches_2026_02',
    month: '2026-02',
    name: 'February 2026',
    matches: [
      [51077, '2026-02-02'],
      [51120, '2026-02-09'],
      [51168, '2026-02-17'],
      [51203, '2026-02-25'],
    ],
  },
  {
    partition: 'matches_2026_03',
    month: '2026-03',
    name: 'March 2026',
    matches: [
      [51239, '2026-03-03'],
      [51286, '2026-03-10'],
      [51324, '2026-03-18'],
      [51371, '2026-03-26'],
    ],
  },
];
// Step 2 looks up SOUGHT. Match 51042 ran past midnight on 31 January, so step 5 reports it again
// with its first date (REPEATED) and step 6 with the next day's (FRESH).
const SOUGHT = 51042;
const REPEATED: Match = [51042, '2026-01-31'];
const FRESH: Match = [51042, '2026-02-01'];
const TABLE_NAME = 'matches';

type Step = {
  readonly at: number;
  readonly statement: string;
  readonly result: string;
  readonly detail?: string;
  readonly caption: string;
};

const STEPS: readonly Step[] = [
  {
    at: 0,
    statement: 'CREATE INDEX ON matches (match_id);',
    result: 'CREATE INDEX',
    caption:
      "CREATE INDEX on matches builds one B-tree in each month's partition, and none for matches itself.",
  },
  {
    at: 5,
    statement: `SELECT * FROM matches WHERE match_id = ${SOUGHT};`,
    result: '(1 row)',
    caption:
      "A lookup by match_id names no month, so all three trees are searched, even after January's tree finds 51042.",
  },
  {
    at: 11,
    statement: 'ALTER TABLE matches ADD UNIQUE (match_id);',
    result: 'ERROR: UNIQUE constraint on partitioned table must include all partitioning columns',
    detail:
      'DETAIL: UNIQUE constraint on table "matches" lacks column "played_on" which is part of the partition key.',
    caption:
      'UNIQUE (match_id) is refused. Each tree checks only its own month, so a second 51042 in February would go unseen.',
  },
  {
    at: 17,
    statement: 'ALTER TABLE matches ADD UNIQUE (match_id, played_on);',
    result: 'ALTER TABLE',
    caption:
      'UNIQUE (match_id, played_on) includes the partition key, so it is accepted. It builds one more tree per month.',
  },
  {
    at: 21,
    statement: `INSERT INTO matches (match_id, played_on) VALUES (${REPEATED[0]}, '${REPEATED[1]}');`,
    result:
      'ERROR: duplicate key value violates unique constraint "matches_2026_01_match_id_played_on_key"',
    detail: `DETAIL: Key (match_id, played_on)=(${REPEATED[0]}, ${REPEATED[1]}) already exists.`,
    caption:
      "A repeated pair has the same date as its twin, so it lands in January, and January's tree refuses it.",
  },
  {
    at: 25,
    statement: `INSERT INTO matches (match_id, played_on) VALUES (${FRESH[0]}, '${FRESH[1]}');`,
    result: 'INSERT 0 1',
    caption:
      'But only duplicate pairs are ruled out. (51042, 2026-02-01) is a new pair, so match 51042 is now in two months.',
  },
];

// Step n counts from 1, the way the page numbers its steps.
const startOf = (n: number): number => STEPS[n - 1]!.at;
const endOf = (n: number): number => STEPS[n]?.at ?? LOOP;

type Index = {
  readonly columns: string;
  readonly suffix: string;
  // A pair index shows each key's date under its match_id.
  readonly pairs: boolean;
  readonly builtIn: number;
  readonly buildEvery: number;
  readonly nameY: number;
  readonly rootTop: number;
  readonly leafTop: number;
  readonly cellHeight: number;
};

const BY_ID: Index = {
  columns: 'match_id',
  suffix: 'match_id_idx',
  pairs: false,
  builtIn: 1,
  buildEvery: 0.6,
  nameY: 280,
  rootTop: 294,
  leafTop: 350,
  cellHeight: 22,
};
const BY_PAIR: Index = {
  columns: 'match_id played_on',
  suffix: 'match_id_played_on_key',
  pairs: true,
  builtIn: 4,
  buildEvery: 0.5,
  nameY: 406,
  rootTop: 420,
  leafTop: 486,
  cellHeight: 34,
};
const indexName = (m: Month, index: Index): string => `${m.partition}_${index.suffix}`;

// Each tree appears in turn, leaves first, then the root above them.
const BUILD_FROM = 0.6;
const ROOT_AFTER = 0.3;
const builtAt = (index: Index, i: number): number =>
  startOf(index.builtIn) + BUILD_FROM + index.buildEvery * i;
const lastRootAt = (index: Index): number => builtAt(index, MONTHS.length - 1) + ROOT_AFTER;

// A dot goes down to the root, pauses there, then drops to the leaf slot its key belongs in.
type Descent = {
  readonly from: number;
  readonly toRoot: number;
  readonly atRoot: number;
  readonly toLeaf: number;
};
const PROBE: Descent = { from: 0.4, toRoot: 0.5, atRoot: 0.1, toLeaf: 0.4 };
const PROBE_EVERY = 1.4;
const INSERT: Descent = { from: 0.5, toRoot: 0.8, atRoot: 0.1, toLeaf: 0.5 };
const travelOf = (d: Descent): number => d.toRoot + d.atRoot + d.toLeaf;
const probeDeparts = (i: number): number => startOf(2) + PROBE.from + PROBE_EVERY * i;
const probeArrives = (i: number): number => probeDeparts(i) + travelOf(PROBE);
const insertDeparts = (n: number): number => startOf(n) + INSERT.from;
const insertArrives = (n: number): number => insertDeparts(n) + travelOf(INSERT);

// Step 3 marks the first 51042, then shows why no tree can see a second one.
const MARKS_AT = startOf(3) + 1.3;
const BLIND_AT = startOf(3) + 1.9;
// Step 6: the leaf moves its larger keys along one slot before the new key goes in.
const SHIFT = 0.4;
const FRESH_AT = insertArrives(6) + SHIFT;

// When the session answers each step's statement.
const ANSWER_AFTER = 0.4;
const ANSWERS: readonly number[] = [
  lastRootAt(BY_ID) + ANSWER_AFTER,
  probeArrives(MONTHS.length - 1) + ANSWER_AFTER,
  startOf(3) + 0.5,
  lastRootAt(BY_PAIR) + ANSWER_AFTER,
  insertArrives(5) + ANSWER_AFTER,
  FRESH_AT + ANSWER_AFTER,
];
const TWICE_AT = ANSWERS[5]! + 0.6;

const TITLE = 'One B-tree per partition';
const NOTE =
  "An index on a partitioned table is one B-tree per partition, and each tree sees only its own partition's rows.";
const DESC =
  'An animation in six steps. A matches table is partitioned by played_on into three partitions, one each for January, February, and March 2026. ' +
  'CREATE INDEX on matches (match_id) builds one B-tree in each partition and none for matches itself. ' +
  "A lookup for match 51042 then searches the three trees in turn: January's tree finds it, and the February and March trees are searched anyway. " +
  'Adding UNIQUE (match_id) fails, because each tree checks only its own month, so a second 51042 dated in February would never meet the one in January. ' +
  'Adding UNIQUE (match_id, played_on) succeeds and builds a second tree in each partition, keyed by match id and date. ' +
  "Inserting match 51042 dated 2026-01-31 a second time lands in January, and January's tree refuses the duplicate pair. " +
  "Inserting match 51042 dated 2026-02-01 is a new pair, so February's trees take it, and match 51042 is now in two months.";

const MARGIN = 30;
const TEXT_X = MARGIN + 16;
const RIGHT_X = W - MARGIN - 16;
const INNER_W = W - 2 * MARGIN;
// The session: the statement, then the answer, then the answer's detail line.
const PANEL = { top: 84, height: 76 } as const;
const STATEMENT_Y = 108;
const RESULT_Y = 130;
const DETAIL_Y = 149;
// The partitioned table, then one box per partition under it.
const TABLE = { top: 178, height: 32 } as const;
const TABLE_TEXT_Y = 199;
const TABLE_BOTTOM = TABLE.top + TABLE.height;
const PARTITION = { top: 236, width: 340, gap: 22, height: 312, pad: 12 } as const;
const HEADER_Y = 258;
const partitionX = (i: number): number => MARGIN + i * (PARTITION.width + PARTITION.gap);
const centerX = (i: number): number => partitionX(i) + PARTITION.width / 2;
// A page holds equal cells: a leaf has room for three keys, the root holds its one separator.
const CELL_W = 46;
const PAD = 4;
const SLOT = CELL_W + PAD;
const LEAF_W = PAD + 3 * SLOT;
const ROOT_W = PAD + SLOT;
const LEAF_GAP = 8;
const EDGE_SPREAD = 16;
const RING = 2;
const DOT_ABOVE = 6;
const VERDICT_DX = ROOT_W / 2 + 12;
const UNSEEN_Y = 444;
const TWICE_Y = 574;
const CAPTION = { top: 588, height: 36 } as const;

type Side = 0 | 1;
type Point = readonly [x: number, y: number];
type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const pageHeight = (index: Index): number => index.cellHeight + 2 * PAD;
const leafX = (i: number, side: Side): number =>
  side === 0 ? centerX(i) - LEAF_GAP / 2 - LEAF_W : centerX(i) + LEAF_GAP / 2;
const slotX = (pageX: number, slot: number): number => pageX + PAD + slot * SLOT;
const leafKeys = (m: Month, side: Side): readonly Match[] =>
  side === 0 ? m.matches.slice(0, 2) : m.matches.slice(2);
const cellBox = (i: number, index: Index, side: Side, slot: number): Box => ({
  x: slotX(leafX(i, side), slot),
  y: index.leafTop + PAD,
  width: CELL_W,
  height: index.cellHeight,
});

// A match_id index orders keys by match_id alone, a pair index by match_id, then played_on.
const compare = (index: Index, a: Match, b: Match): number =>
  a[0] - b[0] || (index.pairs ? a[1].localeCompare(b[1]) : 0);

// Where a search for a key ends: the leaf, the slot the key holds or would take, and whether it is there.
function descend(m: Month, index: Index, key: Match): { side: Side; slot: number; found: boolean } {
  const side: Side = compare(index, key, m.matches[2]) >= 0 ? 1 : 0;
  const keys = leafKeys(m, side);
  return {
    side,
    slot: keys.filter((k) => compare(index, k, key) < 0).length,
    found: keys.some((k) => compare(index, k, key) === 0),
  };
}

// The partition a row lands in: the one whose month holds its played_on.
function monthOf([, playedOn]: Match): number {
  const i = MONTHS.findIndex((m) => playedOn.startsWith(`${m.month}-`));
  if (i === -1) throw new Error(`no partition holds ${playedOn}`);
  return i;
}

const label = (classes: string, x: number, y: number, words: string, roles = ''): string =>
  `<text ${roles ? `${roles} ` : ''}class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const timed = (
  roles: string,
  classes: string,
  [x, y]: Point,
  words: string,
  when: readonly Interval[],
): string =>
  `<text ${roles} class="${classes}" x="${x}" y="${y}">${escapeXml(words)}${show(when, LOOP)}</text>`;
const rect = ({ x, y, width, height }: Box, classes: string, rest = ''): string =>
  `<rect ${rest ? `${rest} ` : ''}class="${classes}" x="${x}" y="${y}" width="${width}" height="${height}"`;
const ring = (roles: string, classes: string, cell: Box, when: readonly Interval[]): string => {
  const box = {
    x: cell.x - RING,
    y: cell.y - RING,
    width: cell.width + 2 * RING,
    height: cell.height + 2 * RING,
  };
  return `${rect(box, classes, roles)} rx="6">${show(when, LOOP)}</rect>`;
};
const nest = (lines: readonly string[]): string[] => lines.map((line) => `  ${line}`);

// The waypoints of a dot that leaves the table for partition i, pauses above the root, then lands.
function descent(i: number, index: Index, land: Point, departs: number, d: Descent): Waypoint[] {
  const start: Point = [centerX(i), TABLE_BOTTOM + 2];
  const root: Point = [centerX(i), index.rootTop - DOT_ABOVE];
  const atRoot = departs + d.toRoot;
  return [
    [0, ...start],
    [departs, ...start],
    [atRoot, ...root],
    [atRoot + d.atRoot, ...root],
    [departs + travelOf(d), ...land],
    [LOOP, ...land],
  ];
}
const above = (cell: Box): Point => [cell.x + CELL_W / 2, cell.y - PAD - DOT_ABOVE];

function session(): string[] {
  const exchanges = STEPS.flatMap((step, i) => {
    const n = i + 1;
    const answered: Interval[] = [[ANSWERS[i]!, endOf(n)]];
    const error = step.result.startsWith('ERROR');
    return [
      timed(
        `data-role="statement" data-step="${n}"`,
        'font-mono text-label fill-ink',
        [TEXT_X, STATEMENT_Y],
        step.statement,
        [[step.at, endOf(n)]],
      ),
      timed(
        `data-role="result" data-step="${n}" data-outcome="${error ? 'error' : 'ok'}"`,
        `font-mono text-offset ${error ? 'fill-red' : 'fill-emerald'}`,
        [TEXT_X, RESULT_Y],
        step.result,
        answered,
      ),
      ...(step.detail
        ? [
            timed(
              `data-role="detail" data-step="${n}"`,
              'font-mono text-offset fill-ink-muted',
              [TEXT_X, DETAIL_Y],
              step.detail,
              answered,
            ),
          ]
        : []),
    ];
  });
  // The count of trees searched rises as each probe reaches its leaf.
  const counts = [0, ...MONTHS.map((_, i) => i + 1)].map((count) =>
    timed(
      'data-role="count"',
      'font-mono text-label font-bold fill-ink anchor-end',
      [RIGHT_X, STATEMENT_Y],
      String(count),
      [
        [
          count === 0 ? startOf(2) : probeArrives(count - 1),
          count < MONTHS.length ? probeArrives(count) : endOf(2),
        ],
      ],
    ),
  );
  return [
    `${rect({ x: MARGIN, y: PANEL.top, width: INNER_W, height: PANEL.height }, 'la-canvas')} rx="10"/>`,
    ...exchanges,
    timed(
      'data-role="count-label"',
      'la-note anchor-end',
      [RIGHT_X - 22, STATEMENT_Y],
      'trees searched',
      [[startOf(2), endOf(2)]],
    ),
    ...counts,
  ];
}

function table(): string[] {
  return [
    `<g data-role="table" data-table="${TABLE_NAME}">`,
    `  ${rect({ x: MARGIN, y: TABLE.top, width: INNER_W, height: TABLE.height }, 'fill-surface stroke-violet stroke-1.5')} rx="8" stroke-dasharray="6 4"/>`,
    `  ${label('font-mono text-label font-semibold fill-ink', TEXT_X, TABLE_TEXT_Y, TABLE_NAME)}`,
    `  ${label('font-mono text-label fill-ink-muted', TEXT_X + 72, TABLE_TEXT_Y, 'PARTITION BY RANGE (played_on)')}`,
    `  ${label('la-note anchor-end', RIGHT_X, TABLE_TEXT_Y, 'holds no rows or index trees of its own')}`,
    '</g>',
    ...MONTHS.map(
      (_, i) =>
        `<path class="la-arrow" d="M ${centerX(i)} ${TABLE_BOTTOM} V ${PARTITION.top - 2}" marker-end="url(#head)"/>`,
    ),
  ];
}

function partitions(): string[] {
  return MONTHS.flatMap((m, i) => [
    `<g data-role="partition" data-partition="${m.partition}" data-month="${m.month}">`,
    `  ${rect({ x: partitionX(i), y: PARTITION.top, width: PARTITION.width, height: PARTITION.height }, 'la-card', 'data-role="bounds"')} rx="12"/>`,
    `  ${label('font-mono text-label font-semibold fill-ink', partitionX(i) + PARTITION.pad, HEADER_Y, m.partition)}`,
    `  ${label('font-sans text-offset fill-ink-muted anchor-end', partitionX(i) + PARTITION.width - PARTITION.pad, HEADER_Y, m.name)}`,
    '</g>',
  ]);
}

function keyCell(
  roles: string,
  cell: Box,
  index: Index,
  [id, playedOn]: Match,
  cellClass: string,
  animation: string,
): string[] {
  const middle = cell.x + CELL_W / 2;
  return [
    `<g ${roles} data-match="${id}" data-played-on="${playedOn}">`,
    ...(animation ? [`  ${animation}`] : []),
    `  ${rect(cell, cellClass, 'data-role="cell"')} rx="4"/>`,
    `  ${label('la-offset anchor-middle', middle, cell.y + (index.pairs ? 14 : 15), String(id))}`,
    ...(index.pairs
      ? [`  ${label('la-offset anchor-middle', middle, cell.y + 28, playedOn.slice(5))}`]
      : []),
    '</g>',
  ];
}

function leaf(i: number, index: Index, side: Side): string[] {
  const m = MONTHS[i]!;
  const x = leafX(i, side);
  const keys = leafKeys(m, side);
  const fresh = monthOf(FRESH) === i ? descend(m, index, FRESH) : null;
  const opens = fresh !== null && fresh.side === side ? fresh.slot : null;
  const shift = move(
    [
      [0, 0, 0],
      [insertArrives(6), 0, 0],
      [FRESH_AT, SLOT, 0],
      [LOOP, SLOT, 0],
    ],
    LOOP,
  );
  const free = [0, 1, 2].filter((slot) => slot >= keys.length);
  return [
    '<g data-role="page" data-page="leaf">',
    `  ${rect({ x, y: index.leafTop, width: LEAF_W, height: pageHeight(index) }, 'fill-surface stroke-violet stroke-1.5', 'data-role="frame"')} rx="6"/>`,
    ...free.map(
      (slot) =>
        `  ${rect(cellBox(i, index, side, slot), 'la-cell-tail', 'data-role="free"')} rx="4"/>`,
    ),
    ...keys.flatMap((key, slot) =>
      nest(
        keyCell(
          'data-role="key"',
          cellBox(i, index, side, slot),
          index,
          key,
          'la-cell',
          opens !== null && slot >= opens ? shift : '',
        ),
      ),
    ),
    ...(opens === null
      ? []
      : nest(
          keyCell(
            'data-role="key" data-new="true"',
            cellBox(i, index, side, opens),
            index,
            FRESH,
            'la-cell-new',
            show([[FRESH_AT, LOOP]], LOOP),
          ),
        )),
    '</g>',
  ];
}

function tree(i: number, index: Index): string[] {
  const m = MONTHS[i]!;
  const cx = centerX(i);
  const built = builtAt(index, i);
  const rootShown = show([[built + ROOT_AFTER, LOOP]], LOOP);
  const rootBottom = index.rootTop + pageHeight(index);
  const root: Box = {
    x: cx - ROOT_W / 2,
    y: index.rootTop,
    width: ROOT_W,
    height: pageHeight(index),
  };
  const separator: Box = {
    x: root.x + PAD,
    y: root.y + PAD,
    width: CELL_W,
    height: index.cellHeight,
  };
  const edge = (side: Side): string => {
    const [from, to] = [
      cx + (side === 0 ? -EDGE_SPREAD : EDGE_SPREAD),
      leafX(i, side) + LEAF_W / 2,
    ];
    return `<path class="la-arrow" d="M ${from} ${rootBottom} L ${to} ${index.leafTop}"/>`;
  };
  return [
    `<g data-role="tree" data-partition="${m.partition}" data-index="${indexName(m, index)}" data-columns="${index.columns}">`,
    `  ${show([[built, LOOP]], LOOP)}`,
    `  ${label('font-mono text-offset fill-ink-muted', partitionX(i) + PARTITION.pad, index.nameY, indexName(m, index), 'data-role="index-name"')}`,
    '  <g data-role="edges">',
    `    ${rootShown}`,
    `    ${edge(0)}`,
    `    ${edge(1)}`,
    '  </g>',
    '  <g data-role="page" data-page="root">',
    `    ${rootShown}`,
    `    ${rect(root, 'fill-surface stroke-violet stroke-1.5', 'data-role="frame"')} rx="6"/>`,
    ...nest(nest(keyCell('data-role="separator"', separator, index, m.matches[2], 'la-cell', ''))),
    '  </g>',
    ...nest(leaf(i, index, 0)),
    ...nest(leaf(i, index, 1)),
    '</g>',
  ];
}

const verdictAt = (i: number, index: Index): Point => [
  centerX(i) + VERDICT_DX,
  index.rootTop + pageHeight(index) / 2 + 4,
];

// Step 2: one probe per partition, each down its own tree, one after another.
function probes(): string[] {
  return MONTHS.flatMap((m, i) => {
    const { side, slot, found } = descend(m, BY_ID, [SOUGHT, '']);
    const cell = cellBox(i, BY_ID, side, slot);
    const [departs, arrives] = [probeDeparts(i), probeArrives(i)];
    const searched: Interval[] = [[arrives, endOf(2)]];
    return [
      `<circle data-role="probe" data-partition="${m.partition}" class="la-flow-dot" r="5">`,
      `  ${show([[departs, arrives]], LOOP)}`,
      `  ${move(descent(i, BY_ID, above(cell), departs, PROBE), LOOP)}`,
      '</circle>',
      timed(
        `data-role="search-result" data-partition="${m.partition}" data-found="${found}"`,
        `font-sans text-offset font-semibold ${found ? 'fill-emerald' : 'fill-ink-muted'}`,
        verdictAt(i, BY_ID),
        found ? `${SOUGHT} found` : `no ${SOUGHT}`,
        searched,
      ),
      ...(found ? [ring('data-role="found"', 'la-read-marker', cell, searched)] : []),
    ];
  });
}

// Step 3: January's tree holds 51042, and a second 51042 dated in February, the row step 6 inserts,
// would only ever meet February's tree.
function refusal(): string[] {
  const [first, second] = [monthOf(REPEATED), monthOf(FRESH)];
  const secondMonth = MONTHS[second]!.name.split(' ')[0]!;
  const twin = descend(MONTHS[first]!, BY_ID, [SOUGHT, '']);
  const held = cellBox(first, BY_ID, twin.side, twin.slot);
  const chip: Box = { x: centerX(second) - 24, y: UNSEEN_Y - 13, width: 48, height: 26 };
  const crossX = partitionX(second) - PARTITION.gap / 2;
  const marked: Interval[] = [[MARKS_AT, endOf(3)]];
  const cross = (dy: number): string =>
    `<line data-role="cross" class="stroke-red stroke-2.5" x1="${crossX - 5}" y1="${UNSEEN_Y - dy}" x2="${crossX + 5}" y2="${UNSEEN_Y + dy}"/>`;
  return [
    ring('data-role="first"', 'fill-none stroke-amber stroke-2.5', held, marked),
    `<g data-role="unseen" data-partition="${MONTHS[second]!.partition}">`,
    `  ${show(marked, LOOP)}`,
    `  ${rect(chip, 'fill-surface stroke-red stroke-1.5', 'data-role="chip"')} rx="6" stroke-dasharray="4 3"/>`,
    `  ${label('font-mono text-label fill-red anchor-middle', centerX(second), UNSEEN_Y + 5, String(SOUGHT))}`,
    `  ${label('font-sans text-offset fill-ink-muted anchor-middle', centerX(second), UNSEEN_Y + 34, `a second ${SOUGHT}, dated in ${secondMonth}`)}`,
    '</g>',
    '<g data-role="blind">',
    `  ${show([[BLIND_AT, endOf(3)]], LOOP)}`,
    `  <path data-role="sightline" class="fill-none stroke-red stroke-1.5" d="M ${chip.x} ${UNSEEN_Y} H ${held.x + CELL_W / 2} V ${held.y + held.height + 8}" stroke-dasharray="5 4"/>`,
    `  ${cross(5)}`,
    `  ${cross(-5)}`,
    '</g>',
  ];
}

// Steps 5 and 6: each insert goes to the partition its date picks, down the pair tree.
function inserts(): string[] {
  return [5, 6].flatMap((n) => {
    const pair = n === 5 ? REPEATED : FRESH;
    const i = monthOf(pair);
    const m = MONTHS[i]!;
    const { side, slot, found } = descend(m, BY_PAIR, pair);
    const cell = cellBox(i, BY_PAIR, side, slot);
    const [departs, arrives] = [insertDeparts(n), insertArrives(n)];
    const settled = found ? arrives : FRESH_AT;
    return [
      `<circle data-role="insert" data-match="${pair[0]}" data-played-on="${pair[1]}" data-partition="${m.partition}" data-verdict="${found ? 'refused' : 'accepted'}" class="la-flow-dot" r="5">`,
      `  ${show([[departs, settled]], LOOP)}`,
      `  ${move(descent(i, BY_PAIR, above(cell), departs, INSERT), LOOP)}`,
      '</circle>',
      timed(
        `data-role="verdict" data-played-on="${pair[1]}"`,
        `font-sans text-offset font-semibold ${found ? 'fill-red' : 'fill-emerald'}`,
        verdictAt(i, BY_PAIR),
        found ? 'pair already here' : 'new pair',
        [[settled, endOf(n)]],
      ),
      ...(found
        ? [
            ring('data-role="duplicate"', 'fill-none stroke-red stroke-2.5', cell, [
              [arrives, endOf(n)],
            ]),
          ]
        : []),
    ];
  });
}

// Step 6 ends on match 51042 in two months, in both indexes.
function twice(): string[] {
  const marks = [BY_ID, BY_PAIR].flatMap((index) =>
    [REPEATED, FRESH].map((pair) => {
      const i = monthOf(pair);
      const { side, slot } = descend(MONTHS[i]!, index, pair);
      return ring(
        'data-role="twice"',
        'fill-none stroke-amber stroke-2.5',
        cellBox(i, index, side, slot),
        [[TWICE_AT, LOOP]],
      );
    }),
  );
  return [
    ...marks,
    timed(
      'data-role="twice-note"',
      'font-sans text-label font-semibold fill-ink anchor-middle',
      [W / 2, TWICE_Y],
      `match ${SOUGHT} is now in January and in February`,
      [[TWICE_AT, LOOP]],
    ),
  ];
}

function captions(): string[] {
  return [
    `${rect({ x: MARGIN, y: CAPTION.top, width: INNER_W, height: CAPTION.height }, 'la-canvas')} rx="8"/>`,
    ...STEPS.map((step, i) =>
      timed(
        'data-role="caption"',
        'la-label anchor-middle',
        [W / 2, CAPTION.top + 23],
        step.caption,
        [[step.at, endOf(i + 1)]],
      ),
    ),
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
    '  <defs>',
    '    <marker id="head" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">',
    '      <path class="fill-flow" d="M 0 0 L 9 4.5 L 0 9 Z"/>',
    '    </marker>',
    '  </defs>',
    `  <rect class="fill-stage" width="${W}" height="${H}"/>`,
    `  ${label('la-title', MARGIN, 44, TITLE)}`,
    `  ${label('la-note', MARGIN, 68, NOTE)}`,
    ...nest(session()),
    ...nest(table()),
    ...nest(partitions()),
    // The pair trees sit under the insert dots, and the match_id trees over them, so a dot bound
    // for a pair tree passes behind the match_id tree above it.
    ...MONTHS.flatMap((_, i) => nest(tree(i, BY_PAIR))),
    ...nest(inserts()),
    ...MONTHS.flatMap((_, i) => nest(tree(i, BY_ID))),
    ...nest(probes()),
    ...nest(refusal()),
    ...nest(twice()),
    ...nest(captions()),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
