import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  escapeXml,
  type Interval,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 25;
const WIDTH = 1000;
const HEIGHT = 568;

const CHANNEL = 'ticket-orders';
const DLQ_TOPIC = `${CHANNEL}-dlq`;

const CELL_W = 34;
const CELL_H = 30;

const STRIP_LEFT = 232;
const STRIP_TOP = 88;
const PITCH = 40;
const OFFSETS = [41, 42, 43, 44, 45, 46, 47] as const;
const STATUS_Y = 136;
const cellLeft = (offset: number): number => STRIP_LEFT + (offset - OFFSETS[0]) * PITCH;

const LANE_LEFT = 32;
const LANE_WIDTH = 568;
const LANE_HEIGHT = 114;
const RECORD_X = 65;
const CHARGE_LEFT = 108;
const CHARGE_WIDTH = 120;
const CHARGE_RIGHT = CHARGE_LEFT + CHARGE_WIDTH;
const CHARGE_X = CHARGE_LEFT + CHARGE_WIDTH / 2;
// A record waits at the left edge of charge() while the method handles it.
const AT_CHARGE = 122;
const RETRY_WIDTH = 84;

const DLQ_LEFT = 612;
const DLQ_TOP = 150;
const DLQ_WIDTH = 356;
const DLQ_HEIGHT = 366;
const DEAD_X = 645;
const KEY_X = 676;
const VALUE_X = 832;
const CAPTION_Y = 548;

type Path = 'declined' | 'unreadable' | 'unavailable';

type Retry = {
  readonly delay: number;
  readonly left: number;
  readonly arrives: number;
  readonly fails: number;
};

const RETRIES: readonly Retry[] = [
  { delay: 10000, left: 254, arrives: 14.5, fails: 16 },
  { delay: 20000, left: 362, arrives: 16.5, fails: 18.5 },
  { delay: 50000, left: 470, arrives: 19, fails: 21.5 },
];
const topicOf = (retry: Retry): string => `${CHANNEL}_retry_${retry.delay}`;
const retryX = (retry: Retry): number => retry.left + RETRY_WIDTH / 2;

type Lane = {
  readonly path: Path;
  readonly top: number;
  readonly offset: number;
  readonly title: string;
  readonly note?: string;
  readonly verdict: string;
  readonly reads: number;
  readonly answered: number;
  readonly nacked: number;
  readonly retries: readonly Retry[];
  readonly landed: number;
  readonly count: string;
  readonly reason: string;
  readonly payload?: string;
};

const LANES: readonly Lane[] = [
  {
    path: 'declined',
    top: 150,
    offset: 41,
    title: 'Fails for good',
    verdict: '400 Bad Request',
    reads: 0.5,
    answered: 1.5,
    nacked: 3,
    retries: [],
    landed: 4.5,
    count: '0',
    reason: 'CardGateway 400',
  },
  {
    path: 'unreadable',
    top: 276,
    offset: 42,
    title: 'Cannot be read',
    note: 'fail-on-deserialization-failure=false',
    verdict: 'receives null',
    reads: 6.5,
    answered: 7.5,
    nacked: 9,
    retries: [],
    landed: 10.5,
    count: '0',
    reason: 'not valid JSON',
    payload: 'value: the original bytes',
  },
  {
    path: 'unavailable',
    top: 402,
    offset: 43,
    title: 'Might pass later',
    verdict: '503 Service Unavailable',
    reads: 12.5,
    answered: 13.5,
    nacked: 14,
    retries: RETRIES,
    landed: 22.5,
    count: String(RETRIES.length),
    reason: 'CardGateway 503',
  },
];
const centreOf = (lane: Lane): number => lane.top + 62;

// While the failed record waits in the retry topics, the consumer pays the next orders.
const PAID: ReadonlyArray<readonly [offset: number, at: number]> = [
  [44, 15.5],
  [45, 16.5],
];

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'charge() reads offset 41, and CardGateway answers 400 Bad Request. Retrying that charge would get the same answer.',
  ],
  [
    3,
    'So charge() nacks 41 with ticket-orders-dlq as the topic. It skips the retry topics, and the consumer moves on to 42.',
  ],
  [
    6,
    'Offset 42 is not valid JSON. The deserializer fails, so charge() receives a null payload instead of an order.',
  ],
  [
    9,
    'charge() nacks it to ticket-orders-dlq the same way. The dead letter keeps the original bytes.',
  ],
  [
    12,
    'CardGateway answers 503 for offset 43. That may not last, so charge() nacks it plainly, and it goes to the first retry topic.',
  ],
  [
    15,
    'Meanwhile the consumer charges 44 and 45. After each delay, charge() reads 43 again, gets another 503, and nacks it again.',
  ],
  [
    21.5,
    'After the third retry fails, 43 lands on ticket-orders-dlq too, with delayed-retry-count 3 and the 503 as its reason.',
  ],
];

const TITLE = 'Three ways into the dead-letter topic';
const DESC =
  'Offsets 41 to 47 of the ticket-orders partition feed charge(), and three of them fail in different ways. ' +
  'CardGateway answers 400 for offset 41, so charge() nacks it with ticket-orders-dlq as the topic, and it skips the retry topics. ' +
  'Offset 42 is not valid JSON, so charge() receives a null payload and nacks it to the dead-letter topic the same way, original bytes and all. ' +
  'CardGateway answers 503 for offset 43, so it goes through three retry topics, fails again after each delay, and lands on ticket-orders-dlq with delayed-retry-count 3. ' +
  'Each dead letter carries delayed-retry-count and delayed-retry-reason headers. ' +
  "The consumer's position moves past every failed offset, and it charges 44 and 45 while 43 waits.";

const text = (classes: string, x: number, y: number, words: string, extra = ''): string =>
  `<text class="${classes}" x="${x}" y="${y}"${extra}>${escapeXml(words)}</text>`;
const centred = (classes: string, x: number, y: number, words: string): string =>
  text(classes, x, y, words, ' text-anchor="middle"');
const arrow = (from: number, to: number, y: number): string =>
  `<path class="la-arrow" d="M ${from} ${y} H ${to}" marker-end="url(#head)"/>`;
const cell = (classes: string, left: number, top: number): string =>
  `<rect class="${classes}" x="${left}" y="${top}" width="${CELL_W}" height="${CELL_H}" rx="5"/>`;

function partition(): string {
  return [
    `  <g data-role="partition" data-topic="${CHANNEL}" data-partition="0">`,
    `    ${text('fill-ink text-offset font-mono', 32, 108, `${CHANNEL}, partition 0`)}`,
    ...OFFSETS.flatMap((offset) => [
      `    ${cell('la-cell', cellLeft(offset), STRIP_TOP)}`,
      `    ${centred('la-offset', cellLeft(offset) + CELL_W / 2, 107, String(offset))}`,
    ]),
    `    ${text('la-note', STRIP_LEFT + OFFSETS.length * PITCH + 12, 108, 'outline: the offset charge() is on')}`,
    '  </g>',
  ].join('\n');
}

function retryTopic(retry: Retry, y: number): string {
  const x = retryX(retry);
  return [
    `    <g data-role="retry-topic" data-topic="${topicOf(retry)}">`,
    `      <rect class="la-cell" x="${retry.left}" y="${y - CELL_H / 2}" width="${RETRY_WIDTH}" height="${CELL_H}" rx="5"/>`,
    `      ${centred('fill-ink-muted text-offset font-mono', x, y + 30, CHANNEL)}`,
    `      ${centred('fill-ink-muted text-offset font-mono', x, y + 44, `_retry_${retry.delay}`)}`,
    '    </g>',
  ].join('\n');
}

function exits(lane: Lane, y: number): string[] {
  const starts = [CHARGE_RIGHT, ...lane.retries.map((r) => r.left + RETRY_WIDTH)];
  const ends = [...lane.retries.map((r) => r.left), DLQ_LEFT];
  const note =
    lane.retries.length === 0
      ? [
          `    ${centred('la-note', (CHARGE_RIGHT + DLQ_LEFT) / 2, y - 16, `nack with ${DLQ_TOPIC} as the topic`)}`,
        ]
      : [];
  return [
    ...lane.retries.map((retry) => retryTopic(retry, y)),
    ...starts.map((start, i) => `    ${arrow(start + 4, (ends[i] ?? start) - 6, y)}`),
    ...note,
  ];
}

function drawLane(lane: Lane): string {
  const y = centreOf(lane);
  return [
    `  <g data-role="lane" data-path="${lane.path}">`,
    `    <rect class="la-canvas" x="${LANE_LEFT}" y="${lane.top}" width="${LANE_WIDTH}" height="${LANE_HEIGHT}" rx="12"/>`,
    `    ${text('fill-ink text-label font-sans font-semibold', 48, lane.top + 22, lane.title)}`,
    ...(lane.note
      ? [
          `    ${text('fill-ink-muted text-offset font-mono', LANE_LEFT + LANE_WIDTH - 12, lane.top + 22, lane.note, ' text-anchor="end"')}`,
        ]
      : []),
    `    ${cell('la-cell', RECORD_X - CELL_W / 2, y - CELL_H / 2)}`,
    `    ${centred('la-offset', RECORD_X, y + 4, String(lane.offset))}`,
    `    ${arrow(RECORD_X + CELL_W / 2 + 4, CHARGE_LEFT - 4, y)}`,
    `    <rect class="fill-sky stroke-sky-light stroke-1.5" x="${CHARGE_LEFT}" y="${y - 19}" width="${CHARGE_WIDTH}" height="38" rx="8"/>`,
    `    ${centred('fill-surface text-label font-mono font-semibold', CHARGE_X, y + 5, 'charge()')}`,
    ...exits(lane, y),
    '  </g>',
  ].join('\n');
}

function header(name: string, value: string, y: number): string {
  return [
    `      <g data-role="header" data-header="${name}">`,
    `        ${text('fill-ink-muted text-offset font-mono', KEY_X, y, name)}`,
    `        <text data-role="value" class="fill-ink text-offset font-mono" x="${VALUE_X}" y="${y}">${escapeXml(value)}</text>`,
    '      </g>',
  ].join('\n');
}

function deadLetter(lane: Lane, index: number): string {
  const y = centreOf(lane);
  const top = y - CELL_H / 2;
  return [
    `    <g data-role="dead-letter" data-path="${lane.path}" data-offset="${index}" data-from="${lane.offset}">`,
    `      ${show([[lane.landed, LOOP]], LOOP)}`,
    `      ${cell('la-cell', DEAD_X - CELL_W / 2, top)}`,
    `      <rect class="la-cell-new" x="${DEAD_X - CELL_W / 2}" y="${top}" width="${CELL_W}" height="${CELL_H}" rx="5">${show([[lane.landed, lane.landed + 1.5]], LOOP)}</rect>`,
    `      ${centred('la-offset', DEAD_X, y + 4, String(index))}`,
    header('delayed-retry-count', lane.count, y - 6),
    header('delayed-retry-reason', lane.reason, y + 12),
    ...(lane.payload
      ? [
          `      <text data-role="payload" class="fill-ink-muted text-offset font-sans" x="${KEY_X}" y="${y + 30}">${escapeXml(lane.payload)}</text>`,
        ]
      : []),
    '    </g>',
  ].join('\n');
}

function dlq(): string {
  return [
    `  <g data-role="dlq" data-topic="${DLQ_TOPIC}">`,
    `    <rect class="fill-violet-deep stroke-red stroke-1.5" x="${DLQ_LEFT}" y="${DLQ_TOP}" width="${DLQ_WIDTH}" height="${DLQ_HEIGHT}" rx="14"/>`,
    `    ${centred('fill-red text-label font-mono font-semibold', DLQ_LEFT + DLQ_WIDTH / 2, DLQ_TOP + 26, DLQ_TOPIC)}`,
    ...LANES.map(deadLetter),
    '  </g>',
  ].join('\n');
}

// The moment a failed record is out of the partition's way: in the dead-letter topic or the first retry topic.
const leaves = (lane: Lane): number => lane.retries[0]?.arrives ?? lane.landed;

// Where charge() is in the partition. It moves past each failed offset as soon as the record leaves.
function positions(): string[] {
  const moves: ReadonlyArray<readonly [offset: number, from: number]> = [
    [OFFSETS[0], 0],
    ...LANES.map((lane) => [lane.offset + 1, leaves(lane)] as const),
    ...PAID.map(([offset, at]) => [offset + 1, at] as const),
  ];
  return moves.map(([offset, from], i) => {
    const until = moves[i + 1]?.[1] ?? LOOP;
    return `  <rect data-role="position" data-offset="${offset}" class="la-read-marker" x="${cellLeft(offset) - 4}" y="${STRIP_TOP - 4}" width="${CELL_W + 8}" height="${CELL_H + 8}" rx="7">${show([[from, until]], LOOP)}</rect>`;
  });
}

const STATUS_COLOURS = { dlq: 'fill-red', retry: 'fill-amber', paid: 'fill-emerald' } as const;
type Status = keyof typeof STATUS_COLOURS;

function status(offset: number, word: Status, during: Interval): string {
  const label = word === 'dlq' ? 'DLQ' : word;
  return `  <text data-role="status" data-offset="${offset}" data-status="${word}" class="${STATUS_COLOURS[word]} text-offset font-sans font-semibold" x="${cellLeft(offset) + CELL_W / 2}" y="${STATUS_Y}" text-anchor="middle">${label}${show([during], LOOP)}</text>`;
}

function statuses(): string[] {
  return [
    ...LANES.flatMap((lane) => [
      ...(lane.retries.length > 0
        ? [status(lane.offset, 'retry', [leaves(lane), lane.landed])]
        : []),
      status(lane.offset, 'dlq', [lane.landed, LOOP]),
    ]),
    ...PAID.map(([offset, at]) => status(offset, 'paid', [at, LOOP])),
  ];
}

function verdict(lane: Lane): string {
  return `  <text data-role="verdict" data-path="${lane.path}" class="fill-red text-offset font-sans font-semibold" x="${CHARGE_X}" y="${centreOf(lane) + 38}" text-anchor="middle">${escapeXml(lane.verdict)}${show([[lane.answered, LOOP]], LOOP)}</text>`;
}

function retryFailed(retry: Retry, y: number): string {
  return `  <text data-role="retry-failed" data-topic="${topicOf(retry)}" class="fill-red text-offset font-sans font-semibold halo" x="${retryX(retry)}" y="${y - 24}" text-anchor="middle">503 again${show([[retry.fails, LOOP]], LOOP)}</text>`;
}

function record(lane: Lane): string {
  const y = centreOf(lane);
  const stops: ReadonlyArray<readonly [t: number, x: number]> = [
    [lane.reads, RECORD_X],
    [lane.answered, AT_CHARGE],
    [lane.nacked, AT_CHARGE],
    ...lane.retries.flatMap((retry) => [
      [retry.arrives, retryX(retry)] as const,
      [retry.fails, retryX(retry)] as const,
    ]),
    [lane.landed, DEAD_X],
  ];
  const path: Waypoint[] = [
    [0, RECORD_X, y],
    ...stops.map(([t, x]): Waypoint => [t, x, y]),
    [LOOP, DEAD_X, y],
  ];
  return [
    `  <g data-role="record" data-path="${lane.path}" data-offset="${lane.offset}">`,
    `    ${show([[lane.reads, lane.landed]], LOOP)}`,
    `    ${move(path, LOOP)}`,
    '    <rect class="la-cell-new" x="-12" y="-10" width="24" height="20" rx="4"/>',
    `    ${centred('la-offset', 0, 4, String(lane.offset))}`,
    '  </g>',
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="la-label" x="32" y="${CAPTION_Y}">${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
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
    '  </defs>',
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  <text class="la-title" x="32" y="40">${TITLE}</text>`,
    `  ${text('la-note', 32, 64, `charge() reads ${CHANNEL} with failure-strategy=delayed-retry-topic and dead-letter-queue.topic=${DLQ_TOPIC}.`)}`,
    partition(),
    ...LANES.map(drawLane),
    dlq(),
    ...positions(),
    ...statuses(),
    ...LANES.map(verdict),
    ...LANES.flatMap((lane) => lane.retries.map((retry) => retryFailed(retry, centreOf(lane)))),
    ...LANES.map(record),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
