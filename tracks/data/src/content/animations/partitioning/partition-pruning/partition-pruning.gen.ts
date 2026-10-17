import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, move, show } from '@learning-animated/svg-kit/author';

const LOOP = 30;
const WIDTH = 1000;
const HEIGHT = 520;

type Row = { readonly playedOn: string; readonly winnerId: number };
type Partition = {
  readonly name: string;
  readonly month: string;
  readonly from: string;
  readonly to: string;
  readonly rows: readonly Row[];
};

const match = (playedOn: string, winnerId: number): Row => ({ playedOn, winnerId });
// Player 1042 on the course's roster of 20 players, whose ids every Data lesson shares.
const KOALA = 1042;

// One partition per month. Each holds the dates from its lower bound up to, but not including,
// its upper bound. Koala won one match in January and one in March, and other players won the rest.
const PARTITIONS: readonly Partition[] = [
  {
    name: 'matches_2026_01',
    month: 'January',
    from: '2026-01-01',
    to: '2026-02-01',
    rows: [match('2026-01-05', KOALA), match('2026-01-12', 2981), match('2026-01-27', 7702)],
  },
  {
    name: 'matches_2026_02',
    month: 'February',
    from: '2026-02-01',
    to: '2026-03-01',
    rows: [match('2026-02-03', 5214), match('2026-02-14', 9128), match('2026-02-21', 4127)],
  },
  {
    name: 'matches_2026_03',
    month: 'March',
    from: '2026-03-01',
    to: '2026-04-01',
    rows: [match('2026-03-02', KOALA), match('2026-03-09', 8577), match('2026-03-23', 2046)],
  },
  {
    name: 'matches_2026_04',
    month: 'April',
    from: '2026-04-01',
    to: '2026-05-01',
    rows: [match('2026-04-06', 9612), match('2026-04-15', 6120), match('2026-04-28', 3560)],
  },
];

type Query = {
  readonly id: 'march' | 'winner';
  readonly sql: readonly (readonly [indent: number, line: string])[];
  // The played_on range the WHERE clause allows, or null when it puts no limit on played_on.
  readonly range: readonly [from: string, to: string] | null;
  readonly where: (row: Row) => boolean;
  readonly wants: string;
  // The query reaches the planner, which checks one partition every `check` seconds from
  // `checksAt`. The scan then reads one row every `read` seconds, until the query leaves.
  readonly arrives: number;
  readonly checksAt: number;
  readonly check: number;
  readonly read: number;
  readonly leaves: number;
};

const MARCH: readonly [from: string, to: string] = ['2026-03-01', '2026-04-01'];

const QUERIES: readonly Query[] = [
  {
    id: 'march',
    sql: [
      [0, 'SELECT * FROM matches'],
      [0, `WHERE played_on >= '${MARCH[0]}'`],
      [2, `AND played_on < '${MARCH[1]}';`],
    ],
    range: MARCH,
    where: (row) => row.playedOn >= MARCH[0] && row.playedOn < MARCH[1],
    wants: `${MARCH[0]} to ${MARCH[1]}`,
    arrives: 0,
    checksAt: 4,
    check: 1.5,
    read: 1,
    leaves: 16,
  },
  {
    id: 'winner',
    sql: [
      [0, 'SELECT * FROM matches'],
      [0, `WHERE winner_id = ${KOALA};`],
    ],
    range: null,
    where: (row) => row.winnerId === KOALA,
    wants: 'any played_on',
    arrives: 16,
    checksAt: 17,
    check: 1,
    read: 0.5,
    leaves: LOOP,
  },
];

// The planner keeps a partition unless the query's played_on range misses its bounds.
const keeps = (query: Query, partition: Partition): boolean =>
  query.range === null || (query.range[0] < partition.to && partition.from < query.range[1]);
const keptBy = (query: Query): Partition[] => PARTITIONS.filter((p) => keeps(query, p));
const checkOf = (query: Query, i: number): Interval => [
  query.checksAt + i * query.check,
  query.checksAt + (i + 1) * query.check,
];
const scanStart = (query: Query): number => query.checksAt + PARTITIONS.length * query.check;

type Read = {
  readonly partition: Partition;
  readonly row: Row;
  readonly slot: number;
  readonly start: number;
  readonly end: number;
};

// Every row the scan reads, in order: the kept partitions one after another, top row first.
function readsOf(query: Query): Read[] {
  return keptBy(query)
    .flatMap((partition) => partition.rows.map((row, slot) => ({ partition, row, slot })))
    .map((read, i) => {
      const start = scanStart(query) + i * query.read;
      return { ...read, start, end: start + query.read };
    });
}

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'A query asks for the matches played in March: played_on from 2026-03-01 up to, but not including, 2026-04-01.',
  ],
  [
    4,
    "The planner compares that range with each partition's bounds. Only March can hold rows in that range, so it prunes the other three months.",
  ],
  [
    10,
    'Only matches_2026_03 is scanned, and all 3 of its rows are returned. The pruned months stay dark, and none of their rows is read.',
  ],
  [
    16,
    'A query for the matches Koala (player 1042) won filters on winner_id, not played_on, so no month can be pruned. All 12 rows are read to return 2.',
  ],
];

const TITLE = "Skipping the months a query can't match";
const NOTE =
  "The planner compares the WHERE clause with each partition's bounds and scans only the partitions that could hold the rows the query wants.";
const DESC =
  'An animation in four steps. A query asks for the matches played in March, from a matches table with one partition per month, January to April 2026. ' +
  "The planner compares the query's played_on range with each partition's bounds and prunes January, February, and April. " +
  'Only matches_2026_03 is scanned, and its 3 rows are returned while the pruned months stay dark. ' +
  'Then a query for the matches that Koala, player 1042, won filters on winner_id instead. It puts no limit on played_on, so the planner keeps every month, ' +
  'and the scan reads all 12 rows to return 2.';

type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

const QUERY_BOX: Box = { left: 32, top: 88, width: 380, height: 100 };
const PLANNER: Box = { left: 500, top: 88, width: 468, height: 100 };
const FIRST_LINE_Y = QUERY_BOX.top + 50;
const SECOND_LINE_Y = PLANNER.top + 76;
const PLANNER_VALUE_X = PLANNER.left + 140;
const ARROW: Interval = [QUERY_BOX.left + QUERY_BOX.width, PLANNER.left - 6];
// The query travels along the arrow to the planner, which shows what it wants on arrival.
const handoffOf = (query: Query): Interval => [query.arrives + 0.25, query.arrives + 1];

const TABLE_LABEL_Y = 214;
// One frame per partition, side by side.
const FRAME = { top: 228, width: 222, height: 180, gap: 16 } as const;
const frameLeft = (i: number): number => 32 + i * (FRAME.width + FRAME.gap);
const BOUNDS_Y = FRAME.top + 50;
const ROW = { inset: 12, padding: 12, top: FRAME.top + 68, height: 26, pitch: 34 } as const;
const rowTop = (slot: number): number => ROW.top + slot * ROW.pitch;
const VERDICT_Y = FRAME.top + FRAME.height + 24;
const STATS_Y = 462;
const CAPTION_Y = 502;

const VERDICTS = {
  pruned: ["can't hold wanted rows: pruned", 'fill-ink-muted font-sans text-offset anchor-middle'],
  kept: [
    'may hold wanted rows: kept',
    'fill-amber font-sans text-offset font-semibold anchor-middle',
  ],
} as const;

const text = (classes: string, x: number, y: number, words: string, attributes = ''): string =>
  `<text${attributes} class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const rect = (classes: string, { left, top, width, height }: Box, rx: number): string =>
  `<rect class="${classes}" x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}"/>`;
const indented = (lines: readonly string[], depth: string): string =>
  lines.map((line) => `${depth}${line}`).join('\n');
const tagged = (role: string, query: Query, partition?: Partition): string =>
  ` data-role="${role}" data-query="${query.id}"${partition ? ` data-partition="${partition.name}"` : ''}`;

const frameBox = (i: number): Box => ({
  left: frameLeft(i),
  top: FRAME.top,
  width: FRAME.width,
  height: FRAME.height,
});
const rowBox = (i: number, slot: number): Box => ({
  left: frameLeft(i) + ROW.inset,
  top: rowTop(slot),
  width: FRAME.width - 2 * ROW.inset,
  height: ROW.height,
});

// A row's two values, on top of whatever cell is drawn under them.
function rowInk(i: number, slot: number, row: Row, ink: string): string[] {
  const y = rowTop(slot) + 17;
  const [left, right] = [ROW.inset + ROW.padding, FRAME.width - ROW.inset - ROW.padding];
  return [
    text(ink, frameLeft(i) + left, y, row.playedOn),
    text(`${ink} anchor-end`, frameLeft(i) + right, y, `winner ${row.winnerId}`),
  ];
}

function queryBox(): string {
  const sql = QUERIES.map((query) =>
    [
      `  <g${tagged('query', query)}>`,
      `    ${show([[query.arrives, query.leaves]], LOOP)}`,
      ...query.sql.map(
        ([indent, line], i) =>
          `    ${text('fill-ink font-mono text-offset', QUERY_BOX.left + 16 + indent * 8, FIRST_LINE_Y + i * 18, line)}`,
      ),
      '  </g>',
    ].join('\n'),
  );
  return [
    `  ${rect('la-canvas stroke-1.5', QUERY_BOX, 8)}`,
    `  ${text('la-label font-semibold', QUERY_BOX.left + 16, QUERY_BOX.top + 24, 'query')}`,
    ...sql,
  ].join('\n');
}

function planner(): string {
  const handoffs = QUERIES.map((query) => {
    const [from, to] = handoffOf(query);
    return [
      `  <circle${tagged('handoff', query)} class="la-flow-dot" r="5">`,
      `    ${show([[from, to]], LOOP)}`,
      `    ${move(
        [
          [0, ARROW[0] + 6, FIRST_LINE_Y],
          [from, ARROW[0] + 6, FIRST_LINE_Y],
          [to, ARROW[1] - 6, FIRST_LINE_Y],
          [LOOP, ARROW[1] - 6, FIRST_LINE_Y],
        ],
        LOOP,
      )}`,
      '  </circle>',
    ].join('\n');
  });
  const wants = QUERIES.map(
    (query) =>
      `  <text${tagged('wants', query)} class="fill-ink font-mono text-offset" x="${PLANNER_VALUE_X}" y="${FIRST_LINE_Y}">${escapeXml(query.wants)}${show([[handoffOf(query)[1], query.leaves]], LOOP)}</text>`,
  );
  const compares = QUERIES.flatMap((query) =>
    PARTITIONS.map((partition, i) =>
      [
        `  <g${tagged('compare', query, partition)}>`,
        `    ${show([checkOf(query, i)], LOOP)}`,
        `    ${text('fill-ink-muted font-mono text-offset', PLANNER.left + 16, SECOND_LINE_Y, partition.name)}`,
        `    ${text('fill-ink font-mono text-offset', PLANNER_VALUE_X, SECOND_LINE_Y, `${partition.from} to ${partition.to}`)}`,
        '  </g>',
      ].join('\n'),
    ),
  );
  const plans = QUERIES.map((query) => {
    const kept = keptBy(query);
    const plan =
      kept.length === PARTITIONS.length
        ? `scan all ${kept.length} partitions`
        : `scan ${kept.map((p) => p.name).join(', ')} only`;
    return [
      `  <g${tagged('plan', query)}>`,
      `    ${show([[scanStart(query), query.leaves]], LOOP)}`,
      `    ${text('fill-ink-muted font-sans text-offset', PLANNER.left + 16, SECOND_LINE_Y, 'plan')}`,
      `    ${text('fill-amber font-mono text-offset font-semibold', PLANNER_VALUE_X, SECOND_LINE_Y, plan)}`,
      '  </g>',
    ].join('\n');
  });
  return [
    `  <path class="la-arrow" d="M ${ARROW[0]} ${FIRST_LINE_Y} H ${ARROW[1]}" marker-end="url(#head)"/>`,
    `  ${rect('la-canvas stroke-1.5', PLANNER, 8)}`,
    `  ${text('la-label font-semibold', PLANNER.left + 16, PLANNER.top + 24, 'planner')}`,
    `  ${text('fill-ink-muted font-sans text-offset', PLANNER.left + 16, FIRST_LINE_Y, 'query wants')}`,
    ...wants,
    ...compares,
    ...plans,
    ...handoffs,
  ].join('\n');
}

function partitions(): string {
  return PARTITIONS.map((partition, i) => {
    const left = frameLeft(i);
    const rows = partition.rows.map((row, slot) =>
      [
        `    <g data-role="row" data-partition="${partition.name}" data-played-on="${row.playedOn}" data-winner-id="${row.winnerId}">`,
        `      ${rect('la-cell', rowBox(i, slot), 5)}`,
        indented(rowInk(i, slot, row, 'la-offset'), '      '),
        '    </g>',
      ].join('\n'),
    );
    return [
      `  <g data-role="partition" data-partition="${partition.name}" data-from="${partition.from}" data-to="${partition.to}">`,
      `    ${rect('la-card', frameBox(i), 12)}`,
      `    ${text('fill-ink font-mono text-label font-semibold', left + 16, FRAME.top + 26, partition.name)}`,
      `    ${text('fill-ink-muted font-sans text-offset anchor-end', left + FRAME.width - 16, FRAME.top + 26, partition.month)}`,
      `    ${text('fill-ink-muted font-mono text-offset', left + 16, BOUNDS_Y, `${partition.from} to ${partition.to}`, ` data-role="bounds" data-partition="${partition.name}"`)}`,
      ...rows,
      '  </g>',
    ].join('\n');
  }).join('\n');
}

// A pruned partition goes dark: the same frame, drawn in the stage's colors, until its query leaves.
function pruned(query: Query): string[] {
  return PARTITIONS.flatMap((partition, i) => {
    if (keeps(query, partition)) return [];
    const left = frameLeft(i);
    const dim = 'fill-ink-muted font-mono text-offset';
    return [
      [
        `  <g${tagged('pruned', query, partition)}>`,
        `    ${show([[checkOf(query, i)[1], query.leaves]], LOOP)}`,
        `    ${rect('fill-stage stroke-grid stroke-1.5', frameBox(i), 12)}`,
        `    ${text('fill-ink-muted font-mono text-label font-semibold', left + 16, FRAME.top + 26, partition.name)}`,
        `    ${text('fill-ink-muted font-sans text-offset anchor-end', left + FRAME.width - 16, FRAME.top + 26, partition.month)}`,
        `    ${text(dim, left + 16, BOUNDS_Y, `${partition.from} to ${partition.to}`)}`,
        ...partition.rows.flatMap((row, slot) => [
          `    ${rect('fill-stage stroke-grid stroke-1.5', rowBox(i, slot), 5)}`,
          indented(rowInk(i, slot, row, dim), '    '),
        ]),
        '  </g>',
      ].join('\n'),
    ];
  });
}

function scan(query: Query): string[] {
  const reads = readsOf(query);
  const outlines = keptBy(query).map((partition) => {
    const own = reads.filter((read) => read.partition === partition);
    const i = PARTITIONS.indexOf(partition);
    return `  <rect${tagged('scanning', query, partition)} class="fill-none stroke-amber stroke-2.5" x="${frameLeft(i)}" y="${FRAME.top}" width="${FRAME.width}" height="${FRAME.height}" rx="12">${show([[own[0]!.start, own[own.length - 1]!.end]], LOOP)}</rect>`;
  });
  const highlights = reads.map(({ partition, row, slot, start, end }) => {
    const i = PARTITIONS.indexOf(partition);
    return [
      `  <g${tagged('read', query, partition)} data-played-on="${row.playedOn}">`,
      `    ${show([[start, end]], LOOP)}`,
      `    ${rect('la-cell-new', rowBox(i, slot), 5)}`,
      indented(rowInk(i, slot, row, 'la-offset'), '    '),
      '  </g>',
    ].join('\n');
  });
  const returned = reads
    .filter(({ row }) => query.where(row))
    .map(({ partition, row, slot, end }) => {
      const i = PARTITIONS.indexOf(partition);
      const { left, top, width, height } = rowBox(i, slot);
      return `  <rect${tagged('returned', query, partition)} data-played-on="${row.playedOn}" class="fill-none stroke-emerald stroke-2.5" x="${left}" y="${top}" width="${width}" height="${height}" rx="5">${show([[end, query.leaves]], LOOP)}</rect>`;
    });
  return [...outlines, ...highlights, ...returned];
}

function checks(query: Query): string[] {
  return PARTITIONS.flatMap((partition, i) => {
    const [checked, decided] = checkOf(query, i);
    const left = frameLeft(i);
    const verdict = keeps(query, partition) ? 'kept' : 'pruned';
    const [words, classes] = VERDICTS[verdict];
    return [
      `  <rect${tagged('check', query, partition)} class="fill-none stroke-amber stroke-1.5" x="${left + 8}" y="${BOUNDS_Y - 15}" width="${FRAME.width - 16}" height="22" rx="6">${show([[checked, decided]], LOOP)}</rect>`,
      `  <text${tagged('verdict', query, partition)} data-verdict="${verdict}" class="${classes}" x="${left + FRAME.width / 2}" y="${VERDICT_Y}">${escapeXml(words)}${show([[decided, query.leaves]], LOOP)}</text>`,
    ];
  });
}

// What the counters say from a moment on, for each query: partitions and rows scanned so far.
function counts(): string {
  const of = (kind: 'partitions' | 'rows', x: number): string[] =>
    QUERIES.flatMap((query) => {
      const reads = readsOf(query);
      const changes: Array<readonly [at: number, words: string]> = [
        [query.arrives, kind === 'rows' ? '0' : `0 of ${PARTITIONS.length}`],
      ];
      reads.forEach((read, i) => {
        if (kind === 'rows') changes.push([read.start, String(i + 1)]);
        else if (read.slot === 0) {
          const scanned = keptBy(query).indexOf(read.partition) + 1;
          changes.push([read.start, `${scanned} of ${PARTITIONS.length}`]);
        }
      });
      return changes.map(([from, words], i) => {
        const to = changes[i + 1]?.[0] ?? query.leaves;
        return `  <text data-role="count" data-of="${kind}" class="fill-ink font-mono text-label font-semibold" x="${x}" y="${STATS_Y}">${escapeXml(words)}${show([[from, to]], LOOP)}</text>`;
      });
    });
  return [
    `  ${text('fill-ink-muted font-sans text-offset', 32, STATS_Y, 'partitions scanned')}`,
    ...of('partitions', 156),
    `  ${text('fill-ink-muted font-sans text-offset', 236, STATS_Y, 'rows read')}`,
    ...of('rows', 304),
    `  ${rect('la-cell-new', { left: 620, top: STATS_Y - 11, width: 24, height: 14 }, 3)}`,
    `  ${text('fill-ink-muted font-sans text-offset', 652, STATS_Y, 'row being read')}`,
    `  ${rect('fill-cell stroke-emerald stroke-2.5', { left: 780, top: STATS_Y - 11, width: 24, height: 14 }, 3)}`,
    `  ${text('fill-ink-muted font-sans text-offset', 812, STATS_Y, 'row returned')}`,
  ].join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="la-label" x="32" y="${CAPTION_Y}">${escapeXml(words)}${show([[at, next]], LOOP)}</text>`;
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" data-loop="${LOOP}s">`,
    `  <title>${escapeXml(TITLE)}</title>`,
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
    `  ${text('la-title', 32, 44, TITLE)}`,
    `  ${text('la-note', 32, 68, NOTE)}`,
    queryBox(),
    planner(),
    '  <g data-role="table">',
    `    ${text('fill-ink font-mono text-label font-semibold', 32, TABLE_LABEL_Y, 'matches')}`,
    `    ${text('fill-ink-muted font-sans text-offset', 100, TABLE_LABEL_Y, 'partitioned by the month of played_on')}`,
    '  </g>',
    partitions(),
    ...QUERIES.flatMap(pruned),
    ...QUERIES.flatMap(scan),
    ...QUERIES.flatMap(checks),
    counts(),
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
