import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { shownThroughout } from '@learning-animated/svg-kit/timeline';
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
} from '../../../../../test/helpers/consumer-groups.ts';

const { svg } = parseSvg(readFileSync(new URL('./single-consumer.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// Figure 4-1: topic T1 and a group of one. The loop opens on the group before
// anyone has joined it.
const FIGURE = FIGURES['4-1'];

test('is registered as chapter 4, order 1', () => {
  assert.equal(lesson.id, 'single-consumer', 'index.md must register single-consumer');
  assert.equal(lesson.section, 'ch04-kafka-consumers', 'Figure 4-1 lives in chapter 4');
  assert.equal(lesson.order, 1, 'it is the first chapter 4 animation');
});

test('draws topic T1 with its four partitions', () => {
  assertTopicT1(svg);
});

test('labels Consumer Group 1 and its consumer', () => {
  assertLabels(svg, [1]);
});

test('draws the group before anyone has joined it', () => {
  const group = svg.querySelector('[data-role="group"][data-group="1"]')!;
  assert.ok(shownThroughout(group, [0, 1]), 'Consumer Group 1 is there all along, empty at first');
});

test('has Consumer 1 join the empty group', () => {
  assertMembership(svg, FIGURE);
});

test('gives Consumer 1 every partition', () => {
  assertOwnership(svg, FIGURE);
});

test('draws each assignment only while it holds', () => {
  assertAssignmentsFollowPhases(svg);
});

test('marks the new assignments in the warm accent, then settles', () => {
  assertNewAssignmentsGlow(svg);
});

test('moves no message until the group has settled', () => {
  assertFlowsWaitForTheChange(svg, FIGURE);
});

test('captions the empty group, the join, and the result', () => {
  assertCaptions(svg);
});

test('runs on one shared loop', () => {
  assertOneLoop(svg);
});
