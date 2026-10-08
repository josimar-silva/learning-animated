import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { complement, escapeXml, type Interval, show } from '@learning-animated/svg-kit/author';

const LOOP = 20;
const WIDTH = 960;
const HEIGHT = 520;

type Adapter = 'card' | 'sandbox';
type Outcome = 'unsatisfied' | 'resolvable' | 'ambiguous';

// One start of the application. The lookup checks the conditions for 2 s, then answers until the next start.
type Setup = {
  readonly start: number;
  readonly end: number;
  readonly value: 'unset' | 'card';
  readonly conditions: readonly Adapter[];
  readonly kept: readonly Adapter[];
  readonly outcome: Outcome;
};

const SETUPS: readonly Setup[] = [
  {
    start: 0,
    end: 6.5,
    value: 'unset',
    conditions: ['card', 'sandbox'],
    kept: [],
    outcome: 'unsatisfied',
  },
  {
    start: 6.5,
    end: 13,
    value: 'card',
    conditions: ['card', 'sandbox'],
    kept: ['card'],
    outcome: 'resolvable',
  },
  {
    start: 13,
    end: LOOP,
    value: 'card',
    conditions: ['card'],
    kept: ['card', 'sandbox'],
    outcome: 'ambiguous',
  },
];
const CHECKS_AFTER = 1;
const ANSWERS_AFTER = 3;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    "The application starts without payment.gateway, and the lookup checks each adapter's condition against it.",
  ],
  [
    3,
    'Neither condition holds, so no bean is left: isUnsatisfied() is true and get() throws UnsatisfiedResolutionException.',
  ],
  [6.5, 'Restarted with payment.gateway=card, the lookup checks both conditions again.'],
  [
    9.5,
    "Only CardGateway's condition holds, so one bean is left: isResolvable() is true and get() returns CardGateway.",
  ],
  [
    13,
    'Next, SandboxGateway loses its @LookupIfProperty, so no condition can skip it. The new build starts with card.',
  ],
  [
    16,
    'CardGateway passes too, so two beans are left: isAmbiguous() is true and get() throws AmbiguousResolutionException.',
  ],
];

const ADAPTERS = {
  card: { left: 412, name: 'CardGateway', ink: 'fill-sky' },
  sandbox: { left: 674, name: 'SandboxGateway', ink: 'fill-pink' },
} as const;
const CLASS_TOP = 146;
const CLASS_WIDTH = 246;
const CLASS_HEIGHT = 104;
const VERDICT_Y = 274;
const centreOf = (adapter: Adapter): number => ADAPTERS[adapter].left + CLASS_WIDTH / 2;

type Cell = {
  readonly outcome: Outcome;
  readonly count: string;
  readonly method: string;
  readonly verb: string;
  readonly result: string;
  readonly face: 'font-mono' | 'font-sans';
  readonly ink: string;
};

const CELLS: readonly Cell[] = [
  {
    outcome: 'unsatisfied',
    count: 'no bean left',
    method: 'isUnsatisfied()',
    verb: 'throws',
    result: 'UnsatisfiedResolutionException',
    face: 'font-mono',
    ink: 'fill-red',
  },
  {
    outcome: 'resolvable',
    count: 'one bean left',
    method: 'isResolvable()',
    verb: 'returns',
    result: 'the remaining bean',
    face: 'font-sans',
    ink: 'fill-emerald',
  },
  {
    outcome: 'ambiguous',
    count: 'two beans left',
    method: 'isAmbiguous()',
    verb: 'throws',
    result: 'AmbiguousResolutionException',
    face: 'font-mono',
    ink: 'fill-red',
  },
];
const CELL_TOP = 312;
const CELL_WIDTH = 296;
const CELL_HEIGHT = 100;
const CELL_GAP = 12;
const cellLeft = (i: number): number => 24 + i * (CELL_WIDTH + CELL_GAP);

const TITLE = 'What a lookup answers';
const DESC =
  'Checkout looks up a PaymentGateway through Instance. Two classes implement it, CardGateway and SandboxGateway, and both are beans marked with @LookupIfProperty on payment.gateway. ' +
  'Started without the property, neither condition holds: no bean is left, isUnsatisfied() is true, and get() throws UnsatisfiedResolutionException. ' +
  'Restarted with card, only CardGateway is left, so isResolvable() is true and get() returns it. ' +
  'Then SandboxGateway loses its condition, and with card both beans are left: isAmbiguous() is true, and get() throws AmbiguousResolutionException.';

// Touching intervals become one, so an element shown through two setups never blinks between them.
function merged(intervals: readonly Interval[]): Interval[] {
  const out: [number, number][] = [];
  for (const [start, end] of intervals) {
    const last = out.at(-1);
    if (last && last[1] === start) last[1] = end;
    else out.push([start, end]);
  }
  return out;
}

const where = (keep: (setup: Setup) => boolean): Setup[] => SETUPS.filter(keep);
const whole = (setups: readonly Setup[]): Interval[] =>
  merged(setups.map(({ start, end }): Interval => [start, end]));
const checking = (setups: readonly Setup[]): Interval[] =>
  setups.map(({ start }): Interval => [start + CHECKS_AFTER, start + ANSWERS_AFTER]);
const answering = (setups: readonly Setup[]): Interval[] =>
  merged(setups.map(({ start, end }): Interval => [start + ANSWERS_AFTER, end]));

const indent = (lines: readonly string[]): string[] => lines.map((line) => `  ${line}`);

// A group shown only during the intervals. It starts hidden unless it shows at 0 s.
function timed(
  attributes: string,
  intervals: readonly Interval[],
  body: readonly string[],
): string[] {
  const hidden = intervals.every(([start]) => start > 0);
  return [
    `<g ${attributes}${hidden ? ' opacity="0"' : ''}>`,
    `  ${show(intervals, LOOP)}`,
    ...indent(body),
    '</g>',
  ];
}

const arrow = (from: number, to: number, y: number): string[] => [
  `<line class="la-arrow" x1="${from}" y1="${y}" x2="${to - 8}" y2="${y}"/>`,
  `<polygon class="fill-flow" points="${to},${y} ${to - 8},${y - 4} ${to - 8},${y + 4}"/>`,
];

function checkout(): string[] {
  return [
    '<g data-role="checkout">',
    '  <rect class="fill-stage stroke-grid stroke-1.5" x="24" y="92" width="340" height="96" rx="10"/>',
    '  <g class="font-mono">',
    '    <text class="text-label font-semibold fill-ink" x="40" y="116">CheckoutService</text>',
    `    <text data-role="injection" class="text-offset fill-ink" x="40" y="142">${escapeXml('@Inject Instance<PaymentGateway> gateway;')}</text>`,
    '    <text class="text-offset fill-ink-muted" x="40" y="166">gateway.get().charge(order);</text>',
    '  </g>',
    '</g>',
    ...timed('data-role="call"', answering(SETUPS), [
      '<rect class="fill-none stroke-amber stroke-1.5" x="34" y="153" width="216" height="18" rx="4"/>',
    ]),
  ];
}

function start(): string[] {
  const value = (setup: Setup['value']): Interval[] => whole(where((s) => s.value === setup));
  return [
    '<rect class="fill-stage stroke-grid stroke-1.5" x="24" y="204" width="340" height="92" rx="10"/>',
    ...timed(
      'data-role="start-run"',
      SETUPS.map(({ start: at }): Interval => [at, at + CHECKS_AFTER]),
      [
        '<rect class="fill-none stroke-amber stroke-2.5" x="24" y="204" width="340" height="92" rx="10"/>',
      ],
    ),
    '<text class="font-sans text-label font-semibold fill-ink" x="40" y="228">start</text>',
    '<g class="font-mono text-offset">',
    '  <text class="fill-ink-muted" x="40" y="248">java -jar quarkus-run.jar</text>',
    '  <text class="fill-ink-muted" x="40" y="278">payment.gateway</text>',
    '  <rect class="la-cell-tail" x="160" y="262" width="96" height="24" rx="4"/>',
    ...indent(
      timed('data-role="start-value" data-value="unset"', value('unset'), [
        '<text class="font-sans fill-ink-muted" x="268" y="278">not set</text>',
      ]),
    ),
    ...indent(
      timed('data-role="start-value" data-value="card"', value('card'), [
        '<rect class="la-cell" x="160" y="262" width="96" height="24" rx="4"/>',
        '<text class="fill-sky anchor-middle" x="208" y="278">card</text>',
      ]),
    ),
    '</g>',
  ];
}

function conditionLines(adapter: Adapter): string[] {
  const { left } = ADAPTERS[adapter];
  return [
    `<text class="fill-ink" x="${left + 10}" y="182">@LookupIfProperty(</text>`,
    `<text class="fill-ink" x="${left + 24}" y="198">${escapeXml('name = "payment.gateway",')}</text>`,
    `<text class="fill-ink" x="${left + 24}" y="214">${escapeXml(`stringValue = "${adapter}")`)}</text>`,
  ];
}

function adapterClass(adapter: Adapter): string[] {
  const { left, name, ink } = ADAPTERS[adapter];
  const holds = whole(where((s) => s.conditions.includes(adapter)));
  const [first] = holds;
  const always = holds.length === 1 && first?.[0] === 0 && first[1] === LOOP;
  const condition = always
    ? [
        `<g data-role="condition" data-adapter="${adapter}">`,
        ...indent(conditionLines(adapter)),
        '</g>',
      ]
    : timed(`data-role="condition" data-adapter="${adapter}"`, holds, conditionLines(adapter));
  const missing = complement(holds, LOOP);
  return [
    `<g data-role="class" data-adapter="${adapter}">`,
    `  <rect class="fill-stage stroke-grid stroke-1.5" x="${left}" y="${CLASS_TOP}" width="${CLASS_WIDTH}" height="${CLASS_HEIGHT}" rx="8"/>`,
    `  <text class="fill-ink-muted" x="${left + 10}" y="166">@ApplicationScoped</text>`,
    ...indent(condition),
    ...(missing.length === 0
      ? []
      : indent(
          timed(`data-role="no-condition" data-adapter="${adapter}"`, missing, [
            `<rect class="fill-none stroke-amber stroke-1.5" x="${left + 10}" y="170" width="${CLASS_WIDTH - 20}" height="50" rx="6" stroke-dasharray="5 4"/>`,
            `<text class="font-sans font-semibold fill-amber anchor-middle" x="${centreOf(adapter)}" y="199">no @LookupIfProperty</text>`,
          ]),
        )),
    `  <text class="fill-ink" x="${left + 10}" y="236">class <tspan class="font-semibold ${ink}">${name}</tspan></text>`,
    '</g>',
  ];
}

function check(adapter: Adapter): string[] {
  const { left } = ADAPTERS[adapter];
  return timed(
    `data-role="check" data-adapter="${adapter}"`,
    checking(where((s) => s.conditions.includes(adapter))),
    [
      `<rect class="fill-none stroke-amber stroke-1.5" x="${left + 6}" y="170" width="${CLASS_WIDTH - 12}" height="50" rx="6"/>`,
    ],
  );
}

function verdicts(adapter: Adapter): string[] {
  const { left } = ADAPTERS[adapter];
  const x = centreOf(adapter);
  const kept = where((s) => s.kept.includes(adapter));
  const reason = kept.every((s) => s.conditions.includes(adapter))
    ? 'kept: condition holds'
    : 'kept: no condition';
  return [
    ...timed(`data-role="kept" data-adapter="${adapter}"`, answering(kept), [
      `<rect class="fill-none stroke-amber stroke-2.5" x="${left - 4}" y="${CLASS_TOP - 4}" width="${CLASS_WIDTH + 8}" height="${CLASS_HEIGHT + 8}" rx="10"/>`,
      `<text class="font-sans text-offset font-semibold fill-amber anchor-middle" x="${x}" y="${VERDICT_Y}">${reason}</text>`,
    ]),
    ...timed(
      `data-role="skipped" data-adapter="${adapter}"`,
      answering(where((s) => !s.kept.includes(adapter))),
      [
        `<text class="font-sans text-offset fill-ink-muted anchor-middle" x="${x}" y="${VERDICT_Y}">skipped: condition fails</text>`,
      ],
    ),
  ];
}

function beans(): string[] {
  return [
    '<rect class="la-card" x="396" y="92" width="540" height="204" rx="10"/>',
    '<text class="font-sans text-label font-semibold fill-ink" x="412" y="116">beans in the CDI container</text>',
    '<text class="font-sans text-offset fill-ink-muted" x="412" y="134">Both classes are beans in every setup. The lookup skips any whose condition fails.</text>',
    '<g class="font-mono text-offset">',
    ...indent([...adapterClass('card'), ...adapterClass('sandbox')]),
    '</g>',
    ...check('card'),
    ...check('sandbox'),
    ...verdicts('card'),
    ...verdicts('sandbox'),
  ];
}

function cellBody(cell: Cell, i: number, lit: boolean): string[] {
  const left = cellLeft(i);
  const x = left + CELL_WIDTH / 2;
  const ink = lit ? 'fill-ink' : 'fill-ink-muted';
  const outline = lit ? 'stroke-amber stroke-2.5' : 'stroke-grid stroke-1.5';
  const result = lit ? `${cell.face} font-semibold ${cell.ink}` : `${cell.face} fill-ink-muted`;
  return [
    `<rect class="fill-stage ${outline}" x="${left}" y="${CELL_TOP}" width="${CELL_WIDTH}" height="${CELL_HEIGHT}" rx="10"/>`,
    '<g class="font-sans anchor-middle">',
    `  <text class="text-label font-semibold ${ink}" x="${x}" y="${CELL_TOP + 24}">${cell.count}</text>`,
    `  <text class="text-offset ${ink}" x="${x}" y="${CELL_TOP + 46}"><tspan class="font-mono">${cell.method}</tspan> is true</text>`,
    `  <text class="text-offset ${ink}" x="${x}" y="${CELL_TOP + 68}"><tspan class="font-mono">get()</tspan> ${cell.verb}</text>`,
    `  <text class="text-offset ${result}" x="${x}" y="${CELL_TOP + 88}">${cell.result}</text>`,
    '</g>',
  ];
}

function cell(entry: Cell, i: number): string[] {
  const lit = answering(where((s) => s.outcome === entry.outcome));
  return [
    ...timed(
      `data-role="idle" data-outcome="${entry.outcome}"`,
      complement(lit, LOOP),
      cellBody(entry, i, false),
    ),
    ...timed(`data-role="answer" data-outcome="${entry.outcome}"`, lit, cellBody(entry, i, true)),
  ];
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `<text data-role="caption" x="480" y="451"${at > 0 ? ' opacity="0"' : ''}>${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
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
    '',
    `  <rect class="la-canvas" x="8" y="8" width="${WIDTH - 16}" height="${HEIGHT - 16}" rx="16"/>`,
    `  <text class="la-title" x="32" y="46">${TITLE}</text>`,
    `  <text class="la-note" x="32" y="70">${escapeXml('What Instance<PaymentGateway> answers depends on how many beans pass their lookup conditions.')}</text>`,
    '',
    ...indent(checkout()),
    ...indent(start()),
    ...indent(arrow(364, 396, 140)),
    ...indent(arrow(364, 396, 274)),
    '',
    ...indent(beans()),
    '',
    ...indent(CELLS.flatMap(cell)),
    '',
    '  <rect class="fill-stage stroke-grid stroke-1.5" x="24" y="426" width="912" height="40" rx="8"/>',
    '  <g class="font-sans text-label fill-ink anchor-middle">',
    ...indent(indent(CAPTIONS.map(caption))),
    '  </g>',
    '',
    '  <text class="font-sans text-offset fill-ink-muted" x="32" y="494">Sources: quarkus.io/guides/cdi-reference (choosing beans for programmatic lookup) and the Jakarta CDI 4.1 spec (the Instance interface).</text>',
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
