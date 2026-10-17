// Writes hash-sharding.svg through `just gen`. ROSTER drives every placement, and the story
// constants under it drive every timing.
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
const W = 1000;
const H = 560;

// Twenty players in sign-up order, so player ids grow down the list. Each carries a two-digit
// hash of its id, and between them the hashes leave every remainder mod 20 once.
const ROSTER: ReadonlyArray<readonly [tag: string, id: number, hash: number]> = [
  ['Adder', 412, 47],
  ['Koala', 1042, 66],
  ['Raven', 2046, 88],
  ['Badger', 2981, 82],
  ['Marten', 3560, 52],
  ['Tapir', 4127, 56],
  ['Dingo', 5214, 64],
  ['Petrel', 6120, 70],
  ['Quail', 7038, 43],
  ['Coyote', 7702, 35],
  ['Egret', 7915, 13],
  ['Jackal', 8240, 29],
  ['Lemur', 8577, 41],
  ['Newt', 8903, 99],
  ['Otter', 9128, 25],
  ['Stoat', 9406, 14],
  ['Ferret', 9612, 58],
  ['Gibbon', 9745, 91],
  ['Heron', 9861, 20],
  ['Iguana', 9980, 37],
];

const BEFORE = 4;
const AFTER = 5;
// hash mod 4 and hash mod 5 repeat together every 20.
const CYCLE = BEFORE * AFTER;
// The scan in step 2 covers player ids 9600 to 9999: the four newest players.
const SCAN = [9600, 9999] as const;

// Step 1: the router works out Adder's server slowly, then sends the others one every 0.3 s.
const FIRST_REACHES = 0.5;
const FIRST_LEAVES = 1.5;
const FIRST_LANDS = 2.5;
const NEXT_EVERY = 0.3;
const TRIP = 0.5;
// Step 2: the server counts, then the scan over the newest ids.
const SPREAD = 9;
const QUERY_SENT = 10;
const QUERY_ARRIVES = 11;
// Step 3: db-4 is added.
const OPEN = 15;
// Step 4: the players whose server changes move one at a time.
const MOVE = 18;
const MOVES_FROM = 18.5;
const MOVE_EVERY = 0.5;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'Each player goes to server hash(player_id) mod 4, and each server ends up with five. Adder hashes to 47, and 47 mod 4 = 3.',
  ],
  [
    SPREAD,
    'The four newest players sit on four different servers: no sign-up hot spot, but a scan over their ids asks every server.',
  ],
  [OPEN, 'Server db-4 is added, and the rule becomes hash(player_id) mod 5.'],
  [
    MOVE,
    '16 of the 20 players move: only those whose hash mod 20 is below 4 stay where they were.',
  ],
];

const TITLE = 'Hash mod N, until N changes';
const NOTE =
  'Hashing spreads players evenly, but every placement depends on N, so changing N moves most players.';
const DESC =
  'An animation in four steps. Twenty players of an online game sign up one at a time in order of player id, and a router sends each one to database server hash(player_id) mod 4, so each of db-0 to db-3 gets five players. ' +
  'The four newest players sit on four different servers, so a scan over their ids has to ask all four servers. ' +
  'Server db-4 is added and the rule becomes hash(player_id) mod 5. ' +
  'Sixteen players then move one at a time while a counter counts them, and the four whose hash mod 20 is 0, 1, 2, or 3 stay on their server. ' +
  'Each of the five servers ends with four players.';

type Point = readonly [x: number, y: number];
type Seat = readonly [server: number, row: number];

// The server boxes, one column each, with a seat per row for a player's chip.
const ROWS = 5;
const COLUMN_WIDTH = 176;
const COLUMN_PITCH = 190;
const BOX_TOP = 200;
const BOX_HEIGHT = 236;
const CHIP = { width: 152, height: 26 } as const;
const RING = { width: CHIP.width + 8, height: CHIP.height + 8 } as const;
const columnLeft = (server: number): number => 32 + server * COLUMN_PITCH;
const columnX = (server: number): number => columnLeft(server) + COLUMN_WIDTH / 2;
const rowY = (row: number): number => BOX_TOP + 49 + row * 34;
const seatPoint = ([server, row]: Seat): Point => [columnX(server), rowY(row)];

// The router sits above the servers. A player waits at ENTRY while its server is worked out.
const ROUTER = { left: 310, top: 84, width: 380, height: 64 } as const;
const ROUTER_X = ROUTER.left + ROUTER.width / 2;
const BUS_Y = 176;
const ENTRY: Point = [ROUTER_X, BUS_Y];
const route = (server: number): Point[] => [
  [ROUTER_X, ROUTER.top + ROUTER.height],
  ENTRY,
  [columnX(server), BUS_Y],
  [columnX(server), BOX_TOP - 4],
];

const TALLY_Y = 462;
const CAPTION_TOP = 478;
const LEGEND_Y = 540;

type Player = {
  readonly tag: string;
  readonly id: number;
  readonly hash: number;
  // Reaches the router, leaves it, and lands on its first server.
  readonly reaches: number;
  readonly leaves: number;
  readonly lands: number;
  readonly first: Seat;
  readonly second: Seat;
  // Leaves for its second server at this moment, or null when both rules agree.
  readonly moves: number | null;
};

function plan(): Player[] {
  const filled = Array.from({ length: BEFORE }, () => 0);
  const placed = ROSTER.map(([tag, id, hash], i) => {
    const leaves = i === 0 ? FIRST_LEAVES : FIRST_LANDS + (i - 1) * NEXT_EVERY;
    const server = hash % BEFORE;
    const row = filled[server]!;
    filled[server] = row + 1;
    const first: Seat = [server, row];
    return {
      tag,
      id,
      hash,
      reaches: i === 0 ? FIRST_REACHES : leaves,
      leaves,
      lands: i === 0 ? FIRST_LANDS : leaves + TRIP,
      first,
    };
  });
  // Taken in order of hash mod 20, each player finds its new seat free: whoever sat there has
  // already moved on.
  const taken = Array.from({ length: AFTER }, () => Array.from({ length: ROWS }, () => false));
  for (const { first } of placed) taken[first[0]]![first[1]] = true;
  const moving = placed
    .filter(({ hash }) => hash % BEFORE !== hash % AFTER)
    .sort((a, b) => (a.hash % CYCLE) - (b.hash % CYCLE));
  const seconds = new Map<string, readonly [seat: Seat, moves: number]>();
  moving.forEach(({ tag, hash, first }, j) => {
    taken[first[0]]![first[1]] = false;
    const server = hash % AFTER;
    const row = taken[server]!.indexOf(false);
    if (row === -1) throw new Error(`db-${server} has no free seat for ${tag}`);
    taken[server]![row] = true;
    seconds.set(tag, [[server, row], MOVES_FROM + j * MOVE_EVERY]);
  });
  return placed.map((player) => {
    const second = seconds.get(player.tag);
    return { ...player, second: second?.[0] ?? player.first, moves: second?.[1] ?? null };
  });
}

const PLAYERS = plan();
const MOVERS = PLAYERS.flatMap((player) =>
  player.moves === null ? [] : [{ ...player, moves: player.moves }],
).sort((a, b) => a.moves - b.moves);
const ALL_MOVED = MOVES_FROM + MOVERS.length * MOVE_EVERY;

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const shown = (during: Interval): string => show([during], LOOP);
const indent = (lines: readonly string[], spaces: number): string[] =>
  lines.map((line) => `${' '.repeat(spaces)}${line}`);

function distinct(points: readonly Point[]): Point[] {
  return points.filter(
    ([x, y], i) => i === 0 || x !== points[i - 1]![0] || y !== points[i - 1]![1],
  );
}

const pathOf = (points: readonly Point[]): string =>
  distinct(points)
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');

// Waypoints that cross a polyline at constant speed between two moments, holding still before and after.
function travel(points: readonly Point[], from: number, to: number): Waypoint[] {
  const path = distinct(points);
  const lengths = path.slice(1).map(([x, y], i) => Math.hypot(x - path[i]![0], y - path[i]![1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const first = path[0]!;
  const last = path[path.length - 1]!;
  let walked = 0;
  return [
    [0, ...first],
    [from, ...first],
    ...lengths.map((length, i): Waypoint => {
      walked += length;
      return [from + ((to - from) * walked) / total, ...path[i + 1]!];
    }),
    [LOOP, ...last],
  ];
}

function router(): string[] {
  const rule = (n: number, during: Interval): string => {
    const modulus = n === BEFORE ? String(n) : `<tspan class="fill-amber">${n}</tspan>`;
    return `<text data-role="rule" data-n="${n}" class="font-mono text-label fill-ink anchor-middle" x="${ROUTER_X}" y="${ROUTER.top + 37}">server = hash(player_id) mod ${modulus}${shown(during)}</text>`;
  };
  const lines: Array<readonly [Interval, string]> = [
    ...PLAYERS.map((player, i): readonly [Interval, string] => [
      [player.reaches, PLAYERS[i + 1]?.reaches ?? player.reaches + NEXT_EVERY],
      `${player.tag}: hash(${player.id}) = ${player.hash}, ${player.hash} mod ${BEFORE} = ${player.hash % BEFORE}`,
    ]),
    [[QUERY_SENT, OPEN], `player_id ${SCAN[0]} to ${SCAN[1]}: ask all ${BEFORE} servers`],
    ...MOVERS.map((player): readonly [Interval, string] => [
      [player.moves, player.moves + MOVE_EVERY],
      `${player.tag}: ${player.hash} mod ${BEFORE} = ${player.hash % BEFORE}, ${player.hash} mod ${AFTER} = ${player.hash % AFTER}`,
    ]),
    [
      [ALL_MOVED, LOOP],
      `mod ${BEFORE} and mod ${AFTER} agree only when hash mod ${CYCLE} < ${BEFORE}`,
    ],
  ];
  return [
    '  <g data-role="router">',
    `    <rect class="la-canvas stroke-1.5" x="${ROUTER.left}" y="${ROUTER.top}" width="${ROUTER.width}" height="${ROUTER.height}" rx="10"/>`,
    `    ${text('fill-ink-muted font-sans text-offset anchor-middle', ROUTER_X, ROUTER.top + 17, 'router')}`,
    `    ${rule(BEFORE, [0, OPEN])}`,
    `    ${rule(AFTER, [OPEN, LOOP])}`,
    ...lines.map(
      ([during, words]) =>
        `    <text data-role="working" class="font-mono text-offset fill-amber anchor-middle" x="${ROUTER_X}" y="${ROUTER.top + 55}">${escapeXml(words)}${shown(during)}</text>`,
    ),
    '  </g>',
  ];
}

function servers(): string[] {
  return Array.from({ length: AFTER }, (_, server) =>
    [
      `  <g data-role="server" data-server="${server}">`,
      ...(server < BEFORE ? [] : [`    ${shown([OPEN, LOOP])}`]),
      `    <path class="la-arrow" d="${pathOf(route(server))}" marker-end="url(#head)"/>`,
      `    <rect data-role="box" data-server="${server}" class="la-card" x="${columnLeft(server)}" y="${BOX_TOP}" width="${COLUMN_WIDTH}" height="${BOX_HEIGHT}" rx="12"/>`,
      `    ${text('font-mono text-label font-semibold fill-ink anchor-middle', columnX(server), BOX_TOP + 22, `db-${server}`)}`,
      '  </g>',
    ].join('\n'),
  );
}

// Each server shows its player count while nobody is on the move: from step 2 until the moves
// start, and again after the last one lands.
function counts(): string[] {
  return Array.from({ length: AFTER }, (_, server) => {
    const before = PLAYERS.filter(({ first }) => first[0] === server).length;
    const after = PLAYERS.filter(({ second }) => second[0] === server).length;
    const count = (players: number, during: Interval): string =>
      `  <text data-role="count" data-server="${server}" class="la-note anchor-middle" x="${columnX(server)}" y="${BOX_TOP + BOX_HEIGHT - 14}">${players} players${shown(during)}</text>`;
    return [
      count(before, [server < BEFORE ? SPREAD : OPEN, MOVE]),
      count(after, [ALL_MOVED, LOOP]),
    ];
  }).flat();
}

// The scan over an id range: hashing scattered those ids, so the router asks every server.
function asks(): string[] {
  return Array.from({ length: BEFORE }, (_, server) =>
    [
      `  <g data-role="ask" data-server="${server}">`,
      `    ${shown([QUERY_SENT, OPEN])}`,
      `    <path class="fill-none stroke-amber stroke-1.5" d="${pathOf(route(server))}" marker-end="url(#head-new)"/>`,
      '    <circle class="la-flow-dot" r="5">',
      `      ${shown([QUERY_SENT, QUERY_ARRIVES])}`,
      `      ${move(travel(route(server), QUERY_SENT, QUERY_ARRIVES), LOOP)}`,
      '    </circle>',
      '  </g>',
    ].join('\n'),
  );
}

const identity = (player: Player): string =>
  `data-tag="${player.tag}" data-id="${player.id}" data-hash="${player.hash}"`;

// A chip is drawn around (0, 0), so a translate puts it in its seat.
function chip(player: Player, frame: string): string[] {
  const half = CHIP.width / 2;
  return [
    `<rect class="${frame}" x="${-half}" y="${-CHIP.height / 2}" width="${CHIP.width}" height="${CHIP.height}" rx="5"/>`,
    text('font-sans text-label fill-cell-ink', -half + 10, 4.5, player.tag),
    text('font-mono text-offset fill-ink-muted anchor-end', 30, 4.5, `#${player.id}`),
    text('la-offset anchor-end', half - 10, 4.5, String(player.hash)),
  ];
}

// A ring around the chip centered on a point: amber for a scan hit, emerald for a player that stays.
const ring = (attributes: string, classes: string, [x, y]: Point, during: Interval): string =>
  `<rect ${attributes} class="${classes}" x="${x - RING.width / 2}" y="${y - RING.height / 2}" width="${RING.width}" height="${RING.height}" rx="8">${shown(during)}</rect>`;

// A player's chip at each seat it holds. A player that moves gets an amber chip at its new seat.
function seats(player: Player): string[] {
  const seat = (at: Seat, during: Interval, frame: string, extra: readonly string[] = []) => {
    const [x, y] = seatPoint(at);
    return [
      `  <g data-role="player" ${identity(player)} transform="translate(${x} ${y})">`,
      `    ${shown(during)}`,
      ...indent([...chip(player, frame), ...extra], 4),
      '  </g>',
    ].join('\n');
  };
  if (player.moves === null) {
    const stayed = ring(
      'data-role="stayed"',
      'fill-none stroke-emerald stroke-2.5',
      [0, 0],
      [MOVE, LOOP],
    );
    return [seat(player.first, [player.lands, LOOP], 'la-cell', [stayed])];
  }
  return [
    seat(player.first, [player.lands, player.moves], 'la-cell'),
    seat(player.second, [player.moves + MOVE_EVERY, LOOP], 'la-cell-new'),
  ];
}

function hits(): string[] {
  return PLAYERS.filter(({ id }) => id >= SCAN[0] && id <= SCAN[1]).map(
    ({ tag, first }) =>
      `  ${ring(`data-role="hit" data-tag="${tag}"`, 'fill-none stroke-amber stroke-2.5', seatPoint(first), [QUERY_ARRIVES, OPEN])}`,
  );
}

// Chips on the way to a seat, drawn above everything else. Only a player that moves is amber.
function flights(player: Player): string[] {
  const flight = (during: Interval, path: readonly Waypoint[], frame: string): string =>
    [
      `  <g data-role="flight" ${identity(player)}>`,
      `    ${shown(during)}`,
      `    ${move(path, LOOP)}`,
      ...indent(chip(player, frame), 4),
      '  </g>',
    ].join('\n');
  const [x, y] = seatPoint(player.first);
  const arrival = flight(
    [player.reaches, player.lands],
    travel([ENTRY, [x, BUS_Y], [x, y]], player.leaves, player.lands),
    'la-cell',
  );
  if (player.moves === null) return [arrival];
  const landed = player.moves + MOVE_EVERY;
  return [
    arrival,
    flight(
      [player.moves, landed],
      travel([seatPoint(player.first), seatPoint(player.second)], player.moves, landed),
      'la-cell-new',
    ),
  ];
}

function tally(): string[] {
  const ticks: ReadonlyArray<readonly [from: number, moved: number]> = [
    [MOVE, 0],
    ...MOVERS.map(({ moves }, j) => [moves + MOVE_EVERY, j + 1] as const),
  ];
  return ticks.map(([from, moved], i) => {
    const next = ticks[i + 1];
    const classes = next
      ? 'font-sans text-label fill-ink anchor-middle'
      : 'font-sans text-label font-semibold fill-amber anchor-middle';
    return `  <text data-role="moved" class="${classes}" x="${W / 2}" y="${TALLY_Y}">${moved} of ${PLAYERS.length} players moved${shown([from, next?.[0] ?? LOOP])}</text>`;
  });
}

function captions(): string[] {
  return [
    `  <rect class="la-canvas" x="32" y="${CAPTION_TOP}" width="${W - 64}" height="36" rx="8"/>`,
    ...CAPTIONS.map(
      ([from, words], i) =>
        `  <text data-role="caption" class="la-label anchor-middle" x="${W / 2}" y="${CAPTION_TOP + 23}">${escapeXml(words)}${shown([from, CAPTIONS[i + 1]?.[0] ?? LOOP])}</text>`,
    ),
  ];
}

// The key to step 4's colors shows only once players start to move, so step 2's amber rings
// can't be read as moves.
function legend(): string[] {
  return [
    '  <g data-role="legend">',
    `    ${shown([MOVE, LOOP])}`,
    `    <rect class="la-cell-new" x="32" y="${LEGEND_Y - 11}" width="26" height="14" rx="3"/>`,
    `    ${text('la-note', 66, LEGEND_Y, 'moved to a new server')}`,
    `    <rect class="fill-none stroke-emerald stroke-2.5" x="236" y="${LEGEND_Y - 11}" width="26" height="14" rx="3"/>`,
    `    ${text('la-note', 270, LEGEND_Y, 'stayed on its server')}`,
    '  </g>',
    `  ${text('la-note anchor-end', W - 32, LEGEND_Y, 'Each chip shows a tag, a #player_id, and a made-up two-digit hash.')}`,
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
    '    <marker id="head-new" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">',
    '      <path class="fill-amber" d="M 0 0 L 9 4.5 L 0 9 Z"/>',
    '    </marker>',
    '  </defs>',
    `  <rect class="fill-stage" width="${W}" height="${H}"/>`,
    `  ${text('la-title', 32, 44, TITLE)}`,
    `  ${text('la-note', 32, 68, NOTE)}`,
    ...router(),
    ...servers(),
    ...counts(),
    ...asks(),
    ...PLAYERS.flatMap(seats),
    ...hits(),
    ...PLAYERS.flatMap(flights),
    ...tally(),
    ...captions(),
    ...legend(),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
