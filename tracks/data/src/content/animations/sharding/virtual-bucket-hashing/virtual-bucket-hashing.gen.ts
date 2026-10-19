import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, move, show } from '@learning-animated/svg-kit/author';

const LOOP = 24;
const WIDTH = 1000;
const HEIGHT = 492;
const BUCKETS = 16;

// The game's players by tag, with hash(player_id) for each, as the other hash lessons list them.
const PLAYERS: ReadonlyArray<readonly [tag: string, hash: number]> = [
  ['Adder', 47],
  ['Badger', 82],
  ['Coyote', 35],
  ['Dingo', 64],
  ['Egret', 13],
  ['Ferret', 58],
  ['Gibbon', 91],
  ['Heron', 20],
  ['Iguana', 37],
  ['Jackal', 29],
  ['Koala', 66],
  ['Lemur', 41],
  ['Marten', 52],
  ['Newt', 99],
  ['Otter', 25],
  ['Petrel', 70],
  ['Quail', 43],
  ['Raven', 88],
  ['Stoat', 14],
  ['Tapir', 56],
];
const TAGS = PLAYERS.map(([tag]) => tag);
const LOOKUP_TAG = 'Adder';

type Server = 'db-0' | 'db-1' | 'db-2' | 'db-3' | 'db-4';
const FIRST_SERVERS: readonly Server[] = ['db-0', 'db-1', 'db-2', 'db-3'];
const NEW_SERVER: Server = 'db-4';
// The map gives each server a run of four buckets, so the last bucket of each run comes from a
// different server.
const TAKEN: readonly number[] = [3, 7, 11, 15];

const hashOf = (tag: string): number => PLAYERS.find(([player]) => player === tag)![1];
const bucketOf = (tag: string): number => hashOf(tag) % BUCKETS;
const playersOf = (bucket: number): string[] => TAGS.filter((tag) => bucketOf(tag) === bucket);
const firstOwner = (bucket: number): Server => FIRST_SERVERS[Math.floor(bucket / 4)]!;
const lastOwner = (bucket: number): Server =>
  TAKEN.includes(bucket) ? NEW_SERVER : firstOwner(bucket);
const MOVED = TAKEN.flatMap(playersOf);

// Every moment of the story, in seconds of the loop.
const STORY = {
  map: 6,
  joins: 11,
  lookup: 17,
  // Step 1: a player leaves the list every 0.2 s, and its flight into its bucket takes 0.8 s.
  firstFlight: 0.8,
  flightGap: 0.2,
  flight: 0.8,
  // Step 2: a server appears with its four map entries every 0.6 s.
  serverGap: 0.6,
  // Step 3: db-4 takes a bucket every 1.2 s. A move takes 0.9 s, and the map entry changes 0.2 s
  // after the bucket lands, so no lookup is sent to db-4 before its data is there.
  firstHandoff: 11.8,
  handoffGap: 1.2,
  handoff: 0.9,
  settle: 0.2,
  // Step 4: the lookup shows a line every 0.6 s, then the count of players that moved.
  lookupGap: 0.6,
  counted: 20.2,
} as const;

const departs = (i: number): number => STORY.firstFlight + i * STORY.flightGap;
const lands = (i: number): number => departs(i) + STORY.flight;
const appearsAt = (server: Server): number =>
  server === NEW_SERVER ? STORY.joins : STORY.map + FIRST_SERVERS.indexOf(server) * STORY.serverGap;

type Handoff = { readonly leaves: number; readonly arrives: number; readonly flips: number };
function handoffOf(bucket: number): Handoff | null {
  const turn = TAKEN.indexOf(bucket);
  if (turn === -1) return null;
  const leaves = STORY.firstHandoff + turn * STORY.handoffGap;
  const arrives = leaves + STORY.handoff;
  return { leaves, arrives, flips: arrives + STORY.settle };
}

const LOOKUP = {
  hash: STORY.lookup + STORY.lookupGap,
  bucket: STORY.lookup + 2 * STORY.lookupGap,
  server: STORY.lookup + 3 * STORY.lookupGap,
  found: STORY.lookup + 4 * STORY.lookupGap,
} as const;

const listed = (items: readonly (string | number)[]): string =>
  `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    `Players hash into ${BUCKETS} buckets with hash(player_id) mod ${BUCKETS}. There are always ${BUCKETS} buckets, so a player's bucket never changes.`,
  ],
  [STORY.map, 'A map assigns buckets to servers. Each of the four servers gets four buckets.'],
  [
    STORY.joins,
    `Server ${NEW_SERVER} joins and takes one bucket from each server. The players inside move with their bucket.`,
  ],
  [
    STORY.lookup,
    `Lookups read the new map. Only the players in buckets ${listed(TAKEN)} moved: ${MOVED.length} of ${TAGS.length}.`,
  ],
];

const TITLE = 'Moving buckets, not keys';
const NOTE =
  "A player's bucket never changes. Adding a server edits the map and moves whole buckets.";
const DESC =
  `An animation in four steps. Twenty players of an online game, listed by tag with the hash of their player id, hash into ${BUCKETS} buckets with hash(player_id) mod ${BUCKETS}. ` +
  `A map then gives database servers ${listed(FIRST_SERVERS)} a run of four buckets each. ` +
  `Server ${NEW_SERVER} joins and takes buckets ${listed(TAKEN)}, one from each server. ` +
  `Each bucket moves with the players inside it, and its map entry changes to ${NEW_SERVER} once it arrives. ` +
  `A lookup for ${LOOKUP_TAG}, whose player id hashes to ${hashOf(LOOKUP_TAG)}, still computes bucket ${bucketOf(LOOKUP_TAG)} and now reads ${NEW_SERVER} from the map. ` +
  `Only ${listed(MOVED)} changed server, ${MOVED.length} of the ${TAGS.length} players, and no player was rehashed.`;

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

// The four servers stand side by side, each a column of four bucket slots.
const COLUMNS = { x: 32, y: 92, width: 158, pitch: 170, header: 28 } as const;
const SLOT = { width: 142, height: 30, pitch: 36, inset: 8 } as const;
const columnLeft = (column: number): number => COLUMNS.x + column * COLUMNS.pitch;
const slot = (column: number, row: number): Box => ({
  x: columnLeft(column) + SLOT.inset,
  y: COLUMNS.y + COLUMNS.header + row * SLOT.pitch,
  width: SLOT.width,
  height: SLOT.height,
});
const columnFrame = (column: number): Box => ({
  x: columnLeft(column),
  y: COLUMNS.y,
  width: COLUMNS.width,
  height: COLUMNS.header + 3 * SLOT.pitch + SLOT.height + SLOT.inset,
});
// db-4 joins under the columns with one slot below each, so every bucket it takes drops straight
// down. Its name sits under the slots, where no falling bucket covers it.
const NEW_FRAME: Box = {
  x: COLUMNS.x,
  y: 282,
  width: 3 * COLUMNS.pitch + COLUMNS.width,
  height: SLOT.inset + SLOT.height + 26,
};
const newSlot = (column: number): Box => ({
  ...slot(column, 0),
  y: NEW_FRAME.y + SLOT.inset,
});
const homeOf = (bucket: number): Box => slot(Math.floor(bucket / 4), bucket % 4);
const lastOf = (bucket: number): Box =>
  TAKEN.includes(bucket) ? newSlot(Math.floor(bucket / 4)) : homeOf(bucket);

const CHIP = { width: 54, height: 20 } as const;
const chipIn = (bucket: number, tag: string): Box => {
  const home = homeOf(bucket);
  const place = playersOf(bucket).indexOf(tag);
  return { x: home.x + 26 + place * 58, y: home.y + 5, ...CHIP };
};

// The right-hand panel holds the player list in step 1 and the lookup in step 4. The list may
// reach down over the map, which only appears once the list has gone.
const FORMULA = { x: 720, y: 111 } as const;
const LIST: Box = { x: 720, y: 124, width: 248, height: 300 };
const listChip = (i: number): Box => ({
  x: LIST.x + 16 + Math.floor(i / 10) * 116,
  y: LIST.y + 38 + (i % 10) * 26,
  ...CHIP,
});
const PANEL: Box = { x: 720, y: 124, width: 248, height: 222 };

const MAP = { x: 32, y: 404, width: 51, height: 26, pitch: 59 } as const;
const entryBox = (bucket: number): Box => ({
  x: MAP.x + bucket * MAP.pitch,
  y: MAP.y,
  width: MAP.width,
  height: MAP.height,
});
const CAPTION_Y = 470;

const around = (box: Box, by: number): Box => ({
  x: box.x - by,
  y: box.y - by,
  width: box.width + 2 * by,
  height: box.height + 2 * by,
});

const shown = (from: number, to: number = LOOP): string => show([[from, to]], LOOP);

// Data attributes that name an element for the test, and the animation it carries, if any.
type Extra = { readonly data?: string; readonly inner?: string };
const role = (name: string, more = ''): string => `data-role="${name}"${more ? ` ${more}` : ''}`;

function rect(
  classes: string,
  { x, y, width, height }: Box,
  rx: number,
  { data, inner }: Extra = {},
): string {
  const head = `<rect${data ? ` ${data}` : ''} class="${classes}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}"`;
  return inner ? `${head}>${inner}</rect>` : `${head}/>`;
}

function text(
  classes: string,
  x: number,
  y: number,
  words: string,
  { data, inner = '' }: Extra = {},
): string {
  return `<text${data ? ` ${data}` : ''} class="${classes}" x="${x}" y="${y}">${escapeXml(words)}${inner}</text>`;
}

function chip(box: Box, tag: string): string[] {
  return [
    rect('la-cell', box, 4),
    text(
      'fill-cell-ink font-sans text-offset anchor-middle',
      box.x + box.width / 2,
      box.y + 14,
      tag,
    ),
  ];
}

function playerList(): string {
  return [
    '  <g data-role="player-list">',
    `    ${shown(0, STORY.map)}`,
    `    ${rect('la-canvas', LIST, 10)}`,
    `    ${text('la-note', LIST.x + 16, LIST.y + 24, `${TAGS.length} players with hash(player_id)`)}`,
    ...PLAYERS.map(([tag, hash], i) => {
      const box = listChip(i);
      return `    ${text('fill-ink-muted font-mono text-offset', box.x + box.width + 8, box.y + 14, String(hash), { data: role('hash', `data-player="${tag}"`) })}`;
    }),
    '  </g>',
  ].join('\n');
}

function server(name: Server): string {
  const added = name === NEW_SERVER;
  const frame = added ? NEW_FRAME : columnFrame(FIRST_SERVERS.indexOf(name));
  const [x, y, anchor] = added
    ? [frame.x + 12, frame.y + frame.height - 9, '']
    : [frame.x + frame.width / 2, frame.y + 19, ' anchor-middle'];
  return [
    `  <g data-role="server" data-server="${name}">`,
    `    ${shown(appearsAt(name))}`,
    `    ${rect('la-card', frame, 10)}`,
    `    ${text(`fill-ink font-mono text-label font-semibold${anchor}`, x, y, name, { data: role('server-name') })}`,
    ...(added
      ? [0, 1, 2, 3].map((column) => `    ${rect('la-cell-tail', newSlot(column), 6)}`)
      : []),
    '  </g>',
  ].join('\n');
}

function player(bucket: number, tag: string): string {
  const box = chipIn(bucket, tag);
  const handoff = handoffOf(bucket);
  const [cell, label] = chip(box, tag);
  return [
    `    <g data-role="player" data-player="${tag}">`,
    `      ${shown(lands(TAGS.indexOf(tag)))}`,
    `      ${cell}`,
    ...(handoff
      ? [
          `      ${rect('la-cell-new', box, 4, { data: role('moved'), inner: shown(handoff.arrives) })}`,
        ]
      : []),
    `      ${label}`,
    '    </g>',
  ].join('\n');
}

// A bucket carries its players: they are drawn inside it, so they move only when it moves.
function bucketGroup(bucket: number): string {
  const home = homeOf(bucket);
  const handoff = handoffOf(bucket);
  const dy = lastOf(bucket).y - home.y;
  return [
    `  <g data-role="bucket" data-bucket="${bucket}">`,
    ...(handoff
      ? [
          `    ${move(
            [
              [0, 0, 0],
              [handoff.leaves, 0, 0],
              [handoff.arrives, 0, dy],
              [LOOP, 0, dy],
            ],
            LOOP,
          )}`,
        ]
      : []),
    `    ${rect('fill-surface stroke-cell-stroke stroke-1.5', home, 6)}`,
    ...(handoff
      ? [
          `    ${rect('fill-none stroke-amber stroke-1.5', home, 6, { inner: shown(handoff.leaves) })}`,
        ]
      : []),
    `    ${text('la-offset anchor-middle', home.x + 13, home.y + 19, String(bucket), { data: role('index') })}`,
    ...playersOf(bucket).map((tag) => player(bucket, tag)),
    '  </g>',
  ].join('\n');
}

function entry(bucket: number): string {
  const box = entryBox(bucket);
  const handoff = handoffOf(bucket);
  const first = firstOwner(bucket);
  const middle = box.x + box.width / 2;
  const owner = (name: Server, from: number, to: number = LOOP): string =>
    `      ${text('la-offset anchor-middle', middle, box.y + 17, name, { data: role('owner'), inner: shown(from, to) })}`;
  return [
    `    <g data-role="map-entry" data-bucket="${bucket}">`,
    `      ${text('fill-ink-muted font-mono text-offset anchor-middle', middle, box.y - 8, String(bucket), { data: role('index') })}`,
    `      ${rect('la-cell', box, 4)}`,
    ...(handoff
      ? [
          `      ${rect('la-cell-new', box, 4, { inner: shown(handoff.flips) })}`,
          owner(first, appearsAt(first), handoff.flips),
          owner(NEW_SERVER, handoff.flips),
        ]
      : [owner(first, appearsAt(first))]),
    '    </g>',
  ].join('\n');
}

function map(): string {
  return [
    '  <g data-role="map">',
    `    ${shown(STORY.map)}`,
    `    ${text('la-label font-semibold', MAP.x, MAP.y - 30, 'Map: bucket → server')}`,
    ...Array.from({ length: BUCKETS }, (_, bucket) => entry(bucket)),
    '  </g>',
  ].join('\n');
}

function lookup(): string {
  const hash = hashOf(LOOKUP_TAG);
  const bucket = bucketOf(LOOKUP_TAG);
  const x = PANEL.x + 16;
  const step = (y: number, words: string, from: number): string =>
    `    ${text('fill-ink font-mono text-offset', x, y, words, { data: role('lookup-step'), inner: shown(from) })}`;
  return [
    `  <g data-role="lookup" data-player="${LOOKUP_TAG}">`,
    `    ${shown(STORY.lookup)}`,
    `    ${rect('la-canvas', PANEL, 10)}`,
    `    ${text('la-label font-semibold', x, PANEL.y + 24, `lookup ${LOOKUP_TAG}`, { data: role('lookup-tag') })}`,
    step(PANEL.y + 50, `hash(player_id) = ${hash}`, LOOKUP.hash),
    step(PANEL.y + 70, `bucket = ${hash} mod ${BUCKETS} = ${bucket}`, LOOKUP.bucket),
    step(PANEL.y + 90, `server = map[${bucket}] = ${lastOwner(bucket)}`, LOOKUP.server),
    `    ${text('fill-ink-muted font-sans text-offset', x, PANEL.y + 110, `map[${bucket}] was ${firstOwner(bucket)} until ${NEW_SERVER} joined`, { data: role('was'), inner: shown(LOOKUP.server) })}`,
    '  </g>',
  ].join('\n');
}

function count(): string {
  const x = PANEL.x + 16;
  const note = (y: number, words: string, name: string): string =>
    `  ${text('fill-ink-muted font-sans text-offset', x, y, words, { data: role(name), inner: shown(STORY.counted) })}`;
  return [
    `  ${text('fill-amber font-sans text-label font-semibold', x, PANEL.y + 150, `${MOVED.length} of ${TAGS.length} players moved`, { data: role('moved-count'), inner: shown(STORY.counted) })}`,
    note(PANEL.y + 170, MOVED.join(', '), 'moved-tags'),
    note(PANEL.y + 188, 'no player was rehashed', 'moved-note'),
  ].join('\n');
}

// Emerald rings mark what the lookup reads: the map entry, then the bucket on its server.
function reads(): string {
  const bucket = bucketOf(LOOKUP_TAG);
  const ring = (of: string, box: Box, rx: number, from: number): string =>
    `  ${rect('la-read-marker', around(box, 4), rx, { data: role('read', `data-of="${of}"`), inner: shown(from) })}`;
  return [
    ring('map-entry', entryBox(bucket), 7, LOOKUP.server),
    ring('bucket', lastOf(bucket), 9, LOOKUP.found),
  ].join('\n');
}

function flight(tag: string, i: number): string {
  const from = listChip(i);
  const to = chipIn(bucketOf(tag), tag);
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  return [
    `  <g data-role="flight" data-player="${tag}">`,
    `    ${shown(0, lands(i))}`,
    `    ${move(
      [
        [0, 0, 0],
        [departs(i), 0, 0],
        [lands(i), dx, dy],
        [LOOP, dx, dy],
      ],
      LOOP,
    )}`,
    ...chip(from, tag).map((part) => `    ${part}`),
    '  </g>',
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  ${text('la-label', 32, CAPTION_Y, words, { data: role('caption'), inner: shown(at, next) })}`;
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
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  ${text('la-title', 32, 44, TITLE)}`,
    `  ${text('la-note', 32, 68, NOTE)}`,
    `  ${text('fill-ink font-mono text-label', FORMULA.x, FORMULA.y, `bucket = hash(player_id) mod ${BUCKETS}`, { data: role('formula') })}`,
    playerList(),
    lookup(),
    count(),
    ...[...FIRST_SERVERS, NEW_SERVER].map(server),
    ...Array.from({ length: BUCKETS }, (_, bucket) => bucketGroup(bucket)),
    map(),
    reads(),
    ...TAGS.map(flight),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
