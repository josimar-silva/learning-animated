import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(
  readFileSync(new URL('./producer-components.svg', import.meta.url), 'utf8'),
);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// The record fields Figure 3-1 shows, in book order. Partition and key are
// optional, which the brackets say.
const FIELDS: [string, string][] = [
  ['topic', 'Topic'],
  ['partition', '[Partition]'],
  ['key', '[Key]'],
  ['value', 'Value'],
];

// The two batch buffers the partitioner feeds, as the figure names them.
const BUFFERS = [
  { topic: 'A', partition: '0' },
  { topic: 'B', partition: '1' },
];

// What each pass of the loop animates, sorted. The descent and the broker
// response happen every time; the branch after "Fail?" is what the pass is about.
const PHASE_FLOWS: Record<string, string[]> = {
  success: ['descend', 'metadata', 'respond'],
  retry: ['descend', 'escalate', 'respond', 'retry'],
  exception: ['descend', 'escalate', 'exception', 'respond'],
};

// The fraction of the 12s loop each pass owns. The three passes must stay
// inside their own third, in book order, so the success-then-retry-then-
// exception narrative never overlaps itself.
const PHASE_WINDOW: Record<string, [number, number]> = {
  success: [0, 1 / 3],
  retry: [1 / 3, 2 / 3],
  exception: [2 / 3, 1],
};

function animationsIn(el: Element): Element[] {
  return [...el.querySelectorAll('animate, animateMotion, animateTransform, set')];
}

// The keyTimes span a flow is actually visible for, trimmed of the leading
// and trailing pin at 0 and 1 that SMIL keyTimes always carry.
function activeWindow(flow: Element): [number, number] {
  const anim = flow.querySelector('animate[attributeName="opacity"]');
  assert.ok(anim, 'a flow needs an opacity animate to time it by');
  const keyTimes = anim
    .getAttribute('keyTimes')!
    .split(';')
    .map((v) => Number(v.trim()));
  return [keyTimes[1]!, keyTimes[keyTimes.length - 2]!];
}

test('is registered as chapter 3, order 1', () => {
  assert.equal(lesson.id, 'producer-components', 'index.md must register producer-components');
  assert.equal(lesson.section, 'ch03-kafka-producers', 'Figure 3-1 lives in chapter 3');
  assert.equal(lesson.order, 1, 'it is the first chapter 3 animation');
});

test('builds a ProducerRecord from its four fields', () => {
  const record = svg.querySelector('[data-role="producer-record"]');
  assert.ok(record, 'needs a ProducerRecord card');
  assert.match(record.textContent, /ProducerRecord/, 'the card names itself');
  const fields = [...record.querySelectorAll('[data-role="field"]')];
  assert.deepEqual(
    fields.map((f) => f.getAttribute('data-field')),
    FIELDS.map(([name]) => name),
    'fields read topic, partition, key, value, as the book orders them',
  );
  for (const [name, label] of FIELDS) {
    const field = record.querySelector(`[data-field="${name}"]`) as Element;
    assert.ok(field.textContent.includes(label), `field ${name} is labelled ${label}`);
  }
});

test('pipes the record through the serializer and then the partitioner', () => {
  const stages = [...svg.querySelectorAll('[data-role="stage"]')];
  assert.deepEqual(
    stages.map((s) => s.getAttribute('data-stage')),
    ['serializer', 'partitioner'],
    'serialization happens before partitioning',
  );
  assert.match(stages[0]!.textContent, /Serializer/, 'the serializer is labelled');
  assert.match(stages[1]!.textContent, /Partitioner/, 'the partitioner is labelled');
});

test('collects records into per-partition batches', () => {
  const buffers = [...svg.querySelectorAll('[data-role="buffer"]')];
  assert.equal(buffers.length, 2, 'Figure 3-1 shows two batch buffers');
  assert.deepEqual(
    buffers.map((b) => ({
      topic: b.getAttribute('data-topic'),
      partition: b.getAttribute('data-partition'),
    })),
    BUFFERS,
    'topic A partition 0 and topic B partition 1',
  );
  for (const buffer of buffers) {
    const topic = buffer.getAttribute('data-topic');
    const partition = buffer.getAttribute('data-partition');
    assert.match(buffer.textContent, new RegExp(`Topic ${topic}`), 'the buffer names its topic');
    assert.match(
      buffer.textContent,
      new RegExp(`Partition ${partition}`),
      'the buffer names its partition',
    );
    const batches = [...buffer.querySelectorAll('[data-role="batch"]')];
    assert.deepEqual(
      batches.map((b) => b.getAttribute('data-batch')),
      ['0', '1', '2'],
      'each buffer holds batch 0, 1, and 2',
    );
    for (const batch of batches) {
      const n = batch.getAttribute('data-batch');
      assert.match(batch.textContent, new RegExp(`Batch ${n}`), `batch ${n} is labelled`);
    }
  }
});

test('dispatches batches to a Kafka broker', () => {
  const broker = svg.querySelector('[data-role="broker"]');
  assert.ok(broker, 'needs a broker');
  assert.match(broker.textContent, /Kafka Broker/, 'the broker names itself');
});

test('draws the fail and retry decisions', () => {
  const decisions = [...svg.querySelectorAll('[data-role="decision"]')];
  assert.deepEqual(
    decisions.map((d) => d.getAttribute('data-decision')).sort(),
    ['fail', 'retry'],
    'both decision diamonds are present',
  );
  const byName = new Map(decisions.map((d) => [d.getAttribute('data-decision'), d] as const));
  assert.match(byName.get('fail')!.textContent, /Fail\?/, 'the fail diamond is labelled');
  assert.match(byName.get('retry')!.textContent, /Retry\?/, 'the retry diamond is labelled');
});

test('draws the dashed producer boundary the figure puts around the client', () => {
  assert.ok(
    svg.querySelector('[data-role="producer-boundary"]'),
    'the client boundary separates producer internals from the broker',
  );
});

test('loops through a success, a retry, and a thrown exception', () => {
  const phases = [...svg.querySelectorAll('[data-role="phase"]')];
  assert.deepEqual(
    phases.map((p) => p.getAttribute('data-phase')),
    ['success', 'retry', 'exception'],
    'the loop runs success, then a retry, then a non-retriable failure',
  );
  for (const phase of phases) {
    const name = String(phase.getAttribute('data-phase'));
    const flows = [...phase.querySelectorAll('[data-role="flow"]')];
    assert.deepEqual(
      flows.map((f) => f.getAttribute('data-flow')).sort(),
      PHASE_FLOWS[name],
      `the ${name} pass animates exactly the flows it needs`,
    );
    for (const flow of flows) {
      assert.ok(
        animationsIn(flow).length > 0,
        `flow ${flow.getAttribute('data-flow')} in the ${name} pass must animate`,
      );
    }
  }
});

test('keeps each pass inside its own third of the loop, in book order', () => {
  const phases = [...svg.querySelectorAll('[data-role="phase"]')];
  for (const phase of phases) {
    const name = String(phase.getAttribute('data-phase'));
    const [lo, hi] = PHASE_WINDOW[name]!;
    for (const flow of phase.querySelectorAll('[data-role="flow"]')) {
      const [start, end] = activeWindow(flow);
      assert.ok(
        start >= lo && end <= hi,
        `flow ${flow.getAttribute('data-flow')} in the ${name} pass must stay within ${lo}-${hi} of the loop, got ${start}-${end}`,
      );
    }
  }
});

test('names the branch it is taking in every pass', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  assert.deepEqual(
    captions.map((c) => c.getAttribute('data-phase')),
    ['success', 'retry', 'exception'],
    'one caption per pass, in loop order',
  );
  for (const caption of captions) {
    assert.ok(caption.textContent.trim().length > 0, 'the caption says something');
    assert.ok(animationsIn(caption).length > 0, 'the caption fades in with its pass');
  }
});

test('returns metadata on success and throws when it cannot retry', () => {
  const metadata = svg.querySelector('[data-role="return-path"][data-return="metadata"]');
  assert.ok(metadata, 'the success path back to the caller is drawn');
  assert.match(metadata.textContent, /Metadata/, 'it says what comes back');
  const exception = svg.querySelector('[data-role="return-path"][data-return="exception"]');
  assert.ok(exception, 'the non-retriable path back to the caller is drawn');
  assert.match(exception.textContent, /exception/i, 'it says an exception is thrown');
});
