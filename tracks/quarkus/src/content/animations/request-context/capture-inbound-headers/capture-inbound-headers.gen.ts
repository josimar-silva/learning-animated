// Writes capture-inbound-headers.svg through `just gen`. One story table drives every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import {
  complement,
  escapeXml,
  type Interval,
  move,
  show,
  type Waypoint,
} from '@learning-animated/svg-kit/author';

const LOOP = 18;
const W = 960;
const H = 572;

const HEADERS = ['X-Correlation-Id', 'X-Box-Office'] as const;
type Header = (typeof HEADERS)[number];

type Request = {
  readonly id: string;
  readonly lane: number;
  readonly tint: 'sky' | 'pink';
  readonly sent: Readonly<Record<Header, string>>;
  // The request and its duplicated context exist from here on.
  readonly arrive: number;
  readonly leave: number;
  readonly atFilter: number;
  readonly read: Interval;
  readonly store: Interval;
  readonly atEndpoint: number;
  readonly get: Interval;
};

const REQUESTS: readonly Request[] = [
  {
    id: 'A',
    lane: 196,
    tint: 'sky',
    sent: { 'X-Correlation-Id': '7f3a', 'X-Box-Office': 'web' },
    arrive: 0,
    leave: 1.2,
    atFilter: 1.8,
    read: [1.8, 3.6],
    store: [3.6, 5.2],
    atEndpoint: 6,
    get: [11, 12.6],
  },
  {
    id: 'B',
    lane: 368,
    tint: 'pink',
    sent: { 'X-Correlation-Id': 'c41e', 'X-Box-Office': 'kiosk' },
    arrive: 6,
    leave: 6.6,
    atFilter: 7.2,
    read: [7.2, 8.4],
    store: [8.4, 10],
    atEndpoint: 10.8,
    get: [13.4, 15],
  },
];

const CAPTIONS: readonly (readonly [at: number, text: string])[] = [
  [0, 'Request A arrives at POST /checkout with X-Correlation-Id 7f3a and X-Box-Office web.'],
  [1.8, 'Routing has picked checkout(), but the request filter runs first and reads both headers.'],
  [
    3.6,
    "The filter puts both values in A's duplicated context. Vert.x creates one for every request.",
  ],
  [
    6,
    "Request B arrives while checkout() is still running for A. The same filter reads B's headers.",
  ],
  [8.4, "B's values go into B's own duplicated context. A's context still holds 7f3a and web."],
  [11, "A's checkout() reads its context and gets 7f3a and web, not B's values."],
  [13.4, "B's checkout() reads c41e and kiosk from its own context."],
  [15.6, 'The filter code and the keys are the same, but each request keeps its own values.'],
];

// Columns, left to right. The filter and checkout() are shared code, so each spans every lane.
const CARD = { x: 24, w: 206 };
const FILTER = { x: 262, w: 184 };
const CONTEXT = { x: 490, w: 240 };
const ENDPOINT = { x: 774, w: 162 };
const BOX = { y: 84, h: 396 };
const BAND = { top: -52, h: 156 };
const DOT = { card: 242, filter: 294, endpoint: 804 };
const SLOT = { x: CONTEXT.x + 152, w: 76 };

const rect = (x: number, y: number, w: number, h: number, cls: string, rx = 6): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const text = (x: number, y: number, content: string, cls: string): string =>
  `<text x="${x}" y="${y}" class="${cls}">${escapeXml(content)}</text>`;

const hooks = (role: string, request?: Request, header?: Header): string =>
  ` data-role="${role}"${request ? ` data-request="${request.id}"` : ''}${header ? ` data-header="${header}"` : ''}`;

function during(intervals: readonly Interval[], content: string, data = ''): string {
  const always = intervals.length === 1 && intervals[0]![0] <= 0 && intervals[0]![1] >= LOOP;
  return always
    ? `<g${data}>${content}</g>`
    : `<g opacity="0"${data}>${show(intervals, LOOP)}${content}</g>`;
}

function arrow(from: number, to: number, y: number, line: string, head: string): string {
  return `<line x1="${from}" y1="${y}" x2="${to - 8}" y2="${y}" class="${line}"/><polygon points="${to},${y} ${to - 8},${y - 4} ${to - 8},${y + 4}" class="${head}"/>`;
}

const band = (x: number, w: number, lane: number, cls: string): string =>
  rect(x, lane + BAND.top, w, BAND.h, cls, 8);

function card(r: Request): string {
  const { lane } = r;
  const chips = HEADERS.map((header, i) => {
    const y = lane - 16 + 30 * i;
    return [
      `<g${hooks('header', r, header)}>${rect(CARD.x + 12, y, CARD.w - 24, 24, 'la-cell', 4)}${text(CARD.x + 22, y + 16, `${header}: ${r.sent[header]}`, 'la-offset')}</g>`,
      during(
        [r.read],
        rect(CARD.x + 9, y - 3, CARD.w - 18, 30, 'fill-none stroke-amber stroke-1.5'),
        hooks('header-read', r, header),
      ),
    ].join('\n');
  });
  return during(
    [[r.arrive, LOOP]],
    [
      rect(CARD.x, lane - 52, CARD.w, 104, `fill-surface stroke-${r.tint} stroke-1.5`, 10),
      text(
        CARD.x + 14,
        lane - 28,
        `Request ${r.id}`,
        `font-sans text-label font-semibold fill-${r.tint}`,
      ),
      text(
        CARD.x + CARD.w - 14,
        lane - 28,
        'POST /checkout',
        'font-mono text-offset fill-ink-muted anchor-end',
      ),
      ...chips,
    ].join('\n'),
    hooks('request', r),
  );
}

function filterRun(r: Request): string {
  const { lane } = r;
  const x = FILTER.x + 10;
  const w = FILTER.w - 20;
  const put = (cls: string): string =>
    text(x + w - 10, lane + 52, 'ContextLocals.put', `font-mono text-offset ${cls} anchor-end`);
  return [
    band(x, w, lane, 'fill-stage stroke-grid'),
    during(
      [[r.atFilter, r.store[1]]],
      band(x, w, lane, 'fill-none stroke-amber stroke-1.5'),
      hooks('filter-run', r),
    ),
    during(
      [r.read],
      text(FILTER.x + 52, lane + 4, 'reads both headers', 'font-sans text-offset fill-ink'),
    ),
    during(
      [r.store],
      text(FILTER.x + 52, lane + 4, 'stores the values', 'font-sans text-offset fill-ink'),
    ),
    during(complement([r.store], LOOP), put('fill-ink-muted')),
    during([r.store], put('fill-amber')),
  ].join('\n');
}

function context(r: Request): string {
  const { lane } = r;
  const rows = HEADERS.map((header, i) => {
    const y = lane + 43 + 28 * i;
    const value = (cls: string, valueCls: string): string =>
      rect(SLOT.x, y, SLOT.w, 22, cls, 4) +
      text(SLOT.x + SLOT.w / 2, y + 15, r.sent[header], `${valueCls} anchor-middle`);
    return [
      text(CONTEXT.x + 12, y + 15, header, 'font-mono text-offset fill-ink-muted'),
      rect(SLOT.x, y, SLOT.w, 22, 'la-cell-tail', 4),
      during([r.store], value('la-cell-new', 'la-offset'), hooks('writing', r, header)),
      during(
        [[r.store[1], LOOP]],
        value('la-cell', `font-mono text-offset fill-${r.tint}`),
        hooks('stored', r, header),
      ),
      during(
        [r.get],
        rect(SLOT.x - 3, y - 3, SLOT.w + 6, 28, 'la-read-marker'),
        hooks('read-marker', r, header),
      ),
    ].join('\n');
  });
  return during(
    [[r.arrive, LOOP]],
    [
      rect(CONTEXT.x, lane + 16, CONTEXT.w, 88, 'la-card', 8),
      text(
        CONTEXT.x + 12,
        lane + 34,
        `duplicated context of ${r.id}`,
        `font-sans text-offset font-semibold fill-${r.tint}`,
      ),
      ...rows,
    ].join('\n'),
    hooks('context', r),
  );
}

function endpointRun(r: Request): string {
  const { lane } = r;
  const x = ENDPOINT.x + 10;
  const w = ENDPOINT.w - 20;
  const get = (cls: string): string =>
    text(x + 10, lane + 52, 'ContextLocals.get', `font-mono text-offset ${cls}`);
  const read = `read ${r.sent['X-Correlation-Id']}, ${r.sent['X-Box-Office']}`;
  return [
    band(x, w, lane, 'fill-stage stroke-grid'),
    during(
      [[r.atEndpoint, LOOP]],
      band(x, w, lane, 'fill-none stroke-amber stroke-1.5'),
      hooks('endpoint-run', r),
    ),
    during(
      [[r.atEndpoint, r.get[0]]],
      text(ENDPOINT.x + 48, lane + 4, 'holding seats', 'font-sans text-offset fill-ink-muted'),
    ),
    during(
      [[r.get[0], LOOP]],
      text(ENDPOINT.x + 48, lane + 4, read, `font-sans text-offset font-semibold fill-${r.tint}`),
      hooks('endpoint-read', r),
    ),
    during(complement([r.get], LOOP), get('fill-ink-muted')),
    during([r.get], get('fill-emerald')),
  ].join('\n');
}

function arrows(r: Request): string {
  const { lane } = r;
  const y = lane + 68;
  return [
    during(
      [[r.arrive, LOOP]],
      [
        arrow(CARD.x + CARD.w, FILTER.x, lane, 'la-arrow', 'fill-flow'),
        arrow(FILTER.x + FILTER.w, ENDPOINT.x, lane, 'la-arrow', 'fill-flow'),
        arrow(FILTER.x + FILTER.w - 10, CONTEXT.x, y, 'la-arrow', 'fill-flow'),
        arrow(CONTEXT.x + CONTEXT.w, ENDPOINT.x + 10, y, 'la-arrow', 'fill-flow'),
      ].join('\n'),
    ),
    during(
      [r.store],
      arrow(
        FILTER.x + FILTER.w - 10,
        CONTEXT.x,
        y,
        'fill-none stroke-amber stroke-2.5',
        'fill-amber',
      ),
      hooks('put-arrow', r),
    ),
    during(
      [r.get],
      arrow(
        CONTEXT.x + CONTEXT.w,
        ENDPOINT.x + 10,
        y,
        'fill-none stroke-emerald stroke-2.5',
        'fill-emerald',
      ),
      hooks('get-arrow', r),
    ),
  ].join('\n');
}

function packet(r: Request): string {
  const { lane } = r;
  const points: Waypoint[] = [
    [0, DOT.card, lane],
    [r.leave, DOT.card, lane],
    [r.atFilter, DOT.filter, lane],
    [r.store[1], DOT.filter, lane],
    [r.atEndpoint, DOT.endpoint, lane],
    [LOOP, DOT.endpoint, lane],
  ];
  return during(
    [[r.arrive, LOOP]],
    `<g transform="translate(${DOT.card},${lane})">${move(points, LOOP)}<circle r="11" class="fill-${r.tint} stroke-stage stroke-1.5"/>${text(0, 4, r.id, 'font-sans text-offset font-bold fill-surface anchor-middle')}</g>`,
    hooks('packet', r),
  );
}

function captions(): string[] {
  return CAPTIONS.map(([at, caption], i) => {
    const until = CAPTIONS[i + 1]?.[0] ?? LOOP;
    return `<text x="${W / 2}" y="520" class="font-sans text-label fill-ink anchor-middle" opacity="0" data-role="caption">${show([[at, until]], LOOP)}${escapeXml(caption)}</text>`;
  });
}

export function render(): string {
  const filterMid = FILTER.x + FILTER.w / 2;
  const endpointMid = ENDPOINT.x + ENDPOINT.w / 2;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc" data-loop="${LOOP}s">`,
    '<title id="title">Capture inbound headers</title>',
    `<desc id="desc">${escapeXml(
      "Two checkout requests, A and B, overlap in time. Each carries an X-Correlation-Id and an X-Box-Office header. A request filter reads both headers before checkout() runs and stores the values in that request's own duplicated context, so B's values never land in A's context. When checkout() reads its context, A gets 7f3a and web, and B gets c41e and kiosk.",
    )}</desc>`,
    '<style>\n/* LA-STYLE:START */\n/* LA-STYLE:END */\n</style>',
    rect(0, 0, W, H, 'fill-stage', 0),
    text(28, 40, 'Capture inbound headers', 'la-title'),
    text(
      28,
      62,
      "A request filter puts each request's headers in that request's duplicated context before checkout() runs.",
      'la-note',
    ),
    text(CARD.x + CARD.w / 2, 116, 'inbound requests', 'la-note anchor-middle'),
    text(
      CONTEXT.x + CONTEXT.w / 2,
      116,
      'one duplicated context per request',
      'la-note anchor-middle',
    ),
    rect(FILTER.x, BOX.y, FILTER.w, BOX.h, 'la-canvas', 10),
    text(
      filterMid,
      106,
      'request filter',
      'font-sans text-label font-semibold fill-ink anchor-middle',
    ),
    text(
      filterMid,
      124,
      '@ServerRequestFilter',
      'font-mono text-offset fill-ink-muted anchor-middle',
    ),
    rect(ENDPOINT.x, BOX.y, ENDPOINT.w, BOX.h, 'la-canvas', 10),
    text(
      endpointMid,
      106,
      'checkout()',
      'font-mono text-label font-semibold fill-ink anchor-middle',
    ),
    text(endpointMid, 124, 'POST /checkout', 'font-mono text-offset fill-ink-muted anchor-middle'),
    ...REQUESTS.flatMap((r) => [filterRun(r), endpointRun(r), arrows(r), context(r), card(r)]),
    ...REQUESTS.map(packet),
    rect(24, 496, W - 48, 38, 'la-canvas', 8),
    ...captions(),
    text(
      28,
      556,
      'Sources: quarkus.io/guides/rest (request or response filters) and quarkus.io/guides/duplicated-context (context local data).',
      'font-sans text-offset fill-ink-muted',
    ),
    '</svg>',
  ].join('\n');
  return `${embedBlock(svg, canonicalStyleBlock())}\n`;
}
