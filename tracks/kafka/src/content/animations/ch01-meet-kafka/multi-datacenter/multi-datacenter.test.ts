import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(readFileSync(new URL('./multi-datacenter.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

function flowsOfType(svg: Element, type: string): Element[] {
  return [...svg.querySelectorAll(`[data-role="flow"][data-flow="${type}"]`)];
}

test('is registered as chapter 1, order 4', () => {
  assert.equal(lesson.id, 'multi-datacenter', 'index.md must register multi-datacenter');
  assert.equal(lesson.section, 'ch01-meet-kafka', 'Figure 1-8 lives in chapter 1');
  assert.equal(lesson.order, 4, 'it follows the three seed animations');
});

test('draws three labelled datacenters', () => {
  const dcs = [...svg.querySelectorAll('[data-role="datacenter"]')];
  assert.equal(dcs.length, 3, 'exactly three datacenters');
  assert.deepEqual(
    dcs.map((d) => d.getAttribute('data-dc')).sort(),
    ['A', 'B', 'C'],
    'datacenters A, B, and C',
  );
  for (const d of dcs) {
    const dc = d.getAttribute('data-dc');
    assert.match(d.textContent, new RegExp(`Datacenter ${dc}`), `datacenter ${dc} labelled`);
  }
});

test('places producers in A and B and consumers in A, B, and C', () => {
  const producers = [...svg.querySelectorAll('[data-role="producer"]')];
  assert.equal(producers.length, 2, 'A and B each have a producer');
  for (const p of producers) assert.match(p.textContent, /Producer/, 'producer labelled');

  const consumers = [...svg.querySelectorAll('[data-role="consumer"]')];
  assert.equal(consumers.length, 4, 'A:1, B:1, C:2 consumers');
  for (const c of consumers) assert.match(c.textContent, /Consumer/, 'consumer labelled');
  const inC = consumers.filter((c) => c.getAttribute('data-dc') === 'C');
  assert.equal(inC.length, 2, 'datacenter C reads with two consumers');
});

test('has local clusters in A and B and aggregate clusters in A, B, and C', () => {
  const clusters = [...svg.querySelectorAll('[data-role="cluster"]')];

  const local = clusters.filter((c) => c.getAttribute('data-kind') === 'local');
  assert.deepEqual(
    local.map((c) => c.getAttribute('data-dc')).sort(),
    ['A', 'B'],
    'local clusters in A and B',
  );
  for (const c of local) assert.match(c.textContent, /Kafka Cluster\s*Local/, 'local labelled');

  const aggregate = clusters.filter((c) => c.getAttribute('data-kind') === 'aggregate');
  assert.deepEqual(
    aggregate.map((c) => c.getAttribute('data-dc')).sort(),
    ['A', 'B', 'C'],
    'aggregate clusters in A, B, and C',
  );
  for (const c of aggregate) {
    assert.match(c.textContent, /Kafka Cluster\s*Aggregate/, 'aggregate labelled');
  }
});

test('runs a MirrorMaker in every datacenter', () => {
  const mirrors = [...svg.querySelectorAll('[data-role="mirror-maker"]')];
  assert.equal(mirrors.length, 3, 'one MirrorMaker per datacenter');
  assert.deepEqual(
    mirrors.map((m) => m.getAttribute('data-dc')).sort(),
    ['A', 'B', 'C'],
    'MirrorMakers in A, B, and C',
  );
  for (const m of mirrors) assert.match(m.textContent, /Mirror\s*Maker/, 'mirror maker labelled');
});

test('animates local produce and consume for A and B', () => {
  const produce = flowsOfType(svg, 'produce');
  assert.equal(produce.length, 2, 'a produce flow into each local cluster');

  const consume = flowsOfType(svg, 'consume');
  assert.equal(consume.length, 4, 'A and B locals plus two C aggregate reads');

  for (const f of [...produce, ...consume]) {
    const anims = [...f.querySelectorAll('animate, animateTransform, animateMotion, set')];
    assert.ok(anims.length > 0, 'each local flow must animate');
  }
});

test('mirrors both local clusters into aggregates and chains B to C', () => {
  const mirrorConsume = flowsOfType(svg, 'mirror-consume');
  assert.equal(
    mirrorConsume.length,
    5,
    'each MirrorMaker consumes both A and B locals, and C consumes B aggregate',
  );

  const mirrorProduce = flowsOfType(svg, 'mirror-produce');
  assert.equal(mirrorProduce.length, 3, 'each MirrorMaker produces to its aggregate');

  for (const f of [...mirrorConsume, ...mirrorProduce]) {
    const anims = [...f.querySelectorAll('animate, animateTransform, animateMotion, set')];
    assert.ok(anims.length > 0, 'each mirror flow must animate');
  }
});

test('labels the consume and produce steps of mirroring', () => {
  assert.match(svg.textContent, /Consume/, 'labels the consume step');
  assert.match(svg.textContent, /Produce/, 'labels the produce step');
});
