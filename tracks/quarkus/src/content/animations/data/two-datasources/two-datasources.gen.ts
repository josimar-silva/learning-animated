// Writes two-datasources.svg through `just gen`. One story table drives every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { complement, escapeXml, type Interval, show } from '@learning-animated/svg-kit/author';

const LOOP = 25;
const W = 960;
const H = 570;

const DATASOURCES = ['inventory', 'accounts'] as const;
type Datasource = (typeof DATASOURCES)[number];
type Attempt = 'read' | 'default' | 'xa';

// One use of an injected datasource: the field is called, its pool lends a connection, and the
// statement runs on its database. Inside a transaction the connection stays out until the end.
type Call = {
  readonly datasource: Datasource;
  readonly attempt: Attempt;
  readonly call: Interval;
  readonly borrow: Interval;
  readonly statement?: { readonly at: Interval; readonly sql: string };
  // Inside a transaction: when the connection joins it, or fails to.
  readonly join?: number;
  readonly fail?: number;
};

const SELL = "UPDATE seats SET state = 'sold'";

const CALLS: readonly Call[] = [
  {
    datasource: 'inventory',
    attempt: 'read',
    call: [3, 4],
    borrow: [3.5, 5.5],
    statement: { at: [4, 5.5], sql: 'SELECT * FROM seats' },
  },
  {
    datasource: 'accounts',
    attempt: 'read',
    call: [6.5, 7.5],
    borrow: [7, 9],
    statement: { at: [7.5, 9], sql: 'SELECT * FROM buyers' },
  },
  {
    datasource: 'inventory',
    attempt: 'default',
    call: [10.5, 11.5],
    borrow: [11, 15.5],
    join: 11,
    statement: { at: [11.5, 12.5], sql: SELL },
  },
  { datasource: 'accounts', attempt: 'default', call: [13.5, 14.5], borrow: [14, 15], fail: 14.5 },
  {
    datasource: 'inventory',
    attempt: 'xa',
    call: [17.5, 18.5],
    borrow: [18, 23],
    join: 18,
    statement: { at: [18.5, 19.5], sql: SELL },
  },
  {
    datasource: 'accounts',
    attempt: 'xa',
    call: [19, 20],
    borrow: [19.5, 23],
    join: 19.5,
    statement: { at: [20, 21], sql: 'INSERT INTO purchases' },
  },
];

// confirm() runs its transaction twice: with the default jdbc.transactions, then with xa on both.
type Transaction = {
  readonly attempt: 'default' | 'xa';
  readonly label: string;
  readonly span: Interval;
  // When its writes are undone or become final.
  readonly end: number;
  readonly outcome: string;
  readonly tint: 'red' | 'emerald';
  readonly prepare?: Interval;
};

const DEFAULT_TX: Transaction = {
  attempt: 'default',
  label: 'one transaction',
  span: [10, 17],
  end: 15.5,
  outcome: 'rolled back',
  tint: 'red',
};
const XA_TX: Transaction = {
  attempt: 'xa',
  label: 'one XA transaction',
  span: [17, LOOP],
  end: 23,
  outcome: 'committed',
  tint: 'emerald',
  prepare: [21.5, 23],
};
const TRANSACTIONS = [DEFAULT_TX, XA_TX] as const;

const CAPTIONS: readonly (readonly [at: number, text: string])[] = [
  [
    0,
    'checkout() injects two named datasources, inventory and accounts. Quarkus starts a separate pool for each one.',
  ],
  [
    3,
    'It reads the held seats through @DataSource("inventory"), on a connection from the inventory pool.',
  ],
  [
    6.5,
    'It reads the buyer through @DataSource("accounts"), on a connection from the accounts pool. No transaction is open.',
  ],
  [
    10,
    'confirm() is @Transactional and writes to both. The inventory connection joins and marks A12 and A13 sold.',
  ],
  [
    13.5,
    'The accounts connection fails to enlist: without XA, a transaction holds one datasource. The seat update rolls back.',
  ],
  [
    17,
    'With jdbc.transactions=xa on both datasources, both connections join the same transaction.',
  ],
  [
    21,
    'The commit has two phases: both databases prepare, then both commit, so the seats and the purchase are saved together.',
  ],
];

// A row of a table: what it holds, and what the writes put in it.
type Row = {
  readonly table?: string;
  readonly cells?: readonly [left: string, right: string];
  readonly written?: readonly [left: string, right: string];
  readonly read?: boolean;
};

const TABLES: Readonly<Record<Datasource, readonly Row[]>> = {
  inventory: [
    { table: 'seats', cells: ['A12', 'held'], written: ['A12', 'sold'], read: true },
    { cells: ['A13', 'held'], written: ['A13', 'sold'], read: true },
  ],
  accounts: [
    { table: 'buyers', cells: ['4012', 'fan@example.com'], read: true },
    { table: 'purchases', written: ['4012', 'A12, A13'] },
  ],
};

const POOL_SIZE: Readonly<Record<Datasource, number>> = { inventory: 5, accounts: 3 };

// Each datasource owns a column: its field in the endpoint, its pool, and its database.
const COLUMN: Readonly<Record<Datasource, { x: number; w: number; cx: number }>> = {
  inventory: { x: 24, w: 444, cx: 246 },
  accounts: { x: 492, w: 444, cx: 714 },
};
const ENDPOINT = { y: 84, h: 80, field: 148 };
const BAR = { y: 176, h: 44, text: 202 };
const SLOT = { y: 186, w: 140, h: 24 };
const POOL = { y: 236, h: 116 };
const CELL = { y: 247, w: 26, h: 22, gap: 6 };
const DB = { y: 376, h: 100, title: 400 };
const ROW = { w: 180, h: 22, top: 414, step: 30 };

const rect = (x: number, y: number, w: number, h: number, cls: string, rx = 6): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const text = (x: number, y: number, content: string, cls: string): string =>
  `<text x="${x}" y="${y}" class="${cls}">${escapeXml(content)}</text>`;

const hooks = (role: string, datasource?: Datasource, attempt?: Attempt): string =>
  ` data-role="${role}"${datasource ? ` data-datasource="${datasource}"` : ''}${attempt ? ` data-attempt="${attempt}"` : ''}`;

function during(intervals: readonly Interval[], content: string, data = ''): string {
  return `<g opacity="0"${data}>${show(intervals, LOOP)}${content}</g>`;
}

function down(x: number, from: number, to: number, line: string, head: string): string {
  return `<line x1="${x}" y1="${from}" x2="${x}" y2="${to - 8}" class="${line}"/><polygon points="${x},${to} ${x - 4},${to - 8} ${x + 4},${to - 8}" class="${head}"/>`;
}

const callsOf = (datasource: Datasource): Call[] =>
  CALLS.filter((c) => c.datasource === datasource);

const statementsOf = (calls: readonly Call[]): Interval[] =>
  calls.flatMap((c) => (c.statement ? [c.statement.at] : []));

const transactionOf = (call: Call): Transaction | undefined =>
  TRANSACTIONS.find((tx) => tx.attempt === call.attempt);

function endpoint(): string {
  const field = (datasource: Datasource): string => {
    const calls = callsOf(datasource).map((c) => c.call);
    const line = `@Inject @DataSource("${datasource}") AgroalDataSource ${datasource}`;
    const at = (cls: string): string =>
      text(
        COLUMN[datasource].cx,
        ENDPOINT.field,
        line,
        `font-mono text-offset ${cls} anchor-middle`,
      );
    return [
      during(complement(calls, LOOP), at('fill-ink'), hooks('field', datasource)),
      during(calls, at('fill-amber'), hooks('field-active', datasource)),
    ].join('\n');
  };
  return [
    rect(24, ENDPOINT.y, W - 48, ENDPOINT.h, 'la-canvas', 10),
    `<g${hooks('request')} data-request="A"><circle cx="48" cy="110" r="11" class="fill-sky stroke-stage stroke-1.5"/>${text(48, 114, 'A', 'font-sans text-offset font-bold fill-surface anchor-middle')}</g>`,
    text(68, 115, 'POST /checkout', 'font-mono text-label font-semibold fill-ink'),
    text(
      196,
      115,
      'checkout() reads the seats and the buyer, then confirm() writes to both',
      'font-sans text-offset fill-ink-muted',
    ),
    ...DATASOURCES.map(field),
  ].join('\n');
}

// The connection's path: endpoint to pool, then pool to database.
function connectors(datasource: Datasource): string {
  const { cx } = COLUMN[datasource];
  const calls = callsOf(datasource);
  const top = ENDPOINT.y + ENDPOINT.h;
  const poolBottom = POOL.y + POOL.h;
  return [
    down(cx, top, POOL.y, 'la-arrow', 'fill-flow'),
    during(
      calls.map((c) => c.borrow),
      down(cx, top, POOL.y, 'fill-none stroke-amber stroke-2.5', 'fill-amber'),
    ),
    down(cx, poolBottom, DB.y, 'la-arrow', 'fill-flow'),
    during(
      statementsOf(calls),
      down(cx, poolBottom, DB.y, 'fill-none stroke-amber stroke-2.5', 'fill-amber'),
    ),
  ].join('\n');
}

function pool(datasource: Datasource): string {
  const { x, w, cx } = COLUMN[datasource];
  const size = POOL_SIZE[datasource];
  const left = cx - (size * CELL.w + (size - 1) * CELL.gap) / 2;
  const cellX = (i: number): number => left + i * (CELL.w + CELL.gap);
  const key = `quarkus.datasource.${datasource}`;
  const config = (y: number, line: string, tint: string): string =>
    text(cx, y, line, `font-mono text-offset ${tint} anchor-middle`);
  const cells = Array.from(
    { length: size },
    (_, i) =>
      `<rect x="${cellX(i)}" y="${CELL.y}" width="${CELL.w}" height="${CELL.h}" rx="4" class="la-cell"${hooks('connection')}/>`,
  );
  return `<g${hooks('pool', datasource)}>${[
    rect(x, POOL.y, w, POOL.h, 'la-canvas', 10),
    text(x + 16, 263, `${datasource} pool`, 'font-sans text-label font-semibold fill-ink'),
    ...cells,
    // The connection under the arrow is the one the pool lends.
    during(
      callsOf(datasource).map((c) => c.borrow),
      rect(cellX((size - 1) / 2), CELL.y, CELL.w, CELL.h, 'la-cell-new', 4),
      hooks('borrowed', datasource),
    ),
    config(292, `${key}.db-kind=postgresql`, 'fill-ink-muted'),
    config(312, `${key}.jdbc.max-size=${size}`, 'fill-ink-muted'),
    during(
      complement([XA_TX.span], LOOP),
      config(332, '# jdbc.transactions defaults to enabled', 'fill-ink-muted'),
    ),
    during(
      [XA_TX.span],
      config(332, `${key}.jdbc.transactions=xa`, 'fill-amber'),
      hooks('xa-config', datasource),
    ),
  ].join('\n')}</g>`;
}

function cylinder(x: number, y: number): string {
  const drum = 'fill-violet-deep stroke-violet stroke-1.5';
  return `<path d="M ${x} ${y} L ${x} ${y + 14} A 8 3 0 0 0 ${x + 16} ${y + 14} L ${x + 16} ${y} Z" class="${drum}"/><ellipse cx="${x + 8}" cy="${y}" rx="8" ry="3" class="${drum}"/>`;
}

function database(datasource: Datasource): string {
  const { x, w, cx } = COLUMN[datasource];
  const rowX = cx - ROW.w / 2;
  const rows = TABLES[datasource];
  const calls = callsOf(datasource);
  const status = (content: string, cls: string): string =>
    text(x + w - 16, DB.title, content, `${cls} anchor-end`);
  const cell = (y: number, [left, right]: readonly [string, string], cls: string): string =>
    [
      rect(rowX, y, ROW.w, ROW.h, cls, 4),
      text(rowX + 12, y + 15, left, 'la-offset'),
      text(rowX + ROW.w - 12, y + 15, right, 'la-offset anchor-end'),
    ].join('');
  const each = (pick: (row: Row, y: number) => string): string =>
    rows.map((row, i) => pick(row, ROW.top + i * ROW.step)).join('');
  const written = (cls: string): string =>
    each((row, y) => (row.written ? cell(y, row.written, cls) : ''));
  const reads = statementsOf(calls.filter((c) => c.attempt === 'read'));
  // A write stays pending from its statement until its transaction commits or rolls back.
  const writes = calls.flatMap((c) => {
    const tx = transactionOf(c);
    return c.statement && tx
      ? [{ attempt: tx.attempt, pending: [c.statement.at[0], tx.end] as const }]
      : [];
  });
  const wrote = (tx: Transaction): boolean => writes.some((write) => write.attempt === tx.attempt);
  return [
    rect(x, DB.y, w, DB.h, 'fill-surface stroke-violet stroke-1.5', 10),
    cylinder(x + 16, 387),
    text(x + 40, DB.title, `${datasource} database`, 'font-sans text-label font-semibold fill-ink'),
    ...calls.flatMap((c) =>
      c.statement
        ? [
            during(
              [c.statement.at],
              status(c.statement.sql, 'font-mono text-offset fill-amber'),
              hooks('statement', datasource, c.attempt),
            ),
          ]
        : [],
    ),
    wrote(DEFAULT_TX)
      ? during(
          [[DEFAULT_TX.end, DEFAULT_TX.span[1]]],
          status('rolled back', 'font-sans text-offset font-semibold fill-red'),
          hooks('rolled-back', datasource),
        )
      : '',
    wrote(XA_TX) && XA_TX.prepare
      ? during(
          [XA_TX.prepare],
          status('prepared', 'font-sans text-offset font-semibold fill-amber'),
          hooks('prepared', datasource),
        )
      : '',
    wrote(XA_TX)
      ? during(
          [[XA_TX.end, LOOP]],
          status('committed', 'font-sans text-offset font-semibold fill-emerald'),
          hooks('committed', datasource),
        )
      : '',
    `<g${hooks('table', datasource)}>${each(
      (row, y) =>
        (row.table ? text(x + 16, y + 15, row.table, 'font-mono text-offset fill-ink-muted') : '') +
        (row.cells
          ? cell(y, row.cells, 'la-cell')
          : rect(rowX, y, ROW.w, ROW.h, 'la-cell-tail', 4)),
    )}</g>`,
    during(
      reads,
      each((row, y) =>
        row.read ? rect(rowX - 3, y - 3, ROW.w + 6, ROW.h + 6, 'la-read-marker', 6) : '',
      ),
      hooks('read-marker', datasource),
    ),
    ...writes.map((write) =>
      during([write.pending], written('la-cell-new'), hooks('pending', datasource, write.attempt)),
    ),
    wrote(XA_TX) ? during([[XA_TX.end, LOOP]], written('la-cell'), hooks('saved', datasource)) : '',
  ].join('\n');
}

function transaction(tx: Transaction): string {
  const slot = (datasource: Datasource): string => {
    const { cx } = COLUMN[datasource];
    const x = cx - SLOT.w / 2;
    const call = CALLS.find((c) => c.attempt === tx.attempt && c.datasource === datasource);
    const label = (content: string, cls: string): string =>
      text(cx, BAR.text, content, `font-sans text-offset ${cls} anchor-middle`);
    return [
      rect(x, SLOT.y, SLOT.w, SLOT.h, 'la-cell-tail'),
      label(datasource, 'fill-ink-muted'),
      call?.join === undefined
        ? ''
        : during(
            [[call.join, tx.span[1]]],
            rect(x, SLOT.y, SLOT.w, SLOT.h, 'la-cell-new') +
              label(`${datasource} joined`, 'fill-ink'),
            hooks('enlisted', datasource, tx.attempt),
          ),
      call?.fail === undefined
        ? ''
        : during(
            [[call.fail, tx.span[1]]],
            rect(x, SLOT.y, SLOT.w, SLOT.h, 'fill-surface stroke-red stroke-1.5') +
              label('Failed to enlist', 'font-semibold fill-red'),
            hooks('enlist-failed', datasource, tx.attempt),
          ),
    ].join('\n');
  };
  const right = (content: string, tint: string): string =>
    text(W - 36, BAR.text, content, `font-sans text-offset font-semibold ${tint} anchor-end`);
  return during(
    [tx.span],
    [
      `<rect x="24" y="${BAR.y}" width="${W - 48}" height="${BAR.h}" rx="8" class="fill-surface stroke-amber stroke-1.5" stroke-dasharray="6 4"/>`,
      text(36, BAR.text, tx.label, 'font-sans text-offset font-semibold fill-amber'),
      text(
        W / 2,
        BAR.text,
        '@Transactional confirm()',
        'font-mono text-offset fill-ink anchor-middle',
      ),
      ...DATASOURCES.map(slot),
      tx.prepare ? during([tx.prepare], right('prepare', 'fill-amber')) : '',
      during(
        [[tx.end, tx.span[1]]],
        right(tx.outcome, `fill-${tx.tint}`),
        hooks('outcome', undefined, tx.attempt),
      ),
    ].join('\n'),
    hooks('transaction', undefined, tx.attempt),
  );
}

function captions(): string[] {
  return CAPTIONS.map(([at, caption], i) => {
    const until = CAPTIONS[i + 1]?.[0] ?? LOOP;
    return `<text x="${W / 2}" y="516" class="font-sans text-label fill-ink anchor-middle" opacity="0" data-role="caption">${show([[at, until]], LOOP)}${escapeXml(caption)}</text>`;
  });
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc" data-loop="${LOOP}s">`,
    '<title id="title">One endpoint, two datasources</title>',
    `<desc id="desc">${escapeXml(
      "One checkout request reads the held seats from the inventory database and the buyer from the accounts database. Each query goes through the datasource injected with @DataSource and borrows a connection from that datasource's own pool. Then confirm() writes to both in one transaction. With the default settings, the accounts connection fails to enlist and the transaction rolls back the seat update. With jdbc.transactions=xa on both datasources, both connections join, and the transaction commits both in two phases.",
    )}</desc>`,
    '<style>\n/* LA-STYLE:START */\n/* LA-STYLE:END */\n</style>',
    rect(0, 0, W, H, 'fill-stage', 0),
    text(28, 40, 'One endpoint, two datasources', 'la-title'),
    text(
      28,
      62,
      'Each named datasource has its own pool. One transaction can write to both only with XA.',
      'la-note',
    ),
    endpoint(),
    ...DATASOURCES.flatMap((datasource) => [
      connectors(datasource),
      pool(datasource),
      database(datasource),
    ]),
    ...TRANSACTIONS.map(transaction),
    rect(24, 492, W - 48, 38, 'la-canvas', 8),
    ...captions(),
    text(
      28,
      552,
      'Sources: quarkus.io/guides/datasource (configure multiple datasources, named datasource injection, multiple datasources in a single transaction).',
      'font-sans text-offset fill-ink-muted',
    ),
    '</svg>',
  ].join('\n');
  return `${embedBlock(svg, canonicalStyleBlock())}\n`;
}
