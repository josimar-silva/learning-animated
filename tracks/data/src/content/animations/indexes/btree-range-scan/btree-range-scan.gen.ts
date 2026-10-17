import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  escapeXml,
  type Interval,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 16;
const WIDTH = 1000;
const HEIGHT = 480;
const MARGIN = 32;

type Point = readonly [x: number, y: number];
type Segment = readonly [start: Point, end: Point];
type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

// Matchmaking reads the ratings from FROM to TO, both included: the opponents for a
// player rated 4165.
const FROM = 4120;
const TO = 4210;
const QUERY = `SELECT player_id, tag FROM players WHERE rating BETWEEN ${FROM} AND ${TO};`;

type PageId = 'root' | 'internal-1' | 'internal-2' | 'leaf-1' | 'leaf-2' | 'leaf-3' | 'leaf-4';
type Level = 'root' | 'internal' | 'leaf';
type Page = {
  readonly id: PageId;
  readonly level: Level;
  readonly parent?: PageId;
  // A page above the leaves holds one separator. A leaf holds its keys.
  readonly keys: readonly number[];
};

// The index on players (rating), cut down to seven pages. A page above the leaves
// sends keys below its separator to its left child and the rest to its right child.
const PAGES: readonly Page[] = [
  { id: 'root', level: 'root', keys: [4180] },
  { id: 'internal-1', level: 'internal', parent: 'root', keys: [4090] },
  { id: 'internal-2', level: 'internal', parent: 'root', keys: [4260] },
  { id: 'leaf-1', level: 'leaf', parent: 'internal-1', keys: [3990, 4020, 4045, 4070] },
  { id: 'leaf-2', level: 'leaf', parent: 'internal-1', keys: [4090, 4120, 4150, 4165] },
  { id: 'leaf-3', level: 'leaf', parent: 'internal-2', keys: [4180, 4195, 4210, 4240] },
  { id: 'leaf-4', level: 'leaf', parent: 'internal-2', keys: [4260, 4285, 4310, 4340] },
];
const LEAVES = PAGES.filter((page) => page.level === 'leaf');
const pageOf = (id: PageId): Page => PAGES.find((page) => page.id === id)!;
const childrenOf = (page: Page): Page[] => PAGES.filter((child) => child.parent === page.id);
const leafHolding = (key: number): Page => LEAVES.find((leaf) => leaf.keys.includes(key))!;

// The story. The scan holds one page at a time, and between two visits it follows a link.
type Visit = { readonly page: PageId; readonly from: number; readonly to: number };
const VISITS: readonly Visit[] = [
  { page: 'root', from: 0.5, to: 1.5 },
  { page: 'internal-1', from: 2, to: 3 },
  { page: 'leaf-2', from: 3.5, to: 8 },
  { page: 'leaf-3', from: 9, to: LOOP },
];
// When the scan reads each key. The last one is the first key past TO, where it stops.
const READS: ReadonlyArray<readonly [key: number, at: number]> = [
  [4120, 3.5],
  [4150, 5],
  [4165, 6],
  [4180, 9],
  [4195, 10],
  [4210, 11],
  [4240, 12],
];
const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'The scan goes down the tree once, the way a lookup does: root page, internal page, then the leaf that holds 4120.',
  ],
  [
    5,
    'A leaf keeps its keys sorted, so the scan reads to the right: 4150 and 4165 are in the range too.',
  ],
  [
    8,
    'At the end of the leaf, the scan follows the right-link to the next leaf. It never goes back up to a parent page.',
  ],
  [12, '4240 is the first key past 4210, so the scan stops. It read four of the seven pages.'],
];

const visitOf = (page: Page): Visit | undefined => VISITS.find((visit) => visit.page === page.id);
const inRange = (key: number): boolean => key >= FROM && key <= TO;
// A key stays read until the scan reads the next key on the same leaf or leaves the leaf.
function readWindow(i: number): Interval {
  const [key, from] = READS[i]!;
  const next = READS[i + 1];
  const leaf = leafHolding(key);
  if (next && leafHolding(next[0]) === leaf) return [from, next[1]];
  return [from, visitOf(leaf)!.to];
}

// A link the scan follows between two visits: a downlink, or a right-link between leaves.
type Link = {
  readonly from: Page;
  readonly to: Page;
  readonly start: number;
  readonly end: number;
};
const LINKS: readonly Link[] = VISITS.slice(1).map((visit, i) => {
  const before = VISITS[i]!;
  return { from: pageOf(before.page), to: pageOf(visit.page), start: before.to, end: visit.from };
});

const CELL = { width: 40, height: 28, gap: 4 } as const;
const PAD = 10;
const PAGE_HEIGHT = CELL.height + 2 * PAD;
const LEAF_WIDTH = 4 * CELL.width + 3 * CELL.gap + 2 * PAD;
const INNER_WIDTH = CELL.width + 48;
// The leaves span the stage, so the right-links between them get as long as they can.
const LEAF_GAP = (WIDTH - 2 * MARGIN - LEAVES.length * LEAF_WIDTH) / (LEAVES.length - 1);
const TOPS: Record<Level, number> = { root: 150, internal: 240, leaf: 330 };
const LEVEL_NAMES: Record<Level, string> = {
  root: 'root page',
  internal: 'internal pages',
  leaf: 'leaf pages',
};
const LEGEND_Y = 428;
const CAPTION_Y = 460;

// Leaves sit in key order from left to right, and a page above them sits over its children.
function boxOf(page: Page): Box {
  if (page.level === 'leaf') {
    const left = MARGIN + LEAVES.indexOf(page) * (LEAF_WIDTH + LEAF_GAP);
    return { left, top: TOPS.leaf, width: LEAF_WIDTH, height: PAGE_HEIGHT };
  }
  const children = childrenOf(page).map(boxOf);
  const first = children[0]!;
  const last = children[children.length - 1]!;
  const middle = (first.left + last.left + last.width) / 2;
  return {
    left: middle - INNER_WIDTH / 2,
    top: TOPS[page.level],
    width: INNER_WIDTH,
    height: PAGE_HEIGHT,
  };
}

function cellOf(page: Page, key: number): Box {
  const box = boxOf(page);
  const left =
    page.level === 'leaf'
      ? box.left + PAD + page.keys.indexOf(key) * (CELL.width + CELL.gap)
      : box.left + (box.width - CELL.width) / 2;
  return { left, top: box.top + PAD, width: CELL.width, height: CELL.height };
}

// A downlink leaves its parent's bottom edge on the side of the separator it stands for.
function downlink(child: Page): Segment {
  const parent = pageOf(child.parent!);
  const [from, to] = [boxOf(parent), boxOf(child)];
  const x = childrenOf(parent)[0] === child ? from.left + 12 : from.left + from.width - 12;
  return [
    [x, from.top + from.height],
    [to.left + to.width / 2, to.top - 5],
  ];
}

function rightLink(leaf: Page): Segment {
  const [from, to] = [boxOf(leaf), boxOf(LEAVES[LEAVES.indexOf(leaf) + 1]!)];
  const y = from.top + from.height / 2;
  return [
    [from.left + from.width + 2, y],
    [to.left - 5, y],
  ];
}

const pathOf = ([[x1, y1], [x2, y2]]: Segment): string => `M ${x1} ${y1} L ${x2} ${y2}`;

// Waypoints that hold at a link's start, run it between two moments, then hold at its end.
function travel([start, end]: Segment, from: number, to: number): Waypoint[] {
  return [
    [0, ...start],
    [from, ...start],
    [to, ...end],
    [LOOP, ...end],
  ];
}

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const rect = (classes: string, { left, top, width, height }: Box, rx: number): string =>
  `<rect class="${classes}" x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}"/>`;

const TITLE = 'Scanning a range';
const NOTE =
  'Matchmaking reads a range of ratings: down the tree once, then sideways along the leaves.';
const DESC =
  'An animation in four steps. To find opponents for a player rated 4165, matchmaking asks a B-tree index on players (rating) for the ratings from 4120 to 4210. ' +
  'The scan goes down the tree once: the root page sends it left, an internal page sends it right, and it lands on the leaf page that holds 4120. ' +
  'It reads that leaf to the right, 4120, 4150, and 4165, then follows the right-link to the next leaf without going back up to a parent page, and reads 4180, 4195, and 4210. ' +
  'The next key, 4240, is past 4210, so the scan stops. It read four of the seven pages.';

function query(): string {
  return [
    `  <rect class="la-canvas" x="${MARGIN}" y="86" width="${WIDTH - 2 * MARGIN}" height="34" rx="8"/>`,
    `  <text data-role="query" class="fill-ink font-mono text-offset" x="48" y="107">${escapeXml(QUERY)}</text>`,
    `  <text data-role="index" class="fill-ink-muted font-sans text-offset anchor-end" x="${WIDTH - 48}" y="107">B-tree index on players (rating)</text>`,
  ].join('\n');
}

function links(): string {
  const downlinks = PAGES.filter((page) => page.parent).map(
    (child) =>
      `  <path data-role="downlink" data-from="${child.parent}" data-to="${child.id}" class="la-arrow" d="${pathOf(downlink(child))}" marker-end="url(#head)"/>`,
  );
  const rightLinks = LEAVES.slice(0, -1).map(
    (leaf, i) =>
      `  <path data-role="right-link" data-from="${leaf.id}" data-to="${LEAVES[i + 1]!.id}" class="la-arrow" d="${pathOf(rightLink(leaf))}" marker-end="url(#head)"/>`,
  );
  return [...downlinks, ...rightLinks].join('\n');
}

function keyCell(cell: Box, value: number): string[] {
  return [
    `      ${rect('la-cell', cell, 4)}`,
    `      ${text('la-offset anchor-middle', cell.left + cell.width / 2, cell.top + 18, String(value))}`,
  ];
}

// A key the scan reads gets the read marker while the scan is on it. A key in the range
// also gets a match bar from that moment on.
function marks(cell: Box, value: number): string[] {
  const i = READS.findIndex(([key]) => key === value);
  if (i === -1) return [];
  const [, at] = READS[i]!;
  const read = `      <rect data-role="read" class="la-read-marker" x="${cell.left - 2}" y="${cell.top - 2}" width="${cell.width + 4}" height="${cell.height + 4}" rx="6">${show([readWindow(i)], LOOP)}</rect>`;
  if (!inRange(value)) return [read];
  const match = `      <rect data-role="match" class="fill-emerald" x="${cell.left + 8}" y="${cell.top + 21}" width="${cell.width - 16}" height="4" rx="2">${show([[at, LOOP]], LOOP)}</rect>`;
  return [match, read];
}

function leafKey(leaf: Page, value: number): string {
  const cell = cellOf(leaf, value);
  return [
    `    <g data-role="key" data-key="${value}">`,
    ...keyCell(cell, value),
    ...marks(cell, value),
    '    </g>',
  ].join('\n');
}

function separator(page: Page): string {
  const [value] = page.keys;
  return [
    `    <g data-role="separator" data-key="${value}">`,
    ...keyCell(cellOf(page, value!), value!),
    '    </g>',
  ].join('\n');
}

// Which way FROM goes at a page above the leaves, shown while the scan reads that page.
function turn(page: Page, { from, to }: Visit): string {
  const box = boxOf(page);
  const [value] = page.keys;
  const words = FROM < value! ? `${FROM} < ${value}: go left` : `${FROM} > ${value}: go right`;
  return `    <text data-role="compare" class="fill-ink font-mono text-offset" x="${box.left + box.width + 12}" y="${box.top + box.height / 2 + 4}">${escapeXml(words)}${show([[from, to]], LOOP)}</text>`;
}

function treePage(page: Page): string {
  const box = boxOf(page);
  const visit = visitOf(page);
  const parent = page.parent ? ` data-parent="${page.parent}"` : '';
  return [
    `  <g data-role="page" data-page="${page.id}" data-level="${page.level}"${parent}>`,
    `    <rect data-role="frame" class="la-card" x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="8"/>`,
    ...(visit
      ? [
          `    <rect data-role="reading" class="fill-none stroke-amber stroke-2.5" x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="8">${show([[visit.from, visit.to]], LOOP)}</rect>`,
        ]
      : []),
    ...(page.level === 'leaf'
      ? page.keys.map((value) => leafKey(page, value))
      : [separator(page), ...(visit ? [turn(page, visit)] : [])]),
    '  </g>',
  ].join('\n');
}

function trail(link: Link): string {
  const segment = link.to.parent === link.from.id ? downlink(link.to) : rightLink(link.from);
  return [
    `  <g data-role="trail" data-from="${link.from.id}" data-to="${link.to.id}">`,
    `    ${show([[link.start, LOOP]], LOOP)}`,
    `    <path data-role="line" class="fill-none stroke-amber stroke-1.5" d="${pathOf(segment)}" marker-end="url(#head-active)"/>`,
    '    <circle data-role="dot" class="la-flow-dot" r="5">',
    `      ${show([[link.start, link.end]], LOOP)}`,
    `      ${move(travel(segment, link.start, link.end), LOOP)}`,
    '    </circle>',
    '  </g>',
  ].join('\n');
}

function stop(): string {
  const [value, at] = READS.find(([k]) => k > TO)!;
  const leaf = leafHolding(value);
  const cell = cellOf(leaf, value);
  return `  <text data-role="stop" class="fill-ink font-mono text-offset font-semibold anchor-middle" x="${cell.left + cell.width / 2}" y="${boxOf(leaf).top + PAGE_HEIGHT + 20}">${escapeXml(`${value} > ${TO}: stop`)}${show([[at, LOOP]], LOOP)}</text>`;
}

function legend(): string {
  return [
    `  <rect class="fill-emerald" x="${MARGIN}" y="${LEGEND_Y - 6}" width="24" height="4" rx="2"/>`,
    `  ${text('fill-ink-muted font-sans text-offset', 64, LEGEND_Y, `rating from ${FROM} to ${TO}`)}`,
    `  <path class="la-arrow" d="M 232 ${LEGEND_Y - 4} H 254" marker-end="url(#head)"/>`,
    `  ${text('fill-ink-muted font-sans text-offset', 268, LEGEND_Y, 'right-link to the next leaf')}`,
    `  ${text('fill-ink-muted font-sans text-offset anchor-end', WIDTH - MARGIN, LEGEND_Y, 'Real pages hold hundreds of keys.')}`,
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="la-label" x="${MARGIN}" y="${CAPTION_Y}">${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
}

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
    '    <marker id="head" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">',
    '      <path class="fill-flow" d="M 0 0 L 9 4.5 L 0 9 Z"/>',
    '    </marker>',
    '    <marker id="head-active" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">',
    '      <path class="fill-amber" d="M 0 0 L 9 4.5 L 0 9 Z"/>',
    '    </marker>',
    '  </defs>',
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  ${text('la-title', MARGIN, 44, TITLE)}`,
    `  ${text('la-note', MARGIN, 68, NOTE)}`,
    query(),
    ...(Object.keys(TOPS) as Level[]).map(
      (level) =>
        `  ${text('fill-ink-muted font-sans text-offset', MARGIN, TOPS[level] - 8, LEVEL_NAMES[level])}`,
    ),
    links(),
    ...PAGES.map(treePage),
    ...LINKS.map(trail),
    stop(),
    legend(),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
