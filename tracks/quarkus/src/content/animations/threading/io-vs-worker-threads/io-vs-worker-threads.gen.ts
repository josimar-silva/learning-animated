// Writes io-vs-worker-threads.svg: just gen <path to this file>
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { END, START } from '@learning-animated/design/style-block';
import { embedBlock } from '@learning-animated/design/sync';
import {
  complement,
  escapeXml,
  type Interval,
  keyTimes,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

// Seconds in one story. Every timed element shares it, so they stay in step.
const LOOP = 13.5;
const W = 1100;
const H = 970;

const TITLE = 'Quarkus: I/O threads vs worker threads';
const DESC =
  'Two requests wait on the same database for the same time. Request A calls an endpoint that returns Uni, so it runs on the event-loop thread, and that thread stays free while the database works. Request B calls an endpoint that returns a plain object, so the event loop hands it to a worker thread, which stays parked for its whole JDBC call. A timeline shows what each thread does, including what happens when the same JDBC call blocks the event loop, and a table compares the two kinds of thread.';

type Color =
  | 'stage'
  | 'surface'
  | 'ink'
  | 'ink-muted'
  | 'slate'
  | 'grid'
  | 'cell'
  | 'violet-deep'
  | 'sky'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'red';
type Request = 'A' | 'B' | 'C' | 'D' | 'E';

// ---------- story (seconds within one loop) ----------

// Lane heights: request A, requests C to E, request B.
const LA = 210;
const LC = 285;
const LB = 360;
// Packet stops: client, I/O thread, worker slot, database.
const XC = 206;
const XIO = 372;
const XW = 762;
const XDB = 850;

const IO_BUSY: ReadonlyArray<
  readonly [start: number, end: number, request: Request, label: string]
> = [
  [1.1, 1.7, 'A', 'running availableSeats() for A'],
  [2.0, 2.4, 'B', 'handing B to a worker'],
  [4.6, 5.0, 'C', 'serving C'],
  [5.9, 6.3, 'D', 'serving D'],
  [7.0, 7.5, 'A', 'A: continuation + write'],
  [8.2, 8.6, 'E', 'serving E'],
  [9.1, 9.5, 'B', "writing B's response"],
];
const W_BUSY: readonly Interval[] = [
  [3.0, 3.4],
  [8.1, 8.5],
];
const W_BLOCKED: readonly Interval[] = [[3.4, 8.1]];
const DB_REACTIVE: Interval = [2.6, 6.1];
const DB_JDBC: Interval = [4.0, 7.5];

type Packet = {
  readonly request: Request;
  readonly lane: number;
  readonly stops: ReadonlyArray<readonly [t: number, x: number]>;
  readonly visible: readonly Interval[];
};
const PACKETS: readonly Packet[] = [
  {
    request: 'A',
    lane: LA,
    stops: [
      [0.4, XC],
      [1.1, XIO],
      [1.7, XIO],
      [2.6, XDB],
      [6.1, XDB],
      [7.0, XIO],
      [7.5, XIO],
      [8.2, XC],
    ],
    visible: [
      [0.4, 2.6],
      [6.1, 8.2],
    ],
  },
  {
    request: 'B',
    lane: LB,
    stops: [
      [1.3, XC],
      [2.0, XIO],
      [2.4, XIO],
      [3.0, XW],
      [3.4, XW],
      [4.0, XDB],
      [7.5, XDB],
      [8.1, XW],
      [8.5, XW],
      [9.1, XIO],
      [9.5, XIO],
      [10.2, XC],
    ],
    visible: [
      [1.3, 4.0],
      [7.5, 10.2],
    ],
  },
  {
    request: 'C',
    lane: LC,
    stops: [
      [4.0, XC],
      [4.6, XIO],
      [5.0, XIO],
      [5.6, XC],
    ],
    visible: [[4.0, 5.6]],
  },
  {
    request: 'D',
    lane: LC,
    stops: [
      [5.3, XC],
      [5.9, XIO],
      [6.3, XIO],
      [6.9, XC],
    ],
    visible: [[5.3, 6.9]],
  },
  {
    request: 'E',
    lane: LC,
    stops: [
      [7.6, XC],
      [8.2, XIO],
      [8.6, XIO],
      [9.2, XC],
    ],
    visible: [[7.6, 9.2]],
  },
];

const CAPTIONS: ReadonlyArray<readonly [start: number, end: number, text: string]> = [
  [
    0.0,
    1.9,
    'A calls availableSeats(), which returns Uni<…>, so Quarkus runs it on the I/O thread.',
  ],
  [
    1.9,
    3.4,
    'B calls salesReport(), which returns a plain object, so the I/O thread hands it to a worker.',
  ],
  [
    3.4,
    4.5,
    "Both now wait on PostgreSQL. A's query holds no thread; B's JDBC call parks executor-thread-1.",
  ],
  [4.5, 6.9, 'While both wait, the I/O thread is free and keeps serving other requests.'],
  [
    6.9,
    8.1,
    "A's rows arrive. Its continuation runs on the same event loop, which writes the response.",
  ],
  [
    8.1,
    10.3,
    "B's JDBC call returns. The worker finishes salesReport(); the I/O thread writes the bytes.",
  ],
  [
    10.3,
    LOOP,
    "Same database latency for A and B. A's wait held no thread; B's wait held a worker the whole time.",
  ],
];

// The anti-pattern row: the same requests if B's JDBC call ran on the event loop.
const STALL: Interval = [2.4, 7.1];
const STALLED_WORK: ReadonlyArray<readonly [start: number, end: number, request: Request]> = [
  [1.1, 1.7, 'A'],
  [2.0, 2.4, 'B'],
  [7.1, 7.6, 'B'],
  [7.6, 8.0, 'C'],
  [8.0, 8.4, 'D'],
  [8.4, 8.9, 'A'],
  [8.9, 9.3, 'E'],
];
// quarkus.vertx.warning-exception-time: Vert.x warns once an event loop is blocked this long.
const WARN_AFTER = 2;

// ---------- helpers ----------

const num = (value: number): string => String(Math.round(value * 100) / 100);

// B is the blocking request; the others return Uni.
const colorOf = (request: Request): Color => (request === 'B' ? 'amber' : 'emerald');

const packetOf = (request: Request): Packet => PACKETS.find((p) => p.request === request)!;

const doneAt = (request: Request): number => packetOf(request).stops.at(-1)![0];

const HATCH = 'url(#hatch)';

const SIZE_UTILITY: Readonly<Record<number, string>> = {
  20: 'text-title',
  13: 'text-label',
  12: 'text-offset',
};

type TextStyle = {
  readonly size?: number;
  readonly fill?: Color;
  readonly weight?: 600 | 700;
  readonly anchor?: 'middle' | 'end';
  readonly mono?: boolean;
  readonly halo?: boolean;
};

function text(
  x: number,
  y: number,
  content: string,
  { size = 13, fill = 'ink', weight, anchor, mono = false, halo = false }: TextStyle = {},
): string {
  const sizeUtility = SIZE_UTILITY[size];
  const classes = [
    mono ? 'font-mono' : 'font-sans',
    sizeUtility,
    weight === 600 ? 'font-semibold' : weight === 700 ? 'font-bold' : undefined,
    `fill-${fill}`,
    anchor ? `anchor-${anchor}` : undefined,
    halo ? 'halo' : undefined,
  ].filter((c) => c !== undefined);
  const fontSize = sizeUtility ? '' : ` font-size="${size}"`;
  return `<text x="${num(x)}" y="${num(y)}"${fontSize} class="${classes.join(' ')}">${escapeXml(content)}</text>`;
}

type ShapeStyle = {
  readonly rx?: number;
  readonly strokeWidth?: number;
  readonly dash?: string;
  readonly paint?: string;
};

const shapeAttributes = ({ rx, strokeWidth, dash, paint }: ShapeStyle): string =>
  (rx ? ` rx="${rx}"` : '') +
  (paint ? ` fill="${paint}"` : '') +
  (strokeWidth ? ` stroke-width="${strokeWidth}"` : '') +
  (dash ? ` stroke-dasharray="${dash}"` : '');

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  classes: string,
  style: ShapeStyle = {},
): string {
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"${shapeAttributes(style)} class="${classes}"/>`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  classes: string,
  style: ShapeStyle = {},
): string {
  return `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}"${shapeAttributes(style)} class="${classes}"/>`;
}

type Hooks = { readonly role?: string; readonly request?: Request };

// Shows the inner markup during the intervals only. The hooks name it for the lesson test.
function during(
  inner: string,
  intervals: readonly Interval[],
  { role, request }: Hooks = {},
): string {
  const hooks =
    (role ? ` data-role="${role}"` : '') + (request ? ` data-request="${request}"` : '');
  return `<g${hooks} opacity="0">${inner}${show(intervals, LOOP)}</g>`;
}

function moving(inner: string, points: readonly Waypoint[]): string {
  const [, x, y] = points[0]!;
  return `<g transform="translate(${num(x)},${num(y)})">${inner}${move(points, LOOP)}</g>`;
}

function growing(
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
  window: Interval,
): string {
  const [start, end] = window;
  const grow = `<animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes([0, start, end, LOOP], LOOP)}" values="0;0;${w};${w}"/>`;
  return `<rect x="${num(x)}" y="${num(y)}" width="0" height="${num(h)}" rx="2.5" class="fill-${color}">${grow}</rect>`;
}

// ---------- document ----------

// The timeline's left edge and width, which the reveal clip shares.
const X0 = 300;
const SPAN = 776;

function defs(): string {
  const reveal = `<rect x="${X0}" y="505" width="0" height="160"><animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes([0, LOOP], LOOP)}" values="0;${SPAN}"/></rect>`;
  return [
    '<defs>',
    '<pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">',
    '<rect width="7" height="7" class="fill-surface"/>',
    '<line x1="0" y1="0" x2="0" y2="7" class="stroke-red stroke-2.5"/>',
    '</pattern>',
    `<clipPath id="reveal">${reveal}</clipPath>`,
    '</defs>',
  ].join('\n');
}

function header(): string[] {
  return [
    text(24, 42, TITLE, { size: 20, weight: 700 }),
    text(
      24,
      68,
      "Every request arrives on an I/O (event-loop) thread. The endpoint's return type decides whether your code runs there or on a worker.",
      { size: 14, fill: 'ink-muted' },
    ),
  ];
}

// ---------- flow view ----------

function lanes(): string[] {
  const lane = (x1: number, x2: number, y: number): string =>
    line(x1, y, x2, y, 'stroke-grid stroke-1.5', { dash: '5 5' });
  return [
    // Two more event loops, stacked behind the one the story follows.
    rect(274, 88, 220, 320, 'la-canvas', { rx: 12 }),
    rect(268, 94, 220, 320, 'la-canvas', { rx: 12 }),
    ...[LA, LC, LB].map((y) => lane(194, 262, y)),
    lane(482, 858, LA),
    lane(482, 550, LB),
    lane(790, 858, LB),
    text(670, LA - 10, 'non-blocking call: the I/O thread moves on', {
      size: 12,
      fill: 'emerald',
      anchor: 'middle',
    }),
    text(516, LB - 10, 'hand-off', { size: 11.5, fill: 'violet', anchor: 'middle' }),
    text(824, LB - 10, 'JDBC', { size: 11.5, fill: 'amber', anchor: 'middle' }),
  ];
}

const CLIENTS: ReadonlyArray<readonly [lane: number, name: string, call: string]> = [
  [LA, 'Client A', 'GET /seats'],
  [LC, 'Clients C, D, E', 'GET /status'],
  [LB, 'Client B', 'GET /sales'],
];

function clients(): string[] {
  const ok = { size: 11.5, fill: 'emerald', weight: 700, anchor: 'end' } as const;
  return [
    ...CLIENTS.flatMap(([lane, name, call]) => [
      rect(24, lane - 28, 170, 56, 'la-canvas', { rx: 10 }),
      text(36, lane - 5, name, { size: 14, weight: 600 }),
      text(36, lane + 14, call, { size: 11.5, fill: 'ink-muted', mono: true }),
    ]),
    during(text(184, LA + 14, '200 OK', ok), [[doneAt('A'), LOOP]]),
    during(text(184, LB + 14, '200 OK', ok), [[doneAt('B'), LOOP]]),
    during(text(184, LC + 14, 'C ✓', ok), [[doneAt('C'), doneAt('D')]]),
    during(text(184, LC + 14, 'C D ✓', ok), [[doneAt('D'), doneAt('E')]]),
    during(text(184, LC + 14, 'C D E ✓', ok), [[doneAt('E'), LOOP]]),
  ];
}

function ioThread(): string[] {
  const busy = IO_BUSY.map(([start, end]): Interval => [start, end]);
  return [
    rect(262, 100, 220, 320, 'fill-surface stroke-sky stroke-1.5', { rx: 12 }),
    during(rect(262, 100, 220, 320, 'fill-none stroke-sky', { rx: 12, strokeWidth: 3.5 }), busy),
    ...[LA, LC, LB].flatMap((y) => [
      line(262, y, y === LC ? XIO : 482, y, 'stroke-grid stroke-1.5', { dash: '2 6' }),
      `<circle cx="${XIO}" cy="${y}" r="15" stroke-dasharray="3 4" class="fill-none stroke-grid stroke-1.5"/>`,
    ]),
    text(372, 126, 'I/O thread (event loop)', {
      size: 15,
      fill: 'sky',
      weight: 700,
      anchor: 'middle',
    }),
    text(372, 145, 'vert.x-eventloop-thread-0', {
      size: 12,
      fill: 'ink-muted',
      anchor: 'middle',
      mono: true,
    }),
    rect(274, 156, 196, 24, 'la-canvas', { rx: 12 }),
    during(
      text(372, 172, 'free', { size: 12, fill: 'ink-muted', anchor: 'middle' }),
      complement(busy, LOOP),
    ),
    ...IO_BUSY.map(([start, end, request, label]) =>
      during(
        text(372, 172, label, { size: 12, fill: 'sky', weight: 600, anchor: 'middle' }),
        [[start, end]],
        { role: 'io-busy', request },
      ),
    ),
    text(372, 408, '1 of N event loops (N = CPU cores)', {
      size: 11.5,
      fill: 'slate',
      anchor: 'middle',
    }),
  ];
}

function workerPool(): string[] {
  const pulse =
    '<animate attributeName="r" values="3;10" dur="1s" repeatCount="indefinite"/>' +
    '<animate attributeName="opacity" values="1;0" dur="1s" repeatCount="indefinite"/>';
  return [
    rect(550, 282, 240, 138, 'fill-surface stroke-violet stroke-1.5', { rx: 12 }),
    text(670, 306, 'Worker pool', { size: 15, fill: 'violet', weight: 700, anchor: 'middle' }),
    text(670, 324, 'up to max(200, 8 × cores) threads', {
      size: 12,
      fill: 'ink-muted',
      anchor: 'middle',
    }),
    rect(560, 346, 220, 28, 'fill-cell stroke-grid', { rx: 6 }),
    during(rect(560, 346, 220, 28, 'fill-violet-deep stroke-violet', { rx: 6 }), W_BUSY),
    during(rect(560, 346, 220, 28, 'stroke-red stroke-1.5', { rx: 6, paint: HATCH }), W_BLOCKED, {
      role: 'worker-blocked',
    }),
    text(570, 364.5, 'executor-thread-1', { size: 11.5, mono: true, halo: true }),
    during(
      text(698, 364.5, 'idle', { size: 12, fill: 'ink-muted' }),
      complement([...W_BUSY, ...W_BLOCKED], LOOP),
    ),
    during(text(698, 364.5, 'busy', { size: 12, fill: 'violet', weight: 700 }), W_BUSY),
    during(
      text(698, 364.5, 'blocked', { size: 12, fill: 'red', weight: 700, halo: true }),
      W_BLOCKED,
    ),
    during(
      `<circle cx="${XW}" cy="${LB}" r="6" stroke-width="2" class="fill-none stroke-red">${pulse}</circle>`,
      W_BLOCKED,
    ),
    rect(560, 380, 220, 28, 'fill-cell stroke-grid', { rx: 6 }),
    text(570, 398.5, 'executor-thread-2', { size: 11.5, fill: 'ink-muted', mono: true }),
    text(698, 398.5, 'idle', { size: 12, fill: 'ink-muted' }),
  ];
}

function database(lane: number, kind: string, request: Request, window: Interval): string[] {
  const y = lane - 32;
  const color = colorOf(request);
  return [
    rect(858, y, 218, 64, `fill-surface stroke-${color}`, { rx: 10 }),
    text(870, y + 23, 'PostgreSQL', { size: 14, weight: 600 }),
    text(870, y + 41, kind, { size: 12, fill: 'ink-muted' }),
    rect(870, y + 50, 194, 5, 'fill-cell', { rx: 2.5 }),
    during(
      growing(870, y + 50, 194, 5, color, window) +
        text(1064, y + 23, 'query running', { size: 11, fill: color, anchor: 'end' }),
      [window],
      { role: 'db-wait', request },
    ),
  ];
}

function packets(): string[] {
  return PACKETS.map(({ request, lane, stops, visible }) => {
    const points: Waypoint[] = [
      [0, stops[0]![1], lane],
      ...stops.map(([t, x]): Waypoint => [t, x, lane]),
      [LOOP, stops.at(-1)![1], lane],
    ];
    const dot =
      `<circle r="11" stroke-width="2" class="fill-${colorOf(request)} stroke-stage"/>` +
      text(0, 4, request, { size: 11, fill: 'surface', weight: 700, anchor: 'middle' });
    return during(moving(dot, points), visible, { role: 'packet', request });
  });
}

function captions(): string[] {
  return [
    rect(24, 436, 1052, 36, 'la-canvas', { rx: 8 }),
    ...CAPTIONS.map(([start, end, caption]) =>
      during(text(550, 459, caption, { size: 14.5, anchor: 'middle' }), [[start, end]], {
        role: 'caption',
      }),
    ),
  ];
}

// ---------- timeline ----------

const X = (t: number): number => X0 + (SPAN * t) / LOOP;
// Rows: the event loop, the worker, and the event loop when B's JDBC call runs on it.
const R1 = 512;
const R2 = 548;
const R3 = 608;

function timeline(): string[] {
  const clipped: string[] = [];
  const work = (start: number, end: number, row: number, request: Request): void => {
    clipped.push(
      rect(X(start), row + 3, X(end) - X(start), 22, `fill-${colorOf(request)}`, { rx: 3 }),
      text((X(start) + X(end)) / 2, row + 18, request, {
        size: 11,
        fill: 'surface',
        weight: 700,
        anchor: 'middle',
      }),
    );
  };
  const blocked = ([start, end]: Interval, row: number, label: string): void => {
    clipped.push(
      rect(X(start), row + 3, X(end) - X(start), 22, 'stroke-red', { rx: 3, paint: HATCH }),
      text((X(start) + X(end)) / 2, row + 18.5, label, {
        size: 11.5,
        fill: 'red',
        weight: 700,
        anchor: 'middle',
        halo: true,
      }),
    );
  };
  const note = (t: number, row: number, label: string): void => {
    clipped.push(text(X(t), row + 18.5, label, { size: 11, fill: 'slate', anchor: 'middle' }));
  };

  for (const [start, end, request] of IO_BUSY) work(start, end, R1, request);
  note(3.5, R1, 'free');
  note(11.5, R1, 'free');
  for (const [start, end] of W_BUSY) work(start, end, R2, 'B');
  for (const window of W_BLOCKED) blocked(window, R2, 'parked, waiting on JDBC');
  note(1.5, R2, 'idle');
  note(11.0, R2, 'idle');
  for (const [start, end, request] of STALLED_WORK) work(start, end, R3, request);
  blocked(STALL, R3, "B's JDBC call blocks the whole loop");

  const caughtUp = STALLED_WORK.at(-1)![1];
  const warnAt = STALL[0] + WARN_AFTER;
  const warnX = X(warnAt);
  return [
    text(24, 500, 'What each thread is doing', { size: 15, weight: 700 }),
    text(246, 500, '(time slowed down)', { size: 12, fill: 'slate' }),
    rect(600, 490, 12, 12, 'fill-emerald', { rx: 2 }),
    text(618, 500, 'Uni request', { size: 12, fill: 'ink-muted' }),
    rect(710, 490, 12, 12, 'fill-amber', { rx: 2 }),
    text(728, 500, 'blocking request', { size: 12, fill: 'ink-muted' }),
    rect(852, 490, 12, 12, 'stroke-red', { rx: 2, paint: HATCH }),
    text(870, 500, 'thread blocked (parked)', { size: 12, fill: 'ink-muted' }),
    text(288, R1 + 19, 'vert.x-eventloop-thread-0', {
      size: 12,
      fill: 'sky',
      anchor: 'end',
      mono: true,
    }),
    text(288, R2 + 19, 'executor-thread-1', {
      size: 12,
      fill: 'violet',
      anchor: 'end',
      mono: true,
    }),
    text(
      24,
      598,
      'Anti-pattern: the same JDBC call made on the I/O thread (for example, blocking code inside a method that returns Uni)',
      { size: 12, fill: 'red' },
    ),
    text(288, R3 + 19, 'vert.x-eventloop-thread-0', {
      size: 12,
      fill: 'red',
      anchor: 'end',
      mono: true,
    }),
    ...[R1, R2, R3].map((row) => rect(X0, row, SPAN, 28, 'la-canvas', { rx: 4 })),
    `<g clip-path="url(#reveal)">${clipped.join('')}</g>`,
    during(
      text(X(caughtUp) + 8, R3 + 18.5, 'C, D, E, A delayed up to 3 s', {
        size: 11.5,
        fill: 'red',
      }),
      [[caughtUp, LOOP]],
    ),
    during(
      `<polygon points="${num(warnX)},${R3 + 30} ${num(warnX - 6)},${R3 + 41} ${num(warnX + 6)},${R3 + 41}" class="fill-red"/>` +
        text(warnX + 12, R3 + 42, `Vert.x logs a blocked-thread warning after ${WARN_AFTER} s`, {
          size: 12,
          fill: 'red',
        }),
      [[warnAt, LOOP]],
    ),
    ...ticks(),
    playhead(),
  ];
}

function ticks(): string[] {
  const marks = Array.from({ length: 14 }, (_, second) => [
    line(X(second), 662, X(second), second % 2 ? 667 : 670, 'stroke-slate'),
    ...(second % 2
      ? []
      : [text(X(second), 683, `${second} s`, { size: 11, fill: 'slate', anchor: 'middle' })]),
  ]);
  return [...marks.flat(), line(X0, 662, X0 + SPAN, 662, 'stroke-grid')];
}

function playhead(): string {
  const head =
    `<path d="M${X0},506 V584 M${X0},604 V640" class="fill-none stroke-ink stroke-1.5"/>` +
    `<polygon points="${X0 - 5},504 ${X0 + 5},504 ${X0},511" class="fill-ink"/>`;
  return moving(head, [
    [0, 0, 0],
    [LOOP, SPAN, 0],
  ]);
}

// ---------- comparison table ----------

const TABLE_TOP = 700;
const ROW_H = 29.5;
type Cell = readonly [content: string, mono: boolean];
const ROWS: ReadonlyArray<readonly [label: string, io: Cell, worker: Cell]> = [
  ['Thread name', ['vert.x-eventloop-thread-N', true], ['executor-thread-N', true]],
  ['Default pool size', ['1 per CPU core, min 2', false], ['up to max(200, 8 × CPU cores)', false]],
  [
    'Your code runs here when',
    ['it returns Uni / Multi / CompletionStage, or @NonBlocking', false],
    ['it returns a plain type (String, List, …), or @Blocking', false],
  ],
  [
    'During a DB or HTTP call',
    ['released; the continuation resumes on the same loop', false],
    ['parked until the call returns', false],
  ],
  [
    'If your code blocks',
    [`every request on that loop stalls; warning after ${WARN_AFTER} s`, false],
    ['expected; Vert.x warns only after 60 s', false],
  ],
  [
    'Config property',
    ['quarkus.vertx.event-loops-pool-size', true],
    ['quarkus.thread-pool.max-threads', true],
  ],
];

function comparison(): string[] {
  const bottom = TABLE_TOP + 32 + ROW_H * ROWS.length;
  const cell = (x: number, y: number, [content, mono]: Cell): string =>
    text(x, y, content, { size: 12.5, mono });
  return [
    rect(24, TABLE_TOP, 1052, bottom - TABLE_TOP, 'la-canvas', { rx: 10 }),
    line(250, TABLE_TOP, 250, bottom, 'stroke-grid'),
    line(658, TABLE_TOP, 658, bottom, 'stroke-grid'),
    text(40, TABLE_TOP + 21, 'At a glance', { fill: 'ink-muted', weight: 600 }),
    text(266, TABLE_TOP + 21, 'I/O thread (event loop)', { size: 14, fill: 'sky', weight: 700 }),
    text(674, TABLE_TOP + 21, 'Worker thread', { size: 14, fill: 'violet', weight: 700 }),
    ...ROWS.flatMap(([label, io, worker], i) => {
      const y = TABLE_TOP + 32 + i * ROW_H;
      return [
        line(24, y, 1076, y, 'stroke-grid'),
        text(40, y + 19.5, label, { fill: 'ink-muted' }),
        cell(266, y + 19.5, io),
        cell(674, y + 19.5, worker),
      ];
    }),
  ];
}

function footer(): string[] {
  return [
    text(
      24,
      936,
      'Java 21+: @RunOnVirtualThread runs blocking-style code on a virtual thread instead of a worker.',
      { size: 12, fill: 'ink-muted' },
    ),
    text(
      24,
      955,
      'Sources: quarkus.io/guides/rest (execution model), quarkus.io/guides/vertx-reference, quarkus.io/guides/duplicated-context.',
      { size: 11.5, fill: 'slate' },
    ),
  ];
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" data-loop="${LOOP}s">`,
    `<title>${escapeXml(TITLE)}</title>`,
    `<desc>${escapeXml(DESC)}</desc>`,
    `<style>\n${START}\n${END}\n</style>`,
    defs(),
    rect(0, 0, W, H, 'fill-stage'),
    ...header(),
    ...lanes(),
    ...clients(),
    ...ioThread(),
    ...workerPool(),
    ...database(LA, 'reactive client, non-blocking', 'A', DB_REACTIVE),
    ...database(LB, 'JDBC driver, blocking', 'B', DB_JDBC),
    ...packets(),
    ...captions(),
    ...timeline(),
    ...comparison(),
    ...footer(),
    '</svg>',
  ];
  return `${embedBlock(svg.join('\n'), canonicalStyleBlock())}\n`;
}
