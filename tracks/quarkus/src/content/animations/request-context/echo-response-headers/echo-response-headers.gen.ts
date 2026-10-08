// Writes echo-response-headers.svg through `just gen`. One story table drives every timing.
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
const W = 960;
const H = 700;
const HEADER = 'X-Correlation-Id';

type Column = 'caller' | 'filter' | 'mapper' | 'endpoint';
// A column the story passes through, at the column's position in time.
type Stop = readonly [t: number, column: Column];

type Answer = {
  readonly status: 200 | 409;
  readonly text: string;
  readonly width: number;
  readonly pill: string;
  // The answer appears at its first stop and rests in the caller from its last.
  readonly route: readonly Stop[];
};

type Thrown = {
  readonly exception: string;
  // The exception leaves checkout() and is gone once the mapper takes it.
  readonly route: readonly Stop[];
  readonly mapperRun: Interval;
};

type Request = {
  readonly id: 'A' | 'B';
  // The y of the request's call line; its answer travels back 40 px lower.
  readonly lane: number;
  readonly tint: 'sky' | 'pink';
  readonly correlationId: string;
  readonly arrive: number;
  readonly send: Interval;
  // checkout() runs, then returns or throws at the end of it.
  readonly hold: Interval;
  readonly thrown?: Thrown;
  readonly answer: Answer;
  readonly filterRun: Interval;
  readonly copy: Interval;
};

const REQUESTS: readonly Request[] = [
  {
    id: 'A',
    lane: 200,
    tint: 'sky',
    correlationId: '7f3a',
    arrive: 0,
    send: [0.5, 1.5],
    hold: [1.5, 2.5],
    answer: {
      status: 200,
      text: '200 OK',
      width: 76,
      pill: 'fill-emerald',
      route: [
        [2.5, 'endpoint'],
        [4, 'filter'],
        [6.5, 'filter'],
        [7.5, 'caller'],
      ],
    },
    filterRun: [4, 6.5],
    copy: [5, 6.5],
  },
  {
    id: 'B',
    lane: 360,
    tint: 'pink',
    correlationId: 'c41e',
    arrive: 7.5,
    send: [8, 9],
    hold: [9, 10],
    thrown: {
      exception: 'SeatAlreadyTaken',
      route: [
        [10, 'endpoint'],
        [11, 'endpoint'],
        [12.5, 'mapper'],
      ],
      mapperRun: [12.5, 13.5],
    },
    answer: {
      status: 409,
      text: '409 Conflict',
      width: 104,
      pill: 'fill-amber',
      route: [
        [12.5, 'mapper'],
        [13.5, 'mapper'],
        [14.5, 'filter'],
        [16.5, 'filter'],
        [17.5, 'caller'],
      ],
    },
    filterRun: [14.5, 16.5],
    copy: [15, 16.5],
  },
];

// Both answers have reached their callers.
const SAME_ID: Interval = [17.5, LOOP];

const CAPTIONS: readonly (readonly [at: number, text: string])[] = [
  [0, 'Request A calls POST /checkout with X-Correlation-Id 7f3a.'],
  [
    2.5,
    'checkout() returns a TicketResult. Before Quarkus writes the 200 OK, the response filter runs.',
  ],
  [
    5,
    'The filter reads X-Correlation-Id from the request and sets it on the response, so the 200 OK leaves with 7f3a.',
  ],
  [
    7.5,
    'Request B calls POST /checkout with X-Correlation-Id c41e, for a seat someone else already holds.',
  ],
  [10, 'checkout() throws SeatAlreadyTaken, so it never returns a response of its own.'],
  [12.5, 'The @ServerExceptionMapper turns SeatAlreadyTaken into a 409 Conflict response.'],
  [15, 'Response filters also run for handled exceptions, so the filter sets c41e on the 409.'],
  [17.5, 'Each caller gets its own id back. The same filter echoed it on the 200 and on the 409.'],
];

const FILTER_CODE: readonly (readonly [indent: number, code: string])[] = [
  [0, '@ServerResponseFilter'],
  [0, 'public void echo(ContainerRequestContext request, ContainerResponseContext response) {'],
  [1, 'String id = request.getHeaderString("X-Correlation-Id");'],
  [1, 'if (id != null) response.getHeaders().putSingle("X-Correlation-Id", id);'],
  [0, '}'],
];
// The lines that copy the header, outlined while the filter copies it.
const COPY_LINES: Interval = [2, 3];

const TITLE = 'Echo headers on the response';
const SUBTITLE =
  'A response filter copies X-Correlation-Id onto the response, whether checkout() returned it or an exception mapper built it.';
const DESC =
  'Two checkout requests run one after the other. Request A sends X-Correlation-Id 7f3a, and checkout() returns a TicketResult. ' +
  'Before the 200 OK is written, a response filter reads X-Correlation-Id from the request and sets the same value on the response. ' +
  'Request B sends X-Correlation-Id c41e, and checkout() throws SeatAlreadyTaken. ' +
  'An exception mapper turns it into 409 Conflict, and the same response filter sets c41e on that response. ' +
  'Each caller gets back the id it sent.';

const COLUMNS: Readonly<Record<Column, { readonly x: number; readonly w: number }>> = {
  caller: { x: 24, w: 200 },
  filter: { x: 256, w: 200 },
  mapper: { x: 488, w: 200 },
  endpoint: { x: 720, w: 216 },
};
type Heading = {
  readonly title: string;
  readonly titleFace: string;
  readonly note: string;
  readonly noteFace: string;
};
const HEADINGS: Readonly<Record<Column, Heading>> = {
  caller: {
    title: 'caller',
    titleFace: 'font-sans',
    note: 'box office app',
    noteFace: 'font-sans',
  },
  filter: {
    title: 'response filter',
    titleFace: 'font-sans',
    note: '@ServerResponseFilter',
    noteFace: 'font-mono',
  },
  mapper: {
    title: 'exception mapper',
    titleFace: 'font-sans',
    note: '@ServerExceptionMapper',
    noteFace: 'font-mono',
  },
  endpoint: {
    title: 'checkout()',
    titleFace: 'font-mono',
    note: 'POST /checkout',
    noteFace: 'font-mono',
  },
};
const HEAD = { y: 80, h: 56 };
// Offsets from a lane's call line.
const BACK = 40;
const BAND = { top: 20, h: 68 };
const CARD = { top: -40, h: 132 };
const STATUS = 106;
// An answer is its status pill with the echoed header chip below it, CHIP wide.
const CHIP = 176;
const EXCEPTION_W = 140;
const CODE = { x: 24, y: 488, w: 912, line: 19, indent: 32, char: 7.2 };
const CAPTION = { y: 624, h: 38 };

const mid = (column: Column): number => COLUMNS[column].x + COLUMNS[column].w / 2;
const inset = (column: Column): number => COLUMNS[column].x + 12;
// Where a moving thing of this width waits in a column: centred, or docked in the caller's card.
const slot = (column: Column, width: number): number =>
  column === 'caller' ? inset('caller') : mid(column) - width / 2;

const rect = (x: number, y: number, w: number, h: number, cls: string, rx = 6): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const text = (x: number, y: number, content: string, cls: string): string =>
  `<text x="${x}" y="${y}" class="${cls}">${escapeXml(content)}</text>`;

const hooks = (role: string, request: Request): string =>
  ` data-role="${role}" data-request="${request.id}"`;

function during(intervals: readonly Interval[], content: string, data = ''): string {
  const always = intervals.length === 1 && intervals[0]![0] <= 0 && intervals[0]![1] >= LOOP;
  return always
    ? `<g${data}>${content}</g>`
    : `<g opacity="0"${data}>${show(intervals, LOOP)}${content}</g>`;
}

function arrow(from: number, to: number, y: number, extra = ''): string {
  const base = from < to ? to - 8 : to + 8;
  return `<line x1="${from}" y1="${y}" x2="${base}" y2="${y}" class="la-arrow"${extra}/><polygon points="${to},${y} ${base},${y - 4} ${base},${y + 4}" class="fill-flow"/>`;
}

const status = (column: Column, lane: number, content: string, cls: string): string =>
  text(mid(column), lane + STATUS, content, `font-sans text-offset ${cls} anchor-middle`);

const band = (column: Column, lane: number, cls: string): string =>
  rect(COLUMNS[column].x + 8, lane + BAND.top, COLUMNS[column].w - 16, BAND.h, cls, 8);

const endpointBand = (lane: number, cls: string): string =>
  rect(COLUMNS.endpoint.x + 8, lane - 24, COLUMNS.endpoint.w - 16, 24 + BAND.top + BAND.h, cls, 8);

const startOf = (route: readonly Stop[]): number => route[0]![0];
const endOf = (route: readonly Stop[]): number => route[route.length - 1]![0];

// Holds still before the first stop and after the last, so the motion spans the loop.
function waypoints(route: readonly Stop[], y: number, width: number): Waypoint[] {
  const points = route.map(([t, column]): Waypoint => [t, slot(column, width), y]);
  const [, startX] = points[0]!;
  const [, endX] = points[points.length - 1]!;
  return [
    ...(startOf(route) > 0 ? [[0, startX, y] as const] : []),
    ...points,
    ...(endOf(route) < LOOP ? [[LOOP, endX, y] as const] : []),
  ];
}

function moving(route: readonly Stop[], y: number, width: number, content: string): string {
  const points = waypoints(route, y, width);
  const [, x] = points[0]!;
  return `<g transform="translate(${x},${y})">${move(points, LOOP)}${content}</g>`;
}

function heading(column: Column): string {
  const { title, titleFace, note, noteFace } = HEADINGS[column];
  return [
    rect(COLUMNS[column].x, HEAD.y, COLUMNS[column].w, HEAD.h, 'la-canvas', 10),
    text(
      mid(column),
      HEAD.y + 23,
      title,
      `${titleFace} text-label font-semibold fill-ink anchor-middle`,
    ),
    text(mid(column), HEAD.y + 43, note, `${noteFace} text-offset fill-ink-muted anchor-middle`),
  ].join('\n');
}

function lines(r: Request): string {
  const callerEdge = COLUMNS.caller.x + COLUMNS.caller.w;
  const endpointEdge = COLUMNS.endpoint.x + 8;
  return during(
    [[r.arrive, LOOP]],
    [
      arrow(callerEdge, endpointEdge, r.lane),
      arrow(endpointEdge, callerEdge, r.lane + BACK, ' stroke-dasharray="6 4"'),
    ].join('\n'),
  );
}

function endpointStation(r: Request): string {
  const { lane, hold, thrown } = r;
  const outcome = thrown
    ? during(
        [[hold[1], LOOP]],
        status('endpoint', lane, `throws ${thrown.exception}`, 'font-semibold fill-red'),
        hooks('endpoint-throw', r),
      )
    : during(
        [[hold[1], LOOP]],
        status('endpoint', lane, 'returns TicketResult', 'fill-emerald'),
        hooks('endpoint-return', r),
      );
  return [
    endpointBand(lane, 'fill-stage stroke-grid'),
    during(
      [hold],
      endpointBand(lane, 'fill-none stroke-amber stroke-1.5'),
      hooks('endpoint-run', r),
    ),
    during([hold], status('endpoint', lane, 'holding seats', 'fill-ink-muted')),
    outcome,
  ].join('\n');
}

function mapperStation(r: Request): string {
  const { lane, thrown } = r;
  const idle = band('mapper', lane, 'fill-stage stroke-grid');
  if (!thrown) {
    return [
      idle,
      during(
        [[r.hold[1], LOOP]],
        status('mapper', lane, 'not called', 'fill-ink-muted'),
        hooks('mapper-skip', r),
      ),
    ].join('\n');
  }
  return [
    idle,
    during(
      [thrown.mapperRun],
      band('mapper', lane, 'fill-none stroke-amber stroke-1.5'),
      hooks('mapper-run', r),
    ),
    during(
      [[thrown.mapperRun[0], LOOP]],
      status('mapper', lane, `returns ${r.answer.text}`, 'fill-ink'),
    ),
  ].join('\n');
}

function filterStation(r: Request): string {
  const { lane, copy } = r;
  return [
    band('filter', lane, 'fill-stage stroke-grid'),
    during(
      [r.filterRun],
      band('filter', lane, 'fill-none stroke-amber stroke-1.5'),
      hooks('filter-run', r),
    ),
    during([copy], status('filter', lane, `copies ${HEADER}`, 'font-semibold fill-amber')),
    during(
      [[copy[1], LOOP]],
      status('filter', lane, `echoed ${r.correlationId}`, `font-semibold fill-${r.tint}`),
    ),
  ].join('\n');
}

function callerCard(r: Request): string {
  const { lane, answer } = r;
  const { x, w } = COLUMNS.caller;
  const chipX = inset('caller');
  // Rings around the header the caller sent and the one it got back.
  const ring = (cls: string): string => rect(chipX - 3, lane - 15, CHIP + 6, 30, cls);
  const echoRing = rect(chipX - 3, lane + BACK + 13, CHIP + 6, 30, 'la-read-marker');
  return during(
    [[r.arrive, LOOP]],
    [
      rect(x, lane + CARD.top, w, CARD.h, `fill-surface stroke-${r.tint} stroke-1.5`, 10),
      text(
        chipX,
        lane - 20,
        `Request ${r.id}`,
        `font-sans text-label font-semibold fill-${r.tint}`,
      ),
      text(
        x + w - 12,
        lane - 20,
        'POST /checkout',
        'font-mono text-offset fill-ink-muted anchor-end',
      ),
      `<g${hooks('sent', r)}>${rect(chipX, lane - 12, CHIP, 24, 'la-cell', 4)}${text(chipX + 10, lane + 4, `${HEADER}: ${r.correlationId}`, 'la-offset')}</g>`,
      during([r.copy], ring('fill-none stroke-amber stroke-1.5'), hooks('header-read', r)),
      during(
        [[endOf(answer.route), LOOP]],
        text(
          chipX + answer.width + 8,
          lane + BACK + 4,
          'received',
          'font-sans text-offset fill-ink-muted',
        ),
        hooks('received', r),
      ),
      during(
        [SAME_ID],
        ring('la-read-marker') +
          echoRing +
          status('caller', lane, 'same id back', 'font-semibold fill-emerald'),
        hooks('same-id', r),
      ),
    ].join('\n'),
    hooks('request', r),
  );
}

function packet(r: Request): string {
  const { lane, send } = r;
  const from = COLUMNS.caller.x + COLUMNS.caller.w + 16;
  const to = COLUMNS.endpoint.x + 24;
  const points: Waypoint[] = [
    [0, from, lane],
    [send[0], from, lane],
    [send[1], to, lane],
    [LOOP, to, lane],
  ];
  return during(
    [[r.arrive, r.hold[1]]],
    `<g transform="translate(${from},${lane})">${move(points, LOOP)}<circle r="11" class="fill-${r.tint} stroke-stage stroke-1.5"/>${text(0, 4, r.id, 'font-sans text-offset font-bold fill-surface anchor-middle')}</g>`,
    hooks('packet', r),
  );
}

function exception(r: Request, thrown: Thrown): string {
  return during(
    [[startOf(thrown.route), endOf(thrown.route)]],
    moving(
      thrown.route,
      r.lane + BACK,
      EXCEPTION_W,
      rect(0, -12, EXCEPTION_W, 24, 'fill-surface stroke-red stroke-1.5', 4) +
        text(
          EXCEPTION_W / 2,
          4,
          thrown.exception,
          'font-mono text-offset font-semibold fill-red anchor-middle',
        ),
    ),
    hooks('exception', r),
  );
}

function response(r: Request): string {
  const { answer, copy } = r;
  const chip = (cls: string, ink: string): string =>
    rect(0, 16, CHIP, 24, cls, 4) + text(10, 32, `${HEADER}: ${r.correlationId}`, ink);
  return during(
    [[startOf(answer.route), LOOP]],
    moving(
      answer.route,
      r.lane + BACK,
      CHIP,
      [
        rect(0, -12, answer.width, 24, answer.pill, 12),
        text(
          answer.width / 2,
          4,
          answer.text,
          'font-sans text-offset font-bold fill-surface anchor-middle',
        ),
        during([copy], chip('la-cell-new', 'la-offset'), hooks('echo-writing', r)),
        during(
          [[copy[1], LOOP]],
          chip('la-cell', `font-mono text-offset fill-${r.tint}`),
          hooks('echo', r),
        ),
      ].join(''),
    ),
    `${hooks('response', r)} data-status="${answer.status}"`,
  );
}

function filterCode(): string {
  const height = 28 + CODE.line * (FILTER_CODE.length - 1) + 18;
  const lineY = (i: number): number => CODE.y + 28 + i * CODE.line;
  const left = (indent: number): number => CODE.x + 20 + indent * CODE.indent;
  const [from, to] = COPY_LINES;
  const copied = FILTER_CODE.slice(from, to + 1);
  const right = Math.max(
    ...copied.map(([indent, code]) => Math.round(left(indent) + code.length * CODE.char)),
  );
  return [
    `<g data-role="filter-code">${rect(CODE.x, CODE.y, CODE.w, height, 'la-card', 10)}`,
    ...FILTER_CODE.map(([indent, code], i) =>
      text(left(indent), lineY(i), code, 'font-mono text-offset fill-ink'),
    ),
    '</g>',
    during(
      REQUESTS.map((r) => r.copy),
      rect(
        CODE.x + 10,
        lineY(from) - 15,
        right - CODE.x,
        lineY(to) - lineY(from) + 22,
        'fill-none stroke-amber stroke-1.5',
      ),
      ' data-role="code-copy"',
    ),
  ].join('\n');
}

function captions(): string[] {
  return CAPTIONS.map(([at, caption], i) => {
    const until = CAPTIONS[i + 1]?.[0] ?? LOOP;
    return `<text x="${W / 2}" y="${CAPTION.y + 24}" class="font-sans text-label fill-ink anchor-middle" opacity="0" data-role="caption">${show([[at, until]], LOOP)}${escapeXml(caption)}</text>`;
  });
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc" data-loop="${LOOP}s">`,
    `<title id="title">${escapeXml(TITLE)}</title>`,
    `<desc id="desc">${escapeXml(DESC)}</desc>`,
    '<style>\n/* LA-STYLE:START */\n/* LA-STYLE:END */\n</style>',
    rect(0, 0, W, H, 'fill-stage', 0),
    text(28, 40, TITLE, 'la-title'),
    text(28, 62, SUBTITLE, 'la-note'),
    ...(Object.keys(COLUMNS) as Column[]).map(heading),
    ...REQUESTS.flatMap((r) => [
      lines(r),
      endpointStation(r),
      mapperStation(r),
      filterStation(r),
      callerCard(r),
    ]),
    filterCode(),
    ...REQUESTS.flatMap((r) => [
      packet(r),
      ...(r.thrown ? [exception(r, r.thrown)] : []),
      response(r),
    ]),
    rect(24, CAPTION.y, W - 48, CAPTION.h, 'la-canvas', 8),
    ...captions(),
    text(
      28,
      H - 16,
      'Source: quarkus.io/guides/rest (request or response filters).',
      'font-sans text-offset fill-ink-muted',
    ),
    '</svg>',
  ].join('\n');
  return `${embedBlock(svg, canonicalStyleBlock())}\n`;
}
