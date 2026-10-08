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

const { svg } = parseSvg(readFileSync(new URL('./two-consumers.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// Figure 4-2: a second consumer joins, and the group splits T1 between the
// two. The loop opens on Figure 4-1's state.
const FIGURE = FIGURES['4-2'];

test('is registered as chapter 4, order 2', () => {
  assert.equal(lesson.id, 'two-consumers', 'index.md must register two-consumers');
  assert.equal(lesson.section, 'ch04-kafka-consumers', 'Figure 4-2 lives in chapter 4');
  assert.equal(lesson.order, 2, 'it follows the single consumer');
});

test('draws topic T1 with its four partitions', () => {
  assertTopicT1(svg);
});

test('labels Consumer Group 1 and its consumers', () => {
  assertLabels(svg, [1]);
});

test('has Consumer 2 join Consumer 1 in the group', () => {
  assertMembership(svg, FIGURE);
});

test('moves partitions 1 and 3 to Consumer 2', () => {
  assertOwnership(svg, FIGURE);
});

test('splits the topic evenly, two partitions per consumer', () => {
  const owners = Object.values(ownersIn(svg, 'after')[1]!);
  for (const consumer of [1, 2]) {
    assert.equal(
      owners.filter((owner) => owner === consumer).length,
      2,
      `consumer ${consumer} reads two of the four partitions`,
    );
  }
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

test('captions the lone consumer, the join, and the split', () => {
  assertCaptions(svg);
});

test('runs on one shared loop', () => {
  assertOneLoop(svg);
});
