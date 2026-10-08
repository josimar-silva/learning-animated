import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt } from '@learning-animated/svg-kit/timeline';
import { test } from 'vitest';

import {
  assertAssignmentsFollowPhases,
  assertCaptions,
  assertFlowsWaitForTheChange,
  assertLabels,
  assertMembership,
  assertOneLoop,
  assertOwnership,
  assertTopicT1,
  FIGURES,
  middleOf,
  WINDOWS,
} from '../../../../../test/helpers/consumer-groups.ts';

const { svg } = parseSvg(readFileSync(new URL('./idle-consumer.svg', import.meta.url), 'utf8'));
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// Figure 4-4: a fifth consumer joins a group that already has one consumer
// per partition. The loop opens on Figure 4-3's state.
const FIGURE = FIGURES['4-4'];

test('is registered as chapter 4, order 4', () => {
  assert.equal(lesson.id, 'idle-consumer', 'index.md must register idle-consumer');
  assert.equal(lesson.section, 'ch04-kafka-consumers', 'Figure 4-4 lives in chapter 4');
  assert.equal(lesson.order, 4, 'it follows one partition each');
});

test('draws topic T1 with its four partitions', () => {
  assertTopicT1(svg);
});

test('labels Consumer Group 1 and its consumers', () => {
  assertLabels(svg, [1]);
});

test('has Consumer 5 join a group with one consumer per partition', () => {
  assertMembership(svg, FIGURE);
});

test('keeps every partition with the owner it already had', () => {
  assertOwnership(svg, FIGURE);
});

test('has nothing to hand over, so no arrow moves or glows', () => {
  assertAssignmentsFollowPhases(svg);
  for (const arrow of svg.querySelectorAll('[data-role="assignment"]')) {
    assert.equal(
      arrow.getAttribute('data-phase'),
      'before after',
      `partition ${arrow.getAttribute('data-partition')} stays with its owner across the change`,
    );
  }
  assert.equal(svg.querySelector('[data-role="glow"]'), null, 'nothing changes hands to mark');
});

test('gives Consumer 5 no partition and no messages', () => {
  assert.equal(
    svg.querySelector('[data-role="assignment"][data-consumer="5"]'),
    null,
    'no partition is left for Consumer 5',
  );
  assert.equal(
    svg.querySelector('[data-role="flow"][data-consumer="5"]'),
    null,
    'no message reaches Consumer 5',
  );
});

test('labels Consumer 5 idle once the group has settled', () => {
  const idle = svg.querySelector('[data-role="idle"][data-group="1"][data-consumer="5"]');
  assert.ok(idle, 'Consumer 5 carries an idle label');
  assert.match(idle.textContent, /idle/, 'the label says idle in words, not only in colour');
  assert.ok(
    hiddenThroughout(idle, [0, WINDOWS.change[1]]),
    'Consumer 5 is only idle once the group has settled',
  );
  assert.equal(opacityAt(idle, middleOf(WINDOWS.after)), 1, 'the idle label shows once settled');
});

test('moves no message until the group has settled', () => {
  assertFlowsWaitForTheChange(svg, FIGURE);
});

test('captions the full group, the join, and the idle consumer', () => {
  assertCaptions(svg);
});

test('runs on one shared loop', () => {
  assertOneLoop(svg);
});
