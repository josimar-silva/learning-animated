import assert from 'node:assert/strict';

import { tagOf } from './parse.ts';

// Reads SMIL timelines as a function of loop time. Every animation here loops
// from begin 0 on one shared dur, so a moment is a fraction of the loop, 0 to 1.

function numbers(list: string): number[] {
  return list.split(';').map((v) => Number(v.trim()));
}

export function animationsIn(el: Element): Element[] {
  return [...el.querySelectorAll('animate, animateMotion, animateTransform, set')];
}

function ownAnimate(el: Element, attributeName: string): Element | undefined {
  return [...el.children].find(
    (child) => tagOf(child) === 'animate' && child.getAttribute('attributeName') === attributeName,
  );
}

// The number an element's own animate gives an attribute at a moment in the
// loop, else its static value, else the fallback. Only values-and-keyTimes
// timelines are understood, and anything else fails loudly.
export function valueAt(el: Element, attributeName: string, t: number): number | null;
export function valueAt(el: Element, attributeName: string, t: number, fallback: number): number;
export function valueAt(
  el: Element,
  attributeName: string,
  t: number,
  fallback: number | null = null,
): number | null {
  const anim = ownAnimate(el, attributeName);
  if (!anim) {
    const attr = el.getAttribute(attributeName);
    return attr === null ? fallback : Number(attr);
  }
  const [rawValues, rawKeyTimes] = [anim.getAttribute('values'), anim.getAttribute('keyTimes')];
  assert.ok(
    rawValues && rawKeyTimes,
    `the ${attributeName} animate needs values and keyTimes to be read`,
  );
  const values = numbers(rawValues);
  const keyTimes = numbers(rawKeyTimes);
  let i = keyTimes.length - 1;
  while (i > 0 && keyTimes[i]! > t) i -= 1;
  if (anim.getAttribute('calcMode') === 'discrete' || i === keyTimes.length - 1) return values[i]!;
  const progress = (t - keyTimes[i]!) / (keyTimes[i + 1]! - keyTimes[i]!);
  return values[i]! + (values[i + 1]! - values[i]!) * progress;
}

// The opacity an element renders with at a moment in the loop, multiplied
// through its ancestors the way the browser composes them.
export function opacityAt(el: Element, t: number): number {
  let opacity = 1;
  for (let node: Element | null = el; node && tagOf(node) !== 'svg'; node = node.parentElement) {
    opacity *= valueAt(node, 'opacity', t, 1);
  }
  return opacity;
}

// The moment an element's own opacity first reaches 1, or null if it never
// does. A static element that is not hidden shows from the start.
export function onsetOf(el: Element): number | null {
  const anim = ownAnimate(el, 'opacity');
  if (!anim) return valueAt(el, 'opacity', 0, 1) === 1 ? 0 : null;
  const at = numbers(anim.getAttribute('values')!).indexOf(1);
  return at === -1 ? null : numbers(anim.getAttribute('keyTimes')!)[at]!;
}

// Opacity is linear or stepped between keyTimes, so the window's ends, every
// keyTime inside it, and the midpoints between them are enough to judge it whole.
function samplesIn(el: Element, [start, end]: readonly [number, number]): number[] {
  const cuts = new Set([start, end]);
  for (let node: Element | null = el; node && tagOf(node) !== 'svg'; node = node.parentElement) {
    const anim = ownAnimate(node, 'opacity');
    if (!anim) continue;
    for (const k of numbers(anim.getAttribute('keyTimes')!)) {
      if (k > start && k < end) cuts.add(k);
    }
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  return [...sorted, ...sorted.slice(1).map((k, i) => (sorted[i]! + k) / 2)];
}

export function hiddenThroughout(el: Element, window: readonly [number, number]): boolean {
  return samplesIn(el, window).every((t) => opacityAt(el, t) === 0);
}

export function shownThroughout(el: Element, window: readonly [number, number]): boolean {
  return samplesIn(el, window).every((t) => opacityAt(el, t) === 1);
}
