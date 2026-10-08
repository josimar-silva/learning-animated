// Writes propagate-outbound-headers.svg through `just gen`. One story table drives every timing.
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

const LOOP = 20;
const W = 960;
const H = 532;

const HEADERS = ['X-Correlation-Id', 'X-Box-Office'] as const;
type Header = (typeof HEADERS)[number];

type Request = {
  readonly id: string;
  readonly lane: number;
  readonly tint: 'sky' | 'pink';
  // What the request filter stored in this request's duplicated context when it arrived.
  readonly stored: Readonly<Record<Header, string>>;
  // checkout() calls charge(), and the call reaches PaymentClient when the factory starts.
  readonly call: number;
  readonly factory: Interval;
  // The call leaves when the factory ends and reaches the payment provider here.
  readonly received: number;
};

const REQUESTS: readonly Request[] = [
  {
    id: 'A',
    lane: 170,
    tint: 'sky',
    stored: { 'X-Correlation-Id': '7f3a', 'X-Box-Office': 'web' },
    call: 1.5,
    factory: [3, 5.5],
    received: 6.5,
  },
  {
    id: 'B',
    lane: 320,
    tint: 'pink',
    stored: { 'X-Correlation-Id': 'c41e', 'X-Box-Office': 'kiosk' },
    call: 8.5,
    factory: [10, 12.5],
    received: 13.5,
  },
];

const CAPTIONS: readonly (readonly [at: number, text: string])[] = [
  [
    0,
    "Requests A and B are in checkout(). Each one's duplicated context already holds its headers.",
  ],
  [
    1.5,
    "A's checkout() calls charge() on PaymentClient, the REST client for the payment provider.",
  ],
  [3, "Before the call leaves, the client runs its ClientHeadersFactory, which reads A's context."],
  [
    5.5,
    'update() returns 7f3a and web as headers, and POST /charges carries them to the provider.',
  ],
  [8.5, "B's checkout() calls charge() while the provider is still handling A's call."],
  [10, "The same factory runs for B's call, reads B's context, and returns c41e and kiosk."],
  [12.5, "B's call leaves with c41e and kiosk, and A's call still carries 7f3a and web."],
  [
    16,
    'One factory serves both calls, but each call carries the headers of the request that made it.',
  ],
];

// Columns, left to right. checkout(), the client, and the provider each span every lane.
const CHECKOUT = { x: 24, w: 160 };
const CONTEXT = { x: 218, w: 232 };
const CLIENT = { x: 486, w: 204 };
const PROVIDER = { x: 722, w: 214 };
const BOX = { y: 84, h: 356 };
const BAND = { top: -30, h: 134 };
const SLOT = { x: CONTEXT.x + 146, w: 76 };
// The arrival flash on the provider's headers.
const FLASH = 1.5;

const inner = (column: { x: number; w: number }): { x: number; w: number } => ({
  x: column.x + 10,
  w: column.w - 20,
});
const DOT = {
  checkout: inner(CHECKOUT).x + 22,
  client: inner(CLIENT).x + 22,
  provider: inner(PROVIDER).x + 22,
};

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

const band = (column: { x: number; w: number }, lane: number, cls: string): string => {
  const { x, w } = inner(column);
  return rect(x, lane + BAND.top, w, BAND.h, cls, 8);
};

const rowY = (lane: number, i: number): number => lane + 43 + 28 * i;

function checkoutRun(r: Request): string {
  const { lane } = r;
  const { x } = inner(CHECKOUT);
  const charge = (cls: string): string =>
    text(x + 10, lane + 52, 'payments.charge()', `font-mono text-offset ${cls}`);
  const factoryStart = r.factory[0];
  return [
    band(CHECKOUT, lane, 'fill-stage stroke-grid'),
    band(CHECKOUT, lane, 'fill-none stroke-amber stroke-1.5'),
    `<circle cx="${DOT.checkout}" cy="${lane}" r="11" class="fill-${r.tint} stroke-stage stroke-1.5"/>`,
    text(
      DOT.checkout,
      lane + 4,
      r.id,
      'font-sans text-offset font-bold fill-surface anchor-middle',
    ),
    during(
      [[0, r.call]],
      text(x + 42, lane + 4, 'holding seats', 'font-sans text-offset fill-ink-muted'),
    ),
    // Shown once the call has left the band, so the moving call never covers it.
    during(
      [[r.call + 0.5, LOOP]],
      text(x + 42, lane + 4, 'awaits charge()', 'font-sans text-offset fill-ink-muted'),
    ),
    during(complement([[r.call, factoryStart]], LOOP), charge('fill-ink-muted')),
    during([[r.call, factoryStart]], charge('fill-amber'), hooks('call', r)),
  ].join('\n');
}

function context(r: Request): string {
  const { lane } = r;
  const rows = HEADERS.map((header, i) => {
    const y = rowY(lane, i);
    return [
      text(CONTEXT.x + 12, y + 15, header, 'font-mono text-offset fill-ink-muted'),
      `<g${hooks('stored', r, header)}>${rect(SLOT.x, y, SLOT.w, 22, 'la-cell', 4)}${text(SLOT.x + SLOT.w / 2, y + 15, r.stored[header], `font-mono text-offset fill-${r.tint} anchor-middle`)}</g>`,
      during(
        [r.factory],
        rect(SLOT.x - 3, y - 3, SLOT.w + 6, 28, 'la-read-marker'),
        hooks('read-marker', r, header),
      ),
    ].join('\n');
  });
  return `<g${hooks('context', r)}>${[
    rect(CONTEXT.x, lane + 16, CONTEXT.w, 88, 'la-card', 8),
    text(
      CONTEXT.x + 12,
      lane + 34,
      `duplicated context of ${r.id}`,
      `font-sans text-offset font-semibold fill-${r.tint}`,
    ),
    ...rows,
  ].join('\n')}</g>`;
}

function clientRun(r: Request): string {
  const { lane } = r;
  const { x } = inner(CLIENT);
  const line = (y: number, content: string, cls: string): string =>
    text(x + 10, y, content, `font-mono text-offset ${cls}`);
  const sent = `sent ${r.stored['X-Correlation-Id']}, ${r.stored['X-Box-Office']}`;
  return [
    band(CLIENT, lane, 'fill-stage stroke-grid'),
    during(
      [r.factory],
      band(CLIENT, lane, 'fill-none stroke-amber stroke-1.5'),
      hooks('client-run', r),
    ),
    during(
      [r.factory],
      text(x + 42, lane + 4, 'runs the factory', 'font-sans text-offset fill-ink'),
    ),
    // The call has left the band by then, so the line starts where its marker stood.
    during(
      [[r.received, LOOP]],
      text(x + 10, lane + 4, sent, `font-sans text-offset font-semibold fill-${r.tint}`),
      hooks('outgoing', r),
    ),
    during(complement([r.factory], LOOP), line(lane + 30, 'update()', 'fill-ink-muted')),
    during([r.factory], line(lane + 30, 'update()', 'fill-amber'), hooks('factory-run', r)),
    during(complement([r.factory], LOOP), line(lane + 52, 'ContextLocals.get', 'fill-ink-muted')),
    during([r.factory], line(lane + 52, 'ContextLocals.get', 'fill-emerald')),
  ].join('\n');
}

function providerRun(r: Request): string {
  const { lane } = r;
  const { x } = inner(PROVIDER);
  const chips = HEADERS.map((header, i) => {
    const y = rowY(lane, i);
    return `<g${hooks('header', r, header)}>${[
      rect(x + 6, y, 182, 22, 'la-cell', 4),
      during([[r.received, r.received + FLASH]], rect(x + 6, y, 182, 22, 'la-cell-new', 4)),
      text(x + 16, y + 15, `${header}: ${r.stored[header]}`, 'la-offset'),
    ].join('')}</g>`;
  });
  return [
    band(PROVIDER, lane, 'fill-stage stroke-grid'),
    during(
      [[r.received, LOOP]],
      [
        band(PROVIDER, lane, 'fill-none stroke-amber stroke-1.5'),
        text(x + 42, lane + 4, 'POST /charges', 'font-mono text-offset fill-ink'),
        ...chips,
      ].join('\n'),
      hooks('received', r),
    ),
  ].join('\n');
}

function arrows(r: Request): string {
  const { lane } = r;
  const y = lane + 68;
  return [
    arrow(CHECKOUT.x + CHECKOUT.w, CLIENT.x, lane, 'la-arrow', 'fill-flow'),
    arrow(CLIENT.x + CLIENT.w, PROVIDER.x, lane, 'la-arrow', 'fill-flow'),
    arrow(CONTEXT.x + CONTEXT.w, inner(CLIENT).x, y, 'la-arrow', 'fill-flow'),
    during(
      [r.factory],
      arrow(
        CONTEXT.x + CONTEXT.w,
        inner(CLIENT).x,
        y,
        'fill-none stroke-emerald stroke-2.5',
        'fill-emerald',
      ),
      hooks('get-arrow', r),
    ),
  ].join('\n');
}

// The outbound call: an outlined marker in the request's tint, apart from the filled request marker.
function packet(r: Request): string {
  const { lane } = r;
  const [start, end] = r.factory;
  const points: Waypoint[] = [
    [0, DOT.checkout, lane],
    [r.call, DOT.checkout, lane],
    [start, DOT.client, lane],
    [end, DOT.client, lane],
    [r.received, DOT.provider, lane],
    [LOOP, DOT.provider, lane],
  ];
  return during(
    [[r.call, LOOP]],
    `<g transform="translate(${DOT.checkout},${lane})">${move(points, LOOP)}<circle r="11" class="fill-surface stroke-${r.tint} stroke-1.5"/>${text(0, 4, r.id, `font-sans text-offset font-bold fill-${r.tint} anchor-middle`)}</g>`,
    hooks('packet', r),
  );
}

function captions(): string[] {
  return CAPTIONS.map(([at, caption], i) => {
    const until = CAPTIONS[i + 1]?.[0] ?? LOOP;
    return `<text x="${W / 2}" y="480" class="font-sans text-label fill-ink anchor-middle" opacity="0" data-role="caption">${show([[at, until]], LOOP)}${escapeXml(caption)}</text>`;
  });
}

function column(
  { x, w }: { x: number; w: number },
  title: string,
  titleFace: string,
  subtitle: string,
  subtitleFace: string,
): string {
  const mid = x + w / 2;
  return [
    rect(x, BOX.y, w, BOX.h, 'la-canvas', 10),
    text(mid, 106, title, `${titleFace} text-label font-semibold fill-ink anchor-middle`),
    text(mid, 124, subtitle, `${subtitleFace} text-offset fill-ink-muted anchor-middle`),
  ].join('\n');
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc" data-loop="${LOOP}s">`,
    '<title id="title">Propagate headers on outbound calls</title>',
    `<desc id="desc">${escapeXml(
      "Two checkout requests, A and B, are in flight at once, and each one's duplicated context holds its X-Correlation-Id and X-Box-Office values. When checkout() calls the payment provider through the PaymentClient REST client, the client's ClientHeadersFactory reads the values from the context of the request that made the call and puts them on POST /charges as headers. A's call reaches the provider with 7f3a and web, and B's call with c41e and kiosk.",
    )}</desc>`,
    '<style>\n/* LA-STYLE:START */\n/* LA-STYLE:END */\n</style>',
    rect(0, 0, W, H, 'fill-stage', 0),
    text(28, 40, 'Propagate headers on outbound calls', 'la-title'),
    text(
      28,
      62,
      "A ClientHeadersFactory copies the headers in each request's duplicated context onto the calls that request makes.",
      'la-note',
    ),
    column(CHECKOUT, 'checkout()', 'font-mono', 'POST /checkout', 'font-mono'),
    text(CONTEXT.x + CONTEXT.w / 2, 116, 'stored by the request filter', 'la-note anchor-middle'),
    column(CLIENT, 'PaymentClient', 'font-mono', '@RegisterClientHeaders', 'font-mono'),
    column(PROVIDER, 'payment provider', 'font-sans', 'remote service', 'font-sans'),
    ...REQUESTS.flatMap((r) => [
      checkoutRun(r),
      clientRun(r),
      providerRun(r),
      arrows(r),
      context(r),
    ]),
    ...REQUESTS.map(packet),
    rect(24, 456, W - 48, 38, 'la-canvas', 8),
    ...captions(),
    text(
      28,
      516,
      'Sources: quarkus.io/guides/rest-client (custom headers support) and quarkus.io/guides/duplicated-context (context local data).',
      'font-sans text-offset fill-ink-muted',
    ),
    '</svg>',
  ].join('\n');
  return `${embedBlock(svg, canonicalStyleBlock())}\n`;
}
