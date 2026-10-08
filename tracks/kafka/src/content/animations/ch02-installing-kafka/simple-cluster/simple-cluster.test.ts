import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(readFileSync(new URL('./simple-cluster.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// The three partitions the cluster hosts, keyed as topic/partition. Broker 1 and
// broker 2 split topic A; broker 3 holds topic B. This is the shape of Figure 2-2.
const PLACEMENT: Record<string, { topic: string; partition: string }> = {
  1: { topic: 'A', partition: '0' },
  2: { topic: 'A', partition: '1' },
  3: { topic: 'B', partition: '0' },
};

const TARGETS = ['A/0', 'A/1', 'B/0'];

function idOf(el: Element): string {
  return `${el.getAttribute('data-topic')}/${el.getAttribute('data-partition')}`;
}

test('is registered as chapter 2, order 1', () => {
  assert.equal(lesson.id, 'simple-cluster', 'index.md must register simple-cluster');
  assert.equal(lesson.section, 'ch02-installing-kafka', 'Figure 2-2 lives in chapter 2');
  assert.equal(lesson.order, 1, 'it is the first chapter 2 animation');
});

test('renders a labelled cluster of three brokers', () => {
  const cluster = svg.querySelector('[data-role="cluster"]');
  assert.ok(cluster, 'needs a cluster container');
  assert.match(svg.textContent, /Kafka Cluster/, 'cluster must be labelled');

  const brokers = [...svg.querySelectorAll('[data-role="broker"]')];
  assert.equal(brokers.length, 3, 'exactly three brokers');
  assert.deepEqual(
    brokers.map((b) => b.getAttribute('data-broker')).sort(),
    ['1', '2', '3'],
    'brokers 1, 2, 3',
  );
  for (const b of brokers) {
    const n = b.getAttribute('data-broker');
    assert.match(b.textContent, new RegExp(`Broker ${n}`), `broker ${n} labelled`);
  }
});

test('places one topic partition on each broker', () => {
  const partitions = [...svg.querySelectorAll('[data-role="partition"]')];
  assert.equal(partitions.length, 3, 'one partition per broker');
  for (const p of partitions) {
    const broker = String(p.getAttribute('data-broker'));
    const want = PLACEMENT[broker];
    assert.ok(want, `partition on a known broker, got ${broker}`);
    assert.equal(
      p.getAttribute('data-topic'),
      want.topic,
      `broker ${broker} hosts topic ${want.topic}`,
    );
    assert.equal(
      p.getAttribute('data-partition'),
      want.partition,
      `broker ${broker} hosts partition ${want.partition}`,
    );
    assert.match(p.textContent, new RegExp(`Topic ${want.topic}`), 'partition names its topic');
    assert.match(
      p.textContent,
      new RegExp(`Partition ${want.partition}`),
      'partition names its index',
    );
  }
});

test('shows two producers and one consumer', () => {
  const producers = [...svg.querySelectorAll('[data-role="producer"]')];
  assert.equal(producers.length, 2, 'two producers');
  assert.deepEqual(
    producers.map((p) => p.getAttribute('data-producer')).sort(),
    ['1', '2'],
    'producers 1 and 2',
  );
  for (const p of producers) assert.match(p.textContent, /Producer/, 'producer labelled');

  const consumers = [...svg.querySelectorAll('[data-role="consumer"]')];
  assert.equal(consumers.length, 1, 'one consumer');
  assert.match(consumers[0]!.textContent, /Consumer/, 'consumer labelled');
});

test('animates a produce flow into each partition', () => {
  const produce = [...svg.querySelectorAll('[data-role="flow"][data-flow="produce"]')];
  assert.equal(produce.length, 3, 'one produce flow per partition');
  assert.deepEqual(produce.map(idOf).sort(), TARGETS, 'produce flows cover A/0, A/1, B/0');
  for (const f of produce) {
    const anims = [...f.querySelectorAll('animate, animateMotion, animateTransform, set')];
    assert.ok(anims.length > 0, `produce flow ${idOf(f)} must animate`);
  }
});

test('routes each producer to the partitions it writes', () => {
  const produce = [...svg.querySelectorAll('[data-role="flow"][data-flow="produce"]')];
  const byProducer: Record<string, Set<string>> = { 1: new Set(), 2: new Set() };
  for (const f of produce) {
    const who = String(f.getAttribute('data-producer'));
    assert.ok(byProducer[who], `flow tagged with a real producer, got ${who}`);
    byProducer[who].add(idOf(f));
  }
  assert.deepEqual(
    [...byProducer[1]!].sort(),
    ['A/0', 'A/1'],
    'producer 1 writes both topic A partitions',
  );
  assert.deepEqual([...byProducer[2]!].sort(), ['B/0'], 'producer 2 writes topic B partition 0');
});

test('animates a consume flow from each partition to the consumer', () => {
  const consume = [...svg.querySelectorAll('[data-role="flow"][data-flow="consume"]')];
  assert.equal(consume.length, 3, 'one consume flow per partition');
  assert.deepEqual(consume.map(idOf).sort(), TARGETS, 'consume flows cover A/0, A/1, B/0');
  for (const f of consume) {
    const anims = [...f.querySelectorAll('animate, animateMotion, animateTransform, set')];
    assert.ok(anims.length > 0, `consume flow ${idOf(f)} must animate`);
  }
});
