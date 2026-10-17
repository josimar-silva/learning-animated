import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  escapeXml,
  type Interval,
  keyTimes,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 30;
const WIDTH = 960;
const HEIGHT = 560;

type Point = readonly [x: number, y: number];

// A chip appears at the start of the lane, slides along the id axis until it sits between two
// boundaries, waits there while the comparison shows, then drops onto the server below.
type Trip = {
  readonly appears: number;
  readonly departs: number;
  readonly stops: number;
  readonly drops: number;
  readonly lands: number;
  readonly until: number;
};

// The story table: every moment in the SVG, in seconds.
const STORY = {
  steps: [
    {
      at: 0,
      caption:
        'Four servers split the players by id: db-0 owns [0, 2500), db-1 [2500, 5000), db-2 [5000, 7500), and db-3 [7500, ∞).',
    },
    {
      at: 4,
      caption:
        'A lookup compares the id with the boundaries: 5000 ≤ 6120 < 7500, so player 6120, Petrel, is on db-2.',
    },
    {
      at: 11,
      caption:
        'The four newest players, ids 9612 to 9980, all live on db-3, so a scan over those ids reads one server, not four.',
    },
    {
      at: 16,
      caption:
        'Ids grow as players sign up, and the game keeps growing: db-3 holds 11 of the 20 players and takes every new sign-up.',
    },
    {
      at: 20,
      caption:
        'Each player sends one request: db-3 answers 11 of the 20 and runs hot, while the other servers sit mostly idle.',
    },
  ],
  lookup: { appears: 4.4, departs: 4.8, stops: 6.8, drops: 8.2, lands: 9, until: 11 },
  scan: { appears: 11.4, departs: 11.8, stops: 12.6, drops: 13.8, lands: 14.5, until: 16 },
  // The players appear on the id axis in sign-up order. Then the top server opens a row for the
  // next sign-up, and every server counts its players.
  growth: { first: 16.2, every: 0.08, signup: 18, counts: 18.6 },
  // Each player sends one request, in this order. The verdict waits until the last one has landed.
  load: {
    order: [
      'Lemur',
      'Dingo',
      'Heron',
      'Koala',
      'Otter',
      'Tapir',
      'Coyote',
      'Ferret',
      'Raven',
      'Quail',
      'Stoat',
      'Badger',
      'Gibbon',
      'Egret',
      'Adder',
      'Newt',
      'Marten',
      'Petrel',
      'Jackal',
      'Iguana',
    ],
    first: 20.4,
    every: 0.25,
    fall: 0.7,
    flash: 0.4,
    verdict: 26.4,
  },
} as const;

type Player = { readonly tag: string; readonly id: number };
// The game's 20 players, the same in every Data lesson. They stand in for millions.
const PLAYERS: readonly Player[] = [
  { tag: 'Adder', id: 412 },
  { tag: 'Badger', id: 2981 },
  { tag: 'Coyote', id: 7702 },
  { tag: 'Dingo', id: 5214 },
  { tag: 'Egret', id: 7915 },
  { tag: 'Ferret', id: 9612 },
  { tag: 'Gibbon', id: 9745 },
  { tag: 'Heron', id: 9861 },
  { tag: 'Iguana', id: 9980 },
  { tag: 'Jackal', id: 8240 },
  { tag: 'Koala', id: 1042 },
  { tag: 'Lemur', id: 8577 },
  { tag: 'Marten', id: 3560 },
  { tag: 'Newt', id: 8903 },
  { tag: 'Otter', id: 9128 },
  { tag: 'Petrel', id: 6120 },
  { tag: 'Quail', id: 7038 },
  { tag: 'Raven', id: 2046 },
  { tag: 'Stoat', id: 9406 },
  { tag: 'Tapir', id: 4127 },
];
// Ids grow as players sign up, so id order is sign-up order.
const BY_ID = [...PLAYERS].sort((a, b) => a.id - b.id);

type Server = { readonly name: string; readonly lower: number; readonly upper: number };
// The top range has no upper bound, so no id is ever too high for a server.
const SERVERS: readonly Server[] = [
  { name: 'db-0', lower: 0, upper: 2500 },
  { name: 'db-1', lower: 2500, upper: 5000 },
  { name: 'db-2', lower: 5000, upper: 7500 },
  { name: 'db-3', lower: 7500, upper: Infinity },
];
const BOUNDARIES = SERVERS.slice(1).map((server) => server.lower);
const OPEN_TOP = SERVERS.at(-1)!;
const written = (bound: number): string => (Number.isFinite(bound) ? String(bound) : '∞');
// A server owns the ids from its lower bound up to, but not including, its upper bound.
const ownerOf = (id: number): Server =>
  SERVERS.find((server) => server.lower <= id && id < server.upper)!;
const playersOn = (server: Server): Player[] => BY_ID.filter((p) => ownerOf(p.id) === server);
const HOT = SERVERS.reduce((a, b) => (playersOn(b).length > playersOn(a).length ? b : a));
// A new player gets a higher id than anyone before, so the next sign-up lands on this server.
const NEXT_SIGNUP = ownerOf(BY_ID.at(-1)!.id + 1);

const LOOKUP = PLAYERS.find((p) => p.tag === 'Petrel')!;
// The four newest players hold the four highest ids.
const NEWEST = BY_ID.slice(-4);
const SCAN = { from: NEWEST[0]!.id, to: NEWEST.at(-1)!.id } as const;

// The axis draws ids up to 10000, and the top range runs on past its open end.
const AXIS = { left: 30, right: 930, from: 0, to: 10000 } as const;
const TICKS = [AXIS.from, ...BOUNDARIES];
const RULER = { label: 130, barTop: 144, barHeight: 4, tickTop: 136, tickBottom: 154 } as const;
const LANE_Y = 100;
const DOT = { y: 106, radius: 4 } as const;
const CHIP = { height: 20, char: 7.2, pad: 8, gap: 8 } as const;
const PANEL = { top: 164, height: 342, gap: 4, header: 186 } as const;
const INNER = 183;
const ROW = { top: 196, height: 20, step: 22, idRight: 40, tagLeft: 50 } as const;
const LOAD_ROW = { top: 468, height: 8, label: 40 } as const;
const TRACK = INNER - LOAD_ROW.label;
const UNIT = TRACK / playersOn(HOT).length;
const TALLY_Y = 496;
const CAPTION_Y = 538;

const xAt = (id: number): number =>
  AXIS.left + ((id - AXIS.from) * (AXIS.right - AXIS.left)) / (AXIS.to - AXIS.from);
const rangeLeft = (server: Server): number => xAt(server.lower);
const rangeRight = (server: Server): number =>
  Number.isFinite(server.upper) ? xAt(server.upper) : AXIS.right;
// A chip stops in the middle of the range its ids fall in.
const stopAt = (server: Server): number => (rangeLeft(server) + rangeRight(server)) / 2;
const panelLeft = (server: Server): number => rangeLeft(server) + PANEL.gap;
const panelWidth = (server: Server): number =>
  rangeRight(server) - rangeLeft(server) - 2 * PANEL.gap;
const innerLeft = (server: Server): number => panelLeft(server) + (panelWidth(server) - INNER) / 2;
const rowTop = (index: number): number => ROW.top + index * ROW.step;
const playerTop = (player: Player): number => rowTop(playersOn(ownerOf(player.id)).indexOf(player));
const playerMiddle = (player: Player): number => playerTop(player) + ROW.height / 2;
const chipWidth = (label: string): number =>
  2 * Math.ceil((label.length * CHIP.char + 2 * CHIP.pad) / 2);

const appearsAt = (player: Player): number =>
  STORY.growth.first + STORY.growth.every * BY_ID.indexOf(player);
const sendsAt = (player: Player): number =>
  STORY.load.first + STORY.load.every * (STORY.load.order as readonly string[]).indexOf(player.tag);
const landsAt = (player: Player): number => sendsAt(player) + STORY.load.fall;

const TITLE = 'Splitting players by id range';
const NOTE =
  'Each server owns one range of player ids. A range includes its lower bound and stops before the next one, and the top range never ends.';
const DESC =
  'An animation in five steps. Four database servers split the 20 players of an online game by player id: db-0 owns ids 0 to 2499, db-1 owns 2500 to 4999, db-2 owns 5000 to 7499, and db-3 owns every id from 7500 up, with no upper bound. ' +
  'A lookup for player 6120, Petrel, compares the id with the boundaries 5000 and 7500 and goes to db-2. ' +
  'A scan over the four newest players, ids 9612 to 9980, reads only db-3. ' +
  'Dots placed along the id axis in sign-up order then show that 11 of the 20 players have ids from 7500 up, and db-3 opens a row for the next sign-up, because every new id is higher than the last. ' +
  'Each player sends one request, so db-3 answers 11 of them and runs hot, while the other servers answer 3 each and sit mostly idle.';

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;

// A player's row on its server: one cell, the id on the left and the tag beside it.
function row(classes: string, player: Player): string[] {
  const left = innerLeft(ownerOf(player.id));
  const top = playerTop(player);
  return [
    `<rect class="${classes}" x="${left}" y="${top}" width="${INNER}" height="${ROW.height}" rx="4"/>`,
    text('la-offset anchor-end', left + ROW.idRight, top + 14, String(player.id)),
    text('la-offset', left + ROW.tagLeft, top + 14, player.tag),
  ];
}

const about = (player: Player): string =>
  `data-server="${ownerOf(player.id).name}" data-tag="${player.tag}"`;

const bar = (server: Server): string =>
  `x="${rangeLeft(server) + 3}" y="${RULER.barTop}" width="${rangeRight(server) - rangeLeft(server) - 6}" height="${RULER.barHeight}" rx="2"`;
const tick = (id: number): string =>
  `x1="${xAt(id)}" y1="${RULER.tickTop}" x2="${xAt(id)}" y2="${RULER.tickBottom}"`;
// The open top range's bar ends in an arrow, and the axis's end reads ∞ instead of a number.
const OPEN_END = {
  base: rangeRight(OPEN_TOP) - 5,
  tip: rangeRight(OPEN_TOP) + 5,
  half: 6,
} as const;
const arrow = (): string => {
  const y = RULER.barTop + RULER.barHeight / 2;
  return `d="M ${OPEN_END.base} ${y - OPEN_END.half} L ${OPEN_END.tip} ${y} L ${OPEN_END.base} ${y + OPEN_END.half} Z"`;
};

function ruler(): string {
  return [
    '  <g data-role="ruler">',
    ...TICKS.map(
      (id) =>
        `    <text data-role="tick" data-at="${id}" class="${BOUNDARIES.includes(id) ? 'fill-ink font-bold' : 'fill-ink-muted'} font-mono text-offset anchor-middle" x="${xAt(id)}" y="${RULER.label}">${id}</text>`,
    ),
    ...SERVERS.map(
      (server) =>
        `    <rect data-role="range" data-server="${server.name}" class="fill-violet" ${bar(server)}/>`,
    ),
    ...BOUNDARIES.map(
      (id) =>
        `    <line data-role="boundary" data-at="${id}" class="stroke-ink-muted stroke-1.5" ${tick(id)}/>`,
    ),
    `    <g data-role="open-end" data-server="${OPEN_TOP.name}">`,
    `      <path class="fill-violet" ${arrow()}/>`,
    `      ${text('fill-ink-muted font-mono text-offset anchor-middle', OPEN_END.tip, RULER.label, '∞')}`,
    '    </g>',
    '  </g>',
  ].join('\n');
}

// Lights the range an id falls in, and the boundaries on either side of it.
function match(of: string, server: Server, trip: Trip): string {
  const edges = [server.lower, server.upper].filter((id) => BOUNDARIES.includes(id));
  return [
    `  <g data-role="match" data-for="${of}" data-server="${server.name}">`,
    `    ${show([[trip.stops, trip.until]], LOOP)}`,
    `    <rect class="fill-amber" ${bar(server)}/>`,
    ...(server === OPEN_TOP ? [`    <path class="fill-amber" ${arrow()}/>`] : []),
    ...edges.map((id) => `    <line class="stroke-amber stroke-2.5" ${tick(id)}/>`),
    '  </g>',
  ].join('\n');
}

function panel(server: Server): string {
  const left = innerLeft(server);
  return [
    `  <g data-role="server" data-server="${server.name}">`,
    `    <rect class="la-card" x="${panelLeft(server)}" y="${PANEL.top}" width="${panelWidth(server)}" height="${PANEL.height}" rx="10"/>`,
    `    ${text('fill-ink font-mono text-label font-semibold', left, PANEL.header, server.name)}`,
    `    ${text('fill-ink-muted font-mono text-offset anchor-end', left + INNER, PANEL.header, `[${server.lower}, ${written(server.upper)})`)}`,
    '  </g>',
  ].join('\n');
}

function player(p: Player): string {
  return [
    `  <g data-role="player" ${about(p)} data-id="${p.id}">`,
    ...row('la-cell', p).map((part) => `    ${part}`),
    '  </g>',
  ].join('\n');
}

// The load meter grows one unit as each of the server's requests lands.
function meter(server: Server): string {
  const left = innerLeft(server);
  const place = `x="${left + LOAD_ROW.label}" y="${LOAD_ROW.top}"`;
  const moments = [0, ...playersOn(server).map(landsAt)].sort((a, b) => a - b);
  const widths = moments.map((_, i) => i * UNIT);
  return [
    `  ${text('fill-ink-muted font-sans text-offset', left, LOAD_ROW.top + 8, 'load')}`,
    `  <rect data-role="load-track" data-server="${server.name}" class="fill-stage stroke-grid stroke-1.5" ${place} width="${TRACK}" height="${LOAD_ROW.height}" rx="4"/>`,
    `  <rect data-role="load" data-server="${server.name}" class="fill-amber" ${place} width="0" height="${LOAD_ROW.height}" rx="4"><animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes(moments, LOOP)}" values="${widths.join(';')}"/></rect>`,
  ].join('\n');
}

function tally(server: Server): string {
  const left = innerLeft(server);
  const hot = server === HOT;
  const [verdict, ink] = hot
    ? ['runs hot', 'fill-red font-sans text-label font-semibold']
    : ['mostly idle', 'la-note'];
  const settled = show([[STORY.load.verdict, LOOP]], LOOP);
  return [
    `  <text data-role="count" data-server="${server.name}" class="la-label" x="${left}" y="${TALLY_Y}">${playersOn(server).length} players${show([[STORY.growth.counts, LOOP]], LOOP)}</text>`,
    `  <text data-role="verdict" data-server="${server.name}" class="${ink} anchor-end" x="${left + INNER}" y="${TALLY_Y}">${verdict}${settled}</text>`,
    ...(hot
      ? [
          `  <rect data-role="hot" data-server="${server.name}" class="fill-red" x="${left + LOAD_ROW.label}" y="${LOAD_ROW.top}" width="${TRACK}" height="${LOAD_ROW.height}" rx="4">${settled}</rect>`,
        ]
      : []),
  ].join('\n');
}

// The empty row where the next player to sign up will go.
function signup(): string {
  const left = innerLeft(NEXT_SIGNUP);
  const top = rowTop(playersOn(NEXT_SIGNUP).length);
  return [
    `  <g data-role="signup" data-server="${NEXT_SIGNUP.name}">`,
    `    ${show([[STORY.growth.signup, LOOP]], LOOP)}`,
    `    <rect class="la-cell-tail" x="${left}" y="${top}" width="${INNER}" height="${ROW.height}" rx="4"/>`,
    `    ${text('fill-ink-muted font-sans text-offset anchor-middle', left + INNER / 2, top + 14, 'next sign-up')}`,
    '  </g>',
  ].join('\n');
}

function lit(role: string, of: string | null, p: Player, [from, until]: Interval): string {
  const purpose = of === null ? '' : ` data-for="${of}"`;
  return [
    `  <g data-role="${role}"${purpose} ${about(p)}>`,
    `    ${show([[from, until]], LOOP)}`,
    ...row('la-cell-new', p).map((part) => `    ${part}`),
    '  </g>',
  ].join('\n');
}

// The comparison around a stopped chip: the server's lower bound before it, its upper bound after.
function bounds(of: string, label: string, trip: Trip, server: Server): string {
  const [x, half] = [stopAt(server), chipWidth(label) / 2];
  const when = show([[trip.stops, trip.drops]], LOOP);
  const y = LANE_Y + 4;
  return [
    `  <text data-role="bound" data-for="${of}" class="fill-amber font-mono text-offset anchor-end" x="${x - half - CHIP.gap}" y="${y}">${escapeXml(`${server.lower} ≤`)}${when}</text>`,
    `  <text data-role="bound" data-for="${of}" class="fill-amber font-mono text-offset anchor-start" x="${x + half + CHIP.gap}" y="${y}">${escapeXml(`< ${written(server.upper)}`)}${when}</text>`,
  ].join('\n');
}

function chip(
  attributes: string,
  label: string,
  trip: Trip,
  server: Server,
  landing: Point,
): string {
  const half = chipWidth(label) / 2;
  const start = AXIS.left + half;
  const x = stopAt(server);
  const path: Waypoint[] = [
    [0, start, LANE_Y],
    [trip.departs, start, LANE_Y],
    [trip.stops, x, LANE_Y],
    [trip.drops, x, LANE_Y],
    [trip.lands, ...landing],
    [LOOP, ...landing],
  ];
  return [
    `  <g ${attributes}>`,
    `    ${show([[trip.appears, trip.lands]], LOOP)}`,
    `    ${move(path, LOOP)}`,
    `    <rect class="la-cell-new" x="${-half}" y="${-CHIP.height / 2}" width="${2 * half}" height="${CHIP.height}" rx="${CHIP.height / 2}"/>`,
    `    ${text('la-offset anchor-middle', 0, 4, label)}`,
    '  </g>',
  ].join('\n');
}

// A player's dot rests over its id on the axis, then falls onto its row as one request.
function dot(p: Player): string {
  const rest: Point = [xAt(p.id), DOT.y];
  const landing: Point = [innerLeft(ownerOf(p.id)) + INNER - 14, playerMiddle(p)];
  const path: Waypoint[] = [
    [0, ...rest],
    [sendsAt(p), ...rest],
    [landsAt(p), ...landing],
    [LOOP, ...landing],
  ];
  return [
    `  <circle data-role="dot" ${about(p)} class="la-flow-dot" r="${DOT.radius}">`,
    `    ${show([[appearsAt(p), landsAt(p)]], LOOP)}`,
    `    ${move(path, LOOP)}`,
    '  </circle>',
  ].join('\n');
}

function caption({ at, caption: words }: { at: number; caption: string }, i: number): string {
  const next = STORY.steps[i + 1]?.at ?? LOOP;
  return `  <text data-role="caption" class="la-label" x="32" y="${CAPTION_Y}">${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
}

export function render(): string {
  const { lookup, scan, load } = STORY;
  const [lookupServer, scanServer] = [ownerOf(LOOKUP.id), ownerOf(SCAN.from)];
  const scanLabel = `${SCAN.from} to ${SCAN.to}`;
  const scanLanding: Point = [
    innerLeft(scanServer) + INNER / 2,
    (playerMiddle(NEWEST[0]!) + playerMiddle(NEWEST.at(-1)!)) / 2,
  ];
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
    ruler(),
    match('lookup', lookupServer, lookup),
    match('scan', scanServer, scan),
    ...SERVERS.map(panel),
    ...BY_ID.map(player),
    ...SERVERS.map(meter),
    ...SERVERS.map(tally),
    signup(),
    lit('found', 'lookup', LOOKUP, [lookup.lands, lookup.until]),
    ...NEWEST.map((p) => lit('found', 'scan', p, [scan.lands, scan.until])),
    ...BY_ID.map((p) => lit('hit', null, p, [landsAt(p), landsAt(p) + load.flash])),
    bounds('lookup', String(LOOKUP.id), lookup, lookupServer),
    bounds('scan', scanLabel, scan, scanServer),
    chip(`data-role="lookup" data-id="${LOOKUP.id}"`, String(LOOKUP.id), lookup, lookupServer, [
      innerLeft(lookupServer) + INNER / 2,
      playerMiddle(LOOKUP),
    ]),
    chip(
      `data-role="scan" data-from="${SCAN.from}" data-to="${SCAN.to}"`,
      scanLabel,
      scan,
      scanServer,
      scanLanding,
    ),
    ...BY_ID.map(dot),
    ...STORY.steps.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
