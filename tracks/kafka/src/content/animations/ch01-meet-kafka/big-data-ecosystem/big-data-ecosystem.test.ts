import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(
  readFileSync(new URL('./big-data-ecosystem.svg', import.meta.url), 'utf8'),
);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

const SOURCES: Record<string, RegExp> = {
  metrics: /Metrics/,
  logs: /Logs/,
  'transaction-data': /Transaction\s*Data/,
  'iot-data': /IoT Data/,
};

const SYSTEMS: Record<string, RegExp> = {
  'online-applications': /Online\s*Applications/,
  'stream-processing': /Stream\s*Processing/,
  'offline-processing': /Offline\s*Processing/,
};

function flowsOfType(svg: Element, type: string): Element[] {
  return [...svg.querySelectorAll(`[data-role="flow"][data-flow="${type}"]`)];
}

test('is registered as chapter 1, order 5', () => {
  assert.equal(lesson.id, 'big-data-ecosystem', 'index.md must register big-data-ecosystem');
  assert.equal(lesson.section, 'ch01-meet-kafka', 'Figure 1-9 lives in chapter 1');
  assert.equal(lesson.order, 5, 'it follows the multi-datacenter animation');
});

test('puts a single Kafka hub at the centre', () => {
  const hubs = [...svg.querySelectorAll('[data-role="kafka"]')];
  assert.equal(hubs.length, 1, 'exactly one Kafka hub');
  assert.match(hubs[0]!.textContent, /Kafka/, 'the hub is labelled Kafka');
});

test('feeds Kafka from four data sources', () => {
  const sources = [...svg.querySelectorAll('[data-role="source"]')];
  assert.equal(sources.length, 4, 'four data sources');
  assert.deepEqual(
    sources.map((s) => s.getAttribute('data-source')).sort(),
    Object.keys(SOURCES).sort(),
    'the four canonical sources',
  );
  for (const s of sources) {
    const key = String(s.getAttribute('data-source'));
    assert.match(s.textContent, SOURCES[key]!, `source ${key} is labelled`);
  }
});

test('connects three processing and application systems', () => {
  const systems = [...svg.querySelectorAll('[data-role="system"]')];
  assert.equal(systems.length, 3, 'three systems above Kafka');
  assert.deepEqual(
    systems.map((s) => s.getAttribute('data-system')).sort(),
    Object.keys(SYSTEMS).sort(),
    'the three canonical systems',
  );
  for (const s of systems) {
    const key = String(s.getAttribute('data-system'));
    assert.match(s.textContent, SYSTEMS[key]!, `system ${key} is labelled`);
  }
});

test('names the ecosystem tools that make the point', () => {
  assert.match(svg.textContent, /Solr/, 'names an online application tool');
  assert.match(svg.textContent, /Spark/, 'names a stream processing tool');
  assert.match(svg.textContent, /Hadoop/, 'names the offline processing tool');
});

test('animates a produce flow from every source into Kafka', () => {
  const produce = flowsOfType(svg, 'produce');
  assert.equal(produce.length, 4, 'one produce flow per source');
  assert.deepEqual(
    produce.map((f) => f.getAttribute('data-source')).sort(),
    Object.keys(SOURCES).sort(),
    'produce flows cover every source',
  );
  for (const f of produce) {
    const anims = [...f.querySelectorAll('animate, animateMotion, animateTransform, set')];
    assert.ok(anims.length > 0, 'each produce flow must animate');
  }
});

test('exchanges data both ways with each system', () => {
  const exchange = flowsOfType(svg, 'exchange');
  assert.equal(exchange.length, 3, 'one exchange flow per system');
  assert.deepEqual(
    exchange.map((f) => f.getAttribute('data-system')).sort(),
    Object.keys(SYSTEMS).sort(),
    'exchange flows cover every system',
  );
  for (const f of exchange) {
    const motions = [...f.querySelectorAll('animateMotion')];
    assert.ok(
      motions.length >= 2,
      `system ${f.getAttribute('data-system')} must animate a read and a write`,
    );
  }
});
