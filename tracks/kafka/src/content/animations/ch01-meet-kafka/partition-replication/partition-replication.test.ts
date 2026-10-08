import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(
  readFileSync(new URL('./partition-replication.svg', import.meta.url), 'utf8'),
);

test('renders a cluster of two brokers, each holding both A partitions', () => {
  const cluster = svg.querySelector('[data-role="cluster"]');
  assert.ok(cluster, 'needs a cluster container');
  assert.match(svg.textContent, /Kafka Cluster/, 'cluster must be labelled');

  const brokers = [...svg.querySelectorAll('[data-role="broker"]')];
  assert.equal(brokers.length, 2, 'exactly two brokers');
  assert.deepEqual(brokers.map((b) => b.getAttribute('data-broker')).sort(), ['1', '2']);
  for (const b of brokers) {
    const n = b.getAttribute('data-broker');
    assert.match(b.textContent, new RegExp(`Broker ${n}`), `broker ${n} labelled`);
  }

  const partitions = [...svg.querySelectorAll('[data-role="partition"]')];
  assert.equal(partitions.length, 4, 'two brokers times two partitions');
  for (const p of partitions) {
    assert.equal(p.getAttribute('data-topic'), 'A', 'partition belongs to topic A');
    assert.ok(
      ['0', '1'].includes(String(p.getAttribute('data-partition'))),
      'partition index 0 or 1',
    );
  }
});

test('marks the leader replica of each partition on a different broker', () => {
  const leaders = [...svg.querySelectorAll('[data-role="partition"][data-leader="true"]')];
  assert.equal(leaders.length, 2, 'each partition has one leader');
  const placement = leaders
    .map((l) => `${l.getAttribute('data-broker')}/${l.getAttribute('data-partition')}`)
    .sort();
  assert.deepEqual(placement, ['1/0', '2/1'], 'A/0 leads on broker 1, A/1 on broker 2');
});

test('shows a producer and a consumer', () => {
  const producer = svg.querySelector('[data-role="producer"]');
  const consumer = svg.querySelector('[data-role="consumer"]');
  assert.ok(producer && /Producer/.test(producer.textContent), 'labelled producer');
  assert.ok(consumer && /Consumer/.test(consumer.textContent), 'labelled consumer');
});

test('animates produce, replicate, and consume flows for both partitions', () => {
  const flows = [...svg.querySelectorAll('[data-role="flow"]')];
  const byType: Record<string, Set<string | null>> = {
    produce: new Set(),
    replicate: new Set(),
    consume: new Set(),
  };
  for (const f of flows) {
    const type = String(f.getAttribute('data-flow'));
    const part = f.getAttribute('data-partition');
    assert.ok(byType[type], `unexpected flow type ${type}`);
    byType[type].add(part);
    const anims = [...f.querySelectorAll('animate, animateTransform, animateMotion, set')];
    assert.ok(anims.length > 0, `${type} flow for A/${part} must animate`);
  }
  for (const type of ['produce', 'replicate', 'consume']) {
    assert.deepEqual([...byType[type]!].sort(), ['0', '1'], `${type} must cover A/0 and A/1`);
  }
});

test('labels the replication of each partition', () => {
  assert.match(svg.textContent, /Replicate A\/0/, 'labels replication of A/0');
  assert.match(svg.textContent, /Replicate A\/1/, 'labels replication of A/1');
});
