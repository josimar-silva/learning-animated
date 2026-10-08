import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { animationSchema } from '@learning-animated/site-kit/schemas';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, shownThroughout } from '@learning-animated/svg-kit/timeline';
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
  WINDOWS,
} from '../../../../../test/helpers/consumer-groups.ts';

const { svg } = parseSvg(
  readFileSync(new URL('./second-consumer-group.svg', import.meta.url), 'utf8'),
);
const lesson = animationSchema.parse(
  frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')),
);

// Figure 4-5: a second group subscribes to the same topic. The loop opens on
// Group 1 as the figure draws it, with one consumer per partition.
const FIGURE = FIGURES['4-5'];

// The moments a flow's messages leave their partition, as loop fractions.
function departures(flow: Element): (number | undefined)[] {
  return [...flow.querySelectorAll('[data-role="message"] animateMotion')].map((motion) => {
    const keyPoints = motion.getAttribute('keyPoints')!.split(';').map(Number);
    const keyTimes = motion.getAttribute('keyTimes')!.split(';').map(Number);
    return keyTimes[keyPoints.findIndex((point) => point > 0) - 1];
  });
}

test('is registered as chapter 4, order 5', () => {
  assert.equal(lesson.id, 'second-consumer-group', 'index.md must register second-consumer-group');
  assert.equal(lesson.section, 'ch04-kafka-consumers', 'Figure 4-5 lives in chapter 4');
  assert.equal(lesson.order, 5, 'it follows the idle consumer');
});

test('draws topic T1 with its four partitions', () => {
  assertTopicT1(svg);
});

test('labels Consumer Group 1 and Consumer Group 2, as the text names them', () => {
  assertLabels(svg, [1, 2]);
});

test('brings in Consumer Group 2 as a whole, with its two consumers', () => {
  assertMembership(svg, FIGURE);
  const second = svg.querySelector('[data-role="group"][data-group="2"]')!;
  assert.ok(hiddenThroughout(second, WINDOWS.before), 'Group 2 is not there before it subscribes');
  assert.ok(shownThroughout(second, WINDOWS.after), 'Group 2 stays once it has subscribed');
  const first = svg.querySelector('[data-role="group"][data-group="1"]')!;
  assert.ok(shownThroughout(first, [0, 1]), 'Group 1 is there all along');
});

test('gives Group 2 every partition, split between its two consumers', () => {
  assertOwnership(svg, FIGURE);
});

test('leaves Group 1 exactly as it was', () => {
  for (const arrow of svg.querySelectorAll('[data-role="assignment"][data-group="1"]')) {
    assert.equal(
      arrow.getAttribute('data-phase'),
      'before after',
      `Group 1 keeps partition ${arrow.getAttribute('data-partition')} where it was`,
    );
  }
  assertAssignmentsFollowPhases(svg);
});

test("draws Group 2's assignments in the warm accent, as the book marks them", () => {
  assertNewAssignmentsGlow(svg, { keepGlowing: [2] });
});

test('moves no message until Group 2 has settled', () => {
  assertFlowsWaitForTheChange(svg, FIGURE);
});

test('delivers every message to both groups at the same moment', () => {
  for (const partition of ['0', '1', '2', '3']) {
    const [first, second] = ['1', '2'].map((group) =>
      svg.querySelector(`[data-role="flow"][data-group="${group}"][data-partition="${partition}"]`),
    );
    assert.ok(first && second, `partition ${partition} feeds both groups`);
    assert.ok(departures(first).length > 0, `partition ${partition} sends messages`);
    assert.deepEqual(
      departures(second),
      departures(first),
      `each message from partition ${partition} leaves for both groups at once`,
    );
  }
});

test('captions one group, the new subscriber, and both getting everything', () => {
  assertCaptions(svg);
});

test('runs on one shared loop', () => {
  assertOneLoop(svg);
});
