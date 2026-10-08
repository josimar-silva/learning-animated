import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(readFileSync(new URL('./topic-partitions.svg', import.meta.url), 'utf8'));

// Committed message counts per partition, faithful to Figure 1-5.
const COMMITTED: Record<number, number> = { 0: 13, 1: 9, 2: 11, 3: 12 };

test('has four partitions, each a contiguous log with a tail slot', () => {
  const parts = [...svg.querySelectorAll('[data-role="partition"]')];
  assert.equal(parts.length, 4, 'must render four partitions');

  const seen = new Set<number>();
  for (const p of parts) {
    const idx = Number(p.getAttribute('data-partition'));
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx <= 3, 'partition index 0..3');
    assert.ok(!seen.has(idx), `duplicate partition ${idx}`);
    seen.add(idx);

    const cells = [...p.querySelectorAll('[data-role="cell"]')];
    assert.equal(cells.length, COMMITTED[idx], `partition ${idx} committed cell count`);
    cells.forEach((c, k) => {
      assert.equal(Number(c.getAttribute('data-offset')), k, `partition ${idx} offset ${k}`);
    });

    const tail = [...p.querySelectorAll('[data-role="tail"]')];
    assert.equal(tail.length, 1, `partition ${idx} needs exactly one tail slot`);
    assert.equal(
      Number(tail[0]!.getAttribute('data-offset')),
      COMMITTED[idx],
      `partition ${idx} tail offset must be the next offset`,
    );
  }
});

test('appends to the tail of every partition with an animation', () => {
  const parts = [...svg.querySelectorAll('[data-role="partition"]')];
  for (const p of parts) {
    const idx = p.getAttribute('data-partition');
    assert.ok(p.querySelector('[data-role="write"]'), `partition ${idx} needs a write indicator`);
    const anims = [...p.querySelectorAll('animate, animateTransform, animateMotion, set')];
    assert.ok(anims.length > 0, `partition ${idx} needs an append animation`);
  }
});

test('labels the topic and the message writes', () => {
  const topic = svg.querySelector('[data-role="topic-title"]');
  assert.ok(topic && /topicName/.test(topic.textContent), 'topic title must mention topicName');
  const writes = svg.querySelector('[data-role="writes-label"]');
  assert.ok(writes && /Message Writes/i.test(writes.textContent), 'must label Message Writes');
});
