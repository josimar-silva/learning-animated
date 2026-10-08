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
const HEIGHT = 476;

const COLUMNS = {
  client: { left: 32, width: 184, title: 'client', note: 'browser', face: 'font-sans' },
  rest: {
    left: 240,
    width: 180,
    title: 'Quarkus REST',
    note: 'maps exceptions',
    face: 'font-sans',
  },
  endpoint: {
    left: 444,
    width: 168,
    title: 'CheckoutResource',
    note: 'POST /checkout',
    face: 'font-mono',
  },
  service: {
    left: 636,
    width: 168,
    title: 'CheckoutService',
    note: 'checkout(order)',
    face: 'font-mono',
  },
  inventory: { left: 828, width: 140, title: 'inventory', note: 'database', face: 'font-sans' },
} as const;
type Column = keyof typeof COLUMNS;
const centre = (column: Column): number => COLUMNS[column].left + COLUMNS[column].width / 2;

const BOX_TOP = 92;
const BOX_HEIGHT = 84;
const STATUS_Y = 166;
// Calls travel right on one lane; exceptions and responses come back left on the other.
const CALL_Y = 200;
const BACK_Y = 232;
const TAG_Y = 262;
const CARD_TOP = 280;
const CODE_LINE = 19;
const INDENT = 15;
const CAPTION_Y = 452;

const REQUESTS: readonly Interval[] = [
  [0.5, 3],
  [10, 12.5],
];

type Escape = {
  readonly exception: string;
  readonly width: number;
  readonly thrown: number;
  readonly leavesService: number;
  readonly leavesEndpoint: number;
  readonly reachesRest: number;
  readonly handled: number;
};

const ESCAPES: readonly Escape[] = [
  {
    exception: 'SeatAlreadyTaken',
    width: 140,
    thrown: 3.5,
    leavesService: 4,
    leavesEndpoint: 5,
    reachesRest: 6,
    handled: 6.5,
  },
  {
    exception: 'PersistenceException',
    width: 168,
    thrown: 13,
    leavesService: 13.5,
    leavesEndpoint: 14.5,
    reachesRest: 15.5,
    handled: 16,
  },
];

type Answer = {
  readonly status: number;
  readonly text: string;
  readonly width: number;
  readonly pill: string;
  readonly ink: string;
  readonly sent: number;
  readonly received: number;
  readonly until: number;
};

const ANSWERS: readonly Answer[] = [
  {
    status: 409,
    text: '409 Conflict',
    width: 112,
    pill: 'fill-amber',
    ink: 'fill-surface',
    sent: 7,
    received: 8,
    until: 9.5,
  },
  {
    status: 500,
    text: '500 Internal Server Error',
    width: 184,
    pill: 'fill-surface stroke-red stroke-1.5',
    ink: 'fill-red',
    sent: 16.5,
    received: 17.5,
    until: LOOP,
  },
];

const SEAT_HELD: Interval = [3, 6.5];
const MAPPER_MATCHES: Interval = [6.5, 9.5];
const DATABASE_DOWN: Interval = [9.5, LOOP];
const NO_MAPPER: Interval = [16, LOOP];

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'A buyer checks out seat F14. The request goes through the endpoint and the service to the inventory database.',
  ],
  [
    3.5,
    'F14 is already held, so the service throws SeatAlreadyTaken. Nothing in the service or the endpoint catches it.',
  ],
  [
    6.5,
    'Quarkus REST finds the @ServerExceptionMapper that takes SeatAlreadyTaken, and the mapper answers 409 Conflict.',
  ],
  [9.5, 'A second buyer checks out, but the inventory database is down.'],
  [
    13,
    'The seat query throws PersistenceException, which escapes the service and the endpoint the same way.',
  ],
  [16, 'No mapper takes PersistenceException, so Quarkus answers 500 Internal Server Error.'],
];

type CodeLine = readonly [indent: number, code: string];
type Card = {
  readonly role: string;
  readonly left: number;
  readonly width: number;
  readonly lines: readonly CodeLine[];
};

const MAPPER_CARD: Card = {
  role: 'mapper',
  left: 32,
  width: 480,
  lines: [
    [0, 'class CheckoutMappers {'],
    [1, '@ServerExceptionMapper'],
    [1, 'public RestResponse<String> seatTaken(SeatAlreadyTaken e) {'],
    [2, 'return RestResponse.status(CONFLICT, e.getMessage());'],
    [1, '}'],
    [0, '}'],
  ],
};

const ENDPOINT_CARD: Card = {
  role: 'endpoint-code',
  left: 528,
  width: 440,
  lines: [
    [0, '@Path("/checkout") class CheckoutResource {'],
    [1, '@POST'],
    [1, 'public TicketResult checkout(Order order) {'],
    [2, 'return service.checkout(order); // no try/catch'],
    [1, '}'],
    [0, '}'],
  ],
};

const CARD_HEIGHT = 26 + CODE_LINE * (MAPPER_CARD.lines.length - 1) + 16;

const TITLE = 'How an exception becomes a response';
const DESC =
  'A checkout request travels from the client through Quarkus REST, CheckoutResource, and CheckoutService to the inventory database. ' +
  'Seat F14 is already held, so the service throws SeatAlreadyTaken, which passes back through the service and the endpoint uncaught. ' +
  'Quarkus REST finds the @ServerExceptionMapper that takes it, and the mapper answers 409 Conflict. ' +
  'A second checkout runs while the database is down: the query throws PersistenceException, no mapper takes it, and Quarkus answers 500 Internal Server Error.';

const label = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}" text-anchor="middle">${escapeXml(words)}</text>`;

function column(name: Column): string {
  const { left, width, title, note, face } = COLUMNS[name];
  const x = centre(name);
  return [
    `  <g data-role="layer" data-layer="${name}">`,
    `    <rect class="la-canvas stroke-1.5" x="${left}" y="${BOX_TOP}" width="${width}" height="${BOX_HEIGHT}" rx="10"/>`,
    `    ${label(`fill-ink text-label ${face} font-semibold`, x, 124, title)}`,
    `    ${label(`fill-ink-muted text-offset ${face}`, x, 146, note)}`,
    '  </g>',
  ].join('\n');
}

function status(role: string, during: Interval, classes: string, x: number, words: string): string {
  return [
    `  <g data-role="${role}">`,
    `    ${show([during], LOOP)}`,
    `    ${label(`${classes} text-offset font-sans font-semibold`, x, STATUS_Y, words)}`,
    '  </g>',
  ].join('\n');
}

function request([sent, arrived]: Interval, i: number): string {
  const from = centre('client');
  const to = centre('inventory') - 12;
  const path: Waypoint[] = [
    [0, from, CALL_Y],
    [sent, from, CALL_Y],
    [arrived, to, CALL_Y],
    [LOOP, to, CALL_Y],
  ];
  return [
    `  <circle data-role="request" data-round="${i + 1}" class="fill-flow-strong" r="7">`,
    `    ${show([[sent, arrived]], LOOP)}`,
    `    ${move(path, LOOP)}`,
    '  </circle>',
  ].join('\n');
}

function uncaught(layer: 'service' | 'endpoint', escape: Escape, from: number): string {
  return `  <text data-role="uncaught" data-layer="${layer}" data-exception="${escape.exception}" class="fill-red text-offset font-sans font-semibold halo" x="${centre(layer)}" y="${TAG_Y}" text-anchor="middle">not caught${show([[from, escape.handled]], LOOP)}</text>`;
}

function exception(escape: Escape): string {
  const path: Waypoint[] = [
    [0, centre('service'), BACK_Y],
    [escape.leavesService, centre('service'), BACK_Y],
    [escape.leavesEndpoint, centre('endpoint'), BACK_Y],
    [escape.reachesRest, centre('rest'), BACK_Y],
    [LOOP, centre('rest'), BACK_Y],
  ];
  return [
    `  <g data-role="exception" data-exception="${escape.exception}">`,
    `    ${show([[escape.thrown, escape.handled]], LOOP)}`,
    `    ${move(path, LOOP)}`,
    `    <rect class="fill-surface stroke-red stroke-1.5" x="${-escape.width / 2}" y="-12" width="${escape.width}" height="24" rx="4"/>`,
    `    ${label('fill-red text-offset font-mono font-semibold', 0, 4, escape.exception)}`,
    '  </g>',
    uncaught('service', escape, escape.leavesService),
    uncaught('endpoint', escape, escape.leavesEndpoint),
  ].join('\n');
}

function response(answer: Answer): string {
  const path: Waypoint[] = [
    [0, centre('rest'), BACK_Y],
    [answer.sent, centre('rest'), BACK_Y],
    [answer.received, centre('client'), BACK_Y],
    [LOOP, centre('client'), BACK_Y],
  ];
  return [
    `  <g data-role="response" data-status="${answer.status}">`,
    `    ${show([[answer.sent, answer.until]], LOOP)}`,
    `    ${move(path, LOOP)}`,
    `    <rect class="${answer.pill}" x="${-answer.width / 2}" y="-12" width="${answer.width}" height="24" rx="12"/>`,
    `    ${label(`${answer.ink} text-offset font-sans font-bold`, 0, 4, answer.text)}`,
    '  </g>',
  ].join('\n');
}

function card({ role, left, width, lines }: Card): string {
  return [
    `  <g data-role="${role}">`,
    `    <rect class="la-card" x="${left}" y="${CARD_TOP}" width="${width}" height="${CARD_HEIGHT}" rx="10"/>`,
    ...lines.map(
      ([indent, code], i) =>
        `    <text class="fill-ink text-offset font-mono" x="${left + 16 + indent * INDENT}" y="${CARD_TOP + 26 + i * CODE_LINE}">${escapeXml(code)}</text>`,
    ),
    '  </g>',
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="la-label" x="32" y="${CAPTION_Y}">${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
}

export function render(): string {
  const { left, width } = COLUMNS.inventory;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" data-loop="${LOOP}s">`,
    `  <title>${TITLE}</title>`,
    `  <desc>${escapeXml(DESC)}</desc>`,
    '  <style>',
    '/* LA-STYLE:START */',
    '/* LA-STYLE:END */',
    '</style>',
    '  <defs>',
    '    <marker id="head" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto-start-reverse">',
    '      <path class="fill-flow" d="M 0 0 L 9 4.5 L 0 9 Z"/>',
    '    </marker>',
    '  </defs>',
    `  <rect class="fill-stage" width="${WIDTH}" height="${HEIGHT}"/>`,
    `  <text class="la-title" x="32" y="44">${TITLE}</text>`,
    `  <text class="la-note" x="32" y="68">The endpoint has no try/catch. Quarkus REST turns whatever escapes it into an HTTP status.</text>`,
    ...(Object.keys(COLUMNS) as Column[]).map(column),
    `  <path class="la-arrow" d="M ${centre('client')} ${CALL_Y} H ${centre('inventory') - 8}" marker-end="url(#head)"/>`,
    `  <path class="la-arrow" d="M ${centre('service')} ${BACK_Y} H ${centre('client') + 8}" stroke-dasharray="6 4" marker-end="url(#head)"/>`,
    card(MAPPER_CARD),
    card(ENDPOINT_CARD),
    status('seat-held', SEAT_HELD, 'fill-ink-muted', centre('inventory'), 'F14 already held'),
    [
      '  <g data-role="database-down">',
      `    ${show([DATABASE_DOWN], LOOP)}`,
      `    <rect class="fill-none stroke-red stroke-2.5" x="${left - 2}" y="${BOX_TOP - 2}" width="${width + 4}" height="${BOX_HEIGHT + 4}" rx="12"/>`,
      `    ${label('fill-red text-offset font-sans font-semibold', centre('inventory'), STATUS_Y, 'down')}`,
      '  </g>',
    ].join('\n'),
    [
      '  <g data-role="mapper-match">',
      `    ${show([MAPPER_MATCHES], LOOP)}`,
      `    <rect class="fill-none stroke-emerald stroke-2.5" x="${MAPPER_CARD.left - 4}" y="${CARD_TOP - 4}" width="${MAPPER_CARD.width + 8}" height="${CARD_HEIGHT + 8}" rx="14"/>`,
      `    ${label('fill-emerald text-offset font-sans font-semibold', centre('rest'), STATUS_Y, 'seatTaken() matches')}`,
      '  </g>',
    ].join('\n'),
    status('no-mapper', NO_MAPPER, 'fill-red', centre('rest'), 'no mapper matches'),
    ...REQUESTS.map(request),
    ...ESCAPES.map(exception),
    ...ANSWERS.map(response),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
