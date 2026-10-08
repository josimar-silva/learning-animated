import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(readFileSync(new URL('./acks.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// The three settings in the order the book introduces them, with what the
// producer waits for and what happens to the record when the leader crashes
// right after the write.
const LANES = [
  { acks: '0', label: 'acks=0', waits: false, outcome: 'lost' },
  { acks: '1', label: 'acks=1', waits: true, outcome: 'lost' },
  { acks: 'all', label: 'acks=all', waits: true, outcome: 'survives' },
];

function animationsIn(el: Element): Element[] {
  return [...el.querySelectorAll('animate, animateMotion, animateTransform, set')];
}

// The widest value an animated bar reaches, which is the latency it settles on
// before the loop resets it.
function peakWidth(bar: Element): number {
  const anim = bar.querySelector('animate[attributeName="width"]');
  assert.ok(anim, 'the latency bar must animate its width');
  const values = anim
    .getAttribute('values')!
    .split(';')
    .map((v) => Number(v.trim()));
  assert.ok(
    values.every((v) => Number.isFinite(v)),
    'every width value is a number',
  );
  return Math.max(...values);
}

// Whether a record slot's cell carries an opacity animate that ever reaches
// full visibility, i.e. the record was actually written into that slot.
function fillsIn(record: Element): boolean {
  const cell = record.querySelector('.la-cell-new');
  assert.ok(cell, 'a record slot must have a cell to (maybe) fill');
  return animationsIn(cell).some((anim) => {
    if (anim.getAttribute('attributeName') !== 'opacity') return false;
    const values = anim
      .getAttribute('values')!
      .split(';')
      .map((v) => Number(v.trim()));
    return values.includes(1);
  });
}

// The keyTime at which an opacity animate first reaches full visibility, the
// instant the thing it draws is on screen.
function onsetKeyTime(anim: Element) {
  const values = anim
    .getAttribute('values')!
    .split(';')
    .map((v) => Number(v.trim()));
  const keyTimes = anim
    .getAttribute('keyTimes')!
    .split(';')
    .map((v) => Number(v.trim()));
  const at = values.findIndex((v) => v === 1);
  assert.ok(at !== -1, 'an opacity animate that never reaches 1 never becomes visible');
  return keyTimes[at];
}

test('is registered as chapter 3, order 2', () => {
  assert.equal(lesson.id, 'acks', 'index.md must register acks');
  assert.equal(lesson.section, 'ch03-kafka-producers', 'acks is a chapter 3 idea');
  assert.equal(lesson.order, 2, 'it follows the producer components');
});

test('compares the three settings side by side', () => {
  const lanes = [...svg.querySelectorAll('[data-role="lane"]')];
  assert.deepEqual(
    lanes.map((l) => l.getAttribute('data-acks')),
    LANES.map((l) => l.acks),
    'lanes read acks=0, acks=1, acks=all from left to right',
  );
  for (const lane of lanes) {
    const spec = LANES.find((l) => l.acks === lane.getAttribute('data-acks'))!;
    assert.ok(lane.textContent.includes(spec.label), `the lane is headed ${spec.label}`);
  }
});

test('gives every lane a producer, a leader, and two followers', () => {
  for (const lane of svg.querySelectorAll('[data-role="lane"]')) {
    const acks = lane.getAttribute('data-acks');
    assert.ok(lane.querySelector('[data-role="producer"]'), `lane ${acks} needs a producer`);
    const replicas = [...lane.querySelectorAll('[data-role="replica"]')];
    assert.deepEqual(
      replicas.map((r) => r.getAttribute('data-replica')),
      ['leader', 'follower', 'follower'],
      `lane ${acks} shows one leader and two followers`,
    );
    for (const replica of replicas) {
      assert.ok(
        replica.querySelector('[data-role="record"]'),
        `every replica in lane ${acks} has a record slot, filled or empty`,
      );
    }
  }
});

test('fills the follower record only in the lane that finished replicating', () => {
  for (const lane of svg.querySelectorAll('[data-role="lane"]')) {
    const acks = lane.getAttribute('data-acks');
    const spec = LANES.find((l) => l.acks === acks)!;
    const followers = [...lane.querySelectorAll('[data-role="replica"][data-replica="follower"]')];
    assert.equal(followers.length, 2, `lane ${acks} has two followers`);
    for (const follower of followers) {
      const record = follower.querySelector('[data-role="record"]') as Element;
      if (spec.outcome === 'survives') {
        assert.ok(
          fillsIn(record),
          `lane ${acks} follower must fill in, replication finished before the crash`,
        );
      } else {
        assert.ok(
          !fillsIn(record),
          `lane ${acks} follower must never fill in, the crash lands before replication finishes`,
        );
      }
    }
  }
});

test('waits for an acknowledgement only when acks is 1 or all', () => {
  for (const lane of svg.querySelectorAll('[data-role="lane"]')) {
    const acks = lane.getAttribute('data-acks');
    const spec = LANES.find((l) => l.acks === acks)!;
    const ack = lane.querySelector('[data-role="flow"][data-flow="ack"]');
    if (spec.waits) {
      assert.ok(ack, `lane ${acks} acknowledges the write`);
      assert.ok(animationsIn(ack).length > 0, `the ack in lane ${acks} must animate`);
    } else {
      assert.equal(ack, null, 'acks=0 never waits for an acknowledgement');
    }
  }
});

test('writes to the leader and replicates to both followers in every lane', () => {
  for (const lane of svg.querySelectorAll('[data-role="lane"]')) {
    const acks = lane.getAttribute('data-acks');
    const write = lane.querySelector('[data-role="flow"][data-flow="write"]');
    assert.ok(write, `lane ${acks} writes to the leader`);
    assert.ok(animationsIn(write).length > 0, `the write in lane ${acks} must animate`);
    const replicate = [...lane.querySelectorAll('[data-role="flow"][data-flow="replicate"]')];
    assert.equal(replicate.length, 2, `lane ${acks} replicates to both followers`);
    for (const flow of replicate) {
      assert.ok(animationsIn(flow).length > 0, `replication in lane ${acks} must animate`);
    }
  }
});

test('makes waiting cost latency, and more waiting cost more', () => {
  const bars = [...svg.querySelectorAll('[data-role="latency"]')];
  assert.equal(bars.length, 3, 'one latency bar per lane');
  assert.deepEqual(
    bars.map((b) => b.getAttribute('data-acks')),
    LANES.map((l) => l.acks),
    'the bars follow the lanes',
  );
  const [none, leader, all] = bars.map(peakWidth) as [number, number, number];
  assert.ok(none < leader, `acks=1 (${leader}) must cost more than acks=0 (${none})`);
  assert.ok(leader < all, `acks=all (${all}) must cost more than acks=1 (${leader})`);
});

test('crashes the leader in every lane so the comparison is fair', () => {
  const crashes = [...svg.querySelectorAll('[data-role="crash"]')];
  assert.deepEqual(
    crashes.map((c) => c.getAttribute('data-acks')),
    LANES.map((l) => l.acks),
    'every lane has a crash, in lane order',
  );
  const onsets = crashes.map((crash) => {
    const anim = crash.querySelector('animate[attributeName="opacity"]');
    assert.ok(anim, 'the crash appears partway through the loop');
    assert.equal(
      anim.getAttribute('dur'),
      '12s',
      'the crash is timed against the same 12s loop as the rest of the lane',
    );
    return onsetKeyTime(anim);
  });
  assert.ok(
    onsets.every((t) => t === onsets[0]),
    `every lane must crash at the same moment in the loop, got keyTimes ${onsets.join(', ')}`,
  );
});

test('loses the record unless every in-sync replica confirmed it', () => {
  const outcomes = [...svg.querySelectorAll('[data-role="outcome"]')];
  assert.deepEqual(
    outcomes.map((o) => ({
      acks: o.getAttribute('data-acks'),
      outcome: o.getAttribute('data-outcome'),
    })),
    LANES.map((l) => ({ acks: l.acks, outcome: l.outcome })),
    'acks=0 and acks=1 lose the record, acks=all keeps it',
  );
  for (const outcome of outcomes) {
    const word = outcome.getAttribute('data-outcome') === 'lost' ? /lost/i : /survives/i;
    assert.match(outcome.textContent, word, 'the verdict is spelled out, not only colored');
    assert.ok(animationsIn(outcome).length > 0, 'the verdict appears after the crash');
  }
});
