import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { test } from 'vitest';

import {
  assertAssignmentsFollowPhases,
  assertCaptions,
  assertFlowsWaitForTheChange,
  assertLabels,
  assertMembership,
  assertNewAssignmentsGlow,
  assertOneLoop,
  assertOwnership,
  assertTopicT1,
  FIGURES,
  ownersIn,
} from '../../../../../test/helpers/consumer-groups.ts';

const { svg } = parseSvg(
  readFileSync(new URL('./one-partition-each.svg', import.meta.url), 'utf8'),
);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// Figure 4-3: two more consumers join, and each of the four ends up with one
// partition. The loop opens on Figure 4-2's state.
const FIGURE = FIGURES['4-3'];

test('is registered as chapter 4, order 3', () => {
  assert.equal(lesson.id, 'one-partition-each', 'index.md must register one-partition-each');
  assert.equal(lesson.section, 'ch04-kafka-consumers', 'Figure 4-3 lives in chapter 4');
  assert.equal(lesson.order, 3, 'it follows the two consumers');
});

test('draws topic T1 with its four partitions', () => {
  assertTopicT1(svg);
});

test('labels Consumer Group 1 and its consumers', () => {
  assertLabels(svg, [1]);
});

test('has Consumers 3 and 4 join the two already in the group', () => {
  assertMembership(svg, FIGURE);
});

test('moves partition 2 to Consumer 3 and partition 3 to Consumer 4', () => {
  assertOwnership(svg, FIGURE);
});

test('leaves every consumer with exactly one partition', () => {
  const owners = Object.values(ownersIn(svg, 'after')[1]!);
  assert.deepEqual(
    [...owners].sort((a, b) => a - b),
    [1, 2, 3, 4],
    'four partitions, four consumers, one each',
  );
});

test('redraws only the assignments that move', () => {
  assertAssignmentsFollowPhases(svg);
});

test('marks the moved assignments in the warm accent, then settles', () => {
  assertNewAssignmentsGlow(svg);
});

test('moves no message until the group has settled', () => {
  assertFlowsWaitForTheChange(svg, FIGURE);
});

test('captions the pair, the join, and one partition each', () => {
  assertCaptions(svg);
});

test('runs on one shared loop', () => {
  assertOneLoop(svg);
});
