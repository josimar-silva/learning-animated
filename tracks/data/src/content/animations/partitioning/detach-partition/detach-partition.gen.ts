// Writes detach-partition.svg through `just gen`. PARTITIONS holds every match on the stage, and
// the story moments below drive every timing.
import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, move, show } from '@learning-animated/svg-kit/author';

const LOOP = 24;
const W = 1100;
const H = 530;

type Match = { readonly id: number; readonly playedOn: string };
type Partition = {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly matches: readonly Match[];
};
const match = (id: number, playedOn: string): Match => ({ id, playedOn });

// One partition per month of played_on, from the first of its month up to, but not including, the
// first of the next. January to March hold three matches each when the story opens. April's
// partition is ready but empty, and its first matches land on the first day of April.
const PARTITIONS: readonly Partition[] = [
  {
    name: 'matches_2026_01',
    from: '2026-01-01',
    to: '2026-02-01',
    matches: [match(50418, '2026-01-07'), match(50873, '2026-01-15'), match(51466, '2026-01-26')],
  },
  {
    name: 'matches_2026_02',
    from: '2026-02-01',
    to: '2026-03-01',
    matches: [match(51920, '2026-02-03'), match(52385, '2026-02-12'), match(53041, '2026-02-24')],
  },
  {
    name: 'matches_2026_03',
    from: '2026-03-01',
    to: '2026-04-01',
    matches: [match(53562, '2026-03-05'), match(54177, '2026-03-16'), match(54790, '2026-03-27')],
  },
  {
    name: 'matches_2026_04',
    from: '2026-04-01',
    to: '2026-05-01',
    matches: [match(55031, '2026-04-01'), match(55036, '2026-04-01'), match(55044, '2026-04-01')],
  },
];
const JANUARY = PARTITIONS[0]!;
const APRIL = PARTITIONS[PARTITIONS.length - 1]!;
const STAYING = PARTITIONS.slice(1);
const KEPT_MONTHS = 3;
// The last day of March, then the day April begins.
const TODAY = ['2026-03-31', APRIL.from] as const;
const rowsIn = (partitions: readonly Partition[]): number =>
  partitions.reduce((sum, p) => sum + p.matches.length, 0);

// Step 1: April begins. The window slides one month, then April's first matches land one after
// another, each one amber while it is written.
const SLIDE: Interval = [1, 2];
const WRITE = 0.6;
const ARRIVALS = APRIL.matches.map((_, i) => 2.2 + WRITE * i);
// Step 2: DETACH PARTITION moves January out of matches.
const DETACH = 5;
const MOVE: Interval = [5.5, 7];
// Step 3: a count on matches, then a count on the detached table.
const COUNT_MATCHES = 10;
const MATCHES_SCAN: Interval = [10.5, 12];
const COUNT_JANUARY = 12.5;
const JANUARY_SCAN: Interval = [13, 14];
// Step 4: COPY archives January, then DROP TABLE removes it.
const COPY = 15;
const COPY_FLOW: Interval = [15.5, 16.5];
const DROP = 17;
const GONE = 17.5;
// Step 5: VACUUM reads matches and finds no dead rows. A bulk DELETE would have marked each
// January match dead.
const VACUUM = 19;
const VACUUM_SCAN: Interval = [19.4, 20];
const BULK = 20.5;
const STRIKES = JANUARY.matches.map((_, i) => 21 + 0.5 * i);
const DEAD_LEFT = 22.5;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [
    0,
    'The game keeps the last three months of matches. When April begins, the window moves on, and January falls out of it.',
  ],
  [
    DETACH,
    `DETACH PARTITION takes ${JANUARY.name} out of matches in one step. Only the catalog changes, so no row is read or written.`,
  ],
  [
    COUNT_MATCHES,
    `Queries on matches now count ${rowsIn(STAYING)} rows instead of ${rowsIn(PARTITIONS)}. ${JANUARY.name} is a table of its own, and it still holds January's ${JANUARY.matches.length} matches.`,
  ],
  [
    COPY,
    "Archive the detached table if January's matches are still needed, then drop it. DROP TABLE removes the whole month at once.",
  ],
  [
    VACUUM,
    `No row was deleted, so VACUUM has no dead rows to clean up. A bulk DELETE would have left all ${JANUARY.matches.length} January matches behind as dead rows.`,
  ],
];

const TITLE = 'Retiring a month in one step';
const NOTE =
  'The game keeps three months of match history, and retires the oldest month by removing its partition instead of deleting rows.';
const DESC =
  `An animation in five steps. The game keeps the last three months of match history in the matches table, which has one partition per month of played_on, from ${JANUARY.name} to ${APRIL.name}. ` +
  'Each row shows a match id and the day the match was played. ' +
  'When April begins, the retention window slides from January through March to February through April, the first April matches arrive, and January falls out of the window. ' +
  `ALTER TABLE matches DETACH PARTITION ${JANUARY.name} then moves January out of matches as a whole, and none of its rows is read or written. ` +
  `A count on matches finds ${rowsIn(STAYING)} rows instead of ${rowsIn(PARTITIONS)}, while the detached table still holds January's ${JANUARY.matches.length} matches. ` +
  'COPY archives them, and DROP TABLE removes the table. ' +
  `VACUUM finds no dead rows, while a bulk DELETE would have left all ${JANUARY.matches.length} January matches behind as dead rows.`;

type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

// The partitioned table holds one frame per partition, and each frame holds one cell per match.
const FRAME = { left: 40, top: 154, width: 160, height: 124, gap: 12 } as const;
const PITCH = FRAME.width + FRAME.gap;
const PARENT: Box = {
  left: 24,
  top: 120,
  width: PARTITIONS.length * PITCH - FRAME.gap + 2 * (FRAME.left - 24),
  height: 172,
};
const PARENT_RIGHT = PARENT.left + PARENT.width;
const frameAt = (i: number, top: number = FRAME.top): Box => ({
  left: FRAME.left + i * PITCH,
  top,
  width: FRAME.width,
  height: FRAME.height,
});
const ROW = { inset: 9, top: 30, width: 142, height: 24, gap: 6, pad: 9 } as const;
const rowTop = (frameTop: number, r: number): number =>
  frameTop + ROW.top + r * (ROW.height + ROW.gap);
// January comes to rest below matches, as a table of its own.
const LANDED = frameAt(0, 330);
const FALL = LANDED.top - FRAME.top;
// The retention window spans three frames and slides one frame to the right.
const WINDOW = {
  left: FRAME.left - 4,
  width: KEPT_MONTHS * FRAME.width + (KEPT_MONTHS - 1) * FRAME.gap + 8,
  y: 104,
  tick: 8,
  labelY: 96,
} as const;
const ARCHIVE_WIDTH = ROW.width + 26;
const ARCHIVE: Box = {
  left: PARENT_RIGHT - ARCHIVE_WIDTH,
  top: LANDED.top,
  width: ARCHIVE_WIDTH,
  height: FRAME.height,
};
const DEAD_GAP = 12;
const BULK_BOX: Box = {
  left: 24,
  top: 316,
  width: JANUARY.matches.length * (ROW.width + DEAD_GAP) - DEAD_GAP + 32,
  height: 136,
};
const CONSOLE: Box = {
  left: PARENT_RIGHT + 16,
  top: 84,
  width: W - 24 - PARENT_RIGHT - 16,
  height: 382,
};
const CAPTION: Box = { left: 24, top: 478, width: W - 48, height: 36 };

const text = (classes: string, x: number, y: number, words: string): string =>
  `<text class="${classes}" x="${x}" y="${y}">${escapeXml(words)}</text>`;
const shown = (during: readonly Interval[]): string => show(during, LOOP);
const rect = (classes: string, box: Box, rx: number, attributes = '', inner = ''): string => {
  const open = `<rect ${attributes ? `${attributes} ` : ''}class="${classes}" x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="${rx}"`;
  return inner ? `${open}>${inner}</rect>` : `${open}/>`;
};
const grown = (box: Box, by: number): Box => ({
  left: box.left - by,
  top: box.top - by,
  width: box.width + 2 * by,
  height: box.height + 2 * by,
});
const middleOf = (box: Box): number => box.left + box.width / 2;
const cellBox = (left: number, top: number): Box => ({
  left,
  top,
  width: ROW.width,
  height: ROW.height,
});
const matchAttributes = (m: Match): string =>
  `data-match-id="${m.id}" data-played-on="${m.playedOn}"`;
// A match's id and the day it was played, drawn over whatever cell sits under them.
const matchInk = (cell: Box, m: Match, indent: string): string[] => [
  `${indent}${text('la-offset', cell.left + ROW.pad, cell.top + 16, String(m.id))}`,
  `${indent}${text('la-offset anchor-end', cell.left + cell.width - ROW.pad, cell.top + 16, m.playedOn)}`,
];

function retentionWindow(): string {
  const right = WINDOW.left + WINDOW.width;
  return [
    '  <g data-role="window">',
    `    ${move(
      [
        [0, 0, 0],
        [SLIDE[0], 0, 0],
        [SLIDE[1], PITCH, 0],
        [LOOP, PITCH, 0],
      ],
      LOOP,
    )}`,
    `    <rect data-role="window-span" class="fill-emerald" x="${WINDOW.left}" y="${WINDOW.y}" width="${WINDOW.width}" height="2"/>`,
    `    <rect class="fill-emerald" x="${WINDOW.left}" y="${WINDOW.y}" width="2" height="${WINDOW.tick}"/>`,
    `    <rect class="fill-emerald" x="${right - 2}" y="${WINDOW.y}" width="2" height="${WINDOW.tick}"/>`,
    `    ${text('fill-emerald font-sans text-offset font-semibold anchor-middle', WINDOW.left + WINDOW.width / 2, WINDOW.labelY, `match history: the last ${KEPT_MONTHS} months`)}`,
    '  </g>',
    `  <text data-role="outside" data-partition="${JANUARY.name}" class="fill-amber font-sans text-offset font-semibold anchor-middle" x="${middleOf(frameAt(0))}" y="${WINDOW.y + 6}">outside the window${shown([[SLIDE[1], MOVE[0]]])}</text>`,
  ].join('\n');
}

function storedRow(m: Match, cell: Box): string {
  return [
    `    <g data-role="row" ${matchAttributes(m)}>`,
    `      ${rect('la-cell', cell, 5)}`,
    ...matchInk(cell, m, '      '),
    '    </g>',
  ].join('\n');
}

// An April match: an empty slot until it lands, amber while it is written, stored after.
function arrivingRow(m: Match, cell: Box, lands: number): string {
  return [
    `    ${rect('la-cell-tail', cell, 5, 'data-role="slot"', shown([[0, lands]]))}`,
    `    <g data-role="row" ${matchAttributes(m)}>`,
    `      ${shown([[lands, LOOP]])}`,
    `      ${rect('la-cell-new', cell, 5, 'data-role="writing"', shown([[lands, lands + WRITE]]))}`,
    `      ${rect('la-cell', cell, 5, '', shown([[lands + WRITE, LOOP]]))}`,
    ...matchInk(cell, m, '      '),
    '    </g>',
  ].join('\n');
}

// January's partition carries its rows out of matches in one move, and its rows never change.
function partition(p: Partition, i: number): string {
  const frame = frameAt(i);
  const rows = p.matches.map((m, r) => {
    const cell = cellBox(frame.left + ROW.inset, rowTop(frame.top, r));
    return p === APRIL ? arrivingRow(m, cell, ARRIVALS[r]!) : storedRow(m, cell);
  });
  const leaving =
    p === JANUARY
      ? [
          `    ${shown([[0, GONE]])}`,
          `    ${move(
            [
              [0, 0, 0],
              [MOVE[0], 0, 0],
              [MOVE[1], 0, FALL],
              [LOOP, 0, FALL],
            ],
            LOOP,
          )}`,
        ]
      : [];
  const retiring =
    p === JANUARY
      ? [
          `    ${rect('fill-none stroke-amber stroke-2.5', grown(frame, 3), 12, '', shown([[SLIDE[1], MOVE[1]]]))}`,
        ]
      : [];
  return [
    `  <g data-role="partition" data-partition="${p.name}" data-from="${p.from}" data-to="${p.to}">`,
    ...leaving,
    `    ${rect('fill-surface stroke-grid stroke-1.5', frame, 10, 'data-role="frame"')}`,
    ...retiring,
    `    <text data-role="name" class="fill-ink font-mono text-offset anchor-middle" x="${middleOf(frame)}" y="${frame.top + 19}">${p.name}</text>`,
    ...rows,
    '  </g>',
  ].join('\n');
}

function partitioned(): string {
  return [
    `  ${rect('la-card', PARENT, 12, 'data-role="parent"')}`,
    `  ${text('la-label font-semibold', FRAME.left, PARENT.top + 22, 'matches')}`,
    `  <text data-role="partition-key" class="fill-ink-muted font-mono text-offset anchor-end" x="${PARENT_RIGHT - 16}" y="${PARENT.top + 22}">PARTITION BY RANGE (played_on)</text>`,
    ...PARTITIONS.map(partition),
  ].join('\n');
}

// A ring marks a frame while a statement reads it: sky for a query, emerald for VACUUM.
function scan(query: string, name: string, frame: Box, during: Interval, classes: string): string {
  return `  ${rect(classes, grown(frame, 5), 13, `data-role="scan" data-query="${query}" data-partition="${name}"`, shown([during]))}`;
}

const QUERY_RING = 'fill-none stroke-sky stroke-2.5';
const attached = (p: Partition): Box => frameAt(PARTITIONS.indexOf(p));

function scans(): string {
  return [
    ...STAYING.map((p) => scan('matches', p.name, attached(p), MATCHES_SCAN, QUERY_RING)),
    scan(JANUARY.name, JANUARY.name, LANDED, JANUARY_SCAN, QUERY_RING),
    scan('copy', JANUARY.name, LANDED, COPY_FLOW, QUERY_RING),
    ...STAYING.map((p) => scan('vacuum', p.name, attached(p), VACUUM_SCAN, 'la-read-marker')),
  ].join('\n');
}

function detached(): string {
  const flowY = LANDED.top + LANDED.height / 2;
  const from = LANDED.left + LANDED.width + 10;
  const to = ARCHIVE.left - 8;
  const archived = JANUARY.matches.map((m, r) => {
    const cell = cellBox(ARCHIVE.left + (ARCHIVE.width - ROW.width) / 2, rowTop(ARCHIVE.top, r));
    return [
      `    <g data-role="archived-row" ${matchAttributes(m)}>`,
      `      ${shown([[COPY_FLOW[1], LOOP]])}`,
      `      ${rect('fill-cell stroke-slate stroke-1.5', cell, 5)}`,
      ...matchInk(cell, m, '      '),
      '    </g>',
    ].join('\n');
  });
  return [
    `  <text data-role="standalone" class="la-label" x="${LANDED.left + LANDED.width + 16}" y="${LANDED.top + 24}">a table of its own${shown([[MOVE[1], GONE]])}</text>`,
    '  <g data-role="dropped">',
    `    ${shown([[GONE, BULK]])}`,
    `    ${rect('la-cell-tail', LANDED, 10)}`,
    `    ${text('la-note anchor-middle', middleOf(LANDED), LANDED.top + LANDED.height / 2 + 5, 'dropped')}`,
    '  </g>',
    '  <g data-role="archive">',
    `    ${shown([[COPY, LOOP]])}`,
    `    ${rect('fill-none stroke-slate stroke-1.5', ARCHIVE, 10)}`,
    `    ${text('la-note anchor-middle', middleOf(ARCHIVE), ARCHIVE.top + 19, 'archive')}`,
    ...archived,
    '  </g>',
    '  <g data-role="copy-flow">',
    `    ${shown([[COPY, GONE]])}`,
    `    <path class="la-arrow" d="M ${from} ${flowY} H ${to}" marker-end="url(#head)"/>`,
    '    <circle class="la-flow-dot" r="5">',
    `      ${shown([COPY_FLOW])}`,
    `      ${move(
      [
        [0, from, flowY],
        [COPY_FLOW[0], from, flowY],
        [COPY_FLOW[1], to - 6, flowY],
        [LOOP, to - 6, flowY],
      ],
      LOOP,
    )}`,
    '    </circle>',
    '  </g>',
  ].join('\n');
}

function bulkDelete(): string {
  const { left, top } = BULK_BOX;
  const dead = JANUARY.matches.map((m, i) => {
    const cell = cellBox(left + 16 + i * (ROW.width + DEAD_GAP), top + 60);
    return [
      `    <g data-role="dead-row" ${matchAttributes(m)}>`,
      `      ${rect('la-cell', cell, 5)}`,
      ...matchInk(cell, m, '      '),
      '      <g data-role="strike">',
      `        ${shown([[STRIKES[i]!, LOOP]])}`,
      `        ${rect('fill-none stroke-red stroke-2.5', cell, 5)}`,
      `        <path class="fill-none stroke-red stroke-1.5" d="M ${cell.left + 6} ${cell.top + cell.height / 2} H ${cell.left + cell.width - 6}"/>`,
      '      </g>',
      '    </g>',
    ].join('\n');
  });
  return [
    '  <g data-role="bulk-delete">',
    `    ${shown([[BULK, LOOP]])}`,
    `    ${rect('fill-surface stroke-red stroke-1.5', BULK_BOX, 10, 'stroke-dasharray="6 4"')}`,
    `    ${text('fill-red font-sans text-label font-semibold', left + 16, top + 24, 'a bulk DELETE instead')}`,
    `    <text data-role="delete" class="fill-ink font-mono text-offset" x="${left + 16}" y="${top + 46}">${escapeXml(`DELETE FROM matches WHERE played_on < '${JANUARY.to}';`)}</text>`,
    ...dead,
    `    <text data-role="dead-rows" class="fill-red font-sans text-label font-semibold" x="${left + 16}" y="${top + 116}">${JANUARY.matches.length} dead rows wait for VACUUM${shown([[DEAD_LEFT, LOOP]])}</text>`,
    '  </g>',
  ].join('\n');
}

// What the console prints from step 2 on, one block per step. It keeps every line, oldest first.
type Printed =
  | {
      readonly kind: 'statement';
      readonly step: string;
      readonly lines: readonly string[];
      readonly from: number;
    }
  | {
      readonly kind: 'result';
      readonly step: string;
      readonly words: string;
      readonly ink: string;
      readonly from: number;
      readonly before?: string;
    };

const PRINTED: readonly (readonly Printed[])[] = [
  [
    {
      kind: 'statement',
      step: 'detach',
      lines: ['ALTER TABLE matches', `DETACH PARTITION ${JANUARY.name};`],
      from: DETACH,
    },
    {
      kind: 'result',
      step: 'detach',
      words: '-- 0 rows read or written',
      ink: 'fill-emerald',
      from: MOVE[1],
    },
  ],
  [
    {
      kind: 'statement',
      step: 'count-matches',
      lines: ['SELECT count(*) FROM matches;'],
      from: COUNT_MATCHES,
    },
    {
      kind: 'result',
      step: 'count-matches',
      words: `count = ${rowsIn(STAYING)}`,
      ink: 'fill-sky',
      from: MATCHES_SCAN[1],
      before: `${rowsIn(PARTITIONS)} before the detach`,
    },
    {
      kind: 'statement',
      step: 'count-january',
      lines: [`SELECT count(*) FROM ${JANUARY.name};`],
      from: COUNT_JANUARY,
    },
    {
      kind: 'result',
      step: 'count-january',
      words: `count = ${JANUARY.matches.length}`,
      ink: 'fill-sky',
      from: JANUARY_SCAN[1],
    },
  ],
  [
    {
      kind: 'statement',
      step: 'copy',
      lines: [`COPY ${JANUARY.name}`, `TO '/archive/${JANUARY.name}';`],
      from: COPY,
    },
    {
      kind: 'result',
      step: 'copy',
      words: `COPY ${JANUARY.matches.length}`,
      ink: 'fill-ink-muted',
      from: COPY_FLOW[1],
    },
    { kind: 'statement', step: 'drop', lines: [`DROP TABLE ${JANUARY.name};`], from: DROP },
  ],
  [
    { kind: 'statement', step: 'vacuum', lines: ['VACUUM matches;'], from: VACUUM },
    {
      kind: 'result',
      step: 'vacuum',
      words: '-- 0 dead rows to clean up',
      ink: 'fill-emerald',
      from: VACUUM_SCAN[1],
    },
  ],
];

const LINE_X = CONSOLE.left + 16;
const INDENT = 16;
const LINE_PITCH = 22;
const BLOCK_GAP = 6;
const FIRST_LINE_Y = CONSOLE.top + 52;
const linesOf = (entry: Printed): number => (entry.kind === 'statement' ? entry.lines.length : 1);

function printed(entry: Printed, y: number): string {
  const during = shown([[entry.from, LOOP]]);
  if (entry.kind === 'statement') {
    return [
      `  <g data-role="statement" data-step="${entry.step}">`,
      `    ${during}`,
      ...entry.lines.map(
        (line, i) =>
          `    ${text('fill-ink font-mono text-label', LINE_X + (i > 0 ? INDENT : 0), y + i * LINE_PITCH, line)}`,
      ),
      '  </g>',
    ].join('\n');
  }
  return [
    `  <text data-role="result" data-step="${entry.step}" class="${entry.ink} font-mono text-label" x="${LINE_X}" y="${y}">${escapeXml(entry.words)}${during}</text>`,
    ...(entry.before
      ? [
          `  <text data-role="before" class="la-note anchor-end" x="${CONSOLE.left + CONSOLE.width - 16}" y="${y}">${escapeXml(entry.before)}${during}</text>`,
        ]
      : []),
  ].join('\n');
}

function sqlConsole(): string {
  const today = (date: string, during: Interval): string =>
    `  <text data-role="today" data-date="${date}" class="fill-ink-muted font-mono text-label" x="${LINE_X}" y="${FIRST_LINE_Y}">-- today: ${date}${shown([during])}</text>`;
  const out = [
    `  ${rect('la-canvas stroke-1.5', CONSOLE, 12)}`,
    `  ${text('la-label font-semibold', LINE_X, CONSOLE.top + 24, 'SQL')}`,
    today(TODAY[0], [0, SLIDE[0]]),
    today(TODAY[1], [SLIDE[0], LOOP]),
  ];
  let y = FIRST_LINE_Y + LINE_PITCH;
  for (const block of PRINTED) {
    y += BLOCK_GAP;
    for (const entry of block) {
      out.push(printed(entry, y));
      y += linesOf(entry) * LINE_PITCH;
    }
  }
  return out.join('\n');
}

function caption([at, words]: readonly [number, string], i: number): string {
  const next = CAPTIONS[i + 1]?.[0] ?? LOOP;
  return `  <text data-role="caption" class="fill-ink font-sans text-label anchor-middle" x="${W / 2}" y="${CAPTION.top + 23}">${escapeXml(words)}${shown([[at, next]])}</text>`;
}

export function render(): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" data-loop="${LOOP}s">`,
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
    `  <rect class="fill-stage" width="${W}" height="${H}"/>`,
    `  ${text('la-title', 28, 40, TITLE)}`,
    `  ${text('la-note', 28, 64, NOTE)}`,
    retentionWindow(),
    partitioned(),
    detached(),
    scans(),
    bulkDelete(),
    sqlConsole(),
    `  ${rect('la-canvas', CAPTION, 8)}`,
    ...CAPTIONS.map(caption),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
