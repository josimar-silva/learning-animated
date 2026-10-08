export type Interval = readonly [start: number, end: number];
export type Waypoint = readonly [t: number, x: number, y: number];

export function keyTimes(times: readonly number[], loop: number): string {
  return times.map((t) => (t / loop).toFixed(4)).join(';');
}

export function complement(intervals: readonly Interval[], loop: number): Interval[] {
  const gaps: Interval[] = [];
  let cursor = 0;
  for (const [start, end] of [...intervals].sort((a, b) => a[0] - b[0])) {
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < loop) gaps.push([cursor, loop]);
  return gaps;
}

// Shows an element during the intervals and hides it otherwise, on one discrete beat.
export function show(intervals: readonly Interval[], loop: number): string {
  const times = [0];
  const values = ['0'];
  for (const [start, end] of intervals) {
    if (start <= 0) values[0] = '1';
    else {
      times.push(start);
      values.push('1');
    }
    if (end < loop) {
      times.push(end);
      values.push('0');
    }
  }
  return `<animate attributeName="opacity" dur="${loop}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes(times, loop)}" values="${values.join(';')}"/>`;
}

export function move(points: readonly Waypoint[], loop: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || first[0] !== 0 || last[0] !== loop) {
    throw new Error(`move needs waypoints from 0 to ${loop}`);
  }
  const values = points.map(([, x, y]) => `${x},${y}`).join(';');
  return `<animateTransform attributeName="transform" type="translate" dur="${loop}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes(
    points.map(([t]) => t),
    loop,
  )}" values="${values}"/>`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
