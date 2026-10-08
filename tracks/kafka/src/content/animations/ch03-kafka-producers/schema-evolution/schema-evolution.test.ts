import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

const { svg, text } = parseSvg(
  readFileSync(new URL('./schema-evolution.svg', import.meta.url), 'utf8'),
);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// The book's customer example. v2 drops faxNumber and adds email, and both
// fields carry a default, which is what makes the change safe in both
// directions.
const SCHEMAS = {
  1: ['id', 'name', 'faxNumber'],
  2: ['id', 'name', 'email'],
};

// Reading a record never requires the writer's schema to match the reader's.
// Whatever the writer left out comes from the reader's default, and whatever
// the writer added that the reader does not know about is dropped.
const BEATS = [
  {
    beat: 'v1-to-v2',
    writer: '1',
    reader: '2',
    resolved: [
      ['id', 'record'],
      ['name', 'record'],
      ['email', 'default'],
      ['faxNumber', 'dropped'],
    ],
  },
  {
    beat: 'v2-to-v1',
    writer: '2',
    reader: '1',
    resolved: [
      ['id', 'record'],
      ['name', 'record'],
      ['faxNumber', 'default'],
      ['email', 'dropped'],
    ],
  },
];

function animationsIn(el: Element): Element[] {
  return [...el.querySelectorAll('animate, animateMotion, animateTransform, set')];
}

function beatsOf(svg: Element): Element[] {
  return [...svg.querySelectorAll('[data-role="beat"]')];
}

test('is registered as chapter 3, order 5', () => {
  assert.equal(lesson.id, 'schema-evolution', 'index.md must register schema-evolution');
  assert.equal(lesson.section, 'ch03-kafka-producers', 'schema evolution is a chapter 3 idea');
  assert.equal(lesson.order, 5, 'it follows the wire format');
});

test('spells out both versions of the customer schema', () => {
  for (const [version, fields] of Object.entries(SCHEMAS)) {
    const schema = svg.querySelector(`[data-role="schema"][data-version="${version}"]`);
    assert.ok(schema, `the animation must show schema v${version}`);
    assert.deepEqual(
      [...schema.querySelectorAll('[data-field]')].map((f) => f.getAttribute('data-field')),
      fields,
      `schema v${version} carries exactly the fields the book gives it`,
    );
  }
});

test('reads a record both ways round', () => {
  assert.deepEqual(
    beatsOf(svg).map((b) => ({
      beat: b.getAttribute('data-beat'),
      writer: b.getAttribute('data-writer'),
      reader: b.getAttribute('data-reader'),
    })),
    BEATS.map(({ beat, writer, reader }) => ({ beat, writer, reader })),
    'one beat reads a v1 record with v2, the other reads a v2 record with v1',
  );
});

test('fills the missing field from a default and drops the unknown one', () => {
  for (const spec of BEATS) {
    const beat = svg.querySelector(`[data-role="beat"][data-beat="${spec.beat}"]`) as Element;
    const resolved = beat.querySelector('[data-role="resolved"]');
    assert.ok(resolved, `beat ${spec.beat} must show what the reader ends up with`);
    assert.deepEqual(
      [...resolved.querySelectorAll('[data-field]')].map((f) => [
        f.getAttribute('data-field'),
        f.getAttribute('data-source'),
      ]),
      spec.resolved,
      `beat ${spec.beat} resolves every field from the right place`,
    );
  }
});

test('spells the source out in words, not only in colour', () => {
  const wording: Record<string, RegExp> = {
    record: /record/i,
    default: /default/i,
    dropped: /dropped/i,
  };
  for (const beat of beatsOf(svg)) {
    for (const field of beat.querySelectorAll('[data-field][data-source]')) {
      const source = field.getAttribute('data-source')!;
      assert.match(
        field.textContent.replace(/\s+/g, ' '),
        wording[source]!,
        `a ${source} field must say so, for anyone who cannot tell the fills apart`,
      );
    }
  }
});

test('decodes in both directions, so nothing here fails', () => {
  const outcomes = [...svg.querySelectorAll('[data-role="outcome"]')];
  assert.equal(outcomes.length, BEATS.length, 'every beat ends with a verdict');
  for (const outcome of outcomes) {
    assert.equal(
      outcome.getAttribute('data-outcome'),
      'decoded',
      'a compatible change reads cleanly in both directions',
    );
    assert.ok(animationsIn(outcome).length > 0, 'the verdict lands after the resolution');
  }
  assert.ok(
    !/\b(?:fill|stroke)-red\b/.test(text.slice(text.indexOf('LA-STYLE:END'))),
    'nothing goes wrong in this animation, so it must not reach for the failure colour',
  );
});

test('has the registry serve the writer schema in both beats', () => {
  for (const spec of BEATS) {
    const beat = svg.querySelector(`[data-role="beat"][data-beat="${spec.beat}"]`) as Element;
    const flow = beat.querySelector('[data-role="flow"][data-flow="writer-schema"]');
    assert.ok(flow, `beat ${spec.beat} must pull the writer schema from the registry`);
    assert.equal(
      flow.getAttribute('data-version'),
      spec.writer,
      `beat ${spec.beat} must fetch the version the record was written with`,
    );
    assert.ok(animationsIn(flow).length > 0, 'the registry hand-off must animate');
    const record = beat.querySelector('[data-role="flow"][data-flow="record"]');
    assert.ok(record, `beat ${spec.beat} must carry the record to the reader`);
    assert.ok(animationsIn(record).length > 0, 'the record must travel');
  }
});

test('runs both beats against one shared loop', () => {
  const durations = new Set(
    animationsIn(svg)
      .map((anim) => anim.getAttribute('dur'))
      .filter(Boolean),
  );
  assert.equal(
    durations.size,
    1,
    `both directions must play on the same beat, got ${[...durations].join(', ')}`,
  );
});
