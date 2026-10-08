import assert from 'node:assert/strict';

import {
  animationsIn,
  hiddenThroughout,
  opacityAt,
  shownThroughout,
} from '@learning-animated/svg-kit/timeline';

type Window = readonly [number, number];
type Members = Record<number, number[]>;
type Owners = Record<number, Record<number, number>>;
type GroupState = { readonly members: Members; readonly owners: Owners };

// Shared checks for the chapter 4 consumer group animations. Each opens on the
// previous figure's state, lets the group change, then settles into its own
// figure, and WINDOWS gives those phases as fractions of the loop.
export const WINDOWS: Readonly<Record<'before' | 'change' | 'after' | 'reset', Window>> = {
  before: [0, 0.2],
  change: [0.2, 0.4],
  after: [0.4, 0.96],
  reset: [0.96, 1],
};

export function middleOf([start, end]: Window): number {
  return (start + end) / 2;
}

// Who is in each group, and which consumer owns each partition, following the
// book's text. Consumers are numbered from 1, as the figures number them.
const EMPTY: GroupState = { members: {}, owners: {} };
const ONE_CONSUMER: GroupState = {
  members: { 1: [1] },
  owners: { 1: { 0: 1, 1: 1, 2: 1, 3: 1 } },
};
const TWO_CONSUMERS: GroupState = {
  members: { 1: [1, 2] },
  owners: { 1: { 0: 1, 1: 2, 2: 1, 3: 2 } },
};
const FOUR_CONSUMERS: GroupState = {
  members: { 1: [1, 2, 3, 4] },
  owners: { 1: { 0: 1, 1: 2, 2: 3, 3: 4 } },
};
const FIVE_CONSUMERS: GroupState = {
  members: { 1: [1, 2, 3, 4, 5] },
  owners: FOUR_CONSUMERS.owners,
};
const TWO_GROUPS: GroupState = {
  members: { 1: [1, 2, 3, 4], 2: [1, 2] },
  owners: { ...FOUR_CONSUMERS.owners, 2: { 0: 1, 1: 2, 2: 1, 3: 2 } },
};

// Figure 4-5 draws Group 1 with four consumers, so it opens on Figure 4-3's
// state rather than 4-4's. Group 2 splits T1 "just like we showed for G1".
export const FIGURES = {
  '4-1': { before: EMPTY, after: ONE_CONSUMER },
  '4-2': { before: ONE_CONSUMER, after: TWO_CONSUMERS },
  '4-3': { before: TWO_CONSUMERS, after: FOUR_CONSUMERS },
  '4-4': { before: FOUR_CONSUMERS, after: FIVE_CONSUMERS },
  '4-5': { before: FOUR_CONSUMERS, after: TWO_GROUPS },
};

type Figure = (typeof FIGURES)[keyof typeof FIGURES];

function numberOf(el: Element, name: string): number {
  return Number(el.getAttribute(name));
}

// Which consumer owns each partition during a phase, per group, read from the
// assignment arrows. A group gives each partition to exactly one of its
// consumers, so a second owner fails here.
export function ownersIn(svg: Element, phase: 'before' | 'after'): Owners {
  const owners: Owners = {};
  for (const arrow of svg.querySelectorAll(`[data-role="assignment"][data-phase~="${phase}"]`)) {
    const group = numberOf(arrow, 'data-group');
    const partition = numberOf(arrow, 'data-partition');
    const ownersOfGroup = (owners[group] ??= {});
    assert.equal(
      ownersOfGroup[partition],
      undefined,
      `group ${group} gives partition ${partition} to two consumers in the ${phase} phase`,
    );
    ownersOfGroup[partition] = numberOf(arrow, 'data-consumer');
  }
  return owners;
}

export function membersAt(svg: Element, t: number): Members {
  const members: Members = {};
  for (const consumer of svg.querySelectorAll('[data-role="consumer"]')) {
    if (opacityAt(consumer, t) === 0) continue;
    (members[numberOf(consumer, 'data-group')] ??= []).push(numberOf(consumer, 'data-consumer'));
  }
  return members;
}

function newcomers(figure: Figure): [number, number][] {
  const joined: [number, number][] = [];
  for (const [group, consumers] of Object.entries(figure.after.members)) {
    const before = figure.before.members[Number(group)] ?? [];
    for (const consumer of consumers) {
      if (!before.includes(consumer)) joined.push([Number(group), consumer]);
    }
  }
  return joined;
}

function describeArrow(arrow: Element): string {
  const [group, partition, consumer] = ['data-group', 'data-partition', 'data-consumer'].map((n) =>
    arrow.getAttribute(n),
  );
  return `group ${group}'s arrow from partition ${partition} to consumer ${consumer}`;
}

export function assertTopicT1(svg: Element): void {
  const topic = svg.querySelector('[data-role="topic"]');
  assert.ok(topic, 'the animation must draw topic T1');
  assert.match(topic.textContent, /Topic T1/, 'the topic is labelled Topic T1');
  const partitions = [...topic.querySelectorAll('[data-role="partition"]')];
  assert.deepEqual(
    partitions.map((p) => p.getAttribute('data-partition')),
    ['0', '1', '2', '3'],
    'T1 has partitions 0 to 3, in order',
  );
  for (const partition of partitions) {
    const n = partition.getAttribute('data-partition');
    assert.match(partition.textContent, new RegExp(`Partition ${n}`), `partition ${n} is labelled`);
  }
}

// The book's text numbers groups G1 and G2, and every consumer sits inside the
// group it belongs to.
export function assertLabels(svg: Element, groups: number[]): void {
  const drawn = [...svg.querySelectorAll('[data-role="group"]')];
  assert.deepEqual(
    drawn.map((g) => numberOf(g, 'data-group')),
    groups,
    `the animation draws consumer groups ${groups.join(' and ')}`,
  );
  for (const group of drawn) {
    const n = group.getAttribute('data-group');
    assert.match(
      group.textContent,
      new RegExp(`Consumer Group ${n}`),
      `group ${n} is labelled Consumer Group ${n}`,
    );
  }
  for (const consumer of svg.querySelectorAll('[data-role="consumer"]')) {
    const n = consumer.getAttribute('data-consumer');
    const group = consumer.getAttribute('data-group');
    assert.match(consumer.textContent, new RegExp(`Consumer ${n}\\b`), `consumer ${n} is labelled`);
    assert.equal(
      consumer.closest('[data-role="group"]')?.getAttribute('data-group'),
      group,
      `consumer ${n} sits inside Consumer Group ${group}`,
    );
  }
}

// The previous figure's members hold still before the change and this
// figure's hold after it. Exactly the newcomers carry data-joins, and they are
// the only consumers that come and go.
export function assertMembership(svg: Element, figure: Figure): void {
  assert.deepEqual(
    membersAt(svg, middleOf(WINDOWS.before)),
    figure.before.members,
    'before the change, the groups look like the previous figure',
  );
  assert.deepEqual(
    membersAt(svg, middleOf(WINDOWS.after)),
    figure.after.members,
    'once settled, the groups look like this figure',
  );
  const consumers = [...svg.querySelectorAll('[data-role="consumer"]')];
  const joiners = consumers.filter((c) => c.getAttribute('data-joins') === 'true');
  assert.deepEqual(
    joiners.map((c) => [numberOf(c, 'data-group'), numberOf(c, 'data-consumer')]),
    newcomers(figure),
    'exactly the newcomers are marked as joining',
  );
  for (const consumer of consumers) {
    const name = `consumer ${consumer.getAttribute('data-consumer')} of group ${consumer.getAttribute('data-group')}`;
    if (joiners.includes(consumer)) {
      assert.ok(hiddenThroughout(consumer, WINDOWS.before), `${name} is not there before it joins`);
      assert.ok(shownThroughout(consumer, WINDOWS.after), `${name} stays once it has joined`);
    } else {
      assert.ok(shownThroughout(consumer, [0, 1]), `${name} is a member for the whole loop`);
    }
  }
}

export function assertOwnership(svg: Element, figure: Figure): void {
  assert.deepEqual(
    ownersIn(svg, 'before'),
    figure.before.owners,
    'before the change, each partition belongs to its owner in the previous figure',
  );
  assert.deepEqual(
    ownersIn(svg, 'after'),
    figure.after.owners,
    'once settled, each partition belongs to its owner in this figure',
  );
}

// An arrow is on screen exactly while its assignment holds. One that holds on
// both sides of the change never moves, so it carries no animation at all.
export function assertAssignmentsFollowPhases(svg: Element): void {
  const arrows = [...svg.querySelectorAll('[data-role="assignment"]')];
  assert.ok(arrows.length > 0, 'the animation draws its assignments');
  for (const arrow of arrows) {
    const phases = arrow.getAttribute('data-phase')!.split(/\s+/).sort();
    const name = describeArrow(arrow);
    if (phases.join(' ') === 'after before') {
      assert.equal(animationsIn(arrow).length, 0, `${name} holds throughout, so it stays still`);
      assert.ok(shownThroughout(arrow, [0, 1]), `${name} is drawn for the whole loop`);
    } else if (phases.join(' ') === 'before') {
      assert.ok(shownThroughout(arrow, WINDOWS.before), `${name} is drawn before the change`);
      assert.ok(hiddenThroughout(arrow, WINDOWS.after), `${name} is gone once settled`);
    } else {
      assert.deepEqual(phases, ['after'], `${name} holds before, after, or both`);
      assert.ok(hiddenThroughout(arrow, WINDOWS.before), `${name} is not drawn before the change`);
      assert.ok(shownThroughout(arrow, WINDOWS.after), `${name} is drawn once settled`);
    }
  }
}

// What changes is drawn in the warm accent while the group changes. Groups
// listed in keepGlowing stay warm once settled; the rest settle to the flow
// colour.
export function assertNewAssignmentsGlow(
  svg: Element,
  { keepGlowing = [] }: { keepGlowing?: number[] } = {},
): void {
  const fresh = [...svg.querySelectorAll('[data-role="assignment"][data-phase="after"]')];
  assert.ok(fresh.length > 0, 'the change hands out at least one partition');
  for (const arrow of fresh) {
    const name = describeArrow(arrow);
    const glow = arrow.querySelector('[data-role="glow"]');
    assert.ok(glow, `${name} is new, so it has a warm accent mark`);
    assert.equal(opacityAt(glow, middleOf(WINDOWS.change)), 1, `${name} glows during the change`);
    const keeps = keepGlowing.includes(numberOf(arrow, 'data-group'));
    assert.equal(
      opacityAt(glow, middleOf(WINDOWS.after)),
      keeps ? 1 : 0,
      keeps ? `${name} stays warm once settled` : `${name} settles to the flow colour`,
    );
  }
}

// Messages wait until the group has settled and stop before the loop resets,
// because what a live group does mid-handover is the rebalance protocol of
// Figures 4-6 and 4-7. Each owned partition gets one flow, on its owner's arrow.
export function assertFlowsWaitForTheChange(svg: Element, figure: Figure): void {
  const expected = Object.entries(figure.after.owners).flatMap(([group, owners]) =>
    Object.entries(owners).map(([partition, consumer]) => [
      Number(group),
      Number(partition),
      consumer,
    ]),
  );
  const flows = [...svg.querySelectorAll('[data-role="flow"]')];
  assert.deepEqual(
    flows.map((f) => [
      numberOf(f, 'data-group'),
      numberOf(f, 'data-partition'),
      numberOf(f, 'data-consumer'),
    ]),
    expected,
    'one flow per owned partition, delivered to its owner',
  );
  for (const flow of flows) {
    const [group, partition] = [
      flow.getAttribute('data-group'),
      flow.getAttribute('data-partition'),
    ];
    const arrow = svg.querySelector(
      `[data-role="assignment"][data-phase~="after"][data-group="${group}"][data-partition="${partition}"]`,
    );
    const messages = [...flow.querySelectorAll('[data-role="message"]')];
    assert.ok(messages.length > 0, `partition ${partition} sends group ${group} messages`);
    for (const message of messages) {
      const href = message.querySelector('mpath')?.getAttribute('xlink:href');
      assert.ok(
        href && arrow?.querySelector(href),
        `partition ${partition}'s messages ride the arrow to its owner in group ${group}`,
      );
      assert.ok(
        hiddenThroughout(message, [0, WINDOWS.after[0]]),
        'no message moves before the group has settled',
      );
      assert.ok(hiddenThroughout(message, WINDOWS.reset), 'messages stop before the loop resets');
      assert.ok(!hiddenThroughout(message, WINDOWS.after), 'each message is shown once settled');
    }
  }
}

export function assertCaptions(svg: Element): void {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  const phases = ['before', 'change', 'after'] as const;
  assert.deepEqual(
    captions.map((c) => c.getAttribute('data-phase')),
    phases,
    'one caption per phase, in loop order',
  );
  for (const caption of captions) {
    const own = caption.getAttribute('data-phase');
    assert.ok(caption.textContent.trim().length > 0, `the ${own} caption says something`);
    for (const phase of phases) {
      assert.equal(
        opacityAt(caption, middleOf(WINDOWS[phase])),
        phase === own ? 1 : 0,
        `the ${own} caption is ${phase === own ? 'shown' : 'hidden'} during the ${phase} window`,
      );
    }
  }
}

export function assertOneLoop(svg: Element): void {
  const durations = new Set(
    animationsIn(svg)
      .map((anim) => anim.getAttribute('dur'))
      .filter(Boolean),
  );
  assert.equal(
    durations.size,
    1,
    `every phase plays on the same loop, got ${[...durations].join(', ')}`,
  );
}
