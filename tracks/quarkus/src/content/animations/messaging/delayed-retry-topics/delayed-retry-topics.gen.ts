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

const LOOP = 25;
const WIDTH = 1000;
const HEIGHT = 516;

type Point = readonly [x: number, y: number];

const MAIN_TOPIC = 'ticket-orders';
const FIRST_RETRY = 'ticket-orders_retry_5000';
const SECOND_RETRY = 'ticket-orders_retry_30000';
const DEAD_LETTERS = 'ticket-orders-dlq';
type Retry = typeof FIRST_RETRY | typeof SECOND_RETRY;
type Target = Retry | typeof DEAD_LETTERS;
type Source = typeof MAIN_TOPIC | Retry;

// The Kafka card: the partition on top, then the topics a failed record moves through.
const CARD = { left: 32, top: 92, width: 428, height: 348 } as const;
const CARD_RIGHT = CARD.left + CARD.width;
const CELL = { width: 34, height: 30, gap: 6 } as const;
const CELL_LEFT = 56;
const MAIN_NAME_Y = 120;
const MAIN_TOP = 132;
const MAIN_Y = MAIN_TOP + CELL.height / 2;
const MARKER_Y = MAIN_TOP + CELL.height + 6;
const OFFSETS = [3, 4, 5] as const;
const TAIL_OFFSET = 6;
const cellLeft = (offset: number): number =>
  CELL_LEFT + (offset - OFFSETS[0]) * (CELL.width + CELL.gap);
const SLOT_X = CELL_LEFT + CELL.width / 2;

type Row = { readonly nameY: number; readonly ink: string; readonly wait: string | null };
const ROWS: Record<Target, Row> = {
  [FIRST_RETRY]: { nameY: 206, ink: 'fill-ink', wait: 'waits 5 s' },
  [SECOND_RETRY]: { nameY: 290, ink: 'fill-ink', wait: 'waits 30 s' },
  [DEAD_LETTERS]: { nameY: 374, ink: 'fill-red', wait: null },
};
// A write runs along a lane just under the topic name, then drops into the topic's slot.
const laneY = (topic: Target): number => ROWS[topic].nameY + 10;
const slotTop = (topic: Target): number => ROWS[topic].nameY + 22;
const slotY = (topic: Target): number => slotTop(topic) + CELL.height / 2;
const WAIT_BAR = { left: 106, width: 160, height: 8 } as const;

type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

// The application: charge() on top, the strategy's retry-topic consumer below it.
const CONSUMER: Box = { left: 520, top: 121, width: 208, height: 52 };
const RETRY_CONSUMER: Box = { left: 520, top: 262, width: 208, height: 44 };
const PROVIDER: Box = { left: 820, top: 121, width: 148, height: 52 };
const CONFIG: Box = { left: 520, top: 328, width: 448, height: 112 };
const APP_X = CONSUMER.left + CONSUMER.width / 2;
const PROVIDER_X = PROVIDER.left + PROVIDER.width / 2;
const REQUEST_Y = 138;
const RESPONSE_Y = 156;
// Where a delivered record sits while charge() calls the payment provider.
const MAIN_DOCK: Point = [CONSUMER.left - 16, MAIN_Y];
const RETRY_DOCK: Point = [APP_X, CONSUMER.top + CONSUMER.height + 13];
const WRITE_EXIT: Point = [CONSUMER.left, 164];
const WRITE_X = CARD_RIGHT - 12;
const READ_X = CARD_RIGHT + 24;
const READ_IN: Record<Retry, number> = { [FIRST_RETRY]: 276, [SECOND_RETRY]: 292 };
const VERDICT: Point = [CONSUMER.left + CONSUMER.width - 12, 196];
const CAPTION_Y = 498;
const LEGEND_Y = 466;

// A delivery takes 1 s to reach charge(), the call and its answer 0.5 s each, and a write 1 s.
const TRIP = 1;
const CALL = 0.5;
const WRITE = 1;

type Delivery = {
  readonly record: number;
  readonly attempt: number;
  readonly from: Source;
  readonly departs: number;
  readonly status: 200 | 503;
  // A failed delivery's record is written to this topic, starting at `at`.
  readonly parksIn?: { readonly topic: Target; readonly at: number };
};

const DELIVERIES: readonly Delivery[] = [
  {
    record: 3,
    attempt: 1,
    from: MAIN_TOPIC,
    departs: 0.5,
    status: 503,
    parksIn: { topic: FIRST_RETRY, at: 3 },
  },
  { record: 4, attempt: 1, from: MAIN_TOPIC, departs: 6, status: 200 },
  { record: 5, attempt: 1, from: MAIN_TOPIC, departs: 8.5, status: 200 },
  {
    record: 3,
    attempt: 2,
    from: FIRST_RETRY,
    departs: 11.5,
    status: 503,
    parksIn: { topic: SECOND_RETRY, at: 14 },
  },
  {
    record: 3,
    attempt: 3,
    from: SECOND_RETRY,
    departs: 18,
    status: 503,
    parksIn: { topic: DEAD_LETTERS, at: 20.5 },
  },
];

const docks = (d: Delivery): number => d.departs + TRIP;
const answered = (d: Delivery): number => docks(d) + 2 * CALL;
// A record is handled once it is acked, or once its copy lands in the next topic.
const handled = (d: Delivery): number => (d.parksIn ? d.parksIn.at + WRITE : answered(d));
// The record leaves charge() when the answer arrives, or when its copy starts out.
const settles = (d: Delivery): number => (d.parksIn ? d.parksIn.at : answered(d));
const verdictEnds = (d: Delivery): number => (d.parksIn ? handled(d) : handled(d) + 1);
const leaves = (topic: Target): number => DELIVERIES.find((d) => d.from === topic)?.departs ?? LOOP;

// The committed offset moves past a record once it is handled.
const COMMITS: ReadonlyArray<readonly [offset: number, from: number]> = [
  [OFFSETS[0], 0],
  ...DELIVERIES.filter((d) => d.from === MAIN_TOPIC).map(
    (d) => [d.record + 1, handled(d)] as const,
  ),
];

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'Record 3 fails: the payment provider answers 503, charge() throws, and the record is nacked.',
  ],
  [
    3,
    'The failure strategy copies record 3 to ticket-orders_retry_5000 and commits its offset anyway.',
  ],
  [6, "Records 4 and 5 don't wait: both are charged and acked during record 3's 5 s delay."],
  [
    11.5,
    'After 5 s, the retry-topic consumer delivers record 3 to charge() again. It fails and moves to ticket-orders_retry_30000.',
  ],
  [
    18,
    'After 30 s, the third attempt fails too. No retry topic is left, so record 3 lands on ticket-orders-dlq.',
  ],
];

const CONFIG_LINES: ReadonlyArray<readonly [indent: number, line: string]> = [
  [1, 'failure-strategy=delayed-retry-topic'],
  [1, `delayed-retry-topic.topics=${FIRST_RETRY},\\`],
  [3, SECOND_RETRY],
  [1, `dead-letter-queue.topic=${DEAD_LETTERS}`],
];

const TITLE = 'Delayed retry topics keep the partition moving';
const NOTE =
  'With failure-strategy=delayed-retry-topic, a failed record waits out its delay in a retry topic instead of in the partition.';
const DESC =
  'An animation in five steps. Record 3 of the ticket-orders topic fails in charge() because the payment provider answers 503. ' +
  'The delayed-retry-topic failure strategy writes it to ticket-orders_retry_5000 and commits its offset, so records 4 and 5 are charged and acked while it waits 5 seconds. ' +
  'The retry-topic consumer then hands it back to charge(), where it fails a second time and moves to ticket-orders_retry_30000. ' +
  'After 30 seconds the third attempt fails too, and with no retry topic left, the record lands on the dead-letter topic ticket-orders-dlq.';

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;

// Waypoints that cross a polyline at constant speed between two moments, holding still before and after.
function travel(points: readonly Point[], from: number, to: number): Waypoint[] {
  const lengths = points
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - points[i]![0], y - points[i]![1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const [first] = points;
  const last = points[points.length - 1]!;
  let walked = 0;
  return [
    [0, ...first!],
    [from, ...first!],
    ...lengths.map((length, i): Waypoint => {
      walked += length;
      return [from + ((to - from) * walked) / total, ...points[i + 1]!];
    }),
    [LOOP, ...last],
  ];
}

const polyline = (points: readonly Point[]): string =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

function grow([from, to]: Interval, full: number): string {
  return `<animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" keyTimes="${keyTimes(
    [0, from, to, LOOP],
    LOOP,
  )}" values="0;0;${full};${full}"/>`;
}

function chip(record: number, dead: boolean): string[] {
  const [frame, ink] = dead
    ? ['fill-surface stroke-red stroke-1.5', 'fill-red']
    : ['fill-cell-new stroke-amber stroke-1.5', 'fill-cell-ink'];
  return [
    `<rect class="${frame}" x="-11" y="-8" width="22" height="16" rx="4"/>`,
    text(`font-mono text-offset ${ink} anchor-middle`, 0, 4, String(record)),
  ];
}

function kafka(): string {
  const main = OFFSETS.map((offset) =>
    [
      `    <g data-role="cell" data-topic="${MAIN_TOPIC}" data-offset="${offset}">`,
      `      <rect class="la-cell" x="${cellLeft(offset)}" y="${MAIN_TOP}" width="${CELL.width}" height="${CELL.height}" rx="5"/>`,
      `      ${text('la-offset anchor-middle', cellLeft(offset) + CELL.width / 2, MAIN_TOP + 19, String(offset))}`,
      '    </g>',
    ].join('\n'),
  );
  const rows = (Object.keys(ROWS) as Target[]).map((topic) =>
    [
      `    <g data-role="topic" data-topic="${topic}">`,
      `      ${text(`${ROWS[topic].ink} font-mono text-offset`, CELL_LEFT, ROWS[topic].nameY, topic)}`,
      `      <rect class="la-cell-tail" x="${CELL_LEFT}" y="${slotTop(topic)}" width="${CELL.width}" height="${CELL.height}" rx="5"/>`,
      '    </g>',
    ].join('\n'),
  );
  return [
    '  <g data-role="kafka">',
    `    <rect class="la-card" x="${CARD.left}" y="${CARD.top}" width="${CARD.width}" height="${CARD.height}" rx="12"/>`,
    `    ${text('fill-ink-muted font-sans text-offset anchor-end', CARD_RIGHT - 16, MAIN_NAME_Y, 'Kafka')}`,
    `    ${text('fill-ink font-mono text-offset', CELL_LEFT, MAIN_NAME_Y, MAIN_TOPIC)}`,
    `    ${text('fill-ink-muted font-sans text-offset', CELL_LEFT + 104, MAIN_NAME_Y, 'partition 0')}`,
    ...main,
    `    <rect class="la-cell-tail" x="${cellLeft(TAIL_OFFSET)}" y="${MAIN_TOP}" width="${CELL.width}" height="${CELL.height}" rx="5"/>`,
    ...rows,
    '  </g>',
  ].join('\n');
}

function committed(): string {
  return COMMITS.map(([offset, from], i) => {
    const until = COMMITS[i + 1]?.[1] ?? LOOP;
    return `  <rect data-role="committed" data-offset="${offset}" class="fill-emerald" x="${cellLeft(offset)}" y="${MARKER_Y}" width="${CELL.width}" height="4" rx="2">${show([[from, until]], LOOP)}</rect>`;
  }).join('\n');
}

function wiring(): string {
  const reads = (Object.keys(READ_IN) as Retry[]).map(
    (topic) =>
      `  <path class="la-arrow" d="M ${CARD_RIGHT} ${slotY(topic)} H ${READ_X} V ${READ_IN[topic]} H ${RETRY_CONSUMER.left - 6}" marker-end="url(#head)"/>`,
  );
  return [
    `  <path class="la-arrow" d="M ${CARD_RIGHT} ${MAIN_Y} H ${CONSUMER.left - 6}" marker-end="url(#head)"/>`,
    ...reads,
    `  <path class="la-arrow" d="M ${APP_X} ${RETRY_CONSUMER.top} V ${CONSUMER.top + CONSUMER.height + 6}" marker-end="url(#head)"/>`,
    `  ${text('fill-ink-muted font-sans text-offset', APP_X + 16, 226, 'after the delay')}`,
    `  <path class="la-arrow" d="M ${CONSUMER.left + CONSUMER.width} ${REQUEST_Y} H ${PROVIDER.left - 6}" marker-end="url(#head)"/>`,
    `  <path class="la-arrow" d="M ${PROVIDER.left} ${RESPONSE_Y} H ${CONSUMER.left + CONSUMER.width + 6}" marker-end="url(#head)"/>`,
  ].join('\n');
}

function parking(d: Delivery): string {
  if (!d.parksIn) return '';
  const { topic, at } = d.parksIn;
  const landed = handled(d);
  const left = leaves(topic);
  const writePath: Point[] = [
    WRITE_EXIT,
    [WRITE_X, WRITE_EXIT[1]],
    [WRITE_X, laneY(topic)],
    [SLOT_X, laneY(topic)],
    [SLOT_X, slotTop(topic) - 2],
  ];
  const wait = ROWS[topic].wait;
  const y = slotY(topic);
  return [
    `  <g data-role="write" data-topic="${topic}">`,
    `    ${show([[at, landed]], LOOP)}`,
    `    <path class="fill-none stroke-amber stroke-1.5" d="${polyline(writePath)}" stroke-dasharray="5 4" marker-end="url(#head-new)"/>`,
    '    <circle class="la-flow-dot" r="5">',
    `      ${move(travel(writePath, at, landed), LOOP)}`,
    '    </circle>',
    '  </g>',
    `  <rect data-role="stored" data-topic="${topic}" class="la-cell" x="${CELL_LEFT}" y="${slotTop(topic)}" width="${CELL.width}" height="${CELL.height}" rx="5">${show([[landed, LOOP]], LOOP)}</rect>`,
    ...(wait
      ? [
          `  <g data-role="delay" data-topic="${topic}">`,
          `    ${show([[landed, left]], LOOP)}`,
          `    <rect class="fill-stage stroke-grid stroke-1.5" x="${WAIT_BAR.left}" y="${y - WAIT_BAR.height / 2}" width="${WAIT_BAR.width}" height="${WAIT_BAR.height}" rx="4"/>`,
          `    <rect class="fill-amber" x="${WAIT_BAR.left}" y="${y - WAIT_BAR.height / 2}" width="0" height="${WAIT_BAR.height}" rx="4">${grow([landed, left], WAIT_BAR.width)}</rect>`,
          `    ${text('fill-ink-muted font-sans text-offset', WAIT_BAR.left + WAIT_BAR.width + 12, y + 4, wait)}`,
          '  </g>',
        ]
      : []),
    `  <g data-role="parked" data-topic="${topic}" data-record="${d.record}" transform="translate(${SLOT_X} ${y})">`,
    `    ${show([[landed, left]], LOOP)}`,
    ...chip(d.record, topic === DEAD_LETTERS).map((part) => `    ${part}`),
    '  </g>',
  ].join('\n');
}

function route(d: Delivery): Point[] {
  if (d.from === MAIN_TOPIC) return [[cellLeft(d.record) + CELL.width / 2, MAIN_Y], MAIN_DOCK];
  return [
    [SLOT_X, slotY(d.from)],
    [READ_X, slotY(d.from)],
    [READ_X, READ_IN[d.from]],
    [APP_X, READ_IN[d.from]],
    RETRY_DOCK,
  ];
}

const delivery = (d: Delivery): string => `data-record="${d.record}" data-delivery="${d.attempt}"`;

// Drawn before the application boxes, so a retried record passes under the retry-topic consumer.
function token(d: Delivery): string {
  return [
    `  <g data-role="token" ${delivery(d)}>`,
    `    ${show([[d.departs, settles(d)]], LOOP)}`,
    `    ${move(travel(route(d), d.departs, docks(d)), LOOP)}`,
    ...chip(d.record, false).map((part) => `    ${part}`),
    '  </g>',
  ].join('\n');
}

function call(d: Delivery): string {
  const sent = docks(d);
  const back = sent + CALL;
  const failed = d.status === 503;
  const [frame, ink] = failed
    ? ['fill-surface stroke-red stroke-1.5', 'fill-red']
    : ['fill-surface stroke-emerald stroke-1.5', 'fill-emerald'];
  const out: Point[] = [
    [CONSUMER.left + CONSUMER.width + 6, REQUEST_Y],
    [PROVIDER.left - 8, REQUEST_Y],
  ];
  const home: Point[] = [
    [PROVIDER.left - 24, RESPONSE_Y],
    [CONSUMER.left + CONSUMER.width + 24, RESPONSE_Y],
  ];
  const [verdict, verdictInk] = failed ? ['nacked', 'fill-red'] : ['acked', 'fill-emerald'];
  return [
    `  <circle data-role="request" ${delivery(d)} class="fill-flow-strong" r="5">`,
    `    ${show([[sent, back]], LOOP)}`,
    `    ${move(travel(out, sent, back), LOOP)}`,
    '  </circle>',
    `  <g data-role="response" ${delivery(d)} data-status="${d.status}">`,
    `    ${show([[back, answered(d)]], LOOP)}`,
    `    ${move(travel(home, back, answered(d)), LOOP)}`,
    `    <rect class="${frame}" x="-20" y="-9" width="40" height="18" rx="9"/>`,
    `    ${text(`${ink} font-sans text-offset font-bold anchor-middle`, 0, 4, String(d.status))}`,
    '  </g>',
    `  <g data-role="verdict" ${delivery(d)} data-verdict="${verdict}">`,
    `    ${show([[answered(d), verdictEnds(d)]], LOOP)}`,
    `    ${text(`${verdictInk} font-sans text-offset font-semibold anchor-end`, VERDICT[0], VERDICT[1], verdict)}`,
    '  </g>',
  ].join('\n');
}

function application(): string {
  const box = ({ left, top, width, height }: Box, classes: string): string =>
    `<rect class="${classes}" x="${left}" y="${top}" width="${width}" height="${height}" rx="8"/>`;
  return [
    '  <g data-role="consumer">',
    `    ${box(CONSUMER, 'fill-sky stroke-sky-light stroke-1.5')}`,
    `    ${text('fill-surface font-mono text-offset anchor-middle', APP_X, 141, '@Incoming("ticket-orders")')}`,
    `    ${text('fill-surface font-mono text-label font-semibold anchor-middle', APP_X, 160, 'charge(order)')}`,
    '  </g>',
    '  <g data-role="retry-consumer">',
    `    ${box(RETRY_CONSUMER, 'fill-sky stroke-sky-light stroke-1.5')}`,
    `    ${text('fill-surface font-sans text-label font-semibold anchor-middle', APP_X, RETRY_CONSUMER.top + 27, 'retry-topic consumer')}`,
    '  </g>',
    '  <g data-role="payment-provider">',
    `    ${box(PROVIDER, 'la-canvas stroke-1.5')}`,
    `    ${text('la-label font-semibold anchor-middle', PROVIDER_X, 143, 'payment provider')}`,
    `    ${text('fill-ink-muted font-mono text-offset anchor-middle', PROVIDER_X, 161, 'via CardGateway')}`,
    '  </g>',
    '  <g data-role="config">',
    `    ${box(CONFIG, 'la-canvas stroke-1.5')}`,
    `    ${text('fill-ink-muted font-mono text-offset', CONFIG.left + 16, CONFIG.top + 22, `mp.messaging.incoming.${MAIN_TOPIC}.`)}`,
    `    ${text('fill-ink-muted font-sans text-offset anchor-end', CONFIG.left + CONFIG.width - 16, CONFIG.top + 22, 'application.properties')}`,
    ...CONFIG_LINES.map(
      ([indent, line], i) =>
        `    ${text('fill-ink font-mono text-offset', CONFIG.left + 16 + indent * 16, CONFIG.top + 42 + i * 18, line)}`,
    ),
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
    '    <marker id="head-new" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">',
    '      <path class="fill-amber" d="M 0 0 L 9 4.5 L 0 9 Z"/>',
    '    </marker>',
    '  </defs>',
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  ${text('la-title', 32, 44, TITLE)}`,
    `  ${text('la-note', 32, 68, NOTE)}`,
    kafka(),
    committed(),
    wiring(),
    ...DELIVERIES.map(parking).filter(Boolean),
    ...DELIVERIES.map(token),
    application(),
    ...DELIVERIES.map(call),
    `  <rect class="fill-emerald" x="32" y="${LEGEND_Y - 6}" width="${CELL.width}" height="4" rx="2"/>`,
    `  ${text('fill-ink-muted font-sans text-offset', 76, LEGEND_Y, `committed offset of ${MAIN_TOPIC}`)}`,
    `  ${text('fill-ink-muted font-sans text-offset anchor-end', WIDTH - 32, LEGEND_Y, 'Delays are shortened to fit the loop.')}`,
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
