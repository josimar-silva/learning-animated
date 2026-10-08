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

type Lane = 'response' | 'typed';

// The story, in seconds: Quarkus sets up both endpoints, then three requests arrive. Steps start
// on whole seconds, which a 16 s loop turns into exact keyTimes, so seeking to a step shows its frame.
const LOOP = 16;
const REQUESTS = [3, 6, 9] as const;
const SUMMARY = 12;

const SETUP: Interval = [0.2, 2.9];
const TYPED_LOOKUP: Interval = [1, 2];
const TYPED_FILL: Interval = [1.1, 1.9];
const ATTACH = 2.2;

// Moments inside every request, in seconds after it arrives.
const RUN: Interval = [0, 0.9];
const RETURN = 0.4;
const CARRY: Interval = [0.6, 0.95];
const WRITE: Interval = [0.95, 2.1];
const LOOKUP: Interval = [1, 1.65];
const FILL: Interval = [1.05, 1.55];
const FOUND: Interval = [1.65, 2.5];
const SEND: Interval = [1.65, 1.95];
const ARRIVE = 2;
const RECEIVE: Interval = [1.95, 2.9];
const BODY = 2;
// A hidden chip jumps back to where it starts, so its next trip begins in place.
const RESET = 0.02;

const PHASES: ReadonlyArray<readonly [number, string]> = [
  [0, 'Before the first request'],
  ...REQUESTS.map((start, i) => [start, `Request ${i + 1}`] as const),
  [SUMMARY, 'After 3 requests'],
];

const CAPTIONS: ReadonlyArray<readonly [number, string]> = [
  [
    0,
    "Before the first request, Quarkus sets up each endpoint. Response hides the body's type, so that endpoint gets no writer.",
  ],
  [
    1,
    'TicketResult names the type and @Produces names one media type, so Quarkus picks the JSON writer now.',
  ],
  [
    3,
    'Request 1: both methods return the same tickets, one inside a Response and one as a plain TicketResult.',
  ],
  [
    4,
    'After the method returns, the Response endpoint looks up a writer. The TicketResult endpoint uses the one it has.',
  ],
  [5, 'Both clients get the same 200 OK and the same JSON body.'],
  [
    6,
    'Requests 2 and 3 repeat it. The Response endpoint looks up its writer again each time; the TicketResult endpoint does not.',
  ],
  [
    12,
    'Both sent the same JSON. Response looked up a writer 3 times, once per request; TicketResult once, before any request.',
  ],
];

const JSON_LINES = ['{"order":"A-1042",', '"seats":["F12","F13"]}'] as const;

const during = ([from, to]: Interval): Interval[] =>
  REQUESTS.map((start) => [start + from, start + to]);
const afterEach = (from: number): Interval[] =>
  REQUESTS.map((start, i) => [start + from, REQUESTS[i + 1] ?? LOOP]);
const windowsOf = (entries: ReadonlyArray<readonly [number, string]>): Interval[] =>
  entries.map(([from], i) => [from, entries[i + 1]?.[0] ?? LOOP]);

// Layout. Lane offsets are relative to the lane's top edge.
const BOX_TOP = 76;
const BOX_HEIGHT = 130;
const ROW = BOX_TOP + 102;

type Frame = { readonly x: number; readonly width: number };
const SETUP_BOX: Frame = { x: 48, width: 256 };
const METHOD_BOX: Frame = { x: 336, width: 200 };
const WRITER_BOX: Frame = { x: 568, width: 300 };
const CLIENT_BOX: Frame = { x: 900, width: 332 };

const SLOT = { setup: 176, method: 436, carried: 640, writer: 796, landed: 948 } as const;

type Look = { readonly box: string; readonly ink: string };
const EMPTY: Look = { box: 'la-cell-tail', ink: 'fill-ink-muted' };
const FOUND_WRITER: Look = { box: 'la-cell-new', ink: 'fill-amber' };
const KEPT_WRITER: Look = { box: 'fill-cell stroke-emerald stroke-1.5', ink: 'fill-emerald' };
const PACKET: Look = { box: 'fill-sky', ink: 'fill-surface' };

const BUSY = 'fill-none stroke-sky stroke-2.5';

type LaneSpec = {
  readonly top: number;
  readonly accent: 'amber' | 'emerald';
  readonly title: string;
  readonly code: string;
  readonly setup: readonly [string, string, string];
  readonly method: readonly [string, string];
  readonly writer: readonly [string, string, string];
  readonly writerGlow: string;
  readonly result: string;
  readonly note: string;
};

const LANES: Readonly<Record<Lane, LaneSpec>> = {
  response: {
    top: 96,
    accent: 'amber',
    title: 'Returns Response',
    code: 'Response checkout(Order order) { … return Response.ok(tickets).build(); }',
    setup: ['Return type: Response', "The body's type stays unknown", 'until the method returns.'],
    method: ['wraps the tickets', 'in a Response'],
    writer: ['Look up a writer', 'after the method returns: find', 'and try the matching writers'],
    writerGlow: 'fill-cell-new stroke-amber stroke-2.5',
    result: 'Response',
    note: '(one per request)',
  },
  typed: {
    top: 352,
    accent: 'emerald',
    title: 'Returns TicketResult',
    code: 'TicketResult checkout(Order order) { … return tickets; }',
    setup: [
      'Return type: TicketResult',
      'Known type, one media type,',
      'so Quarkus picks the writer now.',
    ],
    method: ['returns the', 'TicketResult as it is'],
    writer: [
      'Use the attached writer',
      'chosen before the first request,',
      'so there is nothing to look up',
    ],
    writerGlow: 'fill-none stroke-emerald stroke-2.5',
    result: 'TicketResult',
    note: '(before the first request)',
  },
};

const size = (px: number): string => ` font-size="${px}"`;
const tag = (role: string, lane?: Lane): string =>
  ` data-role="${role}"${lane ? ` data-lane="${lane}"` : ''}`;

function text(x: number, y: number, classes: string, content: string, extra = ''): string {
  return `<text x="${x}" y="${y}" class="${classes}"${extra}>${escapeXml(content)}</text>`;
}

function placed(x: number, y: number, body: string, extra = ''): string {
  return `<g transform="translate(${x},${y})"${extra}>${body}</g>`;
}

function chip(label: string, look: Look, width = 112): string {
  return (
    `<rect x="${-width / 2}" y="-14" width="${width}" height="28" rx="14" class="${look.box}"/>` +
    text(0, 4.5, `font-mono text-label font-bold anchor-middle ${look.ink}`, label)
  );
}

// Slides a chip right during each request and snaps it back once it is hidden.
function travel(distance: number, [from, to]: Interval, hidden: number): string {
  const points: Waypoint[] = [[0, 0, 0]];
  for (const start of REQUESTS) {
    points.push(
      [start + from, 0, 0],
      [start + to, distance, 0],
      [start + hidden, distance, 0],
      [start + hidden + RESET, 0, 0],
    );
  }
  points.push([LOOP, 0, 0]);
  return move(points, LOOP);
}

// The bar fills during each lookup and empties, unseen, once that lookup has ended.
function lookupBar(
  lane: Lane,
  x: number,
  y: number,
  lookups: readonly Interval[],
  fills: readonly Interval[],
): string {
  const times = [0];
  const values = [110];
  fills.forEach(([from, to], i) => {
    const end = lookups[i]![1];
    times.push(from, to, end, end + RESET);
    values.push(110, 0, 0, 110);
  });
  times.push(LOOP);
  values.push(110);
  const line = (classes: string, extra = ''): string =>
    `<line x1="-55" y1="0" x2="55" y2="0" class="${classes}" stroke-width="6" stroke-linecap="round"${extra}`;
  return placed(
    x,
    y,
    show(lookups, LOOP) +
      `${line('stroke-grid')}/>` +
      `${line(`stroke-${LANES[lane].accent}`, ' stroke-dasharray="110 110" stroke-dashoffset="110"')}>` +
      `<animate attributeName="stroke-dashoffset" dur="${LOOP}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes(times, LOOP)}" values="${values.join(';')}"/></line>`,
    tag('writer-lookup', lane),
  );
}

function box(
  frame: Frame,
  top: number,
  glows: ReadonlyArray<readonly [string, readonly Interval[]]>,
  [title, ...lines]: readonly string[],
  titleFont = 'font-sans',
): string {
  const y = top + BOX_TOP;
  const rect = (classes: string, animation: string): string =>
    `<rect x="${frame.x}" y="${y}" width="${frame.width}" height="${BOX_HEIGHT}" rx="10" class="${classes}"${animation ? `>${animation}</rect>` : '/>'}`;
  return [
    rect('la-card', ''),
    ...glows.map(([classes, when]) => rect(classes, show(when, LOOP))),
    text(frame.x + 16, y + 27, `${titleFont} font-bold fill-ink`, title ?? '', size(16)),
    ...lines.map((line, i) =>
      text(frame.x + 16, y + 49 + i * 18, 'font-sans fill-ink-muted', line, size(14)),
    ),
  ].join('\n');
}

function counter(lane: Lane, increments: readonly number[], y: number): string {
  const { accent, note } = LANES[lane];
  const bounds = [0, ...increments, LOOP];
  const counts = bounds.slice(0, -1).map((from, count) => {
    const label = `${count}`;
    return `<text x="456" y="${y}" class="font-sans font-bold fill-${accent}"${size(17)}${tag('lookup-count', lane)} data-count="${label}">${show([[from, bounds[count + 1]!]], LOOP)}${label}</text>`;
  });
  const noteShown: Interval[] = lane === 'typed' ? [[TYPED_LOOKUP[1], LOOP]] : [[0, LOOP]];
  return [
    text(336, y, 'font-sans fill-ink-muted', 'Writer lookups:', size(15)),
    ...counts,
    `<g>${show(noteShown, LOOP)}${text(478, y, 'font-sans fill-ink-muted', note, size(15))}</g>`,
  ].join('\n');
}

function setupSlot(id: Lane, row: number): string {
  if (id === 'response') return placed(SLOT.setup, row, chip('no writer', EMPTY));
  return [
    placed(SLOT.setup, row, show([[0, TYPED_LOOKUP[0]]], LOOP) + chip('writer: ?', EMPTY)),
    lookupBar(id, SLOT.setup, row, [TYPED_LOOKUP], [TYPED_FILL]),
    placed(
      SLOT.setup,
      row,
      show([[TYPED_LOOKUP[1], LOOP]], LOOP) + chip('JSON writer', KEPT_WRITER),
    ),
  ].join('\n');
}

function writerSlot(id: Lane, row: number): string {
  if (id === 'response') {
    return [
      placed(
        SLOT.writer,
        row,
        show(complement(during([LOOKUP[0], FOUND[1]]), LOOP), LOOP) + chip('writer: ?', EMPTY),
      ),
      lookupBar(id, SLOT.writer, row, during(LOOKUP), during(FILL)),
      placed(
        SLOT.writer,
        row,
        show(during(FOUND), LOOP) + chip('JSON writer', FOUND_WRITER),
        tag('writer', id),
      ),
    ].join('\n');
  }
  return [
    placed(SLOT.writer, row, show([[0, ATTACH]], LOOP) + chip('writer: ?', EMPTY)),
    placed(
      SLOT.writer,
      row,
      show([[ATTACH, LOOP]], LOOP) + chip('JSON writer', KEPT_WRITER),
      tag('writer', id),
    ),
    placed(
      SLOT.writer,
      row,
      show(during(LOOKUP), LOOP) +
        '<rect x="-62" y="-18" width="124" height="36" rx="18" class="fill-none stroke-emerald stroke-2.5"/>',
    ),
  ].join('\n');
}

// The value the method returns rides to the writer, and the JSON it writes rides to the client.
function inFlight(id: Lane, row: number): string {
  const { accent, result } = LANES[id];
  const returned: Look = { box: `fill-surface stroke-${accent} stroke-1.5`, ink: `fill-${accent}` };
  return [
    placed(
      SLOT.method,
      row,
      `<g${tag('result', id)}>${travel(SLOT.carried - SLOT.method, CARRY, LOOKUP[1])}${show(during([RETURN, LOOKUP[1]]), LOOP)}${chip(result, returned)}</g>`,
    ),
    placed(
      SLOT.writer,
      row,
      `<g${tag('packet', id)}>${travel(SLOT.landed - SLOT.writer, SEND, ARRIVE)}${show(during([SEND[0], ARRIVE]), LOOP)}${chip('JSON', PACKET, 64)}</g>`,
    ),
  ].join('\n');
}

function clientBody(id: Lane, top: number): string {
  const y = top + BOX_TOP + 82;
  return [
    `<g>${show(afterEach(BODY), LOOP)}`,
    text(916, top + BOX_TOP + 49, 'font-sans fill-ink-muted', '200 OK, application/json', size(14)),
    `<text x="916" y="${y}" class="font-mono text-label fill-ink"${tag('json-body', id)}><tspan x="916" y="${y}">${escapeXml(JSON_LINES[0])}</tspan><tspan x="924" y="${y + 18}">${escapeXml(JSON_LINES[1])}</tspan></text>`,
    '</g>',
  ].join('\n');
}

function lane(id: Lane): string {
  const spec = LANES[id];
  const { top } = spec;
  const row = top + ROW;
  const arrow = (x1: number, x2: number): string =>
    `<line x1="${x1}" y1="${row}" x2="${x2}" y2="${row}" class="la-arrow" marker-end="url(#arrowhead)"/>`;
  const column = (x: number, label: string): string =>
    text(
      x,
      top + 62,
      'font-sans font-bold fill-ink-muted',
      label,
      `${size(12)} letter-spacing="1.5"`,
    );
  return [
    `<g${tag('lane', id)}>`,
    `<rect x="24" y="${top}" width="1232" height="244" rx="16" class="la-canvas"/>`,
    `<circle cx="54" cy="${top + 28}" r="7" class="fill-${spec.accent}"/>`,
    text(70, top + 34, 'font-sans font-bold fill-ink', spec.title, size(19)),
    text(300, top + 34, 'font-mono fill-ink-muted', spec.code, size(14)),
    column(48, 'BEFORE THE FIRST REQUEST'),
    column(336, 'EVERY REQUEST'),
    `<line x1="320" y1="${top + 48}" x2="320" y2="${top + 236}" class="stroke-cell-stroke stroke-1.5" stroke-dasharray="4 5"/>`,
    box(SETUP_BOX, top, [[BUSY, [SETUP]]], spec.setup),
    box(METHOD_BOX, top, [[BUSY, during(RUN)]], ['checkout(…)', ...spec.method], 'font-mono'),
    box(WRITER_BOX, top, [[spec.writerGlow, during(WRITE)]], spec.writer),
    box(CLIENT_BOX, top, [[BUSY, during(RECEIVE)]], ['Client']),
    arrow(540, 562),
    arrow(872, 894),
    setupSlot(id, row),
    writerSlot(id, row),
    inFlight(id, row),
    clientBody(id, top),
    counter(
      id,
      id === 'response' ? REQUESTS.map((start) => start + FOUND[0]) : [TYPED_LOOKUP[1]],
      top + 230,
    ),
    '</g>',
  ].join('\n');
}

function phases(): string {
  const windows = windowsOf(PHASES);
  return [
    '<rect x="1016" y="24" width="216" height="36" rx="18" class="la-card"/>',
    ...PHASES.map(
      ([, label], i) =>
        `<g${tag('phase')}>${show([windows[i]!], LOOP)}${text(1124, 47, 'font-sans font-bold anchor-middle fill-ink', label, size(15))}</g>`,
    ),
  ].join('\n');
}

function captions(): string {
  const windows = windowsOf(CAPTIONS);
  return [
    '<rect x="24" y="608" width="1232" height="60" rx="12" class="la-canvas"/>',
    ...CAPTIONS.map(
      ([, caption], i) =>
        `<text x="48" y="644" class="font-sans fill-ink"${size(17)}${tag('caption')}>${show([windows[i]!], LOOP)}${escapeXml(caption)}</text>`,
    ),
  ].join('\n');
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" data-loop="${LOOP}s">`,
    '<title>Response vs a concrete return type</title>',
    '<desc>Two checkout endpoints in Quarkus REST send the same JSON. Before the first request, Quarkus picks a JSON writer for the endpoint that returns TicketResult, and the endpoint that returns Response gets none. Then three requests arrive. On each one, after the method returns, the Response endpoint looks up a writer, while the TicketResult endpoint calls the writer it already has. Both clients get the same 200 OK and the same JSON body every time.</desc>',
    `<style>\n${START}\n${END}\n</style>`,
    '<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="fill-flow"/></marker></defs>',
    '<rect width="1280" height="720" class="fill-stage"/>',
    text(
      40,
      50,
      'font-sans font-bold fill-ink',
      'Response vs TicketResult: when Quarkus picks the body writer',
      size(26),
    ),
    text(
      40,
      78,
      'font-sans fill-ink-muted',
      'Quarkus REST. Both endpoints declare @Produces(MediaType.APPLICATION_JSON) and return the same tickets.',
      size(15),
    ),
    phases(),
    lane('response'),
    lane('typed'),
    captions(),
    text(
      40,
      700,
      'la-note',
      'Not to scale. Sources: quarkus.io/guides/rest (returning a response body; manually setting the response).',
    ),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
