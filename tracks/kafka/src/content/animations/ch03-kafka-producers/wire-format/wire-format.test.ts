import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(readFileSync(new URL('./wire-format.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// The three parts the Confluent serializer writes, in the order they go on the
// wire. Only the payload is the record; the first five bytes are the overhead
// that buys the schema lookup.
const PARTS = ['magic', 'schema-id', 'payload'];

function animationsIn(el: Element): Element[] {
  return [...el.querySelectorAll('animate, animateMotion, animateTransform, set')];
}

// The keyTime at which an opacity animate first reaches full visibility, the
// instant the thing it draws lands on screen.
function onsetKeyTime(el: Element): number {
  const anim = el.querySelector('animate[attributeName="opacity"]');
  assert.ok(anim, 'a thing that comes and goes must animate its opacity');
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
  return keyTimes[at]!;
}

function anatomy(svg: Element): Element {
  const frame = svg.querySelector('[data-role="frame"][data-frame="anatomy"]');
  assert.ok(frame, 'the animation must spell the frame out at full size');
  return frame;
}

test('is registered as chapter 3, order 4', () => {
  assert.equal(lesson.id, 'wire-format', 'index.md must register wire-format');
  assert.equal(lesson.section, 'ch03-kafka-producers', 'the Avro wire format is a chapter 3 idea');
  assert.equal(lesson.order, 4, 'it follows Figure 3-2');
});

test('lays the frame out as magic byte, schema id, then payload', () => {
  const parts = [...anatomy(svg).querySelectorAll('[data-part]')];
  assert.deepEqual(
    parts.map((p) => p.getAttribute('data-part')),
    PARTS,
    'the frame reads magic byte, schema id, payload from left to right',
  );
});

test('states the width of the two fixed fields', () => {
  const partText = (name: string) =>
    anatomy(svg).querySelector(`[data-part="${name}"]`)!.textContent.replace(/\s+/g, ' ');
  assert.match(partText('magic'), /1 byte/i, 'the magic byte is one byte, and says so');
  assert.match(partText('schema-id'), /4 bytes/i, 'the schema id is four bytes, and says so');
});

test('draws the overhead as small next to the record it carries', () => {
  const widthOf = (name: string) => {
    const rect = anatomy(svg).querySelector(`[data-part="${name}"] rect`);
    assert.ok(rect, `the ${name} field must be drawn as a rect`);
    return Number(rect.getAttribute('width'));
  };
  const overhead = widthOf('magic') + widthOf('schema-id');
  const payload = widthOf('payload');
  assert.ok(
    overhead < payload,
    `the five bytes of overhead (${overhead}) must read as smaller than the record (${payload})`,
  );
});

test('calls the registry on both sides, and only while the caches are cold', () => {
  const calls = [...svg.querySelectorAll('[data-role="flow"][data-flow="registry-call"]')];
  assert.deepEqual(
    calls.map((c) => c.getAttribute('data-side')),
    ['producer', 'consumer'],
    'the serializer resolves the schema, and so does the deserializer',
  );
  for (const call of calls) {
    assert.equal(
      call.getAttribute('data-beat'),
      'cold',
      'a warm cache makes no call, so every registry call belongs to the cold beat',
    );
    assert.ok(animationsIn(call).length > 0, 'a registry call must animate');
  }
});

test('sends the record through Kafka in both beats', () => {
  for (const beat of ['cold', 'warm']) {
    for (const flow of ['produce', 'deliver']) {
      const el = svg.querySelector(`[data-role="flow"][data-flow="${flow}"][data-beat="${beat}"]`);
      assert.ok(el, `the ${beat} beat must still ${flow} the record`);
      assert.ok(animationsIn(el).length > 0, `the ${beat} ${flow} must animate`);
    }
  }
});

test('misses each cache once, then hits it', () => {
  const caches = [...svg.querySelectorAll('[data-role="cache"]')];
  assert.deepEqual(
    caches.map((c) => c.getAttribute('data-side')),
    ['producer', 'consumer'],
    'both the serializer and the deserializer keep a cache',
  );
  for (const cache of caches) {
    const side = cache.getAttribute('data-side');
    const miss = cache.querySelector('[data-state="miss"]');
    const hit = cache.querySelector('[data-state="hit"]');
    assert.ok(miss, `the ${side} cache must show its miss`);
    assert.ok(hit, `the ${side} cache must show its hit`);
    assert.ok(
      onsetKeyTime(miss) < onsetKeyTime(hit),
      `the ${side} cache misses before it hits, never the other way round`,
    );
  }
});

test('runs every beat against one shared loop', () => {
  const durations = new Set(
    animationsIn(svg)
      .map((anim) => anim.getAttribute('dur'))
      .filter(Boolean),
  );
  assert.equal(
    durations.size,
    1,
    `the whole frame must share one loop, got ${[...durations].join(', ')}`,
  );
});
