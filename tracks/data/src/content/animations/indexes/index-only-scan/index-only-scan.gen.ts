import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  escapeXml,
  type Interval,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 26;
const WIDTH = 1000;
const HEIGHT = 568;

type Point = readonly [x: number, y: number];
type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

// The story table: each step starts at `at` seconds and keeps its caption until
// the next one. Every timing in the drawing hangs off these moments and the
// lookups below.
const STEPS = [
  {
    at: 0,
    caption:
      'An index scan finds 4127 in a leaf page, then follows its pointer to table page 3 to read the tag.',
  },
  {
    at: 7,
    caption:
      'Rebuilt with INCLUDE (tag), every leaf entry stores the tag too, so the leaf already has the answer.',
  },
  {
    at: 12,
    caption:
      'The visibility map marks page 3 all-visible, so row 4127 is visible to every transaction and the scan skips the table.',
  },
  {
    at: 17,
    caption:
      "After a match, an UPDATE to player 4130's rating clears page 3's bit, so the scan must visit page 3 to check that row 4127 is visible.",
  },
] as const;
const REBUILT = STEPS[1].at;
const MAP_SHOWN = STEPS[2].at;
const UPDATE_SENT = STEPS[3].at;

// Each lookup of player 4127 leaves the query at `descends` and keeps its marks
// on screen until `ends`. Once the index covers the query, the scan checks the
// visibility map at `checks`.
type Lookup = {
  readonly pass: number;
  readonly descends: number;
  readonly checks?: number;
  readonly ends: number;
};
const LOOKUPS: readonly Lookup[] = [
  { pass: 1, descends: 0.5, ends: REBUILT },
  { pass: 2, descends: 8.5, checks: 12.5, ends: UPDATE_SENT },
  { pass: 3, descends: 19, checks: 20.75, ends: LOOP },
];

const DESCENT = 1.25; // from the query down to the leaf page
const CROSSING = 1.25; // from the leaf straight to the table
const HOP = 0.75; // from the leaf to the map, or from the map to the table
const WRITE = 1; // from the UPDATE to its row
const PAUSE = 0.25; // between one mark and the next
const GLOW = 1; // how long the new leaf cells stay marked as new
// The UPDATE's write lands: page 3 changes and its bit clears.
const WRITTEN = UPDATE_SENT + PAUSE + WRITE;

type Player = { readonly id: number; readonly tag: string; readonly rating: number };
type Page = { readonly page: number; readonly rows: readonly Player[] };

// The players table. Rows sit on a page in the order they were written, not by player id.
const PAGES: readonly Page[] = [
  {
    page: 2,
    rows: [
      { id: 4146, tag: 'Yak', rating: 7105 },
      { id: 4163, tag: 'Xerus', rating: 4980 },
    ],
  },
  {
    page: 3,
    rows: [
      { id: 4127, tag: 'Tapir', rating: 8410 },
      { id: 4130, tag: 'Walrus', rating: 6215 },
    ],
  },
  {
    page: 4,
    rows: [
      { id: 4109, tag: 'Vole', rating: 5320 },
      { id: 4088, tag: 'Zebu', rating: 7760 },
    ],
  },
];
const SOUGHT = 4127;
const QUERY = `SELECT tag FROM players WHERE player_id = ${SOUGHT};`;
// A match moves player 4130's rating up by 25.
const UPDATE = { id: 4130, gain: 25 } as const;
// The root page sends player ids from 4100 up to 4150 to the one leaf drawn in full.
const SEPARATORS = [4100, 4150] as const;

type Place = { readonly page: number; readonly row: number; readonly player: Player };
function placeOf(id: number): Place {
  for (const { page, rows } of PAGES) {
    const row = rows.findIndex((player) => player.id === id);
    if (row !== -1) return { page, row, player: rows[row]! };
  }
  throw new Error(`no row holds player ${id}`);
}
const SOUGHT_PLACE = placeOf(SOUGHT);
const UPDATE_PLACE = placeOf(UPDATE.id);
const NEW_RATING = UPDATE_PLACE.player.rating + UPDATE.gain;

type Entry = Player & { readonly page: number };
const ENTRIES: readonly Entry[] = PAGES.flatMap(({ page, rows }) =>
  rows.map((player) => ({ ...player, page })),
)
  .filter(({ id }) => id >= SEPARATORS[0] && id < SEPARATORS[1])
  .sort((a, b) => a.id - b.id);
const SOUGHT_ENTRY = ENTRIES.findIndex(({ id }) => id === SOUGHT);

const TITLE = 'Answering from the index alone';
const NOTE =
  "An index-only scan skips the table when the leaf has every column the query reads and the row's page is all-visible.";
const DESC =
  "An animation in four steps. An index on players (player_id) finds player 4127 in a leaf page, and an index scan follows the entry's pointer to table page 3 to read the tag. " +
  'The index is then rebuilt with INCLUDE (tag), so every leaf entry stores the tag too. ' +
  'The visibility map marks page 3 all-visible, so the next lookup returns the tag, Tapir, from the leaf and never reads the table. ' +
  "Then a match changes player 4130's rating, also on page 3. That UPDATE clears the page's bit, and the lookup has to visit page 3 to check that row 4127 is visible.";

const CELL_HEIGHT = 24;
const ROW_STEP = 30;
const KEY_WIDTH = 44;
const TAG_WIDTH = 84;
const RATING_WIDTH = 56;
const POINTER_WIDTH = 56;
const ROOT_CELL = 48;
const BIT_WIDTH = 28;

// The two statement boxes on top, the three panels below them, and the result strip.
const SQL: Box = { left: 32, top: 88, width: 536, height: 64 };
const UPDATE_BOX: Box = { left: 592, top: 88, width: 376, height: 64 };
const LINE_1 = 114;
const LINE_2 = 136;
const INDEX: Box = { left: 32, top: 176, width: 392, height: 300 };
const MAP: Box = { left: 448, top: 176, width: 120, height: 300 };
const TABLE: Box = { left: 592, top: 176, width: 376, height: 300 };
const PANEL_LABEL_Y = 200;
const RESULT: Box = { left: 32, top: 490, width: 936, height: 34 };
const RESULT_Y = RESULT.top + 22;
// Where each field of the result strip puts its label and its value.
const FIELDS = {
  plan: { label: 'plan', at: RESULT.left + 16, value: 84 },
  result: { label: 'result', at: 300, value: 348 },
  visits: { label: 'table visits', at: 720, value: 808 },
} as const;
const CAPTION_Y = 550;

// The table's pages, stacked top to bottom.
const COLUMN_Y = 222;
const PAGE_LEFT = 604;
const PAGE_WIDTH = 352;
const PAGE_HEIGHT = 70;
const FIRST_PAGE_TOP = 232;
const PAGE_STEP = 80;
const ROW_X = { key: 616, tag: 666, rating: 756 } as const;
const pageTop = (page: number): number =>
  FIRST_PAGE_TOP + PAGES.findIndex((p) => p.page === page) * PAGE_STEP;
const rowTop = (page: number, row: number): number => pageTop(page) + 8 + row * ROW_STEP;

// The leaf drawn in full sits so that 4127's entry lines up with its row on
// page 3, and the scan's path to the map and the table runs straight.
const ENTRY_X = { key: 128, tag: 180, pointer: 272 } as const;
const entryTop = (i: number): number =>
  rowTop(SOUGHT_PLACE.page, SOUGHT_PLACE.row) + (i - SOUGHT_ENTRY) * ROW_STEP;
const LEAF: Box = {
  left: 118,
  top: entryTop(0) - 10,
  width: 220,
  height: (ENTRIES.length - 1) * ROW_STEP + CELL_HEIGHT + 20,
};
const LANE = entryTop(SOUGHT_ENTRY) + CELL_HEIGHT / 2;
const ROOT: Box = { left: 169, top: 212, width: 118, height: 36 };
const TREE_X = ROOT.left + ROOT.width / 2;
const rootCellLeft = (i: number): number => ROOT.left + 6 + i * (ROOT_CELL + 10);
const LEFT_STUB: Box = { left: 48, top: LEAF.top, width: 58, height: 30 };
const RIGHT_STUB: Box = { left: 350, top: LEAF.top, width: 58, height: 30 };
const LEAF_LABEL_Y = LEAF.top + 54;

const MAP_X = MAP.left + MAP.width / 2;
const BIT_LEFT = MAP_X - BIT_WIDTH / 2;

// The marks a lookup leaves on the cells it reads.
const FOUND_RING: Box = {
  left: LEAF.left + 4,
  top: entryTop(SOUGHT_ENTRY) - 4,
  width: LEAF.width - 8,
  height: CELL_HEIGHT + 8,
};
const ROW_RIGHT = ROW_X.rating + RATING_WIDTH;
const VISIT_RING: Box = {
  left: ROW_X.key - 6,
  top: rowTop(SOUGHT_PLACE.page, SOUGHT_PLACE.row) - 4,
  width: ROW_RIGHT + 12 - ROW_X.key,
  height: CELL_HEIGHT + 8,
};
const LEAF_TAG: Box = {
  left: ENTRY_X.tag,
  top: entryTop(SOUGHT_ENTRY),
  width: TAG_WIDTH,
  height: CELL_HEIGHT,
};
const TABLE_TAG: Box = {
  left: ROW_X.tag,
  top: rowTop(SOUGHT_PLACE.page, SOUGHT_PLACE.row),
  width: TAG_WIDTH,
  height: CELL_HEIGHT,
};
const SOUGHT_BIT: Box = {
  left: BIT_LEFT,
  top: rowTop(SOUGHT_PLACE.page, 0),
  width: BIT_WIDTH,
  height: CELL_HEIGHT,
};

// The paths a lookup and the UPDATE travel.
const DESCENT_PATH: readonly Point[] = [
  [TREE_X, SQL.top + SQL.height],
  [TREE_X, LEAF.top],
];
const LEAF_EXIT = LEAF.left + LEAF.width;
const LEAF_TO_TABLE: readonly Point[] = [
  [LEAF_EXIT, LANE],
  [PAGE_LEFT, LANE],
];
const LEAF_TO_MAP: readonly Point[] = [
  [LEAF_EXIT, LANE],
  [BIT_LEFT - 4, LANE],
];
const MAP_TO_TABLE: readonly Point[] = [
  [BIT_LEFT + BIT_WIDTH, LANE],
  [PAGE_LEFT, LANE],
];
const UPDATED_Y = rowTop(UPDATE_PLACE.page, UPDATE_PLACE.row) + CELL_HEIGHT / 2;
const MARGIN_X = UPDATE_BOX.left + UPDATE_BOX.width + 16;
const WRITE_PATH: readonly Point[] = [
  [UPDATE_BOX.left + UPDATE_BOX.width, UPDATE_BOX.top + UPDATE_BOX.height / 2],
  [MARGIN_X, UPDATE_BOX.top + UPDATE_BOX.height / 2],
  [MARGIN_X, UPDATED_Y],
  [ROW_RIGHT + 6, UPDATED_Y],
];

// When a lookup reaches the leaf, and when it has read the visibility map bit.
const found = (lookup: Lookup): number => lookup.descends + DESCENT;
const checked = (lookup: Lookup): number | null =>
  lookup.checks === undefined ? null : lookup.checks + HOP;
// The scan checks the visibility map only once the index covers the query.
const covered = (lookup: Lookup): boolean => lookup.checks !== undefined;

type Fetch = { readonly start: number; readonly end: number; readonly path: readonly Point[] };
// An index scan always reads the table. An index-only scan reads it only when
// the row's page has lost its all-visible bit by the time the scan checks it.
function fetchOf(lookup: Lookup): Fetch | null {
  const check = checked(lookup);
  if (check === null) {
    const start = found(lookup) + PAUSE;
    return { start, end: start + CROSSING, path: LEAF_TO_TABLE };
  }
  if (check < WRITTEN) return null;
  return { start: check, end: check + HOP, path: MAP_TO_TABLE };
}
// The tag is read from the leaf when a covering index finds the entry, and
// from the table when an index scan's fetch arrives.
function readAt(lookup: Lookup): number {
  const fetch = fetchOf(lookup);
  return !covered(lookup) && fetch ? fetch.end : found(lookup);
}
const doneAt = (lookup: Lookup): number =>
  (fetchOf(lookup)?.end ?? checked(lookup) ?? found(lookup)) + PAUSE;

const indent = (lines: readonly string[]): string[] => lines.map((line) => `  ${line}`);
function element(open: string, children: readonly string[]): string[] {
  const tag = open.split(' ')[0] ?? open;
  return [`<${open}>`, ...indent(children), `</${tag}>`];
}
const group = (attrs: string, children: readonly string[]): string[] =>
  element(`g ${attrs}`, children);
const timed = (intervals: readonly Interval[]): string => show(intervals, LOOP);

const geometry = ({ left, top, width, height }: Box, rx: number): string =>
  `x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}"`;

function rect(attrs: string, box: Box, rx: number): string {
  return `<rect ${attrs} ${geometry(box, rx)}/>`;
}

function timedRect(attrs: string, box: Box, rx: number, shown: Interval): string[] {
  return element(`rect ${attrs} ${geometry(box, rx)}`, [timed([shown])]);
}

function text(attrs: string, x: number, y: number, words: string): string {
  return `<text ${attrs} x="${x}" y="${y}">${escapeXml(words)}</text>`;
}

function timedText(attrs: string, x: number, y: number, words: string, shown: Interval): string {
  return `<text ${attrs} x="${x}" y="${y}">${escapeXml(words)}${timed([shown])}</text>`;
}

function cell(classes: string, left: number, top: number, width: number, words: string): string[] {
  return [
    rect(`class="${classes}"`, { left, top, width, height: CELL_HEIGHT }, 4),
    text('class="la-offset anchor-middle"', left + width / 2, top + 16, words),
  ];
}

const polyline = (points: readonly Point[]): string =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

// Waypoints that cross a polyline at constant speed between two moments,
// holding still before and after.
function travel(points: readonly Point[], from: number, to: number): Waypoint[] {
  const lengths = points
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - points[i]![0], y - points[i]![1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let walked = 0;
  return [
    [0, ...first],
    [from, ...first],
    ...lengths.map((length, i): Waypoint => {
      walked += length;
      return [from + ((to - from) * walked) / total, ...points[i + 1]!];
    }),
    [LOOP, ...last],
  ];
}

function statements(): string[] {
  const x = SQL.left + 16;
  const ink = 'class="fill-ink font-mono text-offset"';
  return [
    rect('class="la-canvas stroke-1.5"', SQL, 8),
    ...group('data-role="index-definition" data-covering="false"', [
      timed([[0, REBUILT]]),
      text(ink, x, LINE_1, 'CREATE INDEX ON players (player_id);'),
    ]),
    ...group('data-role="index-definition" data-covering="true"', [
      timed([[REBUILT, LOOP]]),
      `<text ${ink} x="${x}" y="${LINE_1}">CREATE INDEX ON players (player_id) <tspan class="font-bold">INCLUDE (tag)</tspan>;</text>`,
    ]),
    text(`data-role="query" ${ink}`, x, LINE_2, QUERY),
  ];
}

function updateStatement(): string[] {
  const x = UPDATE_BOX.left + 16;
  const ink = 'class="fill-ink font-mono text-offset"';
  return group('data-role="update"', [
    timed([[UPDATE_SENT, LOOP]]),
    rect('class="fill-surface stroke-amber stroke-1.5"', UPDATE_BOX, 8),
    text(ink, x, LINE_1, `UPDATE players SET rating = rating + ${UPDATE.gain}`),
    text(ink, x, LINE_2, `WHERE player_id = ${UPDATE.id};`),
  ]);
}

function arrow([x1, y1]: Point, [x2, y2]: Point): string {
  return `<path class="la-arrow" d="M ${x1} ${y1} L ${x2} ${y2}" marker-end="url(#head)"/>`;
}

function entry(e: Entry, i: number): string[] {
  const top = entryTop(i);
  const slot: Box = { left: ENTRY_X.tag, top, width: TAG_WIDTH, height: CELL_HEIGHT };
  return group(`data-role="entry" data-key="${e.id}"`, [
    ...cell('la-cell', ENTRY_X.key, top, KEY_WIDTH, String(e.id)),
    ...group(`data-role="included" data-key="${e.id}"`, [
      timed([[REBUILT, LOOP]]),
      rect('class="la-cell"', slot, 4),
      ...timedRect('class="la-cell-new"', slot, 4, [REBUILT, REBUILT + GLOW]),
      text('class="la-offset anchor-middle"', slot.left + TAG_WIDTH / 2, top + 16, e.tag),
    ]),
    ...group(
      'data-role="pointer"',
      cell('la-cell', ENTRY_X.pointer, top, POINTER_WIDTH, `page ${e.page}`),
    ),
  ]);
}

function indexPanel(): string[] {
  const muted = 'class="fill-ink-muted font-sans text-offset"';
  const rootBottom = ROOT.top + ROOT.height;
  const intoLeaves = LEAF.top - 2;
  const stub = (box: Box): string[] =>
    group('data-role="leaf-stub"', [
      rect('class="la-canvas stroke-1.5"', box, 6),
      text(
        'class="fill-ink-muted font-mono text-offset anchor-middle"',
        box.left + box.width / 2,
        box.top + 19,
        '\u2026',
      ),
    ]);
  return [
    rect('class="la-card"', INDEX, 12),
    text('class="la-label"', INDEX.left + 16, PANEL_LABEL_Y, 'index on player_id'),
    text(muted, INDEX.left + 16, ROOT.top + 22, 'root page'),
    text(muted, INDEX.left + 16, LEAF_LABEL_Y, 'leaf pages'),
    arrow([TREE_X, SQL.top + SQL.height], [TREE_X, ROOT.top - 2]),
    arrow([rootCellLeft(0), rootBottom], [LEFT_STUB.left + LEFT_STUB.width / 2, intoLeaves]),
    arrow([TREE_X, rootBottom], [TREE_X, intoLeaves]),
    arrow(
      [rootCellLeft(1) + ROOT_CELL, rootBottom],
      [RIGHT_STUB.left + RIGHT_STUB.width / 2, intoLeaves],
    ),
    ...group('data-role="root-page"', [
      rect('class="la-canvas stroke-1.5"', ROOT, 6),
      ...SEPARATORS.flatMap((key, i) =>
        cell('la-cell', rootCellLeft(i), ROOT.top + 6, ROOT_CELL, String(key)),
      ),
    ]),
    ...stub(LEFT_STUB),
    ...stub(RIGHT_STUB),
    ...group('data-role="leaf-page"', [
      rect('class="la-canvas stroke-1.5"', LEAF, 6),
      ...ENTRIES.flatMap(entry),
    ]),
  ];
}

function bitsFor(page: number): string[] {
  const top = rowTop(page, 0);
  const bit = (allVisible: boolean, shown: Interval | null): string[] =>
    group(`data-role="bit" data-page="${page}" data-all-visible="${allVisible}"`, [
      ...(shown ? [timed([shown])] : []),
      ...cell(
        allVisible ? 'la-cell' : 'la-cell-new',
        BIT_LEFT,
        top,
        BIT_WIDTH,
        allVisible ? '1' : '0',
      ),
    ]);
  if (page !== UPDATE_PLACE.page) return bit(true, null);
  return [...bit(true, [0, WRITTEN]), ...bit(false, [WRITTEN, LOOP])];
}

function visibilityMap(): string[] {
  return group('data-role="visibility-map"', [
    timed([[MAP_SHOWN, LOOP]]),
    rect('class="la-card"', MAP, 12),
    text('class="la-label anchor-middle"', MAP_X, PANEL_LABEL_Y, 'visibility map'),
    ...PAGES.flatMap(({ page }) => bitsFor(page)),
    text(
      'class="fill-ink-muted font-sans text-offset anchor-middle"',
      MAP_X,
      MAP.top + MAP.height - 16,
      '1 = all-visible',
    ),
  ]);
}

function tableRow(page: number, row: number, player: Player): string[] {
  const top = rowTop(page, row);
  const rating = cell('la-cell', ROW_X.rating, top, RATING_WIDTH, String(player.rating));
  const ratings =
    player.id === UPDATE.id
      ? [
          ...group('data-role="rating"', [timed([[0, WRITTEN]]), ...rating]),
          ...group('data-role="changed"', [
            timed([[WRITTEN, LOOP]]),
            ...cell('la-cell-new', ROW_X.rating, top, RATING_WIDTH, String(NEW_RATING)),
          ]),
        ]
      : group('data-role="rating"', rating);
  return group(`data-role="row" data-key="${player.id}"`, [
    ...cell('la-cell', ROW_X.key, top, KEY_WIDTH, String(player.id)),
    ...group('data-role="tag"', cell('la-cell', ROW_X.tag, top, TAG_WIDTH, player.tag)),
    ...ratings,
  ]);
}

function tablePanel(): string[] {
  const header = 'class="fill-ink-muted font-mono text-offset anchor-middle"';
  return [
    rect('class="la-card"', TABLE, 12),
    text('class="la-label"', TABLE.left + 16, PANEL_LABEL_Y, 'table players'),
    text(header, ROW_X.key + KEY_WIDTH / 2, COLUMN_Y, 'player_id'),
    text(header, ROW_X.tag + TAG_WIDTH / 2, COLUMN_Y, 'tag'),
    text(header, ROW_X.rating + RATING_WIDTH / 2, COLUMN_Y, 'rating'),
    ...PAGES.flatMap(({ page, rows }) =>
      group(`data-role="table-page" data-page="${page}"`, [
        rect(
          'class="la-canvas stroke-1.5"',
          { left: PAGE_LEFT, top: pageTop(page), width: PAGE_WIDTH, height: PAGE_HEIGHT },
          6,
        ),
        text(
          'class="fill-ink-muted font-sans text-offset anchor-end"',
          PAGE_LEFT + PAGE_WIDTH - 12,
          rowTop(page, 0) + 16,
          `page ${page}`,
        ),
        ...rows.flatMap((player, row) => tableRow(page, row, player)),
      ]),
    ),
  ];
}

function route(lookup: Lookup, path: readonly Point[], from: number): string[] {
  return element(
    `path data-role="route" data-pass="${lookup.pass}" class="la-arrow" d="${polyline(path)}" stroke-dasharray="5 4" marker-end="url(#head)"`,
    [timed([[from, lookup.ends]])],
  );
}

function routes(lookup: Lookup): string[] {
  const fetch = fetchOf(lookup);
  return [
    ...(lookup.checks === undefined ? [] : route(lookup, LEAF_TO_MAP, lookup.checks)),
    ...(fetch ? route(lookup, fetch.path, fetch.start) : []),
  ];
}

function write(): string[] {
  const start = UPDATE_SENT + PAUSE;
  return group('data-role="write"', [
    timed([[start, WRITTEN]]),
    `<path class="fill-none stroke-amber stroke-1.5" d="${polyline(WRITE_PATH)}" stroke-dasharray="5 4" marker-end="url(#head-new)"/>`,
    ...element('circle class="la-flow-dot" r="5"', [
      move(travel(WRITE_PATH, start, WRITTEN), LOOP),
    ]),
  ]);
}

function marks(lookup: Lookup): string[] {
  const pass = `data-pass="${lookup.pass}"`;
  const ring = 'class="fill-none stroke-amber stroke-1.5"';
  const fetch = fetchOf(lookup);
  const check = checked(lookup);
  const from = covered(lookup) ? 'leaf' : 'table';
  return [
    ...timedRect(`data-role="found" ${pass} data-key="${SOUGHT}" ${ring}`, FOUND_RING, 6, [
      found(lookup),
      lookup.ends,
    ]),
    ...(check !== null && !fetch
      ? timedRect(
          `data-role="bit-read" ${pass} data-page="${SOUGHT_PLACE.page}" class="la-read-marker"`,
          SOUGHT_BIT,
          4,
          [check, lookup.ends],
        )
      : []),
    ...(fetch
      ? timedRect(`data-role="visit" ${pass} ${ring}`, VISIT_RING, 6, [fetch.end, lookup.ends])
      : []),
    ...timedRect(
      `data-role="read" ${pass} data-from="${from}" class="la-read-marker"`,
      from === 'table' ? TABLE_TAG : LEAF_TAG,
      4,
      [readAt(lookup), lookup.ends],
    ),
  ];
}

function dot(
  role: string,
  lookup: Lookup,
  path: readonly Point[],
  from: number,
  to: number,
): string[] {
  return element(
    `circle data-role="${role}" data-pass="${lookup.pass}" class="la-flow-dot" r="5"`,
    [timed([[from, to]]), move(travel(path, from, to), LOOP)],
  );
}

function dots(lookup: Lookup): string[] {
  const fetch = fetchOf(lookup);
  return [
    ...dot('descent', lookup, DESCENT_PATH, lookup.descends, found(lookup)),
    ...(lookup.checks === undefined
      ? []
      : dot('check', lookup, LEAF_TO_MAP, lookup.checks, lookup.checks + HOP)),
    ...(fetch ? dot('fetch', lookup, fetch.path, fetch.start, fetch.end) : []),
  ];
}

function result(lookup: Lookup): string {
  const { tag } = SOUGHT_PLACE.player;
  const [from, words] = covered(lookup)
    ? ['leaf', `${tag}, from the leaf`]
    : ['table', `${tag}, from table page ${SOUGHT_PLACE.page}`];
  return timedText(
    `data-role="result" data-pass="${lookup.pass}" data-from="${from}" class="fill-ink font-sans text-label"`,
    FIELDS.result.value,
    RESULT_Y,
    words,
    [doneAt(lookup), lookup.ends],
  );
}

function tableVisits(lookup: Lookup): string[] {
  const fetch = fetchOf(lookup);
  const count = (n: number, shown: Interval): string =>
    timedText(
      `data-role="table-visits" data-pass="${lookup.pass}" data-count="${n}" class="fill-ink font-mono text-label font-semibold"`,
      FIELDS.visits.value,
      RESULT_Y,
      String(n),
      shown,
    );
  return fetch
    ? [count(0, [lookup.descends, fetch.end]), count(1, [fetch.end, lookup.ends])]
    : [count(0, [lookup.descends, lookup.ends])];
}

function plan(name: string, shown: Interval): string {
  return timedText(
    `data-role="plan" data-plan="${name}" class="fill-ink font-sans text-label font-semibold"`,
    FIELDS.plan.value,
    RESULT_Y,
    name,
    shown,
  );
}

function resultStrip(): string[] {
  const muted = 'class="fill-ink-muted font-sans text-offset"';
  return [
    rect('class="la-canvas stroke-1.5"', RESULT, 8),
    ...Object.values(FIELDS).map(({ label, at }) => text(muted, at, RESULT_Y, label)),
    plan('Index Scan', [0, REBUILT]),
    plan('Index Only Scan', [REBUILT, LOOP]),
    ...LOOKUPS.map(result),
    ...LOOKUPS.flatMap(tableVisits),
  ];
}

function captions(): string[] {
  return STEPS.map(({ at, caption }, i) =>
    timedText('data-role="caption" class="la-label"', 32, CAPTION_Y, caption, [
      at,
      STEPS[i + 1]?.at ?? LOOP,
    ]),
  );
}

function marker(id: string, classes: string): string[] {
  return element(
    `marker id="${id}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"`,
    [`<path class="${classes}" d="M 0 0 L 9 4.5 L 0 9 Z"/>`],
  );
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" data-loop="${LOOP}s">`,
    `  <title>${escapeXml(TITLE)}</title>`,
    `  <desc>${escapeXml(DESC)}</desc>`,
    '  <style>',
    '/* LA-STYLE:START */',
    '/* LA-STYLE:END */',
    '</style>',
    ...indent([
      ...element('defs', [...marker('head', 'fill-flow'), ...marker('head-new', 'fill-amber')]),
      `<rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
      text('class="la-title"', 32, 44, TITLE),
      text('class="la-note"', 32, 68, NOTE),
      ...statements(),
      ...updateStatement(),
      ...indexPanel(),
      ...visibilityMap(),
      ...tablePanel(),
      ...LOOKUPS.flatMap(routes),
      ...write(),
      ...LOOKUPS.flatMap(marks),
      ...LOOKUPS.flatMap(dots),
      ...resultStrip(),
      ...captions(),
    ]),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
