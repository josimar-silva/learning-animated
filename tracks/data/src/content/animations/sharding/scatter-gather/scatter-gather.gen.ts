import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  escapeXml,
  type Interval,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 20;
const WIDTH = 1000;
const HEIGHT = 564;

type Point = readonly [x: number, y: number];
type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type Player = {
  readonly tag: string;
  readonly id: number;
  // hash(player_id), the value every sharding lesson places players by.
  readonly hash: number;
  readonly rating: number;
};

const player = (tag: string, id: number, hash: number, rating: number): Player => ({
  tag,
  id,
  hash,
  rating,
});

// The track's roster. The 20 players stand in for millions.
const ROSTER: readonly Player[] = [
  player('Adder', 412, 47, 6720),
  player('Badger', 2981, 82, 6450),
  player('Coyote', 7702, 35, 5560),
  player('Dingo', 5214, 64, 7650),
  player('Egret', 7915, 13, 8150),
  player('Ferret', 9612, 58, 9870),
  player('Gibbon', 9745, 91, 8330),
  player('Heron', 9861, 20, 6980),
  player('Iguana', 9980, 37, 4610),
  player('Jackal', 8240, 29, 7020),
  player('Koala', 1042, 66, 8640),
  player('Lemur', 8577, 41, 9310),
  player('Marten', 3560, 52, 5230),
  player('Newt', 8903, 99, 9540),
  player('Otter', 9128, 25, 8770),
  player('Petrel', 6120, 70, 7890),
  player('Quail', 7038, 43, 7410),
  player('Raven', 2046, 88, 8920),
  player('Stoat', 9406, 14, 5870),
  player('Tapir', 4127, 56, 8410),
];

type Server = {
  readonly name: string;
  // Seconds the server takes to read one row.
  readonly pace: number;
  readonly busy: boolean;
  // Its players, best rating first: the order its rating index reads them in.
  readonly players: readonly Player[];
};

const SHARDS = 4;
// db-2 is busy with other work, so it reads far slower than the others.
const PACE = [0.4, 0.5, 1.2, 0.6] as const;
const BUSY = 'db-2';
const SERVERS: readonly Server[] = PACE.map((pace, n) => ({
  name: `db-${n}`,
  pace,
  busy: `db-${n}` === BUSY,
  players: ROSTER.filter((p) => p.hash % SHARDS === n).sort((a, b) => b.rating - a.rating),
}));
const home = (p: Player): Server => SERVERS[p.hash % SHARDS]!;

type Query = {
  readonly id: string;
  readonly label: string;
  readonly sql: readonly string[];
  // The player the query names, if any. Only then can the router hash it to one server.
  readonly names?: Player;
  // The rows a server reads and returns, and how many rows the merged result keeps.
  readonly rows: (s: Server) => readonly Player[];
  readonly keeps: number;
  // When the query reaches the router.
  readonly starts: number;
};

const LEMUR = ROSTER.find((p) => p.tag === 'Lemur')!;
const TOP = 3;
const PROFILE: Query = {
  id: 'profile',
  label: `${LEMUR.tag}'s profile`,
  sql: ['SELECT * FROM players', `WHERE player_id = ${LEMUR.id}`],
  names: LEMUR,
  rows: (s) => s.players.filter((p) => p === LEMUR),
  keeps: 1,
  starts: 4,
};
const LEADERBOARD: Query = {
  id: 'leaderboard',
  label: `Global top ${TOP} by rating`,
  sql: ['SELECT * FROM players', `ORDER BY rating DESC LIMIT ${TOP}`],
  // Each server returns its own top 3, because the global top 3 could all come from one server.
  rows: (s) => s.players.slice(0, TOP),
  keeps: TOP,
  starts: 10,
};
const QUERIES: readonly Query[] = [PROFILE, LEADERBOARD];

// The router reads the query for 0.5 s and sends it 0.5 s later. A request or an answer takes
// 0.8 s between the router and a server.
const DECIDE = 0.5;
const SEND = 1;
const TRIP = 0.8;
// Every request runs down the router's stub to the fork together, then fans out along its own
// path, and drops into its server. An answer takes the same path back.
const STUB = 0.2;
const DROP = 0.2;

const targets = (q: Query): readonly Server[] => (q.names ? [home(q.names)] : SERVERS);
const ends = (q: Query): number => QUERIES[QUERIES.indexOf(q) + 1]?.starts ?? LOOP;
const decided = (q: Query): number => q.starts + DECIDE;
const sent = (q: Query): number => q.starts + SEND;
const lands = (q: Query): number => sent(q) + TRIP;
// The k-th row a server reads for the query.
const reading = (q: Query, s: Server, k: number): Interval => [
  lands(q) + k * s.pace,
  lands(q) + (k + 1) * s.pace,
];
const replies = (q: Query, s: Server): number => lands(q) + q.rows(s).length * s.pace;
const answered = (q: Query, s: Server): number => replies(q, s) + TRIP;
// The servers in the order their answers reach the router.
const arrivals = (q: Query): Server[] =>
  [...targets(q)].sort((a, b) => answered(q, a) - answered(q, b));
const done = (q: Query): number => answered(q, arrivals(q).at(-1)!);
// The result once the first k answers are in: their rows, best rating first, cut to what the
// query keeps.
const merged = (q: Query, k: number): Array<readonly [Server, Player]> =>
  arrivals(q)
    .slice(0, k)
    .flatMap((s) => q.rows(s).map((p) => [s, p] as const))
    .sort((a, b) => b[1].rating - a[1].rating)
    .slice(0, q.keeps);

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'Players are sharded by player_id: hash(player_id) mod 4 places five of them on each server, db-0 to db-3.',
  ],
  [
    PROFILE.starts,
    "Lemur's profile names player 8577, and hash(8577) mod 4 = 1, so the router asks db-1 alone. The other servers never see it.",
  ],
  [
    LEADERBOARD.starts,
    'The global top 3 by rating names no player, so the router asks all four servers at once, each for its own top 3.',
  ],
  [
    answered(LEADERBOARD, arrivals(LEADERBOARD)[0]!),
    'The router merges answers as they arrive. Busy db-2 answers last and holds the best rating, so the leaderboard waits for it.',
  ],
];

const TITLE = 'Queries without the shard key';
const NOTE =
  'A query that names the shard key goes to one server. Any other query asks every server and waits for the slowest.';
const DESC =
  'An animation in four steps. Players are sharded by player id across four database servers, db-0 to db-3: hash(player_id) mod 4 places five players on each, and a router in front of them applies the same rule. ' +
  "Loading Lemur's profile names player 8577, so the router sends the query to db-1 alone, and db-1 answers with one row. " +
  'The global top 3 by rating names no player, so the router asks all four servers at once, and each returns its own top 3. ' +
  'The router merges the answers as they arrive, but db-2 is busy and answers last. ' +
  'It holds Ferret, the best rating of all, so the leaderboard of Ferret, Newt, and Lemur is done only when that answer arrives.';

// The query, the router, and the result sit in a row above the four servers.
const QUERY_BOX: Box = { left: 32, top: 92, width: 300, height: 136 };
const ROUTER: Box = { left: 362, top: 92, width: 276, height: 136 };
const RESULT: Box = { left: 668, top: 92, width: 300, height: 136 };
const right = (box: Box): number => box.left + box.width;
const ROUTER_X = ROUTER.left + ROUTER.width / 2;
const ROUTER_BOTTOM = ROUTER.top + ROUTER.height;
const LINK_Y = ROUTER.top + ROUTER.height / 2;
const FORK_Y = 268;
// The rendered width of the router's 'shard key: player_id' label, which step 1 frames.
const KEY_LABEL_WIDTH = 113;

const PANEL = { top: 312, width: 216, height: 196, gap: 24 } as const;
const FIELDS = [
  ['player_id', 70],
  ['tag', 56],
  ['rating', 44],
] as const;
type Field = (typeof FIELDS)[number][0];
const CELL = { height: 20, gap: 6, pitch: 26 } as const;
const fieldLeft = (i: number): number =>
  FIELDS.slice(0, i).reduce((x, [, width]) => x + width + CELL.gap, 0);
const ROW_WIDTH = fieldLeft(FIELDS.length) - CELL.gap;
const HEADER_Y = PANEL.top + 50;
const ROWS_TOP = PANEL.top + 60;
const RESULT_HEADER_Y = RESULT.top + 46;
const RESULT_ROWS_TOP = RESULT.top + 54;
const CAPTION_Y = 544;

const boxOf = (s: Server): Box => ({
  left: 32 + SERVERS.indexOf(s) * (PANEL.width + PANEL.gap),
  top: PANEL.top,
  width: PANEL.width,
  height: PANEL.height,
});
const centreOf = (s: Server): number => boxOf(s).left + PANEL.width / 2;
// Rows sit centred in a server's box, below its name and the column names.
const rowLeft = (s: Server): number => boxOf(s).left + (PANEL.width - ROW_WIDTH) / 2;
const rowTop = (row: number): number => ROWS_TOP + row * CELL.pitch;

// A text, with any data attributes in `tags` and an optional animation inside it.
const text = (
  classes: string,
  x: number,
  y: number,
  words: string,
  tags = '',
  animation = '',
): string =>
  `<text${tags} class="${classes}" x="${x}" y="${y}">${escapeXml(words)}${animation}</text>`;

const rect = ({ left, top, width, height }: Box, classes: string, rx: number): string =>
  `<rect class="${classes}" x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}"/>`;

const indent = (lines: readonly string[], depth: number): string[] =>
  lines.map((line) => `${' '.repeat(depth)}${line}`);

const valueOf = (p: Player, name: Field): string =>
  name === 'player_id' ? String(p.id) : name === 'tag' ? p.tag : String(p.rating);

// A player row as three cells, player_id, tag, and rating, with its left edge at x.
function cells(x: number, top: number, p: Player, frame: string): string[] {
  return FIELDS.flatMap(([name, width], i) => {
    const left = x + fieldLeft(i);
    return [
      `<g data-field="${name}">`,
      `  ${rect({ left, top, width, height: CELL.height }, frame, 4)}`,
      `  ${text('la-offset anchor-middle', left + width / 2, top + 14, valueOf(p, name))}`,
      '</g>',
    ];
  });
}

function columnNames(x: number, y: number): string[] {
  return FIELDS.map(([name, width], i) =>
    text(
      'fill-ink-muted font-mono text-offset anchor-middle',
      x + fieldLeft(i) + width / 2,
      y,
      name,
    ),
  );
}

function busyTag(s: Server): string[] {
  const box = boxOf(s);
  return [
    `<g data-role="busy" data-server="${s.name}">`,
    `  ${rect({ left: box.left + 56, top: box.top + 11, width: 40, height: 18 }, 'fill-surface stroke-amber stroke-1.5', 9)}`,
    `  ${text('fill-ink font-sans text-offset anchor-middle', box.left + 76, box.top + 24, 'busy')}`,
    '</g>',
  ];
}

function server(s: Server): string {
  const box = boxOf(s);
  const rows = s.players.map((p, row) =>
    [
      `    <g data-role="player" data-row="${row + 1}" data-player="${p.id}" data-tag="${p.tag}">`,
      ...indent(cells(rowLeft(s), rowTop(row), p, 'la-cell'), 6),
      '    </g>',
    ].join('\n'),
  );
  return [
    `  <g data-role="server" data-server="${s.name}">`,
    `    ${rect(box, 'la-card', 12)}`,
    `    ${text('la-label font-semibold', box.left + 16, box.top + 24, s.name, ' data-role="server-name"')}`,
    ...indent(s.busy ? busyTag(s) : [], 4),
    `    ${text('fill-ink-muted font-sans text-offset anchor-end', right(box) - 16, box.top + 24, `${s.players.length} players`, ' data-role="players"')}`,
    ...indent(columnNames(rowLeft(s), HEADER_Y), 4),
    ...rows,
    '  </g>',
  ].join('\n');
}

function wiring(): string {
  const fanOut = SERVERS.map(
    (s) =>
      `  <path class="la-arrow" d="M ${ROUTER_X} ${ROUTER_BOTTOM} V ${FORK_Y} H ${centreOf(s)} V ${PANEL.top - 6}" marker-end="url(#head)"/>`,
  );
  return [
    `  <path class="la-arrow" d="M ${right(QUERY_BOX)} ${LINK_Y} H ${ROUTER.left - 6}" marker-end="url(#head)"/>`,
    `  <path class="la-arrow" d="M ${right(ROUTER)} ${LINK_Y} H ${RESULT.left - 6}" marker-end="url(#head)"/>`,
    ...fanOut,
  ].join('\n');
}

function frames(): string {
  return [
    `  ${rect(QUERY_BOX, 'la-canvas stroke-1.5', 10)}`,
    `  ${text('fill-ink-muted font-sans text-offset', QUERY_BOX.left + 16, QUERY_BOX.top + 24, 'query')}`,
    '  <g data-role="router">',
    `    ${rect(ROUTER, 'la-card', 12)}`,
    `    ${text('la-label font-semibold', ROUTER.left + 16, ROUTER.top + 24, 'router')}`,
    `    ${text('fill-ink-muted font-sans text-offset anchor-end', right(ROUTER) - 16, ROUTER.top + 24, 'shard key: player_id')}`,
    '  </g>',
    `  ${rect(RESULT, 'la-canvas stroke-1.5', 10)}`,
    `  ${text('fill-ink-muted font-sans text-offset', RESULT.left + 16, RESULT.top + 24, 'result')}`,
    ...indent(columnNames(RESULT.left + 16, RESULT_HEADER_Y), 2),
  ].join('\n');
}

// Step 1 frames the shard key: the router's label and every server's player_id column.
function shardKey(): string {
  const during = show([[0, PROFILE.starts]], LOOP);
  const outline = 'fill-none stroke-amber stroke-1.5';
  const [, idWidth] = FIELDS[0];
  const columns = SERVERS.map((s) => {
    const top = HEADER_Y - 14;
    const bottom = rowTop(s.players.length - 1) + CELL.height + 3;
    return `  <rect data-role="shard-key" data-server="${s.name}" class="${outline}" x="${rowLeft(s) - 3}" y="${top}" width="${idWidth + 6}" height="${bottom - top}" rx="6">${during}</rect>`;
  });
  const labelLeft = right(ROUTER) - 16 - KEY_LABEL_WIDTH;
  return [
    `  <rect data-role="shard-key" class="${outline}" x="${labelLeft - 7}" y="${ROUTER.top + 10}" width="${KEY_LABEL_WIDTH + 14}" height="20" rx="6">${during}</rect>`,
    ...columns,
  ].join('\n');
}

const tags = (role: string, q: Query, s?: Server): string =>
  ` data-role="${role}" data-query="${q.id}"${s ? ` data-server="${s.name}"` : ''}`;

// What a server does with a query: its box glows while it reads, row by row, and every row it
// returns lights up as it is read and stays lit until the next query.
function work(q: Query): string {
  return targets(q)
    .flatMap((s) => {
      const box = boxOf(s);
      const picked = q.rows(s).map((p, k) => [p, s.players.indexOf(p), reading(q, s, k)] as const);
      const lit = picked.flatMap(([p, row, [from]]) => [
        `  <g${tags('match', q, s)} data-row="${row + 1}" data-tag="${p.tag}">`,
        `    ${show([[from, ends(q)]], LOOP)}`,
        ...indent(cells(rowLeft(s), rowTop(row), p, 'la-cell-new'), 4),
        '  </g>',
      ]);
      const marker = picked.map(
        ([, row, during]) =>
          `  <rect${tags('read', q, s)} data-row="${row + 1}" class="la-read-marker" x="${rowLeft(s) - 5}" y="${rowTop(row) - 3}" width="${ROW_WIDTH + 10}" height="${CELL.height + 6}" rx="6">${show([during], LOOP)}</rect>`,
      );
      return [
        ...lit,
        `  <rect${tags('working', q, s)} class="fill-none stroke-amber stroke-2.5" x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="12">${show([[lands(q), replies(q, s)]], LOOP)}</rect>`,
        ...marker,
      ];
    })
    .join('\n');
}

const nameList = (servers: readonly Server[]): string => servers.map((s) => s.name).join(', ');

// The router's side of a query: the query itself, the decision, the servers it still waits for,
// and the result, merged again each time an answer arrives.
function gather(q: Query): string {
  const during = (from: number): string => show([[from, ends(q)]], LOOP);
  const order = arrivals(q);
  const decision = q.names
    ? `hash(${q.names.id}) mod ${SHARDS} = ${q.names.hash % SHARDS}: ask ${home(q.names).name}`
    : 'no player_id: ask every server';
  const waiting = order.map((s, k) => {
    const from = k === 0 ? sent(q) : answered(q, order[k - 1]!);
    const left = SERVERS.filter((t) => order.slice(k).includes(t));
    return `  ${text('fill-ink-muted font-sans text-offset', ROUTER.left + 16, ROUTER.top + 92, `waiting for ${nameList(left)}`, tags('waiting', q), show([[from, answered(q, s)]], LOOP))}`;
  });
  const results = order.flatMap((s, k) => {
    const shown: Interval = [answered(q, s), order[k + 1] ? answered(q, order[k + 1]!) : ends(q)];
    return merged(q, k + 1).map(([from, p], rank) => {
      const top = RESULT_ROWS_TOP + rank * CELL.pitch;
      return [
        `  <g${tags('result-row', q, from)} data-player="${p.id}">`,
        `    ${show([shown], LOOP)}`,
        ...indent(cells(RESULT.left + 16, top, p, 'la-cell'), 4),
        `    ${text('fill-ink-muted font-sans text-offset', RESULT.left + 16 + ROW_WIDTH + 12, top + 14, `from ${from.name}`)}`,
        '  </g>',
      ].join('\n');
    });
  });
  // Until the last answer is in, the result is only the best so far.
  const first = answered(q, order[0]!);
  const partial =
    first < done(q)
      ? [
          `  ${text('fill-ink-muted font-sans text-offset anchor-end', right(RESULT) - 16, RESULT.top + 24, 'so far', tags('partial', q), show([[first, done(q)]], LOOP))}`,
        ]
      : [];
  return [
    `  <g${tags('query', q)}>`,
    `    ${during(q.starts)}`,
    `    ${text('la-label font-semibold', QUERY_BOX.left + 16, QUERY_BOX.top + 56, q.label)}`,
    ...q.sql.map(
      (line, i) =>
        `    ${text('fill-ink font-mono text-offset', QUERY_BOX.left + 16, QUERY_BOX.top + 86 + i * 20, line)}`,
    ),
    '  </g>',
    `  ${text('la-label', ROUTER.left + 16, ROUTER.top + 62, decision, tags('lookup', q), during(decided(q)))}`,
    ...waiting,
    ...results,
    ...partial,
    `  ${text('fill-emerald font-sans text-offset font-semibold anchor-end', right(RESULT) - 16, RESULT.top + 24, 'done', tags('done', q), during(done(q)))}`,
  ].join('\n');
}

// Waypoints through the points at the given moments, holding still before and after.
function timed(points: readonly Point[], times: readonly number[]): Waypoint[] {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return [
    [0, ...first],
    ...points.map((point, i): Waypoint => [times[i]!, ...point]),
    [LOOP, ...last],
  ];
}

// A request runs from the router to a server, and an answer chip comes back the same way.
function messages(q: Query): string {
  return targets(q)
    .flatMap((s) => {
      const x = centreOf(s);
      const out: Point[] = [
        [ROUTER_X, ROUTER_BOTTOM],
        [ROUTER_X, FORK_Y],
        [x, FORK_Y],
        [x, PANEL.top - 8],
      ];
      const back: Point[] = [
        [x, PANEL.top - 14],
        [x, FORK_Y],
        [ROUTER_X, FORK_Y],
        [ROUTER_X, ROUTER_BOTTOM + 12],
      ];
      const [leaves, returns] = [replies(q, s), answered(q, s)];
      const count = q.rows(s).length;
      return [
        `  <circle${tags('request', q, s)} class="la-flow-dot" r="5">`,
        `    ${show([[sent(q), lands(q)]], LOOP)}`,
        `    ${move(timed(out, [sent(q), sent(q) + STUB, lands(q) - DROP, lands(q)]), LOOP)}`,
        '  </circle>',
        `  <g${tags('answer', q, s)}>`,
        `    ${show([[leaves, returns]], LOOP)}`,
        `    ${move(timed(back, [leaves, leaves + DROP, returns - STUB, returns]), LOOP)}`,
        '    <rect class="fill-surface stroke-emerald stroke-1.5" x="-28" y="-9" width="56" height="18" rx="9"/>',
        `    ${text('fill-emerald font-sans text-offset font-semibold anchor-middle', 0, 4, `${count} ${count === 1 ? 'row' : 'rows'}`)}`,
        '  </g>',
      ];
    })
    .join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  ${text('la-label', 32, CAPTION_Y, words, ' data-role="caption"', show([[at, next]], LOOP))}`;
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
    '  <defs>',
    '    <marker id="head" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">',
    '      <path class="fill-flow" d="M 0 0 L 9 4.5 L 0 9 Z"/>',
    '    </marker>',
    '  </defs>',
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  ${text('la-title', 32, 44, TITLE)}`,
    `  ${text('la-note', 32, 68, NOTE)}`,
    wiring(),
    frames(),
    ...SERVERS.map(server),
    shardKey(),
    ...QUERIES.map(work),
    ...QUERIES.map(gather),
    ...QUERIES.map(messages),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
