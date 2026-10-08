import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { expect, test } from 'vitest';

import { indexMarkdown, lessonBody } from '../../scripts/lib/kafka-content.ts';

const chapters = [{ number: 1, slug: 'ch01-meet-kafka' }];
const animation = {
  id: 'topic-partitions',
  chapter: 1,
  order: 1,
  figure: '1-5',
  title: 'A topic with multiple partitions',
  description: 'A topic is split into partitions.',
  objective: 'See why a topic is a set of ordered logs.',
  src: 'src/animations/ch01-meet-kafka/topic-partitions/topic-partitions.svg',
};
const README = [
  '# 01. Topic with multiple partitions',
  '',
  'Visualizes **Figure 1-5** from Kafka: The Definitive Guide.',
  '',
  '## What it shows',
  '',
  'Each partition is an append-only log.',
  '',
  '## View it',
  '',
  '```',
  'npm run serve',
  '# then open http://localhost:8080',
  '```',
  '',
  '## A note on the figure',
  '',
  'The book draws four partitions.',
  '',
].join('\n');

test('the body keeps the explanation and drops the title, the figure line, and the local viewing steps', () => {
  expect(lessonBody(README)).toBe(
    '## What it shows\n\nEach partition is an append-only log.\n\n## A note on the figure\n\nThe book draws four partitions.\n',
  );
});

test('the frontmatter is a valid animation entry in its chapter', () => {
  const data = animationSchema.parse(frontmatterOf(indexMarkdown(animation, chapters, README)));
  expect(data).toMatchObject({
    id: 'topic-partitions',
    section: 'ch01-meet-kafka',
    order: 1,
    figure: '1-5',
  });
});

test('a companion extra keeps a null figure', () => {
  const data = animationSchema.parse(
    frontmatterOf(indexMarkdown({ ...animation, figure: null }, chapters, README)),
  );
  expect(data.figure).toBeNull();
});

test('an animation outside the known chapters stops the conversion', () => {
  expect(() => indexMarkdown({ ...animation, chapter: 9 }, chapters, README)).toThrow(/chapter 9/);
});
