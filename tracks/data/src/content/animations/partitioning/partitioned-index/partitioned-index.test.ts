import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg, tagOf } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './partitioned-index.gen.ts';

const LOOP = 30;
const MONTHS = [
  { partition: 'matches_2026_01', month: '2026-01' },
  { partition: 'matches_2026_02', month: '2026-02' },
  { partition: 'matches_2026_03', month: '2026-03' },
] as const;
const [JANUARY, FEBRUARY, MARCH] = MONTHS.map((m) => m.partition) as [string, string, string];
const STATEMENTS = [
  'CREATE INDEX ON matches (match_id);',
  'SELECT * FROM matches WHERE match_id = 51042;',
  'ALTER TABLE matches ADD UNIQUE (match_id);',
  'ALTER TABLE matches ADD UNIQUE (match_id, played_on);',
  "INSERT INTO matches (match_id, played_on) VALUES (51042, '2026-01-31');",
  "INSERT INTO matches (match_id, played_on) VALUES (51042, '2026-02-01');",
];
const BY_ID = 'match_id';
const BY_PAIR = 'match_id played_on';

const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./partitioned-index.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

const all = (selector: string, within: Element = svg): Element[] => [
  ...within.querySelectorAll(selector),
];
const one = (selector: string, within: Element = svg): Element => {
  const found = within.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const textOf = (el: Element): string => el.textContent?.trim() ?? '';
const onset = (el: Element): number => {
  const moment = onsetOf(el);
  if (moment === null) throw new Error(`${el.getAttribute('data-role')} never shows`);
  return moment;
};
// Step n, counted from 1, runs from its own start to the next step's.
const stepWindow = (n: number): [number, number] => [steps[n - 1]!.at, steps[n]?.at ?? LOOP];
const inStep = (n: number, moment: number): boolean => {
  const [from, to] = stepWindow(n);
  return moment > at(from) && moment < at(to);
};
// Hidden before step n starts and after it ends.
const onlyDuring = (el: Element, n: number): boolean => {
  const [from, to] = stepWindow(n);
  return (
    (from === 0 || hiddenThroughout(el, between(0, from - 0.05))) &&
    (to === LOOP || hiddenThroughout(el, between(to + 0.05, LOOP)))
  );
};

type Box = { x: number; y: number; width: number; height: number };
const boxOf = (rect: Element): Box => {
  const [x, y, width, height] = ['x', 'y', 'width', 'height'].map((name) =>
    Number(rect.getAttribute(name)),
  ) as [number, number, number, number];
  return { x, y, width, height };
};
const inside = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

// The offset an element's own linear translate animation gives it at a moment in the loop.
const translateAt = (el: Element, moment: number): [x: number, y: number] => {
  const anim = [...el.children].find((child) => tagOf(child) === 'animatetransform');
  if (!anim) return [0, 0];
  const points = anim
    .getAttribute('values')!
    .split(';')
    .map((pair) => pair.split(',').map(Number) as [number, number]);
  const keyTimes = anim.getAttribute('keyTimes')!.split(';').map(Number);
  let i = keyTimes.length - 1;
  while (i > 0 && keyTimes[i]! > moment) i -= 1;
  if (i === keyTimes.length - 1) return points[i]!;
  const progress = (moment - keyTimes[i]!) / (keyTimes[i + 1]! - keyTimes[i]!);
  const [[x0, y0], [x1, y1]] = [points[i]!, points[i + 1]!];
  return [x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress];
};
const landsIn = (dot: Element, moment: number, partition: string): boolean => {
  const [x, y] = translateAt(dot, moment);
  return inside({ x, y, width: 0, height: 0 }, boxOf(boundsOf(partition)));
};

const statement = (n: number): Element => one(`[data-role="statement"][data-step="${n}"]`);
const result = (n: number): Element => one(`[data-role="result"][data-step="${n}"]`);
const detail = (n: number): Element => one(`[data-role="detail"][data-step="${n}"]`);
const boundsOf = (partition: string): Element =>
  one(`[data-role="partition"][data-partition="${partition}"] [data-role="bounds"]`);
const tree = (partition: string, columns: string): Element =>
  one(`[data-role="tree"][data-partition="${partition}"][data-columns="${columns}"]`);
const leaves = (el: Element): Element[] => all('[data-role="page"][data-page="leaf"]', el);
const keysIn = (el: Element): Element[] => all('[data-role="key"]', el);
const storedKeys = (el: Element): Element[] =>
  keysIn(el).filter((key) => !key.hasAttribute('data-new'));
const matchOf = (key: Element): number => Number(key.getAttribute('data-match'));
const dateOf = (key: Element): string => key.getAttribute('data-played-on') ?? '';
const cellOf = (key: Element): Element => one('[data-role="cell"]', key);
const keyFor = (partition: string, columns: string, id: number, date: string): Element => {
  const found = keysIn(tree(partition, columns)).find(
    (key) => matchOf(key) === id && dateOf(key) === date,
  );
  if (!found) throw new Error(`no key ${id} ${date} in ${partition} (${columns})`);
  return found;
};
// A root page and two leaves, joined by two edges, all showing from a moment to the loop's end.
const drawnFrom = (t: Element, moment: number): boolean => {
  const frames = all('[data-role="frame"]', t);
  const edges = all('[data-role="edges"] path', t);
  return (
    frames.length === 3 &&
    edges.length === 2 &&
    [...frames, ...edges, ...storedKeys(t)].every((el) => shownThroughout(el, [moment, 1]))
  );
};
const shownAt = (selector: string, seconds: number): string | null => {
  const shown = all(selector).filter((el) => opacityAt(el, at(seconds)) === 1);
  if (shown.length > 1) throw new Error(`${shown.length} of ${selector} show at ${seconds} s`);
  return shown[0] ? textOf(shown[0]) : null;
};

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 30 s, in six steps that start on whole seconds', () => {
  expect(svg.getAttribute('data-loop')).toBe('30s');
  expect(steps).toHaveLength(STATEMENTS.length);
  for (const step of steps) expect(Number.isInteger(step.at)).toBe(true);
});

test('each step runs one statement, and the session answers it only during that step', () => {
  expect(all('[data-role="statement"]').map(textOf)).toEqual(STATEMENTS);
  STATEMENTS.forEach((_, i) => {
    const n = i + 1;
    const [from, to] = stepWindow(n);
    expect(shownThroughout(statement(n), between(from + 0.05, to - 0.05))).toBe(true);
    expect(onlyDuring(statement(n), n)).toBe(true);
    expect(inStep(n, onset(result(n)))).toBe(true);
    expect(shownThroughout(result(n), [onset(result(n)), at(to - 0.05)])).toBe(true);
    expect(onlyDuring(result(n), n)).toBe(true);
  });
  expect(all('[data-role="detail"]').map((d) => d.getAttribute('data-step'))).toEqual(['3', '5']);
  for (const n of [3, 5]) {
    expect(onset(detail(n))).toBe(onset(result(n)));
    expect(onlyDuring(detail(n), n)).toBe(true);
  }
});

test('matches is split by played_on into one partition per month', () => {
  const table = textOf(one('[data-role="table"]'));
  expect(table).toMatch(/^matches\s+PARTITION BY RANGE \(played_on\)/);
  const partitions = all('[data-role="partition"]');
  expect(
    partitions.map((p) => [p.getAttribute('data-partition'), p.getAttribute('data-month')]),
  ).toEqual(MONTHS.map((m) => [m.partition, m.month]));
  for (const p of partitions) {
    expect(textOf(p)).toContain(p.getAttribute('data-partition'));
    expect(shownThroughout(p, between(0, LOOP))).toBe(true);
  }
});

test('CREATE INDEX builds one B-tree in each partition, and none for matches itself', () => {
  const trees = all(`[data-role="tree"][data-columns="${BY_ID}"]`);
  expect(trees.map((t) => t.getAttribute('data-partition'))).toEqual([JANUARY, FEBRUARY, MARCH]);
  const done = result(1);
  expect(textOf(done)).toBe('CREATE INDEX');
  expect(done.getAttribute('data-outcome')).toBe('ok');
  expect(inStep(1, onset(done))).toBe(true);
  const builds = trees.map(onset);
  builds.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(builds[i]!));
  for (const [i, t] of trees.entries()) {
    const partition = MONTHS[i]!.partition;
    expect(textOf(one('[data-role="index-name"]', t))).toBe(`${partition}_match_id_idx`);
    expect(inStep(1, builds[i]!)).toBe(true);
    expect(builds[i]!).toBeLessThan(onset(done));
    expect(hiddenThroughout(t, [0, builds[i]! - 0.001])).toBe(true);
    expect(drawnFrom(t, onset(done))).toBe(true);
    for (const frame of all('[data-role="frame"]', t)) {
      expect(inside(boxOf(frame), boxOf(boundsOf(partition)))).toBe(true);
    }
  }
  expect(all('[data-role="tree"]', one('[data-role="table"]'))).toEqual([]);
});

test("each tree holds its own month's matches in key order, under a root that splits its two leaves", () => {
  for (const { partition, month } of MONTHS) {
    for (const columns of [BY_ID, BY_PAIR]) {
      const t = tree(partition, columns);
      const keys = storedKeys(t);
      expect(keys).toHaveLength(4);
      for (const key of keys) {
        expect(dateOf(key).startsWith(`${month}-`)).toBe(true);
        // Five digits, so a match id never reads as a player id.
        expect(String(matchOf(key))).toMatch(/^\d{5}$/);
      }
      const matches = keys.map(matchOf);
      expect(matches).toEqual([...matches].sort((a, b) => a - b));
      const [left, right] = leaves(t) as [Element, Element];
      const separator = one('[data-role="page"][data-page="root"] [data-role="separator"]', t);
      const firstRight = storedKeys(right)[0]!;
      expect(matchOf(separator)).toBe(matchOf(firstRight));
      for (const key of storedKeys(left)) expect(matchOf(key)).toBeLessThan(matchOf(separator));
      if (columns === BY_PAIR) {
        expect(dateOf(separator)).toBe(dateOf(firstRight));
        for (const key of keys) expect(textOf(key)).toContain(dateOf(key).slice(5));
      }
    }
    expect(storedKeys(tree(partition, BY_ID)).map((k) => [matchOf(k), dateOf(k)])).toEqual(
      storedKeys(tree(partition, BY_PAIR)).map((k) => [matchOf(k), dateOf(k)]),
    );
  }
});

test("a lookup by match_id alone searches every month's tree in turn, even after January's finds 51042", () => {
  const probes = all('[data-role="probe"]');
  expect(probes.map((p) => p.getAttribute('data-partition'))).toEqual([JANUARY, FEBRUARY, MARCH]);
  const starts = probes.map(onset);
  for (const moment of starts) expect(inStep(2, moment)).toBe(true);
  starts.slice(1).forEach((moment, i) => expect(moment).toBeGreaterThan(starts[i]!));

  const outcomes = MONTHS.map(({ partition }) =>
    one(`[data-role="search-result"][data-partition="${partition}"]`),
  );
  expect(outcomes.map((o) => o.getAttribute('data-found'))).toEqual(['true', 'false', 'false']);
  expect(outcomes.map(textOf)).toEqual(['51042 found', 'no 51042', 'no 51042']);
  outcomes.forEach((o, i) => {
    expect(onset(o)).toBeGreaterThan(starts[i]!);
    expect(starts[i + 1] ?? 1).toBeGreaterThan(onset(o));
    expect(landsIn(probes[i]!, onset(o), MONTHS[i]!.partition)).toBe(true);
    expect(onlyDuring(o, 2)).toBe(true);
  });
  const ring = one('[data-role="found"]');
  const found = keyFor(JANUARY, BY_ID, 51042, '2026-01-31');
  expect(inside(boxOf(cellOf(found)), boxOf(ring))).toBe(true);
  expect(onset(ring)).toBe(onset(outcomes[0]!));
  expect(shownThroughout(ring, [onset(ring), at(stepWindow(2)[1] - 0.05)])).toBe(true);
  expect(onlyDuring(ring, 2)).toBe(true);

  const [from] = stepWindow(2);
  expect(shownAt('[data-role="count"]', from + 0.05)).toBe('0');
  outcomes.forEach((o, i) => {
    expect(shownAt('[data-role="count"]', onset(o) * LOOP + 0.05)).toBe(String(i + 1));
  });
  for (const count of all('[data-role="count"], [data-role="count-label"]')) {
    expect(onlyDuring(count, 2)).toBe(true);
  }
  const rows = result(2);
  expect(textOf(rows)).toBe('(1 row)');
  expect(onset(rows)).toBeGreaterThan(onset(outcomes[2]!));
  expect(inStep(2, onset(rows))).toBe(true);
});

test('UNIQUE (match_id) is refused, because each tree checks only its own month', () => {
  const refused = result(3);
  expect(refused.getAttribute('data-outcome')).toBe('error');
  expect(textOf(refused)).toBe(
    'ERROR: UNIQUE constraint on partitioned table must include all partitioning columns',
  );
  expect(textOf(detail(3))).toBe(
    'DETAIL: UNIQUE constraint on table "matches" lacks column "played_on" which is part of the partition key.',
  );
  expect(inStep(3, onset(refused))).toBe(true);
  for (const t of all('[data-role="tree"]')) expect(inStep(3, onset(t))).toBe(false);

  const first = one('[data-role="first"]');
  expect(inside(boxOf(cellOf(keyFor(JANUARY, BY_ID, 51042, '2026-01-31'))), boxOf(first))).toBe(
    true,
  );
  const unseen = one('[data-role="unseen"]');
  expect(unseen.getAttribute('data-partition')).toBe(FEBRUARY);
  expect(textOf(unseen)).toContain('51042');
  expect(inside(boxOf(one('[data-role="chip"]', unseen)), boxOf(boundsOf(FEBRUARY)))).toBe(true);
  const blind = one('[data-role="blind"]');
  const crosses = all('[data-role="cross"]', blind);
  expect(crosses).toHaveLength(2);
  const [januaryRight, februaryLeft] = [boxOf(boundsOf(JANUARY)), boxOf(boundsOf(FEBRUARY))];
  for (const cross of crosses) {
    for (const x of ['x1', 'x2'].map((name) => Number(cross.getAttribute(name)))) {
      expect(x).toBeGreaterThan(januaryRight.x + januaryRight.width);
      expect(x).toBeLessThan(februaryLeft.x);
    }
  }
  const [, to] = stepWindow(3);
  for (const el of [first, unseen, blind]) {
    expect(inStep(3, onset(el))).toBe(true);
    expect(onset(el)).toBeGreaterThan(onset(refused));
    expect(shownThroughout(el, [onset(blind), at(to - 0.05)])).toBe(true);
    expect(onlyDuring(el, 3)).toBe(true);
  }
});

test('UNIQUE (match_id, played_on) is accepted and builds one more tree per month', () => {
  const accepted = result(4);
  expect(textOf(accepted)).toBe('ALTER TABLE');
  expect(accepted.getAttribute('data-outcome')).toBe('ok');
  expect(inStep(4, onset(accepted))).toBe(true);
  const trees = all(`[data-role="tree"][data-columns="${BY_PAIR}"]`);
  expect(trees.map((t) => t.getAttribute('data-partition'))).toEqual([JANUARY, FEBRUARY, MARCH]);
  for (const [i, t] of trees.entries()) {
    const partition = MONTHS[i]!.partition;
    expect(textOf(one('[data-role="index-name"]', t))).toBe(`${partition}_match_id_played_on_key`);
    expect(inStep(4, onset(t))).toBe(true);
    expect(onset(t)).toBeLessThan(onset(accepted));
    expect(hiddenThroughout(t, [0, onset(t) - 0.001])).toBe(true);
    expect(drawnFrom(t, onset(accepted))).toBe(true);
    for (const frame of all('[data-role="frame"]', t)) {
      expect(inside(boxOf(frame), boxOf(boundsOf(partition)))).toBe(true);
    }
  }
});

test("a repeated pair lands in its own month, and that month's tree refuses it", () => {
  const insert = one('[data-role="insert"][data-played-on="2026-01-31"]');
  expect(insert.getAttribute('data-match')).toBe('51042');
  expect(insert.getAttribute('data-partition')).toBe(JANUARY);
  expect(insert.getAttribute('data-verdict')).toBe('refused');
  expect(inStep(5, onset(insert))).toBe(true);

  const twin = keyFor(JANUARY, BY_PAIR, 51042, '2026-01-31');
  const ring = one('[data-role="duplicate"]');
  expect(inside(boxOf(cellOf(twin)), boxOf(ring))).toBe(true);
  expect(onset(ring)).toBeGreaterThan(onset(insert));
  expect(inStep(5, onset(ring))).toBe(true);
  expect(onlyDuring(ring, 5)).toBe(true);
  expect(opacityAt(twin, onset(ring))).toBe(1);
  expect(landsIn(insert, onset(ring), JANUARY)).toBe(true);
  const verdict = one('[data-role="verdict"][data-played-on="2026-01-31"]');
  expect(textOf(verdict)).toBe('pair already here');
  expect(onset(verdict)).toBe(onset(ring));
  expect(onlyDuring(verdict, 5)).toBe(true);

  const refused = result(5);
  expect(refused.getAttribute('data-outcome')).toBe('error');
  expect(textOf(refused)).toBe(
    'ERROR: duplicate key value violates unique constraint "matches_2026_01_match_id_played_on_key"',
  );
  expect(textOf(detail(5))).toBe(
    'DETAIL: Key (match_id, played_on)=(51042, 2026-01-31) already exists.',
  );
  expect(onset(refused)).toBeGreaterThanOrEqual(onset(ring));
  expect(inStep(5, onset(refused))).toBe(true);
  for (const key of all('[data-role="key"][data-new]')) {
    expect(hiddenThroughout(key, between(0, stepWindow(5)[1]))).toBe(true);
  }
});

test('a new pair with the same match id goes in, so match 51042 ends up in two months', () => {
  const insert = one('[data-role="insert"][data-played-on="2026-02-01"]');
  expect(insert.getAttribute('data-match')).toBe('51042');
  expect(insert.getAttribute('data-partition')).toBe(FEBRUARY);
  expect(insert.getAttribute('data-verdict')).toBe('accepted');
  expect(inStep(6, onset(insert))).toBe(true);

  const added = result(6);
  expect(textOf(added)).toBe('INSERT 0 1');
  expect(added.getAttribute('data-outcome')).toBe('ok');
  const verdict = one('[data-role="verdict"][data-played-on="2026-02-01"]');
  expect(textOf(verdict)).toBe('new pair');
  expect(onlyDuring(verdict, 6)).toBe(true);
  const end = at(LOOP - 0.05);
  for (const columns of [BY_ID, BY_PAIR]) {
    const fresh = all('[data-role="key"][data-new]', tree(FEBRUARY, columns));
    expect(fresh.map((k) => [matchOf(k), dateOf(k)])).toEqual([[51042, '2026-02-01']]);
    const key = fresh[0]!;
    expect(inStep(6, onset(key))).toBe(true);
    expect(onset(key)).toBeGreaterThan(onset(insert));
    expect(onset(verdict)).toBe(onset(key));
    expect(landsIn(insert, onset(key), FEBRUARY)).toBe(true);
    expect(onset(added)).toBeGreaterThanOrEqual(onset(key));
    expect(shownThroughout(key, [onset(key), 1])).toBe(true);

    // The leaf keeps its keys in order: every February id is larger, so 51042 goes in first and
    // the others move along one slot.
    const leaf = leaves(tree(FEBRUARY, columns))[0]!;
    const stored = storedKeys(leaf).map(matchOf);
    expect(stored).toHaveLength(2);
    for (const id of stored) expect(id).toBeGreaterThan(51042);
    const xAtEnd = (k: Element): number =>
      Number(cellOf(k).getAttribute('x')) + translateAt(k, end)[0];
    const order = keysIn(leaf)
      .sort((a, b) => xAtEnd(a) - xAtEnd(b))
      .map(matchOf);
    expect(order).toEqual([51042, ...stored]);

    const holders = MONTHS.filter(({ partition }) =>
      keysIn(tree(partition, columns)).some((k) => matchOf(k) === 51042 && opacityAt(k, end) === 1),
    ).map((m) => m.partition);
    expect(holders).toEqual([JANUARY, FEBRUARY]);
  }
  const marks = all('[data-role="twice"]');
  expect(marks).toHaveLength(4);
  for (const mark of marks) {
    expect(inStep(6, onset(mark))).toBe(true);
    expect(onset(mark)).toBeGreaterThan(onset(added));
    expect(shownThroughout(mark, [onset(mark), 1])).toBe(true);
  }
  // One ring on each 51042: January's first report and February's new one, in both indexes.
  const ringed = [
    keyFor(JANUARY, BY_ID, 51042, '2026-01-31'),
    keyFor(JANUARY, BY_PAIR, 51042, '2026-01-31'),
    keyFor(FEBRUARY, BY_ID, 51042, '2026-02-01'),
    keyFor(FEBRUARY, BY_PAIR, 51042, '2026-02-01'),
  ];
  for (const key of ringed) {
    expect(marks.filter((mark) => inside(boxOf(cellOf(key)), boxOf(mark)))).toHaveLength(1);
  }
  const note = one('[data-role="twice-note"]');
  expect(textOf(note)).toBe('match 51042 is now in January and in February');
  expect(onset(note)).toBe(onset(marks[0]!));
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map(textOf)).toEqual(steps.map((step) => step.text));
  captions.forEach((caption, i) => {
    const [from, to] = stepWindow(i + 1);
    expect(shownThroughout(caption, between(from + 0.05, to - 0.05))).toBe(true);
    expect(onlyDuring(caption, i + 1)).toBe(true);
  });
});
