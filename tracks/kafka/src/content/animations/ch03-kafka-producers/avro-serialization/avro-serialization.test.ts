import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg } = parseSvg(
  readFileSync(new URL('./avro-serialization.svg', import.meta.url), 'utf8'),
);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// The four arrows of Figure 3-2, and what each one carries. The split is the
// whole point of the figure: the schema itself only ever travels between an
// actor and the registry, while the path through Kafka carries nothing but the
// id that stands in for it.
const FLOWS = [
  { flow: 'schema-register', from: 'producer', to: 'registry', payload: 'schema' },
  { flow: 'produce', from: 'producer', to: 'broker', payload: 'schema-id' },
  { flow: 'deliver', from: 'broker', to: 'consumer', payload: 'schema-id' },
  { flow: 'schema-fetch', from: 'registry', to: 'consumer', payload: 'schema' },
];

const ACTORS = ['producer', 'broker', 'registry', 'consumer'];

function animationsIn(el: Element): Element[] {
  return [...el.querySelectorAll('animate, animateMotion, animateTransform, set')];
}

function flowsOf(svg: Element): Element[] {
  return [...svg.querySelectorAll('[data-role="flow"]')];
}

test('is registered as chapter 3, order 3', () => {
  assert.equal(lesson.id, 'avro-serialization', 'index.md must register avro-serialization');
  assert.equal(lesson.section, 'ch03-kafka-producers', 'Figure 3-2 is a chapter 3 figure');
  assert.equal(lesson.order, 3, 'it follows the producer components and acks');
});

test('draws the four actors of the figure', () => {
  const actors = [...svg.querySelectorAll('[data-role="actor"]')];
  assert.deepEqual(
    actors.map((a) => a.getAttribute('data-actor')).sort(),
    [...ACTORS].sort(),
    'the figure has a producer, a broker, a registry, and a consumer',
  );
});

test('puts the serializer inside the producer and the deserializer inside the consumer', () => {
  const producer = svg.querySelector('[data-role="actor"][data-actor="producer"]') as Element;
  const consumer = svg.querySelector('[data-role="actor"][data-actor="consumer"]') as Element;
  assert.ok(
    producer.querySelector('[data-role="codec"][data-codec="serializer"]'),
    'the serializer is drawn inside the producer, as in the figure',
  );
  assert.ok(
    consumer.querySelector('[data-role="codec"][data-codec="deserializer"]'),
    'the deserializer is drawn inside the consumer, as in the figure',
  );
});

test('wires the four arrows exactly as the figure does', () => {
  assert.deepEqual(
    flowsOf(svg).map((f) => ({
      flow: f.getAttribute('data-flow'),
      from: f.getAttribute('data-from'),
      to: f.getAttribute('data-to'),
    })),
    FLOWS.map(({ flow, from, to }) => ({ flow, from, to })),
    'producer to registry, producer to broker, broker to consumer, registry to consumer',
  );
});

test('animates every arrow', () => {
  for (const flow of flowsOf(svg)) {
    const name = flow.getAttribute('data-flow');
    assert.ok(
      animationsIn(flow).length > 0,
      `the ${name} arrow must carry something, not sit still`,
    );
  }
});

test('sends the schema only to and from the registry, never through Kafka', () => {
  assert.deepEqual(
    flowsOf(svg).map((f) => ({
      flow: f.getAttribute('data-flow'),
      payload: f.getAttribute('data-payload'),
    })),
    FLOWS.map(({ flow, payload }) => ({ flow, payload })),
    'the Kafka path carries the schema id, the registry path carries the schema',
  );
});

test('keeps the labels the book puts on the figure', () => {
  const labelOf = (flow: string) =>
    svg.querySelector(`[data-role="flow"][data-flow="${flow}"]`)!.textContent.replace(/\s+/g, ' ');
  assert.match(
    labelOf('produce'),
    /Message with schema ID/i,
    'the arrow into the broker is labelled as the book labels it',
  );
  assert.match(
    labelOf('schema-register'),
    /Current version of schema/i,
    'the arrow into the registry is labelled as the book labels it',
  );
});

test('runs every arrow against one shared loop', () => {
  const durations = new Set(
    flowsOf(svg).flatMap((flow) =>
      animationsIn(flow)
        .map((anim) => anim.getAttribute('dur'))
        .filter(Boolean),
    ),
  );
  assert.equal(
    durations.size,
    1,
    `every arrow must be timed against the same loop, got ${[...durations].join(', ')}`,
  );
});
