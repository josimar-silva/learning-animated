import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, move, show, type Waypoint } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const WIDTH = 1000;
const HEIGHT = 520;
// The player who signs in: the key the lookup searches for.
const PLAYER_ID = 4127;

type Point = readonly [x: number, y: number];

// The index on players(player_id). Each leaf page holds two player ids, in order.
const LEAF_KEYS: ReadonlyArray<readonly number[]> = [
  [1042, 1385],
  [1830, 2104],
  [2477, 2981],
  [3608, 4127],
  [4581, 4930],
  [5214, 5560],
  [6302, 6730],
  [7085, 7611],
  [8090, 8812],
];
// Downlinks per internal page: one before, one between, and one after its two separators.
const FANOUT = 3;

const CELL = { width: 34, height: 22 } as const;
const PAD = 4;
const SLOT = 12;
const KEY_GAP = 2;
const PAGE_HEIGHT = CELL.height + 2 * PAD;
const LEAF_WIDTH = 2 * CELL.width + KEY_GAP + 2 * PAD;
const INTERNAL_WIDTH = 2 * CELL.width + 3 * SLOT + 2 * PAD;
// The leaves under one internal page sit in a group, and the three groups fill the leaf row.
const LEAF_GAP = 8;
const GROUP_GAP = 22;
const GROUP_WIDTH = FANOUT * LEAF_WIDTH + (FANOUT - 1) * LEAF_GAP;
const LEAVES_LEFT = (WIDTH - FANOUT * GROUP_WIDTH - (FANOUT - 1) * GROUP_GAP) / 2;
const groupLeft = (g: number): number => LEAVES_LEFT + g * (GROUP_WIDTH + GROUP_GAP);
// The top of each level, from the leaves (level 0) up to the root (level 2).
const LEVEL_TOP = [328, 244, 160] as const;
// How far above a page the search key waits while that page is read.
const HOVER = 14;

type Page = {
  readonly id: string;
  readonly level: number;
  readonly keys: readonly number[];
  readonly children: readonly Page[];
  readonly left: number;
  readonly top: number;
  readonly width: number;
};

const leaves: Page[] = LEAF_KEYS.map((keys, i) => ({
  id: `leaf-${i + 1}`,
  level: 0,
  keys,
  children: [],
  left: groupLeft(Math.floor(i / FANOUT)) + (i % FANOUT) * (LEAF_WIDTH + LEAF_GAP),
  top: LEVEL_TOP[0],
  width: LEAF_WIDTH,
}));

const firstKey = (p: Page): number => (p.children[0] ? firstKey(p.children[0]) : p.keys[0]!);

// A separator is the first key under the downlink to its right.
function internal(id: string, level: number, children: Page[], middle: number): Page {
  return {
    id,
    level,
    keys: children.slice(1).map(firstKey),
    children,
    left: middle - INTERNAL_WIDTH / 2,
    top: LEVEL_TOP[level]!,
    width: INTERNAL_WIDTH,
  };
}

const internals = Array.from({ length: FANOUT }, (_, g) =>
  internal(
    `internal-${g + 1}`,
    1,
    leaves.slice(g * FANOUT, (g + 1) * FANOUT),
    groupLeft(g) + GROUP_WIDTH / 2,
  ),
);
const root = internal('root', 2, internals, WIDTH / 2);
const PAGES: readonly Page[] = [root, ...internals, ...leaves];
const LEVELS = root.level + 1;
const KEY_COUNT = leaves.reduce((count, leaf) => count + leaf.keys.length, 0);

// The search follows the downlink past every separator at or below the key.
const slotFor = (p: Page): number => p.keys.filter((key) => key <= PLAYER_ID).length;
const descend = (p: Page): Page[] =>
  p.children.length === 0 ? [p] : [p, ...descend(p.children[slotFor(p)]!)];
const PATH = descend(root);
const LEAF = PATH[PATH.length - 1]!;
const ENTRY = LEAF.keys.indexOf(PLAYER_ID);

// One row per page the search reads: the key arrives over it, looks along it (the comparison
// shows), picks a downlink (on the leaf, lands on its entry), and leaves when the read is done.
type Visit = {
  readonly arrive: number;
  readonly look: number;
  readonly pick: number;
  readonly leave: number;
};
const VISITS: readonly Visit[] = [
  { arrive: 0.5, look: 1, pick: 2, leave: 3 },
  { arrive: 4, look: 4.5, pick: 5.5, leave: 7 },
  { arrive: 8, look: 8.5, pick: 9, leave: 11 },
];
const visitOf = (i: number): Visit => VISITS[i]!;
const SLIDE = 0.5;
// After the key lands on its leaf entry, the pointer shows, then the row it points to.
const POINTER = 10;
const FETCHED = 10.6;
// Step 4: the extra level and what it would reach.
const REACH = 12;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    "Player 4127 signs in. The root's separators send 4127 to one child: it falls between 3608 and 6302, so the search takes the middle downlink.",
  ],
  [
    4,
    'An internal page narrows it down again: 4127 is below 4581, so the search takes the leftmost downlink to a leaf.',
  ],
  [
    8,
    "The leaf holds 4127 and a pointer to its row in the players table, and Tapir's profile loads.",
  ],
  [
    12,
    'That took three page reads, one per level. One more level would multiply the keys within reach by the fanout, 3 here.',
  ],
];

const TITLE = 'Finding one key';
const NOTE = 'Player 4127 signs in, and the index on players(player_id) reads one page per level.';
const QUERY = `SELECT * FROM players WHERE player_id = ${PLAYER_ID}`;
const DESC =
  'An animation in four steps. Player 4127 signs in, and the game loads the profile through the index on players(player_id), a B-tree with one root page, three internal pages, and nine leaf pages, each holding two keys. ' +
  'The search reads the root, where 4127 falls between the separators 3608 and 6302, so it takes the middle downlink. ' +
  'The internal page below sends it down the leftmost downlink, because 4127 is below 4581. ' +
  "The leaf holds 4127 and a pointer to its row in the players table, and Tapir's profile loads. " +
  'The lookup took three page reads, one per level. A dashed fourth level then shows that one more level would multiply the keys within reach by the fanout of 3, from 18 to 54, for one more page read.';

const round = (n: number): number => Math.round(n * 10) / 10;
const attributes = (data: Readonly<Record<string, string | number>>): string =>
  Object.entries(data)
    .map(([name, value]) => ` data-${name}="${value}"`)
    .join('');
const text = (
  classes: string,
  x: number,
  y: number,
  words: string,
  data: Readonly<Record<string, string | number>> = {},
  timing = '',
): string =>
  `<text${attributes(data)} class="${classes}" x="${x}" y="${y}">${escapeXml(words)}${timing}</text>`;

const middleY = (p: Page): number => p.top + PAGE_HEIGHT / 2;
const bottom = (p: Page): number => p.top + PAGE_HEIGHT;
const centerX = (p: Page): number => p.left + p.width / 2;
const cellLeft = (p: Page, i: number): number =>
  p.children.length === 0
    ? p.left + PAD + i * (CELL.width + KEY_GAP)
    : p.left + PAD + SLOT + i * (CELL.width + SLOT);
const slotX = (p: Page, slot: number): number =>
  p.left + PAD + SLOT / 2 + slot * (CELL.width + SLOT);

// A downlink drops from its slot to the page's bottom edge, then runs to the top of the child.
function downlink(p: Page, slot: number): string {
  const child = p.children[slot]!;
  const x = slotX(p, slot);
  return `M ${x} ${middleY(p)} V ${bottom(p)} L ${centerX(child)} ${child.top - 1}`;
}

// Where the search key waits above a child: on the downlink that leads to it.
function hoverOn(p: Page, slot: number): Point {
  const child = p.children[slot]!;
  const [x0, y0, x1, y1] = [slotX(p, slot), bottom(p), centerX(child), child.top];
  const y = child.top - HOVER;
  return [round(x0 + ((x1 - x0) * (y - y0)) / (y1 - y0)), y];
}

type Move = { readonly from: number; readonly to: number; readonly via: readonly Point[] };

// Waypoints for a token that holds still between moves and crosses each move at constant speed.
function journey(start: Point, moves: readonly Move[]): Waypoint[] {
  const waypoints: Waypoint[] = [[0, ...start]];
  let here = start;
  for (const { from, to, via } of moves) {
    const points = [here, ...via];
    const lengths = points
      .slice(1)
      .map(([x, y], i) => Math.hypot(x - points[i]![0], y - points[i]![1]));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    if (total === 0) continue;
    if (from > 0) waypoints.push([from, ...here]);
    let walked = 0;
    lengths.forEach((length, i) => {
      walked += length;
      waypoints.push([from + ((to - from) * walked) / total, ...points[i + 1]!]);
    });
    here = points[points.length - 1]!;
  }
  waypoints.push([LOOP, ...here]);
  return waypoints;
}

function keyRoute(): Waypoint[] {
  // The key drops in from the space above the root, then waits over it.
  const start: Point = [centerX(root), root.top - HOVER - 34];
  const moves: Move[] = [
    { from: 0, to: visitOf(0).arrive, via: [[centerX(root), root.top - HOVER]] },
  ];
  PATH.forEach((p, i) => {
    const visit = visitOf(i);
    if (p === LEAF) {
      const landing: Point = [cellLeft(p, ENTRY) + CELL.width / 2, middleY(p)];
      moves.push({ from: visit.look, to: visit.pick, via: [landing] });
      return;
    }
    const slot = slotFor(p);
    moves.push({
      from: visit.look,
      to: visit.look + SLIDE,
      via: [[slotX(p, slot), p.top - HOVER]],
    });
    moves.push({
      from: visit.leave,
      to: visitOf(i + 1).arrive,
      via: [[slotX(p, slot), bottom(p)], hoverOn(p, slot)],
    });
  });
  return journey(start, moves);
}

function page(p: Page): string {
  const entries = p.keys.map((key, i) =>
    [
      '    <g data-role="entry">',
      `      <rect class="la-cell" x="${cellLeft(p, i)}" y="${p.top + PAD}" width="${CELL.width}" height="${CELL.height}" rx="3"/>`,
      `      ${text('la-offset anchor-middle', cellLeft(p, i) + CELL.width / 2, p.top + PAD + 15, String(key))}`,
      '    </g>',
    ].join('\n'),
  );
  const slots = p.children.map(
    (_, slot) =>
      `    <circle class="fill-flow" cx="${slotX(p, slot)}" cy="${middleY(p)}" r="2.5"/>`,
  );
  return [
    `  <g data-role="page" data-page="${p.id}" data-level="${p.level}">`,
    `    <rect data-role="frame" class="la-card" x="${p.left}" y="${p.top}" width="${p.width}" height="${PAGE_HEIGHT}" rx="6"/>`,
    ...entries,
    ...slots,
    '  </g>',
  ].join('\n');
}

function downlinks(): string {
  return PAGES.flatMap((p) =>
    p.children.map(
      (child, slot) =>
        `  <path data-role="downlink" data-from="${p.id}" data-to="${child.id}" data-slot="${slot}" class="la-arrow" d="${downlink(p, slot)}" marker-end="url(#head)"/>`,
    ),
  ).join('\n');
}

function levelLabels(): string {
  const names = ['leaf pages', 'internal pages', 'root page'];
  return names
    .map((name, level) =>
      text(
        'fill-ink-muted font-sans text-offset',
        32,
        LEVEL_TOP[level]! + PAGE_HEIGHT / 2 + 4,
        name,
      ),
    )
    .map((label) => `  ${label}`)
    .join('\n');
}

// The marks a read leaves on the path: the downlink taken, the page while it is read, and the
// page once it has been read.
function readMarks(): string {
  const followed = PATH.slice(0, -1).map((p, i) => {
    const slot = slotFor(p);
    return `  <path data-role="followed" data-from="${p.id}" data-to="${p.children[slot]!.id}" class="fill-none stroke-emerald stroke-2.5" d="${downlink(p, slot)}" marker-end="url(#head-read)">${show([[visitOf(i).pick, LOOP]], LOOP)}</path>`;
  });
  const frame = (p: Page): string =>
    `x="${p.left}" y="${p.top}" width="${p.width}" height="${PAGE_HEIGHT}" rx="6"`;
  const marks = PATH.flatMap((p, i) => {
    const { arrive, leave } = visitOf(i);
    return [
      `  <rect data-role="reading" data-page="${p.id}" class="fill-none stroke-amber stroke-2.5" ${frame(p)}>${show([[arrive, leave]], LOOP)}</rect>`,
      `  <rect data-role="read" data-page="${p.id}" class="la-read-marker" ${frame(p)}>${show([[leave, LOOP]], LOOP)}</rect>`,
    ];
  });
  return [...followed, ...marks].join('\n');
}

function comparisons(): string {
  return PATH.slice(0, -1)
    .map((p, i) => {
      const slot = slotFor(p);
      const words = [p.keys[slot - 1], PLAYER_ID, p.keys[slot]]
        .filter((key) => key !== undefined)
        .join(' < ');
      return `  ${text(
        'fill-ink font-mono text-offset',
        p.left + p.width + 14,
        middleY(p) + 4,
        words,
        { role: 'compare', page: p.id },
        show([[visitOf(i).look, visitOf(i + 1).arrive]], LOOP),
      )}`;
    })
    .join('\n');
}

// The players table: a few of its rows, from the track's roster, in heap order rather than key
// order. The leaf's pointer lands on the row of the player who signs in.
type Player = { readonly id: number; readonly tag: string; readonly rating: number };
const PLAYERS: readonly Player[] = [
  { id: 5214, tag: 'Dingo', rating: 7650 },
  { id: 4127, tag: 'Tapir', rating: 8410 },
  { id: 1042, tag: 'Koala', rating: 8640 },
  { id: 2981, tag: 'Badger', rating: 6450 },
];
const SIGNED_IN = PLAYERS.findIndex((player) => player.id === PLAYER_ID);
const ROW = { width: 128, height: 22, gap: 6 } as const;
const TABLE_TOP = 394;
const TABLE_ROW_TOP = TABLE_TOP + 7;
const ENTRY_X = cellLeft(LEAF, ENTRY) + CELL.width / 2;
const rowLeft = (i: number): number =>
  ENTRY_X - ROW.width / 2 + (i - SIGNED_IN) * (ROW.width + ROW.gap);
const TABLE_LEFT = rowLeft(0) - 124;
const TABLE_RIGHT = rowLeft(PLAYERS.length - 1) + ROW.width + 36;

function rowCell(i: number, classes: string): string[] {
  const { id, tag, rating } = PLAYERS[i]!;
  const left = rowLeft(i);
  return [
    `<rect class="${classes}" x="${left}" y="${TABLE_ROW_TOP}" width="${ROW.width}" height="${ROW.height}" rx="3"/>`,
    text(
      'la-offset anchor-middle',
      left + ROW.width / 2,
      TABLE_ROW_TOP + 15,
      `${id} ${tag} ${rating}`,
    ),
  ];
}

function table(): string {
  const rows = PLAYERS.map((player, i) =>
    [
      `    <g data-role="row" data-player="${player.id}">`,
      ...rowCell(i, 'la-cell').map((part) => `      ${part}`),
      '    </g>',
    ].join('\n'),
  );
  return [
    '  <g data-role="table">',
    `    <rect class="la-card" x="${TABLE_LEFT}" y="${TABLE_TOP}" width="${TABLE_RIGHT - TABLE_LEFT}" height="${ROW.height + 14}" rx="8"/>`,
    `    ${text('la-label', TABLE_LEFT + 14, TABLE_ROW_TOP + 15, 'players table')}`,
    ...rows,
    `    ${text('la-note', rowLeft(PLAYERS.length - 1) + ROW.width + 10, TABLE_ROW_TOP + 15, '…')}`,
    '  </g>',
  ].join('\n');
}

function found(): string {
  const { pick } = visitOf(PATH.length - 1);
  const left = cellLeft(LEAF, ENTRY);
  const from: Point = [ENTRY_X, LEAF.top + PAD + CELL.height];
  const to: Point = [ENTRY_X, TABLE_ROW_TOP - 2];
  return [
    `  <g data-role="row-pointer" data-player="${PLAYER_ID}">`,
    `    ${show([[POINTER, LOOP]], LOOP)}`,
    `    <path class="fill-none stroke-amber stroke-1.5" d="M ${from[0]} ${from[1]} V ${to[1]}" marker-end="url(#head-key)"/>`,
    '  </g>',
    '  <circle class="la-flow-dot" r="4">',
    `    ${show([[POINTER, FETCHED]], LOOP)}`,
    `    ${move(journey(from, [{ from: POINTER, to: FETCHED, via: [to] }]), LOOP)}`,
    '  </circle>',
    `  <g data-role="fetched" data-player="${PLAYER_ID}">`,
    `    ${show([[FETCHED, LOOP]], LOOP)}`,
    ...rowCell(SIGNED_IN, 'la-cell-new').map((part) => `    ${part}`),
    '  </g>',
    `  <g data-role="found" data-key="${PLAYER_ID}">`,
    `    ${show([[pick, LOOP]], LOOP)}`,
    `    <rect class="la-cell-new" x="${left}" y="${LEAF.top + PAD}" width="${CELL.width}" height="${CELL.height}" rx="3"/>`,
    `    ${text('la-offset anchor-middle', ENTRY_X, LEAF.top + PAD + 15, String(PLAYER_ID))}`,
    '  </g>',
  ].join('\n');
}

function searchKey(): string {
  return [
    '  <g data-role="search-key">',
    `    ${show([[0, visitOf(PATH.length - 1).pick]], LOOP)}`,
    `    ${move(keyRoute(), LOOP)}`,
    '    <rect class="fill-cell-new stroke-amber stroke-1.5" x="-19" y="-9" width="38" height="18" rx="4"/>',
    `    ${text('fill-cell-ink font-mono text-offset anchor-middle', 0, 4, String(PLAYER_ID))}`,
    '  </g>',
  ].join('\n');
}

// The reach table, top right: what this tree reaches, and what one more level would.
const COLUMNS = { levels: 748, reads: 820, keys: 912 } as const;
const PANEL_LEFT = 632;
const HEADER_Y = 30;
const NOW_Y = 54;
const MORE_Y = 76;

function readCounts(): string {
  const counts = [0, ...PATH.map((_, i) => i + 1)];
  return counts
    .map((count, i) => {
      const from = i === 0 ? 0 : visitOf(i - 1).arrive;
      const to = i < PATH.length ? visitOf(i).arrive : LOOP;
      return `      ${text(
        'fill-ink font-mono text-label font-bold anchor-middle',
        COLUMNS.reads,
        NOW_Y,
        String(count),
        { role: 'read-count' },
        show([[from, to]], LOOP),
      )}`;
    })
    .join('\n');
}

function reach(): string {
  const value = (column: keyof typeof COLUMNS, y: number, words: string): string =>
    text('fill-ink font-mono text-label anchor-middle', COLUMNS[column], y, words, { column });
  const header = (column: keyof typeof COLUMNS, words: string): string =>
    text('fill-ink-muted font-sans text-offset anchor-middle', COLUMNS[column], HEADER_Y, words);
  return [
    '  <g data-role="reach-table">',
    `    ${header('levels', 'levels')}`,
    `    ${header('reads', 'page reads')}`,
    `    ${header('keys', 'keys within reach')}`,
    `    <path class="fill-none stroke-grid stroke-1.5" d="M ${PANEL_LEFT} ${HEADER_Y + 8} H ${WIDTH - 32}"/>`,
    `    <g data-role="reach" data-levels="${LEVELS}">`,
    `      ${text('fill-ink-muted font-sans text-offset', PANEL_LEFT, NOW_Y, 'this tree')}`,
    `      ${value('levels', NOW_Y, String(LEVELS))}`,
    '      <g data-column="reads">',
    readCounts(),
    '      </g>',
    `      ${value('keys', NOW_Y, String(KEY_COUNT))}`,
    '    </g>',
    `    <g data-role="reach" data-levels="${LEVELS + 1}">`,
    `      ${show([[REACH, LOOP]], LOOP)}`,
    `      ${text('fill-ink-muted font-sans text-offset', PANEL_LEFT, MORE_Y, 'one more level')}`,
    `      ${value('levels', MORE_Y, String(LEVELS + 1))}`,
    `      ${value('reads', MORE_Y, String(LEVELS + 1))}`,
    `      ${value('keys', MORE_Y, String(KEY_COUNT * FANOUT))}`,
    '    </g>',
    '  </g>',
  ].join('\n');
}

// Step 4: a dashed new root above the old one, over the old root and two more trees like it.
const sibling = (id: string, side: number): Page => ({
  id,
  level: root.level,
  keys: [],
  children: [],
  left: root.left + side * 220,
  top: root.top,
  width: INTERNAL_WIDTH,
});
const NEW_ROOT: Page = {
  id: 'new-root',
  level: root.level + 1,
  keys: [],
  children: [sibling('tree-left', -1), root, sibling('tree-right', 1)],
  left: root.left,
  top: 98,
  width: INTERNAL_WIDTH,
};

function extraLevel(): string {
  const others = NEW_ROOT.children.filter((p) => p !== root);
  return [
    '  <g data-role="extra-level">',
    `    ${show([[REACH, LOOP]], LOOP)}`,
    `    ${text('fill-ink-muted font-sans text-offset', 32, middleY(NEW_ROOT) + 4, 'new root')}`,
    `    <rect class="la-cell-tail" x="${NEW_ROOT.left}" y="${NEW_ROOT.top}" width="${NEW_ROOT.width}" height="${PAGE_HEIGHT}" rx="6"/>`,
    ...[0, 1].map(
      (i) =>
        `    <rect class="la-cell-tail" x="${cellLeft(NEW_ROOT, i)}" y="${NEW_ROOT.top + PAD}" width="${CELL.width}" height="${CELL.height}" rx="3"/>`,
    ),
    ...NEW_ROOT.children.map(
      (_, slot) =>
        `    <circle class="fill-flow" cx="${slotX(NEW_ROOT, slot)}" cy="${middleY(NEW_ROOT)}" r="2.5"/>`,
    ),
    ...others.flatMap((other) => [
      `    <rect class="la-cell-tail" x="${other.left}" y="${other.top}" width="${other.width}" height="${PAGE_HEIGHT}" rx="6"/>`,
      `    ${text('la-note anchor-middle', centerX(other), middleY(other) + 4, `${KEY_COUNT} more keys`)}`,
    ]),
    ...NEW_ROOT.children.map(
      (child, slot) =>
        `    <path data-role="extra-downlink" data-to="${child.id}" class="la-arrow" d="${downlink(NEW_ROOT, slot)}" stroke-dasharray="4 3" marker-end="url(#head)"/>`,
    ),
    '  </g>',
  ].join('\n');
}

function legend(): string {
  const y = 458;
  return [
    `  <rect class="fill-none stroke-amber stroke-2.5" x="32" y="${y - 10}" width="22" height="12" rx="3"/>`,
    `  ${text('fill-ink-muted font-sans text-offset', 62, y, 'page being read')}`,
    `  <rect class="la-read-marker" x="166" y="${y - 10}" width="22" height="12" rx="3"/>`,
    `  ${text('fill-ink-muted font-sans text-offset', 196, y, 'page read')}`,
    `  ${text('fill-ink-muted font-sans text-offset anchor-end', WIDTH - 32, y, 'Each page here holds two keys. A real index page holds a few hundred.')}`,
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  ${text('la-label', 32, 498, words, { role: 'caption' }, show([[at, next]], LOOP))}`;
}

const marker = (id: string, fill: string): string =>
  [
    `    <marker id="${id}" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse">`,
    `      <path class="${fill}" d="M 0 0 L 8 4 L 0 8 Z"/>`,
    '    </marker>',
  ].join('\n');

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" data-loop="${LOOP}s">`,
    `  <title>${TITLE}</title>`,
    `  <desc>${escapeXml(DESC)}</desc>`,
    '  <style>',
    '/* LA-STYLE:START */',
    '/* LA-STYLE:END */',
    '</style>',
    '  <defs>',
    marker('head', 'fill-flow'),
    marker('head-read', 'fill-emerald'),
    marker('head-key', 'fill-amber'),
    '  </defs>',
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  ${text('la-title', 32, 44, TITLE)}`,
    `  ${text('la-note', 32, 68, NOTE)}`,
    `  ${text('fill-ink font-mono text-offset', 32, 90, QUERY, { role: 'query' })}`,
    reach(),
    levelLabels(),
    extraLevel(),
    ...PAGES.map(page),
    downlinks(),
    readMarks(),
    comparisons(),
    table(),
    found(),
    searchKey(),
    legend(),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
