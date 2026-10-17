import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { embedBlock } from '@learning-animated/design/sync';
import { escapeXml, type Interval, keyTimes, show } from '@learning-animated/svg-kit/author';

export type Server = 'db-0' | 'db-1' | 'db-2' | 'db-3' | 'db-4';
export type Point = { readonly server: Server; readonly label: string; readonly position: number };
export type View = {
  readonly note: string;
  readonly desc: string;
  // Where db-0 to db-3 hash on the ring, and where db-4 hashes when it joins.
  readonly points: readonly Point[];
  readonly joined: readonly Point[];
  // One caption per step: the points, the walk, db-4 joining, and the counts.
  readonly captions: readonly [string, string, string, string];
};

// One story table times both views, in seconds of the loop. Each step starts a caption, and its
// first change lands on the step itself, so a reader who picks a step while paused sees it begin.
export const LOOP = 24;
const STORY = {
  steps: [0, 5, 13, 19],
  lands: { 'db-0': 0, 'db-1': 0.5, 'db-2': 1, 'db-3': 1.5, 'db-4': 13 },
  playersHash: 5,
  walk: [6, 8],
  stored: 9.5,
  claimed: 14,
  moved: 15,
  loads: 19,
} as const;
const NEW_SERVER_JOINS = STORY.steps[2];

// The game's 20 players by tag, in ring order. The hash of each player id is the player's spot on
// this 100-position ring.
const PLAYERS: ReadonlyArray<readonly [tag: string, position: number]> = [
  ['Egret', 13],
  ['Stoat', 14],
  ['Heron', 20],
  ['Otter', 25],
  ['Jackal', 29],
  ['Coyote', 35],
  ['Iguana', 37],
  ['Lemur', 41],
  ['Quail', 43],
  ['Adder', 47],
  ['Marten', 52],
  ['Tapir', 56],
  ['Ferret', 58],
  ['Dingo', 64],
  ['Koala', 66],
  ['Petrel', 70],
  ['Badger', 82],
  ['Raven', 88],
  ['Gibbon', 91],
  ['Newt', 99],
];
const WALKER = 'Egret';
const SERVERS: readonly Server[] = ['db-0', 'db-1', 'db-2', 'db-3', 'db-4'];
const COLOR: Record<Server, string> = {
  'db-0': 'sky',
  'db-1': 'emerald',
  'db-2': 'pink',
  'db-3': 'violet',
  'db-4': 'amber',
};

const TITLE = 'Consistent hashing on a ring';
const WIDTH = 1000;
const HEIGHT = 580;
const RING = 100;
const CX = 290;
const CY = 318;
const R = 176;
const TRAIL_R = R - 14;
const LABEL_R = R + 30;
const SIDE_LABEL_R = R + 16;
const CAPTION_Y = 556;
const PANEL = { left: 560, top: 142, width: 408, height: 352 } as const;
const PANEL_RIGHT = PANEL.left + PANEL.width;
const BAR_X = PANEL.left + 100;
const UNIT = 20;
const rowY = (i: number): number => PANEL.top + 80 + i * 44;

const round = (n: number): number => Math.round(n * 10) / 10;

// A ring position on the drawing: 0 at the top, rising clockwise.
function spot(position: number, radius = R): [x: number, y: number] {
  const turn = (2 * Math.PI * position) / RING;
  return [round(CX + radius * Math.sin(turn)), round(CY - radius * Math.cos(turn))];
}

const span = (from: number, to: number): number => (to - from + RING) % RING;

// The arc from one ring position clockwise to another.
function arc(from: number, to: number, radius = R): string {
  const [x0, y0] = spot(from, radius);
  const [x1, y1] = spot(to, radius);
  const large = span(from, to) > RING / 2 ? 1 : 0;
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
}

const sorted = (points: readonly Point[]): Point[] =>
  [...points].sort((a, b) => a.position - b.position);

// The first point at or past a position, walking clockwise and wrapping past the top.
function storedBy(position: number, points: readonly Point[]): Point {
  const ring = sorted(points);
  const first = ring.find((p) => p.position >= position) ?? ring[0];
  if (!first) throw new Error('the ring needs at least one point');
  return first;
}

// The point just before another, walking counterclockwise.
function previous(point: Point, points: readonly Point[]): Point {
  const ring = sorted(points);
  const before = ring[(ring.indexOf(point) - 1 + ring.length) % ring.length];
  if (!before) throw new Error(`${point.label} is not on the ring`);
  return before;
}

const count = (server: Server, points: readonly Point[]): number =>
  PLAYERS.filter(([, position]) => storedBy(position, points).server === server).length;

const movers = (points: readonly Point[], joined: readonly Point[]): string[] =>
  PLAYERS.filter(
    ([, position]) =>
      storedBy(position, points).server !== storedBy(position, [...points, ...joined]).server,
  ).map(([tag]) => tag);

const from = (at: number): string => show([[at, LOOP]], LOOP);

type TextOptions = { readonly role?: string; readonly animation?: string };

function text(
  classes: string,
  x: number,
  y: number,
  words: string,
  { role, animation = '' }: TextOptions = {},
): string {
  const data = role ? ` data-role="${role}"` : '';
  return `<text${data} class="${classes}" x="${x}" y="${y}">${escapeXml(words)}${animation}</text>`;
}

function owned(point: Point, start: Point, at: number): string {
  return `  <path data-role="arc" data-server="${point.server}" class="fill-none stroke-${COLOR[point.server]}" d="${arc(start.position, point.position)}" stroke-width="6">${from(at)}</path>`;
}

function ring(points: readonly Point[], joined: readonly Point[]): string {
  const all = [...points, ...joined];
  const [x0, y0] = spot(0, R - 9);
  const [x1, y1] = spot(0, R + 9);
  return [
    `  <circle data-role="ring" class="fill-none stroke-grid" cx="${CX}" cy="${CY}" r="${R}" stroke-width="6"/>`,
    ...points.map((p) => owned(p, previous(p, points), STORY.stored)),
    ...joined.map((p) => owned(p, previous(p, all), STORY.claimed)),
    `  <line class="stroke-ink-muted stroke-1.5" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`,
    `  ${text('fill-ink-muted font-mono text-offset anchor-middle', CX, CY - R + 26, '0')}`,
    '  <g data-role="direction">',
    `    ${from(STORY.playersHash)}`,
    `    <path class="la-arrow" d="${arc(95, 5, R - 48)}" marker-end="url(#head)"/>`,
    `    ${text('la-note anchor-middle', CX, CY - R + 74, 'clockwise')}`,
    '  </g>',
  ].join('\n');
}

function walk(points: readonly Point[]): string {
  const [, position] = PLAYERS.find(([tag]) => tag === WALKER) ?? [];
  if (position === undefined) throw new Error(`${WALKER} is not on the ring`);
  const target = storedBy(position, points);
  const d = arc(position, target.position, TRAIL_R);
  const length = Math.ceil((2 * Math.PI * TRAIL_R * span(position, target.position)) / RING);
  const [start, end] = STORY.walk;
  const times = keyTimes([0, start, end, LOOP], LOOP);
  const [lx, ly] = spot(position, R - 34);
  return [
    `  ${text('fill-ink font-sans text-offset font-semibold anchor-middle', lx, ly + 4, WALKER, { role: 'featured', animation: from(STORY.playersHash) })}`,
    `  <g data-role="walk" data-tag="${WALKER}" data-to="${target.label}">`,
    `    ${show([[start, NEW_SERVER_JOINS]], LOOP)}`,
    `    <path data-role="trail" class="fill-none stroke-flow-strong" d="${d}" stroke-width="2" stroke-dasharray="${length} ${length}">`,
    `      <animate attributeName="stroke-dashoffset" dur="${LOOP}s" repeatCount="indefinite" keyTimes="${times}" values="${length};${length};0;0"/>`,
    '    </path>',
    '    <circle class="fill-flow-strong" r="4">',
    `      ${show([[start, end]], LOOP)}`,
    `      <animateMotion dur="${LOOP}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="${times}" path="${d}"/>`,
    '    </circle>',
    '  </g>',
  ].join('\n');
}

function players(points: readonly Point[], joined: readonly Point[]): string {
  const all = [...points, ...joined];
  const dot = (server: Server, window: Interval): string =>
    `    <circle data-role="owner" data-server="${server}" class="fill-${COLOR[server]} stroke-stage stroke-1.5" r="4.5">${show([window], LOOP)}</circle>`;
  return PLAYERS.map(([tag, position]) => {
    const [x, y] = spot(position);
    const before = storedBy(position, points).server;
    const after = storedBy(position, all).server;
    const walker = tag === WALKER;
    const stored = walker ? STORY.walk[1] : STORY.stored;
    const moves = before !== after;
    return [
      `  <g data-role="player" data-tag="${tag}" data-position="${position}" transform="translate(${x} ${y})">`,
      `    ${from(STORY.playersHash)}`,
      ...(moves
        ? [
            `    <circle data-role="moved" class="fill-none stroke-amber stroke-1.5" r="8">${from(STORY.claimed)}</circle>`,
          ]
        : []),
      `    <circle class="${walker ? 'fill-ink' : 'fill-ink-muted'} stroke-stage stroke-1.5" r="4.5">${show([[STORY.playersHash, stored]], LOOP)}</circle>`,
      dot(before, [stored, moves ? STORY.moved : LOOP]),
      ...(moves ? [dot(after, [STORY.moved, LOOP])] : []),
      '  </g>',
    ].join('\n');
  }).join('\n');
}

// Labels beside points on the ring's sides, and above or below points near its top and bottom, so
// a long label never runs into its own point.
function labelFor(position: number): { x: number; y: number; anchor: string } {
  const side = Math.sin((2 * Math.PI * position) / RING);
  const anchor = side > 0.2 ? 'anchor-start' : side < -0.2 ? 'anchor-end' : 'anchor-middle';
  const [x, y] = spot(position, anchor === 'anchor-middle' ? LABEL_R : SIDE_LABEL_R);
  return { x, y: y + 4.5, anchor };
}

function point(p: Point): string {
  const [x, y] = spot(p.position);
  const label = labelFor(p.position);
  return [
    `  <g data-role="point" data-server="${p.server}" data-label="${p.label}" data-position="${p.position}" transform="translate(${x} ${y})">`,
    `    ${from(STORY.lands[p.server])}`,
    `    <rect class="fill-${COLOR[p.server]} stroke-stage stroke-1.5" x="-6.5" y="-6.5" width="13" height="13" rx="2" transform="rotate(45)"/>`,
    `    ${text(`la-label font-semibold ${label.anchor}`, round(label.x - x), round(label.y - y), p.label)}`,
    '  </g>',
  ].join('\n');
}

function moved(points: readonly Point[], joined: readonly Point[]): string {
  const tags = movers(points, joined);
  return [
    '  <g data-role="moved-count">',
    `    ${from(STORY.moved)}`,
    `    ${text('la-title anchor-middle', CX, CY + 4, `${tags.length} of ${PLAYERS.length}`)}`,
    `    ${text('la-note anchor-middle', CX, CY + 26, 'players moved')}`,
    '  </g>',
    `  ${text('la-label anchor-middle', CX, CY + 50, tags.join(', '), { role: 'moved-tags', animation: from(STORY.moved) })}`,
  ].join('\n');
}

function loads(points: readonly Point[], joined: readonly Point[]): string {
  const all = [...points, ...joined];
  const shown = from(STORY.loads);
  const even = PLAYERS.length / SERVERS.length;
  const evenX = BAR_X + even * UNIT;
  const rows = SERVERS.map((server, i) => {
    const y = rowY(i);
    const [before, after] = [count(server, points), count(server, all)];
    const color = COLOR[server];
    return [
      `    <g data-role="load" data-server="${server}">`,
      ...(server === 'db-4' ? [`      ${from(STORY.lands['db-4'])}`] : []),
      `      <circle class="fill-${color}" cx="${PANEL.left + 32}" cy="${y}" r="6"/>`,
      `      ${text('la-label font-semibold', PANEL.left + 48, y + 4.5, server)}`,
      `      <rect data-role="bar-before" class="fill-none stroke-${color} stroke-1.5" x="${BAR_X}" y="${y - 8}" width="${before * UNIT}" height="16" rx="3" stroke-dasharray="4 3">${shown}</rect>`,
      `      <rect data-role="bar-after" class="fill-${color}" x="${BAR_X}" y="${y - 5}" width="${after * UNIT}" height="10" rx="2">${shown}</rect>`,
      `      ${text('fill-ink font-mono text-offset anchor-end', PANEL_RIGHT - 24, y + 4, `${before} → ${after}`, { role: 'count', animation: shown })}`,
      '    </g>',
    ].join('\n');
  });
  const legendY = PANEL.top + PANEL.height - 22;
  return [
    '  <g data-role="loads">',
    `    <rect class="la-canvas stroke-1.5" x="${PANEL.left}" y="${PANEL.top}" width="${PANEL.width}" height="${PANEL.height}" rx="12"/>`,
    `    ${text('la-label font-semibold', PANEL.left + 24, PANEL.top + 32, 'Players per server')}`,
    `    ${text('la-note anchor-end', PANEL_RIGHT - 24, PANEL.top + 32, 'before → after', { animation: shown })}`,
    ...rows,
    '    <g data-role="even-share">',
    `      ${shown}`,
    `      <line class="stroke-ink-muted stroke-1.5" x1="${evenX}" y1="${rowY(0) - 20}" x2="${evenX}" y2="${rowY(SERVERS.length - 1) + 20}" stroke-dasharray="3 4"/>`,
    `      ${text('la-note anchor-middle', evenX, rowY(SERVERS.length - 1) + 40, `even share: ${even}`)}`,
    '    </g>',
    '    <g data-role="bar-legend">',
    `      ${shown}`,
    `      <rect class="fill-none stroke-ink-muted stroke-1.5" x="${PANEL.left + 24}" y="${legendY - 9}" width="24" height="12" rx="3" stroke-dasharray="4 3"/>`,
    `      ${text('la-note', PANEL.left + 56, legendY + 1, 'before db-4 joined')}`,
    `      <rect class="fill-ink-muted" x="${PANEL.left + 216}" y="${legendY - 7}" width="24" height="8" rx="2"/>`,
    `      ${text('la-note', PANEL.left + 248, legendY + 1, 'after')}`,
    '    </g>',
    '  </g>',
  ].join('\n');
}

function captions(lines: View['captions']): string {
  return lines
    .map((words, i) => {
      const window: Interval = [STORY.steps[i] ?? 0, STORY.steps[i + 1] ?? LOOP];
      return `  ${text('la-label', 32, CAPTION_Y, words, { role: 'caption', animation: show([window], LOOP) })}`;
    })
    .join('\n');
}

export function renderView(view: View): string {
  const { points, joined } = view;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" data-loop="${LOOP}s">`,
    `  <title>${TITLE}</title>`,
    `  <desc>${escapeXml(view.desc)}</desc>`,
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
    `  ${text('la-note', 32, 68, view.note)}`,
    ring(points, joined),
    walk(points),
    players(points, joined),
    ...[...points, ...joined].map(point),
    moved(points, joined),
    loads(points, joined),
    captions(view.captions),
    '</svg>',
    '',
  ].join('\n');
  return embedBlock(svg, canonicalStyleBlock());
}
