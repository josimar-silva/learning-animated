import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(readFileSync(new URL('./consumer-group.svg', import.meta.url), 'utf8'));

const COMMITTED: Record<number, number> = { 0: 13, 1: 9, 2: 11, 3: 12 };
// One consumer group, three consumers, four partitions. Consumer 1 owns two.
const ASSIGN = { 0: '0', 1: '1', 2: '1', 3: '2' };

test('has four partitions with contiguous offsets and a tail each', () => {
  const parts = [...svg.querySelectorAll('[data-role="partition"]')];
  assert.equal(parts.length, 4);
  for (const p of parts) {
    const idx = Number(p.getAttribute('data-partition'));
    const cells = [...p.querySelectorAll('[data-role="cell"]')];
    assert.equal(cells.length, COMMITTED[idx], `partition ${idx} committed cell count`);
    cells.forEach((c, k) => {
      assert.equal(Number(c.getAttribute('data-offset')), k, `partition ${idx} offset ${k}`);
    });
    const tail = [...p.querySelectorAll('[data-role="tail"]')];
    assert.equal(tail.length, 1, `partition ${idx} needs one tail`);
  }
});

test('renders a consumer group of three labelled consumers', () => {
  const group = svg.querySelector('[data-role="consumer-group"]');
  assert.ok(group, 'needs a consumer group container');
  const label = svg.querySelector('[data-role="group-label"]');
  assert.ok(label && /Consumer Group/i.test(label.textContent), 'group must be labelled');

  const consumers = [...svg.querySelectorAll('[data-role="consumer"]')];
  assert.equal(consumers.length, 3, 'exactly three consumers');
  const ids = consumers.map((c) => c.getAttribute('data-consumer')).sort();
  assert.deepEqual(ids, ['0', '1', '2']);
  for (const c of consumers) {
    const n = c.getAttribute('data-consumer');
    assert.match(c.textContent, new RegExp(`Consumer ${n}`), `consumer ${n} labelled`);
  }
});

test('wires each partition to its owning consumer and reads it', () => {
  const reads = [...svg.querySelectorAll('[data-role="read"]')];
  assert.equal(reads.length, 4, 'one read link per partition');

  const mapping: Record<string, string | null> = {};
  for (const r of reads) {
    const p = r.getAttribute('data-partition');
    const c = r.getAttribute('data-consumer');
    mapping[String(p)] = c;
    const anims = [...r.querySelectorAll('animate, animateTransform, animateMotion, set')];
    assert.ok(anims.length > 0, `read of partition ${p} must animate`);
  }
  assert.deepEqual(mapping, ASSIGN, 'partition to consumer assignment must match');

  for (const p of svg.querySelectorAll('[data-role="partition"]')) {
    const idx = p.getAttribute('data-partition');
    assert.ok(
      p.querySelector('[data-role="read-marker"]'),
      `partition ${idx} needs a moving read marker`,
    );
  }
});

test('labels the topic', () => {
  const topic = svg.querySelector('[data-role="topic-title"]');
  assert.ok(topic && /topicName/.test(topic.textContent), 'topic title must mention topicName');
});
