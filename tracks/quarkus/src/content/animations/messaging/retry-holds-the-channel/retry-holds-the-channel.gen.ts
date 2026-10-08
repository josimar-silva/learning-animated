// Writes retry-holds-the-channel.svg through `just gen`. One story table drives every timing.
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

const LOOP = 20;
const W = 960;
const H = 556;

type Point = readonly [x: number, y: number];
type Status = 200 | 503;

// One record handed to charge(). Each call lasts CALL seconds: the request, then the answer.
type Delivery = {
  readonly offset: number;
  readonly partition: number;
  readonly leaves: number;
  readonly calls: readonly number[];
  readonly status: Status;
  // Acked after a 200, or nacked after the last 503.
  readonly settled: number;
  // The record leaves charge(), either done or on its way into the dead-letter topic.
  readonly gone: number;
  readonly verdictUntil: number;
};

const CALL = 1;
const RIDE = 1;
// @Retry(maxRetries = 3) makes one call and up to three retries.
const MAX_ATTEMPTS = 4;

const DELIVERIES: readonly Delivery[] = [
  {
    offset: 3,
    partition: 0,
    leaves: 0.5,
    calls: [1.5, 4, 6.5, 9],
    status: 503,
    settled: 10,
    gone: 11,
    verdictUntil: 12,
  },
  {
    offset: 4,
    partition: 0,
    leaves: 12,
    calls: [13],
    status: 200,
    settled: 14,
    gone: 14.5,
    verdictUntil: 15.5,
  },
  {
    offset: 11,
    partition: 1,
    leaves: 14.5,
    calls: [15.5],
    status: 200,
    settled: 16.5,
    gone: 17,
    verdictUntil: LOOP,
  },
];

// Both partitions wait from record 3's first call until it lands on the dead-letter topic.
const HOLD: Interval = [1.5, 11];

type Partition = {
  readonly id: number;
  readonly y: number;
  readonly offsets: readonly number[];
  readonly appended: { readonly offset: number; readonly at: number };
  readonly committed: readonly (readonly [offset: number, from: number, until: number])[];
  // The height at which a record rides out of this partition toward charge().
  readonly exit: number;
};

const PARTITIONS: readonly Partition[] = [
  {
    id: 0,
    y: 166,
    offsets: [3, 4, 5],
    appended: { offset: 6, at: 5.5 },
    committed: [
      [3, 0, 11],
      [4, 11, 14],
      [5, 14, LOOP],
    ],
    exit: 140,
  },
  {
    id: 1,
    y: 260,
    offsets: [11, 12],
    appended: { offset: 13, at: 8 },
    committed: [
      [11, 0, 16.5],
      [12, 16.5, LOOP],
    ],
    exit: 228,
  },
];

const CAPTIONS: readonly (readonly [at: number, text: string])[] = [
  [0, 'Record 3 from partition 0 reaches charge(). @Blocking runs the method on a worker thread.'],
  [
    2,
    'The payment provider is down and answers 503, so the call throws. @Retry catches it and sleeps through the delay.',
  ],
  [
    5.5,
    '@Retry calls again with the same record 3. Records 4 and 5 wait, partition 1 waits too, and new orders pile up.',
  ],
  [
    10,
    'The fourth 503 uses up maxRetries = 3. Record 3 is nacked, and the failure strategy writes it to ticket-orders-dlq.',
  ],
  [
    12,
    'Only now does the channel move. The payment provider is back, and record 4 is acked after one call.',
  ],
  [
    14.5,
    'Partition 1 had no failing record, yet record 11 waited through every attempt on record 3.',
  ],
  [
    17,
    'While one record retries in place, no other record in the channel moves, on any partition.',
  ],
];

const DESC =
  'Animation. charge() reads the ticket-orders topic with @Incoming, runs on a worker thread because of @Blocking, and carries @Retry(maxRetries = 3, delay = 1000). Record 3 from partition 0 gets 503 from the payment provider, through CardGateway, four times in a row, and the worker thread sleeps through a delay between calls. Through every attempt, records 4 and 5 and all of partition 1 wait, new orders pile up, and neither committed offset moves. After the fourth 503, record 3 is nacked and written to ticket-orders-dlq. Only then does record 4 get its turn and succeed, followed by record 11 from partition 1.';

const CELL = { x: 108, w: 34, h: 30, gap: 6 };
const CARD = { x: 24, y: 88, w: 320, h: 262 };
const PILL = { x: 272, w: 64 };
// Both partitions' records meet here on their way into charge().
const JOIN = 368;
const METHOD = { x: 392, y: 152, w: 248, h: 56 };
const SLOT: Point = [423, 180];
const PROVIDER = { x: 724, y: 152, w: 212, h: 56 };
const WIRE = { request: 168, response: 192, from: 648, to: 712 };
const DLQ = { x: 724, y: 268, w: 212, h: 80 };
const DEAD: Point = [757, 317];
const BADGE = { y: 218, h: 22 };
// The worker lane draws story time: x = x0 + (t - t0) * px.
const LANE = { x: 24, y: 364, w: 912, h: 100, track: 396, t0: 1.5, x0: 60, px: 56 };

const rect = (x: number, y: number, w: number, h: number, cls: string, rx = 6): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const text = (x: number, y: number, content: string, cls: string): string =>
  `<text x="${x}" y="${y}" class="${cls}">${escapeXml(content)}</text>`;

const hooks = (attributes: Readonly<Record<string, string | number>>): string =>
  Object.entries(attributes)
    .map(([name, value]) => ` data-${name}="${value}"`)
    .join('');

function during(intervals: readonly Interval[], content: string, data = ''): string {
  const always = intervals.length === 1 && intervals[0]![0] <= 0 && intervals[0]![1] >= LOOP;
  return always
    ? `<g${data}>${content}</g>`
    : `<g opacity="0"${data}>${show(intervals, LOOP)}${content}</g>`;
}

const path = (points: readonly Point[], cls: string): string =>
  `<path d="${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')}" class="${cls}"/>`;

const headRight = ([x, y]: Point, cls: string): string =>
  `<polygon points="${x},${y} ${x - 8},${y - 4} ${x - 8},${y + 4}" class="${cls}"/>`;

const headLeft = ([x, y]: Point, cls: string): string =>
  `<polygon points="${x},${y} ${x + 8},${y - 4} ${x + 8},${y + 4}" class="${cls}"/>`;

// Widens a lane segment from nothing to its full width while its moment plays.
const grow = (width: number, from: number, to: number): string =>
  `<animate attributeName="width" dur="${LOOP}s" repeatCount="indefinite" keyTimes="${keyTimes([0, from, to, LOOP], LOOP)}" values="0;0;${width};${width}"/>`;

const centi = (t: number): number => Math.round(t * 100) / 100;

// Waypoints that ride a route at a steady speed, leaving at `start` and arriving at `end`.
function ride(route: readonly Point[], start: number, end: number): Waypoint[] {
  const legs = route.slice(1).map(([x, y], i) => Math.hypot(x - route[i]![0], y - route[i]![1]));
  const total = legs.reduce((sum, leg) => sum + leg, 0);
  let travelled = 0;
  return route.map(([x, y], i) => {
    travelled += i === 0 ? 0 : legs[i - 1]!;
    const t = i === route.length - 1 ? end : centi(start + ((end - start) * travelled) / total);
    return [t, x, y];
  });
}

const partitionOf = (d: Delivery): Partition => PARTITIONS.find((p) => p.id === d.partition)!;
const cellX = (p: Partition, offset: number): number =>
  CELL.x + (offset - p.offsets[0]!) * (CELL.w + CELL.gap);
const cellCenter = (p: Partition, offset: number): Point => [
  cellX(p, offset) + CELL.w / 2,
  p.y + CELL.h / 2,
];

function cell(x: number, y: number, offset: number, cls: string): string {
  return (
    rect(x, y, CELL.w, CELL.h, cls, 5) +
    text(x + CELL.w / 2, y + 19, String(offset), 'la-offset anchor-middle')
  );
}

function partition(p: Partition): string {
  const { offset: added, at } = p.appended;
  const tailX = cellX(p, added);
  return [
    text(36, p.y + 19, `partition ${p.id}`, 'font-sans text-offset fill-ink'),
    ...p.offsets.map(
      (offset) =>
        `<g${hooks({ role: 'cell', partition: p.id, offset })}>${cell(cellX(p, offset), p.y, offset, 'la-cell')}</g>`,
    ),
    rect(tailX, p.y, CELL.w, CELL.h, 'la-cell-tail', 5),
    during(
      [[at, LOOP]],
      [
        rect(tailX, p.y, CELL.w, CELL.h, 'la-cell', 5),
        during([[at, at + 1.5]], rect(tailX, p.y, CELL.w, CELL.h, 'la-cell-new', 5)),
        text(tailX + CELL.w / 2, p.y + 19, String(added), 'la-offset anchor-middle'),
      ].join(''),
      hooks({ role: 'appended', partition: p.id, offset: added }),
    ),
    ...p.committed.map(([offset, from, until]) =>
      during(
        [[from, until]],
        rect(cellX(p, offset) - 3, p.y - 3, CELL.w + 6, CELL.h + 6, 'la-read-marker', 7),
        hooks({ role: 'committed', partition: p.id, offset }),
      ),
    ),
    during(
      [HOLD],
      rect(PILL.x, p.y + 3, PILL.w, 24, 'fill-surface stroke-red stroke-1.5', 12) +
        text(
          PILL.x + PILL.w / 2,
          p.y + 19,
          'waiting',
          'font-sans text-offset font-semibold fill-red anchor-middle',
        ),
      hooks({ role: 'waiting', partition: p.id }),
    ),
  ].join('\n');
}

function topic(): string {
  const edge = CARD.x + CARD.w;
  return [
    rect(CARD.x, CARD.y, CARD.w, CARD.h, 'la-card', 14),
    text(40, 114, 'topic', 'la-label'),
    text(80, 114, 'ticket-orders', 'font-mono text-label font-semibold fill-ink'),
    ...PARTITIONS.map(partition),
    rect(36, 318, 20, 16, 'la-read-marker', 4),
    text(66, 330, 'committed offset', 'font-sans text-offset fill-ink'),
    path(
      [
        [edge, PARTITIONS[0]!.exit],
        [JOIN, PARTITIONS[0]!.exit],
        [JOIN, PARTITIONS[1]!.exit],
        [edge, PARTITIONS[1]!.exit],
      ],
      'la-arrow',
    ),
    path(
      [
        [JOIN, SLOT[1]],
        [METHOD.x - 8, SLOT[1]],
      ],
      'la-arrow',
    ),
    headRight([METHOD.x, SLOT[1]], 'fill-flow'),
  ].join('\n');
}

function consumer(): string {
  const right = METHOD.x + METHOD.w;
  return [
    `<g data-role="code">${[
      text(METHOD.x, 104, '@Incoming("ticket-orders")', 'font-mono text-offset fill-ink-muted'),
      text(METHOD.x, 122, '@Blocking', 'font-mono text-offset fill-ink-muted'),
      text(
        METHOD.x,
        140,
        '@Retry(maxRetries = 3, delay = 1000)',
        'font-mono text-offset font-semibold fill-ink',
      ),
    ].join('')}</g>`,
    `<g data-role="consumer">${rect(METHOD.x, METHOD.y, METHOD.w, METHOD.h, 'fill-sky stroke-sky-light stroke-1.5', 10)}${text(540, 185, 'charge(order)', 'font-mono text-label font-semibold fill-surface anchor-middle')}</g>`,
    `<g data-role="payment-provider">${[
      rect(
        PROVIDER.x,
        PROVIDER.y,
        PROVIDER.w,
        PROVIDER.h,
        'fill-surface stroke-cell-stroke stroke-1.5',
        10,
      ),
      text(
        PROVIDER.x + PROVIDER.w / 2,
        176,
        'payment provider',
        'font-sans text-label font-semibold fill-ink anchor-middle',
      ),
      text(
        PROVIDER.x + PROVIDER.w / 2,
        194,
        'via CardGateway',
        'font-mono text-offset fill-ink-muted anchor-middle',
      ),
    ].join('')}</g>`,
    path(
      [
        [right, WIRE.request],
        [PROVIDER.x - 8, WIRE.request],
      ],
      'la-arrow',
    ),
    headRight([PROVIDER.x, WIRE.request], 'fill-flow'),
    path(
      [
        [PROVIDER.x, WIRE.response],
        [right + 8, WIRE.response],
      ],
      'la-arrow',
    ),
    headLeft([right, WIRE.response], 'fill-flow'),
  ].join('\n');
}

function deadLetterTopic(): string {
  const route: Point[] = [
    [SLOT[0], METHOD.y + METHOD.h],
    [SLOT[0], DEAD[1]],
    [DEAD[0] - CELL.w / 2 - 8, DEAD[1]],
  ];
  const tip: Point = [DEAD[0] - CELL.w / 2, DEAD[1]];
  const slotX = DEAD[0] - CELL.w / 2;
  const slotY = DEAD[1] - CELL.h / 2;
  return [
    `<g data-role="dlq">${[
      rect(DLQ.x, DLQ.y, DLQ.w, DLQ.h, 'la-card', 12),
      text(slotX, 290, 'ticket-orders-dlq', 'font-mono text-label font-semibold fill-ink'),
      rect(slotX, slotY, CELL.w, CELL.h, 'la-cell-tail', 5),
      text(786, 322, 'dead letters', 'font-sans text-offset fill-ink'),
    ].join('')}</g>`,
    path(route, 'la-arrow'),
    headRight(tip, 'fill-flow'),
    `<g data-role="failure-strategy">${text(580, 344, 'failure-strategy=dead-letter-queue', 'font-mono text-offset fill-ink-muted anchor-middle')}</g>`,
    ...DELIVERIES.filter((d) => d.status === 503).flatMap((d) => [
      during(
        [[d.settled, d.gone]],
        path(route, 'fill-none stroke-red stroke-2.5') + headRight(tip, 'fill-red'),
      ),
      during(
        [[d.gone, LOOP]],
        cell(slotX, slotY, d.offset, 'fill-cell stroke-red stroke-1.5'),
        hooks({ role: 'dead-letter', offset: d.offset }),
      ),
    ]),
  ].join('\n');
}

function exchange(d: Delivery, attempt: number, start: number): string {
  const answered = start + CALL / 2;
  const done = start + CALL;
  const tint = d.status === 200 ? 'emerald' : 'red';
  const { request, response, from, to } = WIRE;
  return [
    during(
      [[start, answered]],
      `<g transform="translate(${from},${request})">${move(
        [
          [0, from, request],
          [start, from, request],
          [answered, to, request],
          [LOOP, to, request],
        ],
        LOOP,
      )}<circle r="5" class="la-flow-dot"/></g>`,
      hooks({ role: 'request', offset: d.offset, attempt }),
    ),
    during(
      [[answered, done]],
      `<g transform="translate(${to},${response})">${move(
        [
          [0, to, response],
          [answered, to, response],
          [done, from + 4, response],
          [LOOP, from + 4, response],
        ],
        LOOP,
      )}<circle r="5" class="fill-${tint}"/>${text(0, 18, String(d.status), `font-mono text-offset font-semibold fill-${tint} anchor-middle`)}</g>`,
      hooks({ role: 'response', offset: d.offset, attempt, status: d.status }),
    ),
  ].join('\n');
}

function badges(d: Delivery): string[] {
  const ok = d.status === 200;
  const tint = ok ? 'emerald' : 'red';
  const verdict = ok ? 'acked' : 'nacked';
  return [
    ...d.calls.flatMap((start, i) => {
      const attempt = i + 1;
      const next = d.calls[i + 1];
      const shown = [
        during(
          [[start, next ?? start + CALL]],
          rect(448, BADGE.y, 104, BADGE.h, 'la-cell-new', 11) +
            text(
              500,
              BADGE.y + 15,
              `attempt ${attempt} of ${MAX_ATTEMPTS}`,
              'font-sans text-offset font-semibold fill-cell-ink anchor-middle',
            ),
          hooks({ role: 'attempt', offset: d.offset, attempt }),
        ),
      ];
      if (next !== undefined)
        shown.push(
          during(
            [[start + CALL, next]],
            rect(560, BADGE.y, 80, BADGE.h, 'fill-surface stroke-slate stroke-1.5', 11) +
              text(
                600,
                BADGE.y + 15,
                'delay ≈ 1 s',
                'font-sans text-offset fill-ink-muted anchor-middle',
              ),
          ),
        );
      return shown;
    }),
    during(
      [[d.settled, d.verdictUntil]],
      rect(448, BADGE.y, 128, BADGE.h, `fill-surface stroke-${tint} stroke-1.5`, 11) +
        text(
          512,
          BADGE.y + 15,
          `record ${d.offset} ${verdict}`,
          `font-sans text-offset font-semibold fill-${tint} anchor-middle`,
        ),
      hooks({ role: 'verdict', offset: d.offset, verdict }),
    ),
  ];
}

const laneX = (t: number): number => LANE.x0 + (t - LANE.t0) * LANE.px;

function laneCall(d: Delivery, attempt: number, start: number): string {
  const [x0, x1] = [laneX(start), laneX(start + CALL)];
  const [y, h, w] = [LANE.track + 2, 28, x1 - x0 - 2];
  const tint = d.status === 200 ? 'emerald' : 'red';
  return [
    during(
      [[start, start + CALL]],
      `<rect x="${x0 + 1}" y="${y}" width="0" height="${h}" rx="4" class="la-cell-new">${grow(w, start, start + CALL)}</rect>`,
    ),
    during(
      [[start + CALL, LOOP]],
      rect(x0 + 1, y, w, h, `fill-surface stroke-${tint} stroke-1.5`, 4) +
        text(
          (x0 + x1) / 2,
          y + 18,
          String(d.status),
          `font-mono text-offset font-semibold fill-${tint} anchor-middle`,
        ),
      hooks({ role: 'call', offset: d.offset, attempt }),
    ),
  ].join('\n');
}

function laneDelay(d: Delivery, after: number, from: number, to: number): string {
  const [x0, x1] = [laneX(from), laneX(to)];
  const [y, h, w] = [LANE.track + 2, 28, x1 - x0 - 2];
  return during(
    [[from, LOOP]],
    `<rect x="${x0 + 1}" y="${y}" width="0" height="${h}" rx="4" class="fill-surface stroke-slate stroke-1.5">${grow(w, from, to)}</rect>` +
      during(
        [[to, LOOP]],
        text((x0 + x1) / 2, y + 18, 'delay', 'font-sans text-offset fill-ink-muted anchor-middle'),
      ),
    hooks({ role: 'delay', offset: d.offset, after }),
  );
}

function laneRecord(d: Delivery): string[] {
  const first = d.calls[0]!;
  const end = laneX(d.settled);
  const label =
    d.status === 503
      ? `record ${d.offset}: ${d.calls.length} calls, ${d.calls.length - 1} delays`
      : `record ${d.offset}`;
  const shown = [
    ...d.calls.flatMap((start, i) => {
      const segments = [laneCall(d, i + 1, start)];
      const next = d.calls[i + 1];
      if (next !== undefined) segments.push(laneDelay(d, i + 1, start + CALL, next));
      return segments;
    }),
    during(
      [[d.settled, LOOP]],
      text(
        (laneX(first) + end) / 2,
        448,
        label,
        'font-sans text-offset fill-ink-muted anchor-middle',
      ),
    ),
  ];
  if (d.status === 503)
    shown.push(
      during(
        [[d.settled, LOOP]],
        `<line x1="${end}" y1="${LANE.track - 4}" x2="${end}" y2="${LANE.track + 36}" class="stroke-red stroke-2.5"/>` +
          text(end, 448, 'nacked', 'font-sans text-offset font-semibold fill-red anchor-middle'),
      ),
    );
  return shown;
}

function lane(): string {
  return [
    rect(LANE.x, LANE.y, LANE.w, LANE.h, 'fill-surface stroke-violet stroke-1.5', 12),
    text(40, 386, 'worker thread', 'font-sans text-label font-semibold fill-violet'),
    text(
      920,
      386,
      '@Blocking keeps the order: one record at a time for the whole channel',
      'la-note anchor-end',
    ),
    rect(40, LANE.track, 880, 32, 'fill-stage stroke-grid', 6),
    ...DELIVERIES.flatMap(laneRecord),
  ].join('\n');
}

function token(d: Delivery): string {
  const p = partitionOf(d);
  const start = cellCenter(p, d.offset);
  const inbound: Point[] = [start, [start[0], p.exit], [JOIN, p.exit], [JOIN, SLOT[1]], SLOT];
  const points: Waypoint[] = [[0, ...start], ...ride(inbound, d.leaves, d.leaves + RIDE)];
  if (d.status === 503) points.push(...ride([SLOT, [SLOT[0], DEAD[1]], DEAD], d.settled, d.gone));
  const [, x, y] = points[points.length - 1]!;
  points.push([LOOP, x, y]);
  return during(
    [[d.leaves, d.gone]],
    `<g transform="translate(${start[0]},${start[1]})">${move(points, LOOP)}${cell(-CELL.w / 2, -CELL.h / 2, d.offset, 'la-cell-new')}</g>`,
    hooks({ role: 'token', offset: d.offset }),
  );
}

function captions(): string[] {
  return CAPTIONS.map(([at, caption], i) => {
    const until = CAPTIONS[i + 1]?.[0] ?? LOOP;
    return `<text x="${W / 2}" y="499" class="font-sans text-label fill-ink anchor-middle" opacity="0" data-role="caption">${show([[at, until]], LOOP)}${escapeXml(caption)}</text>`;
  });
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc" data-loop="${LOOP}s">`,
    '<title id="title">@Retry on @Incoming holds the channel</title>',
    `<desc id="desc">${escapeXml(DESC)}</desc>`,
    '<style>\n/* LA-STYLE:START */\n/* LA-STYLE:END */\n</style>',
    rect(0, 0, W, H, 'fill-stage', 0),
    text(28, 40, '@Retry on @Incoming holds the channel', 'la-title'),
    text(
      28,
      64,
      'charge() retries record 3 in place, and no other record in the channel moves until its last attempt fails.',
      'la-note',
    ),
    topic(),
    consumer(),
    deadLetterTopic(),
    lane(),
    ...DELIVERIES.flatMap((d) => [
      ...badges(d),
      ...d.calls.map((start, i) => exchange(d, i + 1, start)),
    ]),
    ...DELIVERIES.map(token),
    rect(24, 476, W - 48, 36, 'la-canvas', 8),
    ...captions(),
    text(
      28,
      538,
      'Sources: quarkus.io/guides/kafka (retrying processing, error handling strategies) and quarkus.io/guides/smallrye-fault-tolerance.',
      'font-sans text-offset fill-ink-muted',
    ),
    '</svg>',
  ].join('\n');
  return `${embedBlock(svg, canonicalStyleBlock())}\n`;
}
