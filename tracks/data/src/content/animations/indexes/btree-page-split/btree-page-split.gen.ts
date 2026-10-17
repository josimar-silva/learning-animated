// Writes btree-page-split.svg through `just gen`. The STORY table drives every timing, and
// KEYS_BEFORE drives every rating on the stage.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  escapeXml,
  type Interval,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 21;
const W = 1000;
const H = 420;

// The story, in seconds. A step's caption shows from its start until the next step starts.
const STORY = {
  // Step 1: 4135 appears over the root, the entry for 4102 lights up, and 4135 follows its downlink.
  descend: 0,
  appear: 0.5,
  route: 1,
  descent: [2, 4],
  full: 4,
  // Step 2: the new page opens, the upper half moves over, 4135 drops in, and the links change.
  split: 6,
  move: [6.5, 8],
  drop: [8, 8.75],
  rewire: 9.5,
  // Step 3: the new page's first key is copied into the left page's high key.
  highKey: 11,
  copyAcross: [11.5, 12.5],
  // Step 4: 4190 makes room in the root, then the separator goes up and gets its downlink.
  parent: 15,
  shift: [15.5, 16],
  copyUp: [16, 17.5],
} as const;

// The leaves from left to right, the order the sibling links keep. The new page opens at the split.
type Leaf = 'first' | 'split' | 'new' | 'last';
const ORDER: readonly Leaf[] = ['first', 'split', 'new', 'last'];
const CAPACITY = 3;
const ROOT_SLOTS = 5;
const INCOMING = 4135;
const KEYS_BEFORE: Record<Exclude<Leaf, 'new'>, readonly number[]> = {
  first: [4012, 4061],
  split: [4102, 4150, 4171],
  last: [4190, 4246],
};

// The root before the split: each entry's separator (null for the first downlink) and its leaf.
// A separator is its leaf's first key, and a leaf's high key is the next entry's separator.
const ROOT_BEFORE: ReadonlyArray<readonly [separator: number | null, leaf: Leaf]> = [
  [null, 'first'],
  [KEYS_BEFORE.split[0]!, 'split'],
  [KEYS_BEFORE.last[0]!, 'last'],
];
const SPLIT_SLOT = ROOT_BEFORE.findIndex(([, leaf]) => leaf === 'split');
const NEW_SLOT = SPLIT_SLOT + 1;
// The full leaf takes every rating from LOWER up to, but not including, UPPER.
const LOWER = ROOT_BEFORE[SPLIT_SLOT]![0]!;
const UPPER = ROOT_BEFORE[NEW_SLOT]![0]!;

// The full leaf and the incoming key share out evenly: the lower half stays, the upper half moves.
const MERGED = [...KEYS_BEFORE.split, INCOMING].sort((a, b) => a - b);
const STAYS = MERGED.slice(0, MERGED.length / 2);
const MOVES = MERGED.slice(MERGED.length / 2);
const SEPARATOR = MOVES[0]!;
// The keys that stay keep their slots, so the incoming key has to be the highest of them.
const INCOMING_SLOT = STAYS.length - 1;
if (STAYS[INCOMING_SLOT] !== INCOMING) {
  throw new Error(`the drawing needs ${INCOMING} to be the highest key that stays`);
}

const TITLE = 'Splitting a full leaf';
const NOTE =
  'An index on players(rating), drawn with three keys per leaf. Real pages hold many more.';
const listed = (keys: readonly number[]): string =>
  `${keys.slice(0, -1).join(', ')}, and ${keys[keys.length - 1]}`;
const DESC =
  'An animation in four steps of a B-tree index on players(rating). ' +
  'The root page has three downlinks to leaves that hold up to three ratings each, ' +
  `and the second leaf, with ${listed(KEYS_BEFORE.split)}, is full. ` +
  `A new player finishes placement at rating ${INCOMING}, and an entry for ${INCOMING} goes down from the root to that leaf. ` +
  `The leaf splits: ${MOVES.join(', ')}, and the leaf's high key, ${UPPER}, move to a new page on its right, ` +
  `${INCOMING} goes in after ${STAYS[INCOMING_SLOT - 1]}, and the sibling links are rewired so the new page sits between its neighbors. ` +
  `The left page gets ${SEPARATOR} as its new high key. ` +
  `Then ${SEPARATOR} is copied into the root with a downlink to the new page, ` +
  'and all four leaves sit one level below the root.';

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    STORY.descend,
    `A new player finishes placement at rating ${INCOMING}. That is at least ${LOWER} and below ${UPPER}, so the root sends it to the second leaf, which is full.`,
  ],
  [
    STORY.split,
    `The leaf splits: ${MOVES.join(', ')}, and the high key ${UPPER} move to a new right sibling, ${INCOMING} goes in on the left, and the links are rewired.`,
  ],
  [
    STORY.highKey,
    `The left page gets a new high key: ${SEPARATOR}, the first key on the new page. It now separates the two pages.`,
  ],
  [
    STORY.parent,
    `The parent, here the root, gets a downlink to the new page under ${SEPARATOR}. Every leaf is still one level below the root.`,
  ],
];

type Point = readonly [x: number, y: number];
const round = (n: number): number => Math.round(n * 10) / 10;

// A page is a row of equal cells. A leaf keeps its high key in a cell of its own at the right end.
const MARGIN = 32;
const CELL = { width: 40, height: 28, gap: 4 } as const;
const PAD = 9;
const HIGH_KEY_GAP = 14;
const PAGE_HEIGHT = CELL.height + 2 * PAD;
const LEAF_GAP = 63;
const ROOT_TOP = 124;
const LEAF_TOP = 290;
const ROOT_Y = ROOT_TOP + PAGE_HEIGHT / 2;
const LEAF_Y = LEAF_TOP + PAGE_HEIGHT / 2;
const BELOW_LEAVES = LEAF_TOP + PAGE_HEIGHT + 20;
const CAPTION_Y = H - 22;

const rowWidth = (slots: number): number => slots * CELL.width + (slots - 1) * CELL.gap;
// Nothing lies to the right of the last leaf, so it has no high key.
const hasHighKey = (leaf: Leaf): boolean => leaf !== ORDER[ORDER.length - 1];
const leafWidth = (leaf: Leaf): number =>
  2 * PAD + rowWidth(CAPACITY) + (hasHighKey(leaf) ? HIGH_KEY_GAP + CELL.width : 0);
const leafLeft = (leaf: Leaf): number =>
  ORDER.slice(0, ORDER.indexOf(leaf)).reduce(
    (x, before) => x + leafWidth(before) + LEAF_GAP,
    MARGIN,
  );
const leafRight = (leaf: Leaf): number => leafLeft(leaf) + leafWidth(leaf);
const leafCenter = (leaf: Leaf): number => leafLeft(leaf) + leafWidth(leaf) / 2;
const slotX = (left: number, slot: number): number =>
  left + PAD + CELL.width / 2 + slot * (CELL.width + CELL.gap);
const ROOT_WIDTH = 2 * PAD + rowWidth(ROOT_SLOTS);
const ROOT_LEFT = (W - ROOT_WIDTH) / 2;
const rootAt = (slot: number): Point => [slotX(ROOT_LEFT, slot), ROOT_Y];
const keyAt = (leaf: Leaf, slot: number): Point => [slotX(leafLeft(leaf), slot), LEAF_Y];
const highKeyAt = (leaf: Leaf): Point => [
  leafLeft(leaf) + PAD + rowWidth(CAPACITY) + HIGH_KEY_GAP + CELL.width / 2,
  LEAF_Y,
];

// A downlink leaves the bottom of its root entry and ends on the top edge of its leaf.
const downlinkFrom = (slot: number): Point => [rootAt(slot)[0], ROOT_Y + CELL.height / 2];
const downlinkTo = (leaf: Leaf): Point => [leafCenter(leaf), LEAF_TOP - 2];
const line = ([x1, y1]: Point, [x2, y2]: Point): string => `M ${x1} ${y1} L ${x2} ${y2}`;

// 4135 starts over the entry it will follow, and waits on that downlink just above the full leaf.
const START: Point = [rootAt(SPLIT_SLOT)[0], ROOT_TOP - 24];
const REST: Point = (() => {
  const [[x1, y1], [x2, y2]] = [downlinkFrom(SPLIT_SLOT), downlinkTo('split')];
  const y = LEAF_TOP - 24;
  return [round(x1 + ((x2 - x1) * (y - y1)) / (y2 - y1)), y];
})();

type Look = 'key' | 'new' | 'high-key' | 'new-high-key';
const LOOKS: Record<Look, readonly [frame: string, ink: string]> = {
  key: ['la-cell', 'la-offset'],
  new: ['la-cell-new', 'la-offset'],
  'high-key': ['fill-stage stroke-flow stroke-1.5', 'fill-ink-muted font-mono text-offset'],
  'new-high-key': ['fill-stage stroke-amber stroke-1.5', 'fill-ink-muted font-mono text-offset'],
};

const text = (classes: string, [x, y]: Point, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const box = (
  classes: string,
  [x, y]: Point,
  width: number,
  height: number,
  rx: number,
  attributes = '',
): string =>
  `<rect ${attributes ? `${attributes} ` : ''}class="${classes}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}"/>`;
const cellFrame = (classes: string, [x, y]: Point, attributes = ''): string =>
  box(classes, [x - CELL.width / 2, y - CELL.height / 2], CELL.width, CELL.height, 5, attributes);

function cell(look: Look, label: string | number, [x, y]: Point): string[] {
  const [frame, ink] = LOOKS[look];
  return [cellFrame(frame, [x, y]), text(`${ink} anchor-middle`, [x, y + 4], String(label))];
}

// One group: its data attributes, its timeline when it does not show for the whole loop, its parts.
function group(attributes: string, shown: Interval | null, parts: readonly string[]): string {
  return [
    `  <g ${attributes}>`,
    ...(shown ? [`    ${show([shown], LOOP)}`] : []),
    ...parts.map((part) => `    ${part}`),
    '  </g>',
  ].join('\n');
}

// A text the tests can find by its role, with a timeline when it does not show for the whole loop.
function roleText(
  role: string,
  classes: string,
  at: Point,
  words: string,
  shown: Interval | null,
): string {
  const timeline = shown ? show([shown], LOOP) : '';
  return `  <text data-role="${role}" class="${classes}" x="${at[0]}" y="${at[1]}">${escapeXml(words)}${timeline}</text>`;
}

type Leg = { readonly through: readonly Point[]; readonly during: Interval };
// Waypoints that hold still between legs and cross each leg's points at constant speed.
function journey(start: Point, legs: readonly Leg[]): Waypoint[] {
  const waypoints: Waypoint[] = [[0, ...start]];
  let here = start;
  for (const { through, during } of legs) {
    const [from, to] = during;
    const points = [here, ...through];
    const lengths = through.map(([x, y], i) => Math.hypot(x - points[i]![0], y - points[i]![1]));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let walked = 0;
    waypoints.push([from, ...here]);
    for (const [i, length] of lengths.entries()) {
      walked += length;
      waypoints.push([from + ((to - from) * walked) / total, ...through[i]!]);
    }
    here = through[through.length - 1]!;
  }
  waypoints.push([LOOP, ...here]);
  return waypoints;
}

// A copy of a cell that travels from one place to another, shown only while it moves.
function moving(look: Look, label: number, from: Point, to: Point, during: Interval): string {
  return group(`data-role="moving" data-key="${label}"`, during, [
    move(journey(from, [{ through: [to], during }]), LOOP),
    ...cell(look, label, [0, 0]),
  ]);
}

function markers(): string[] {
  const head = 'M 0 0 L 9 4.5 L 0 9 Z';
  const tail = 'M 9 0 L 0 4.5 L 9 9 Z';
  const marker = (id: string, fill: string, d: string, refX: number): string[] => [
    `    <marker id="${id}" markerWidth="9" markerHeight="9" refX="${refX}" refY="4.5" orient="auto">`,
    `      <path class="${fill}" d="${d}"/>`,
    '    </marker>',
  ];
  return [
    ...marker('head', 'fill-flow', head, 7),
    ...marker('tail', 'fill-flow', tail, 2),
    ...marker('head-new', 'fill-amber', head, 7),
    ...marker('tail-new', 'fill-amber', tail, 2),
  ];
}

function rootPage(): string {
  const slots = Array.from({ length: ROOT_SLOTS }, (_, slot) =>
    cellFrame(
      'la-cell-tail',
      rootAt(slot),
      `data-role="slot" data-page="root" data-slot="${slot}"`,
    ),
  );
  return group('data-role="page" data-page="root" data-level="root"', null, [
    box('la-card', [ROOT_LEFT, ROOT_TOP], ROOT_WIDTH, PAGE_HEIGHT, 8),
    ...slots,
  ]);
}

function leafPage(leaf: Leaf): string {
  const isNew = leaf === 'new';
  const outline = isNew ? 'fill-violet-deep stroke-amber stroke-1.5' : 'la-card';
  const slots = Array.from({ length: CAPACITY }, (_, slot) =>
    cellFrame(
      'la-cell-tail',
      keyAt(leaf, slot),
      `data-role="slot" data-page="${leaf}" data-slot="${slot}"`,
    ),
  );
  const highKeySlot = hasHighKey(leaf)
    ? [cellFrame('la-cell-tail', highKeyAt(leaf), `data-role="high-key-slot" data-page="${leaf}"`)]
    : [];
  const label = isNew
    ? [text('la-note anchor-middle', [leafCenter(leaf), BELOW_LEAVES], 'new page')]
    : [];
  return group(
    `data-role="page" data-page="${leaf}" data-level="leaf"`,
    isNew ? [STORY.split, LOOP] : null,
    [
      box(outline, [leafLeft(leaf), LEAF_TOP], leafWidth(leaf), PAGE_HEIGHT, 8),
      ...slots,
      ...highKeySlot,
      ...label,
    ],
  );
}

// A path closes itself unless it carries a timeline.
const timedPath = (attributes: string, shown: Interval | null): string =>
  `  <path ${attributes}${shown ? `>${show([shown], LOOP)}</path>` : '/>'}`;

function siblingLink(from: Leaf, to: Leaf, shown: Interval | null, isNew = false): string {
  const [classes, tail, head] = isNew
    ? ['fill-none stroke-amber stroke-1.5', 'tail-new', 'head-new']
    : ['la-arrow', 'tail', 'head'];
  const d = line([leafRight(from) + 3, LEAF_Y], [leafLeft(to) - 3, LEAF_Y]);
  return timedPath(
    `data-role="link" data-from="${from}" data-to="${to}" class="${classes}" d="${d}" marker-start="url(#${tail})" marker-end="url(#${head})"`,
    shown,
  );
}

function links(): string[] {
  return [
    siblingLink('first', 'split', null),
    siblingLink('split', 'last', [0, STORY.rewire]),
    siblingLink('split', 'new', [STORY.rewire, LOOP], true),
    siblingLink('new', 'last', [STORY.rewire, LOOP], true),
  ];
}

function downlink(slot: number, to: Leaf, shown: Interval | null, isNew = false): string {
  const [classes, head] = isNew
    ? ['fill-none stroke-amber stroke-1.5', 'head-new']
    : ['la-arrow', 'head'];
  const d = line(downlinkFrom(slot), downlinkTo(to));
  return timedPath(
    `data-role="downlink" data-slot="${slot}" data-page="${to}" class="${classes}" d="${d}" marker-end="url(#${head})"`,
    shown,
  );
}

// Entries right of the new separator move one slot over to make room for it.
function downlinks(): string[] {
  const [shiftStart, shiftEnd] = STORY.shift;
  return [
    ...ROOT_BEFORE.flatMap(([, leaf], slot) =>
      slot < NEW_SLOT
        ? [downlink(slot, leaf, null)]
        : [downlink(slot, leaf, [0, shiftStart]), downlink(slot + 1, leaf, [shiftEnd, LOOP])],
    ),
    downlink(NEW_SLOT, 'new', [STORY.copyUp[1], LOOP], true),
  ];
}

function entry(slot: number, separator: number | null, look: Look, shown: Interval | null): string {
  const key = separator === null ? '' : ` data-key="${separator}"`;
  return group(
    `data-role="entry" data-slot="${slot}"${key}`,
    shown,
    cell(look, separator ?? '-∞', rootAt(slot)),
  );
}

function entries(): string[] {
  const [shiftStart, shiftEnd] = STORY.shift;
  return [
    ...ROOT_BEFORE.flatMap(([separator], slot) =>
      slot < NEW_SLOT
        ? [entry(slot, separator, 'key', null)]
        : [
            entry(slot, separator, 'key', [0, shiftStart]),
            entry(slot + 1, separator, 'key', [shiftEnd, LOOP]),
          ],
    ),
    entry(NEW_SLOT, SEPARATOR, 'new', [STORY.copyUp[1], LOOP]),
  ];
}

// While 4135 goes down, its entry in the root and the downlink under it light up.
function route(): string {
  const [x, y] = rootAt(SPLIT_SLOT);
  return group(
    `data-role="route" data-slot="${SPLIT_SLOT}" data-page="split"`,
    [STORY.route, STORY.split],
    [
      box(
        'fill-none stroke-amber stroke-2.5',
        [x - CELL.width / 2 - 3, y - CELL.height / 2 - 3],
        CELL.width + 6,
        CELL.height + 6,
        7,
      ),
      `<path class="fill-none stroke-amber stroke-1.5" d="${line(downlinkFrom(SPLIT_SLOT), downlinkTo('split'))}" marker-end="url(#head-new)"/>`,
    ],
  );
}

function key(leaf: Leaf, slot: number, value: number, look: Look, shown: Interval | null): string {
  return group(
    `data-role="key" data-page="${leaf}" data-slot="${slot}" data-key="${value}"`,
    shown,
    cell(look, value, keyAt(leaf, slot)),
  );
}

function keys(): string[] {
  const [moveStart, moveEnd] = STORY.move;
  return [
    ...(['first', 'last'] as const).flatMap((leaf) =>
      KEYS_BEFORE[leaf].map((value, slot) => key(leaf, slot, value, 'key', null)),
    ),
    ...KEYS_BEFORE.split.map((value, slot) =>
      key('split', slot, value, 'key', STAYS.includes(value) ? null : [0, moveStart]),
    ),
    key('split', INCOMING_SLOT, INCOMING, 'new', [STORY.drop[1], LOOP]),
    ...MOVES.map((value, slot) => key('new', slot, value, 'key', [moveEnd, LOOP])),
  ];
}

function highKey(leaf: Leaf, value: number, look: Look, shown: Interval | null): string {
  return group(
    `data-role="high-key" data-page="${leaf}" data-key="${value}"`,
    shown,
    cell(look, value, highKeyAt(leaf)),
  );
}

function highKeys(): string[] {
  const [moveStart, moveEnd] = STORY.move;
  return [
    highKey('first', LOWER, 'high-key', null),
    highKey('split', UPPER, 'high-key', [0, moveStart]),
    highKey('split', SEPARATOR, 'new-high-key', [STORY.copyAcross[1], LOOP]),
    highKey('new', UPPER, 'high-key', [moveEnd, LOOP]),
  ];
}

function tokens(): string[] {
  return [
    ...MOVES.map((value, slot) =>
      moving(
        'key',
        value,
        keyAt('split', KEYS_BEFORE.split.indexOf(value)),
        keyAt('new', slot),
        STORY.move,
      ),
    ),
    moving('high-key', UPPER, highKeyAt('split'), highKeyAt('new'), STORY.move),
    moving('new-high-key', SEPARATOR, keyAt('new', 0), highKeyAt('split'), STORY.copyAcross),
    ...ROOT_BEFORE.slice(NEW_SLOT).map(([separator], i) =>
      moving('key', separator!, rootAt(NEW_SLOT + i), rootAt(NEW_SLOT + i + 1), STORY.shift),
    ),
    moving('new', SEPARATOR, highKeyAt('split'), rootAt(NEW_SLOT), STORY.copyUp),
  ];
}

function incoming(): string {
  const cellBottom: Point = [START[0], ROOT_Y + CELL.height / 2];
  const legs: Leg[] = [
    { through: [cellBottom, REST], during: STORY.descent },
    { through: [keyAt('split', INCOMING_SLOT)], during: STORY.drop },
  ];
  return group(
    'data-role="incoming"',
    [STORY.appear, STORY.drop[1]],
    [move(journey(START, legs), LOOP), ...cell('new', INCOMING, [0, 0])],
  );
}

function labels(): string[] {
  return [
    `  ${text('la-note anchor-middle', [highKeyAt('first')[0], BELOW_LEAVES], 'high key')}`,
    roleText(
      'comparison',
      'fill-ink font-mono text-label',
      [ROOT_LEFT + ROOT_WIDTH + 16, ROOT_Y + 4],
      `${LOWER} ≤ ${INCOMING} < ${UPPER}`,
      [STORY.route, STORY.split],
    ),
    roleText(
      'full',
      'la-label font-semibold anchor-middle',
      [leafCenter('split'), BELOW_LEAVES],
      'full',
      [STORY.full, STORY.split],
    ),
  ];
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return roleText('caption', 'la-label', [MARGIN, CAPTION_Y], words, [at, next]);
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
    ...markers(),
    '  </defs>',
    `  <rect class="fill-stage" width="${W}" height="${H}"/>`,
    `  ${text('la-title', [MARGIN, 44], TITLE)}`,
    roleText('note', 'la-note', [MARGIN, 68], NOTE, null),
    `  ${text('la-note anchor-end', [ROOT_LEFT - 14, ROOT_Y + 4], 'root page')}`,
    `  ${text('la-note', [MARGIN, LEAF_TOP - 12], 'leaf pages')}`,
    rootPage(),
    ...ORDER.map(leafPage),
    ...links(),
    ...downlinks(),
    route(),
    ...entries(),
    ...keys(),
    ...highKeys(),
    ...tokens(),
    incoming(),
    ...labels(),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
