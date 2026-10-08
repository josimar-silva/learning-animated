import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  animationsIn,
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
  valueAt,
} from '@learning-animated/svg-kit/timeline';
import { test } from 'vitest';

const { svg } = parseSvg(readFileSync(new URL('./share-group.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

type Window = readonly [number, number];
type Phase = 'before' | 'change' | 'share' | 'stall' | 'redeliver';
type Moment = { el: Element; onset: number };
type RecordState = {
  state: string | null;
  phase: Phase | undefined;
  consumer?: number;
  delivery?: number;
};

// The loop's beats as fractions of it. A consumer group comes first, then a
// share group reads the same partition, shares it, stalls, and redelivers.
const WINDOWS: Readonly<Record<Phase | 'reset', Window>> = {
  before: [0, 0.15],
  change: [0.15, 0.23],
  share: [0.23, 0.5],
  stall: [0.5, 0.7],
  redeliver: [0.7, 0.95],
  reset: [0.95, 1],
};
const PHASES: readonly Phase[] = ['before', 'change', 'share', 'stall', 'redeliver'];
const OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7];

const acquired = (consumer: number, delivery: number, phase: Phase) => ({
  state: 'acquired',
  consumer,
  delivery,
  phase,
});
const available = (phase: Phase) => ({ state: 'available', phase });
const acknowledged = (phase: Phase) => ({ state: 'acknowledged', phase });

// Every record the share group touches and the states it passes through, in
// order, per KIP-932. Consumer 2 stalls on offset 4, so its lock runs out and
// the record goes to Consumer 3 as a second delivery.
const HISTORY = {
  0: [acquired(1, 1, 'share'), acknowledged('share')],
  1: [acquired(2, 1, 'share'), acknowledged('share')],
  2: [acquired(3, 1, 'share'), acknowledged('share')],
  3: [acquired(1, 1, 'stall'), acknowledged('stall')],
  4: [
    acquired(2, 1, 'stall'),
    available('redeliver'),
    acquired(3, 2, 'redeliver'),
    acknowledged('redeliver'),
  ],
  5: [acquired(3, 1, 'stall'), acknowledged('stall')],
};

// Fine enough to land inside every state, which lasts far longer than a step.
const STEP = 1 / 400;

function middleOf([start, end]: Window): number {
  return (start + end) / 2;
}

function momentsIn([start, end]: Window): number[] {
  const moments: number[] = [];
  for (let k = Math.ceil(start / STEP); k * STEP < end; k += 1) moments.push(k * STEP);
  return moments;
}

function phaseAt(t: number): Phase | undefined {
  return PHASES.find((phase) => t >= WINDOWS[phase][0] && t < WINDOWS[phase][1]);
}

// The states a record passed through, in the order they came on screen.
function historyOf(svg: Element, offset: number | string): Moment[] {
  const record = svg.querySelector(`[data-role="record"][data-offset="${offset}"]`);
  assert.ok(record, `offset ${offset} needs a record of its share group state`);
  return [...record.querySelectorAll('[data-role="state"]')]
    .map((el) => ({ el, onset: onsetOf(el)! }))
    .sort((a, b) => a.onset - b.onset);
}

function describeState({ el, onset }: Moment): RecordState {
  const state = el.getAttribute('data-state');
  const described: RecordState = { state, phase: phaseAt(onset) };
  if (state === 'acquired') {
    described.consumer = Number(el.getAttribute('data-consumer'));
    described.delivery = Number(el.getAttribute('data-delivery'));
  }
  return described;
}

function isAcknowledgedAt(svg: Element, offset: number | string, t: number): boolean {
  const record = svg.querySelector(`[data-role="record"][data-offset="${offset}"]`);
  const done = record?.querySelector('[data-role="state"][data-state="acknowledged"]');
  return Boolean(done && opacityAt(done, t) === 1);
}

// Which log cell the start offset marker sits under at a moment in the loop.
function startOffsetAt(svg: Element, t: number): number {
  const bar = svg.querySelector('[data-role="start-offset"] rect')!;
  const x = valueAt(bar, 'x', t);
  const cell = [...svg.querySelectorAll('[data-role="cell"]')].find(
    (c) => Number(c.querySelector('rect')!.getAttribute('x')) === x,
  );
  assert.ok(cell, `the start offset marker at x=${x} must sit under a log cell`);
  return Number(cell.getAttribute('data-offset'));
}

function groupOf(svg: Element, type: string): Element {
  const group = svg.querySelector(`[data-role="group"][data-group-type="${type}"]`);
  assert.ok(group, `the animation needs a ${type} group`);
  return group;
}

function consumersOf(el: Element, role: string): (string | null)[] {
  return [...el.querySelectorAll(`[data-role="${role}"]`)].map((c) =>
    c.getAttribute('data-consumer'),
  );
}

test('is registered as chapter 4, order 6', () => {
  assert.equal(lesson.id, 'share-group', 'index.md must register share-group');
  assert.equal(
    lesson.section,
    'ch04-kafka-consumers',
    'share groups extend the chapter 4 consumer story',
  );
  assert.equal(lesson.order, 6, 'it follows the second consumer group');
});

test('draws topic T1 as a single partition log that never changes', () => {
  const topic = svg.querySelector('[data-role="topic"]');
  assert.ok(topic, 'the animation must draw topic T1');
  assert.match(topic.textContent, /Topic T1/, 'the topic is labelled Topic T1');
  const partitions = [...topic.querySelectorAll('[data-role="partition"]')];
  assert.deepEqual(
    partitions.map((p) => p.getAttribute('data-partition')),
    ['0'],
    'one partition, fewer than the consumers that read it',
  );
  assert.match(partitions[0]!.textContent, /Partition 0/, 'the partition is labelled');
  const cells = [...partitions[0]!.querySelectorAll('[data-role="cell"]')];
  assert.deepEqual(
    cells.map((c) => Number(c.getAttribute('data-offset'))),
    OFFSETS,
    'the log holds offsets 0 to 7, in order',
  );
  for (const cell of cells) {
    assert.equal(
      cell.textContent.trim(),
      cell.getAttribute('data-offset'),
      'each cell shows its offset',
    );
  }
  assert.equal(
    animationsIn(partitions[0]!).length,
    0,
    'the share group tracks records beside the log and never rewrites it',
  );
});

test('opens on a consumer group that leaves two consumers idle', () => {
  const group = groupOf(svg, 'consumer');
  assert.match(group.textContent, /Consumer Group 1/, 'the group is labelled Consumer Group 1');
  assert.deepEqual(consumersOf(group, 'consumer'), ['1', '2', '3'], 'it has three consumers');
  assert.deepEqual(
    consumersOf(group, 'assignment'),
    ['1'],
    'a consumer group gives the partition to one consumer',
  );
  const idle = [...group.querySelectorAll('[data-role="idle"]')];
  assert.deepEqual(consumersOf(group, 'idle'), ['2', '3'], 'the other two have nothing to read');
  for (const badge of idle) {
    assert.match(badge.textContent, /idle/, 'idle is spelled out, not only coloured');
  }
  assert.ok(shownThroughout(group, WINDOWS.before), 'the consumer group opens the loop');
  assert.ok(
    hiddenThroughout(group, [WINDOWS.share[0], WINDOWS.reset[0]]),
    'it is gone once the share group takes over',
  );
});

test('has a share group assign the partition to all three consumers', () => {
  const group = groupOf(svg, 'share');
  assert.match(group.textContent, /Share Group 1/, 'the group is labelled Share Group 1');
  assert.deepEqual(consumersOf(group, 'consumer'), ['1', '2', '3'], 'it has three consumers');
  assert.deepEqual(
    consumersOf(group, 'assignment'),
    ['1', '2', '3'],
    'the share group assigns partition 0 to every consumer',
  );
  assert.equal(group.querySelector('[data-role="idle"]'), null, 'no consumer is idle');
  assert.ok(hiddenThroughout(group, WINDOWS.before), 'the share group is not there at first');
  assert.ok(
    shownThroughout(group, [WINDOWS.share[0], WINDOWS.reset[0]]),
    'it reads the partition for the rest of the loop',
  );
  for (const arrow of group.querySelectorAll('[data-role="assignment"]')) {
    const consumer = arrow.getAttribute('data-consumer');
    const glow = arrow.querySelector('[data-role="glow"]');
    if (consumer === '1') {
      assert.equal(glow, null, 'Consumer 1 already had the partition, so nothing changes there');
      continue;
    }
    assert.ok(glow, `consumer ${consumer} gains the partition, so its arrow is marked new`);
    assert.equal(opacityAt(glow, middleOf(WINDOWS.change)), 1, 'it glows while the group changes');
    assert.equal(opacityAt(glow, middleOf(WINDOWS.share)), 0, 'and settles once it has');
  }
});

test('walks every record through the states the broker tracks for it', () => {
  assert.deepEqual(
    [...svg.querySelectorAll('[data-role="record"]')].map((r) => r.getAttribute('data-offset')),
    Object.keys(HISTORY),
    'the share group tracks offsets 0 to 5, and 6 and 7 are never handed out',
  );
  for (const [offset, expected] of Object.entries(HISTORY)) {
    assert.deepEqual(
      historyOf(svg, offset).map(describeState),
      expected,
      `offset ${offset} passes through its states in order, each in its own beat`,
    );
  }
});

test('keeps each record in exactly one state at a time', () => {
  for (const offset of Object.keys(HISTORY)) {
    const states = historyOf(svg, offset);
    for (const t of momentsIn([0, WINDOWS.reset[0]])) {
      const shown = states.filter(({ el }) => opacityAt(el, t) === 1);
      const partial = states.filter(({ el }) => ![0, 1].includes(opacityAt(el, t)));
      assert.equal(partial.length, 0, `offset ${offset} switches state cleanly at ${t}`);
      assert.equal(
        shown.length,
        t < states[0]!.onset ? 0 : 1,
        `offset ${offset} shows ${t < states[0]!.onset ? 'no state before it is handed out' : 'exactly one state'} at ${t}`,
      );
    }
  }
});

test('spells each state out on the record, not only in colour', () => {
  const wording: Record<string, RegExp> = { acknowledged: /^acked$/, available: /^avail$/ };
  for (const state of svg.querySelectorAll('[data-role="record"] [data-role="state"]')) {
    const name = state.getAttribute('data-state')!;
    const expected =
      name === 'acquired'
        ? new RegExp(`^C${state.getAttribute('data-consumer')}$`)
        : wording[name]!;
    assert.match(state.textContent.trim(), expected, `a ${name} record says so`);
  }
});

test('counts every delivery of a record, starting from one', () => {
  for (const offset of Object.keys(HISTORY)) {
    const deliveries = historyOf(svg, offset)
      .filter(({ el }) => el.getAttribute('data-state') === 'acquired')
      .map(({ el }) => Number(el.getAttribute('data-delivery')));
    assert.deepEqual(
      deliveries,
      deliveries.map((_, i) => i + 1),
      `offset ${offset} counts its deliveries 1, 2, ... as it is handed out again`,
    );
  }
});

test('carries each record to the consumer that acquired it', () => {
  let acquisitions = 0;
  for (const offset of Object.keys(HISTORY)) {
    const states = historyOf(svg, offset);
    states.forEach(({ el, onset }, i) => {
      if (el.getAttribute('data-state') !== 'acquired') return;
      acquisitions += 1;
      const [consumer, delivery] = ['data-consumer', 'data-delivery'].map((n) =>
        el.getAttribute(n),
      );
      const trips = svg.querySelectorAll(
        `[data-role="delivery"][data-offset="${offset}"][data-consumer="${consumer}"][data-delivery="${delivery}"]`,
      );
      assert.equal(trips.length, 1, `offset ${offset} travels to consumer ${consumer} once`);
      const dot = trips[0]!.querySelector('[data-role="dot"]')!;
      assert.ok(
        hiddenThroughout(dot, [0, onset]),
        'nothing travels before the broker hands it out',
      );
      assert.ok(
        !hiddenThroughout(dot, [onset, states[i + 1]!.onset]),
        `offset ${offset} reaches consumer ${consumer} while that consumer holds it`,
      );
    });
  }
  assert.equal(
    svg.querySelectorAll('[data-role="delivery"]').length,
    acquisitions,
    'every trip is a delivery of an acquired record',
  );
});

test('has only the consumer holding a record acknowledge it', () => {
  let acknowledgements = 0;
  for (const offset of Object.keys(HISTORY)) {
    const states = historyOf(svg, offset);
    states.forEach(({ el, onset }, i) => {
      if (el.getAttribute('data-state') !== 'acknowledged') return;
      acknowledgements += 1;
      const holder = states[i - 1]!;
      assert.equal(
        holder.el.getAttribute('data-state'),
        'acquired',
        `offset ${offset} is acknowledged by a consumer that has it`,
      );
      const consumer = holder.el.getAttribute('data-consumer');
      const acks = svg.querySelectorAll(
        `[data-role="ack"][data-offset="${offset}"][data-consumer="${consumer}"]`,
      );
      assert.equal(acks.length, 1, `consumer ${consumer} acknowledges offset ${offset} once`);
      const dot = acks[0]!.querySelector('[data-role="dot"]')!;
      assert.ok(hiddenThroughout(dot, [0, holder.onset]), 'no acknowledgement before it is held');
      assert.ok(
        hiddenThroughout(dot, [onset, 1]),
        'the acknowledgement lands as the record is done',
      );
      assert.ok(!hiddenThroughout(dot, [holder.onset, onset]), 'the acknowledgement travels back');
    });
  }
  assert.equal(
    svg.querySelectorAll('[data-role="ack"]').length,
    acknowledgements,
    'every acknowledgement finishes a record',
  );
  assert.equal(
    svg.querySelector('[data-role="ack"][data-offset="4"][data-consumer="2"]'),
    null,
    'Consumer 2 stalls, so it never acknowledges offset 4',
  );
});

test('hands records to all three consumers, acknowledged in any order', () => {
  const holders = new Set<string | null>();
  const finished: Record<string, number> = {};
  for (const offset of Object.keys(HISTORY)) {
    for (const { el, onset } of historyOf(svg, offset)) {
      if (el.getAttribute('data-state') === 'acquired')
        holders.add(el.getAttribute('data-consumer'));
      if (el.getAttribute('data-state') === 'acknowledged') finished[offset] = onset;
    }
  }
  assert.deepEqual([...holders].sort(), ['1', '2', '3'], 'every consumer gets records to process');
  assert.ok(finished[2]! < finished[0]!, 'offset 2 can be finished before offset 0');
});

test('has Consumer 2 stall on offset 4 until its lock runs out', () => {
  const stalled = svg.querySelector('[data-role="stalled"][data-consumer="2"]');
  assert.ok(stalled, 'Consumer 2 is marked as stalled');
  assert.match(stalled.textContent, /stalled/, 'the stall is spelled out, not only coloured');
  const [held, freed] = historyOf(svg, 4);
  assert.ok(hiddenThroughout(stalled, [0, held!.onset]), 'it only stalls once it holds offset 4');
  assert.equal(phaseAt(onsetOf(stalled)!), 'stall', 'it stalls in the stall beat');
  assert.ok(onsetOf(stalled)! < freed!.onset, 'the stall comes before the lock runs out');
  assert.ok(
    shownThroughout(stalled, [freed!.onset, WINDOWS.reset[0]]),
    'Consumer 2 stays stuck, which is why its record has to go elsewhere',
  );
});

test('tells Consumer 3 that offset 4 is its second delivery', () => {
  const badge = svg.querySelector(
    '[data-role="delivery-count"][data-consumer="3"][data-offset="4"]',
  );
  assert.ok(badge, 'the redelivered record shows its delivery count at the consumer');
  assert.match(badge.textContent, /delivery 2/, 'the count is spelled out');
  const [, , redelivered, done] = historyOf(svg, 4);
  assert.ok(hiddenThroughout(badge, [0, redelivered!.onset]), 'no count before the redelivery');
  assert.ok(
    shownThroughout(badge, [done!.onset, WINDOWS.reset[0]]),
    'the count stays once it lands',
  );
});

test('moves the start offset only past acknowledged records', () => {
  const marker = svg.querySelector('[data-role="start-offset"]');
  assert.ok(marker, 'the share group shows its start offset');
  assert.match(marker.textContent, /start offset/, 'the marker is labelled');
  assert.ok(hiddenThroughout(marker, WINDOWS.before), 'a consumer group has no such marker here');
  assert.ok(
    shownThroughout(marker, [WINDOWS.share[0], WINDOWS.reset[0]]),
    'the marker is shown while the share group reads',
  );
  for (const t of momentsIn([WINDOWS.share[0], WINDOWS.reset[0]])) {
    const expected = OFFSETS.find((offset) => !isAcknowledgedAt(svg, offset, t));
    assert.equal(
      startOffsetAt(svg, t),
      expected,
      `at ${t} the start offset sits at the lowest record not yet acknowledged`,
    );
  }
});

test('holds the start offset at offset 4 while later records finish', () => {
  const moments = momentsIn([WINDOWS.stall[0], WINDOWS.reset[0]]);
  assert.ok(
    moments.some((t) => isAcknowledgedAt(svg, 5, t) && startOffsetAt(svg, t) === 4),
    'offset 5 is done while the start offset still waits on offset 4',
  );
  assert.equal(
    startOffsetAt(svg, WINDOWS.reset[0] - STEP),
    6,
    'once offset 4 is done, the start offset catches up to offset 6',
  );
});

test('explains every state in words in its legend', () => {
  const legend = svg.querySelector('[data-role="legend"]');
  assert.ok(legend, 'the animation carries a legend');
  const used = new Set(
    [...svg.querySelectorAll('[data-role="record"] [data-role="state"]')].map((s) =>
      s.getAttribute('data-state'),
    ),
  );
  for (const state of used) {
    const entry = legend.querySelector(`[data-state="${state}"]`);
    assert.ok(entry, `the legend explains the ${state} state`);
    assert.match(entry.textContent, new RegExp(state!), `the ${state} entry names the state`);
  }
});

test('captions each beat in its own window', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  assert.deepEqual(
    captions.map((c) => c.getAttribute('data-phase')),
    PHASES,
    'one caption per beat, in loop order',
  );
  for (const caption of captions) {
    const own = caption.getAttribute('data-phase');
    assert.ok(caption.textContent.trim().length > 0, `the ${own} caption says something`);
    for (const phase of PHASES) {
      assert.equal(
        opacityAt(caption, middleOf(WINDOWS[phase])),
        phase === own ? 1 : 0,
        `the ${own} caption is ${phase === own ? 'shown' : 'hidden'} during the ${phase} beat`,
      );
    }
  }
});

test('runs every beat on one shared loop', () => {
  const durations = new Set(
    animationsIn(svg)
      .map((anim) => anim.getAttribute('dur'))
      .filter(Boolean),
  );
  assert.equal(durations.size, 1, `every beat plays on one loop, got ${[...durations].join(', ')}`);
});
