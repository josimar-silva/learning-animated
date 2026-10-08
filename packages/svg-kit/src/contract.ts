import assert from 'node:assert/strict';

import { parseSvg, tagOf } from './parse.ts';

const SMIL = new Set(['animate', 'animatetransform', 'animatemotion', 'set']);
const RAW_COLOR =
  /(fill|stroke|stop-color|flood-color|lighting-color|color|background(?:-color)?)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/gi;
// The palette pairs are tested at full strength, so these would void that guarantee.
const DIMMED_PAINT = /(?:stroke|fill)-opacity\s*[:=]/gi;
const CLOCK = /^(\d+(?:\.\d+)?)(ms|s)?$/;

export function smilElements(svg: Element): Element[] {
  return [...svg.querySelectorAll('*')].filter((el) => SMIL.has(tagOf(el)));
}

const withoutBlock = (text: string, block: string): string => text.split(block).join('');

export function assertRootSvg(svg: Element): void {
  assert.equal((svg.tagName || '').toLowerCase(), 'svg', 'root element must be <svg>');
  assert.equal(
    svg.getAttribute('xmlns'),
    'http://www.w3.org/2000/svg',
    'svg must declare the SVG namespace',
  );
  const viewBox = svg.getAttribute('viewBox');
  assert.ok(viewBox, 'svg must have a viewBox');
  const parts = viewBox.trim().split(/[\s,]+/);
  assert.equal(parts.length, 4, 'viewBox must have four numbers');
  for (const n of parts) {
    assert.ok(!Number.isNaN(Number(n)), `viewBox value "${n}" must be numeric`);
  }
}

export function assertAccessible(svg: Element): void {
  assert.equal(svg.getAttribute('role'), 'img', 'svg must have role="img"');
  const title = svg.querySelector('title');
  assert.ok(title && title.textContent.trim().length > 0, 'svg must have a non-empty <title>');
  const desc = svg.querySelector('desc');
  assert.ok(desc && desc.textContent.trim().length > 0, 'svg must have a non-empty <desc>');
}

export function assertEmbedsStyleBlock(text: string, block: string): void {
  assert.ok(text.includes(block), 'SVG must embed the canonical LA-STYLE block; run `just style`');
}

export function assertNoCssOutsideBlock(text: string, block: string): void {
  const rest = withoutBlock(text, block);
  const rules = [...rest.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1]!.replace(/<!\[CDATA\[|\]\]>|<!--[\s\S]*?-->/g, '').trim())
    .filter(Boolean);
  assert.deepEqual(rules, [], 'CSS must live only in the LA-STYLE block');
  assert.equal(
    /\sstyle\s*=/.test(rest),
    false,
    'style attributes are not allowed; use utilities or presentation attributes',
  );
}

export function assertNoRawColors(text: string, block: string): void {
  const matches = withoutBlock(text, block).match(RAW_COLOR);
  assert.equal(matches, null, `raw colors must not be used: ${matches?.join(', ') ?? ''}`);
}

export function assertNoDimmedPaint(text: string): void {
  const matches = text.match(DIMMED_PAINT);
  assert.equal(
    matches,
    null,
    `marks must paint at full strength so the tested contrast holds: ${matches ? matches.join(', ') : ''}`,
  );
}

export function assertSmilOnly(svg: Element, text: string, block: string): void {
  assert.ok(smilElements(svg).length > 0, 'svg must animate with SMIL');
  assert.equal(
    /@keyframes|animation(?:-name)?\s*:/.test(withoutBlock(text, block)),
    false,
    'CSS animation is not allowed: the player drives SMIL only',
  );
}

// Per the SMIL spec, animateMotion paces itself by default and every other timed element is linear.
function effectiveCalcMode(el: Element, tagName: string): string {
  return el.getAttribute('calcMode') || (tagName === 'animatemotion' ? 'paced' : 'linear');
}

function describeTimedElement(el: Element, tagName: string): string {
  const attributeName = el.getAttribute('attributeName');
  return attributeName ? `<${tagName} attributeName="${attributeName}">` : `<${tagName}>`;
}

// Malformed keyTimes make some browsers drop the animation silently instead of raising an error.
// The spec lets discrete timelines end before 1 and makes paced ones ignore keyTimes.
export function assertKeyTimesWellFormed(svg: Element): void {
  for (const el of smilElements(svg)) {
    const tagName = tagOf(el);
    const raw = el.getAttribute('keyTimes');
    if (raw === null) continue;

    const calcMode = effectiveCalcMode(el, tagName);
    if (calcMode === 'paced') continue;

    const label = describeTimedElement(el, tagName);
    const entries = raw.split(';').map((v) => v.trim());
    assert.ok(
      entries.every((v) => v !== '' && Number.isFinite(Number(v))),
      `${label} keyTimes must be numeric: "${raw}"`,
    );
    const keyTimes = entries.map(Number);
    assert.equal(keyTimes[0], 0, `${label} keyTimes must start at 0: "${raw}"`);
    for (let i = 0; i < keyTimes.length; i += 1) {
      assert.ok(
        keyTimes[i]! >= 0 && keyTimes[i]! <= 1,
        `${label} keyTimes values must be in range 0 to 1 inclusive: "${raw}"`,
      );
    }
    if (calcMode !== 'discrete') {
      assert.equal(
        keyTimes[keyTimes.length - 1],
        1,
        `${label} keyTimes must end at 1 for calcMode "${calcMode}": "${raw}"`,
      );
    }
    for (let i = 1; i < keyTimes.length; i += 1) {
      assert.ok(
        keyTimes[i]! >= keyTimes[i - 1]!,
        `${label} keyTimes must never decrease: "${raw}"`,
      );
    }

    const values = el.getAttribute('values');
    const keyPoints = el.getAttribute('keyPoints');
    const companion = values !== null ? values : keyPoints;
    if (companion !== null) {
      const companionName = values !== null ? 'values' : 'keyPoints';
      assert.equal(
        keyTimes.length,
        companion.split(';').length,
        `${label} keyTimes must have as many entries as its ${companionName}: "${raw}"`,
      );
    }
  }
}

export function durSeconds(raw: string): number {
  const match = CLOCK.exec(raw.trim());
  assert.ok(match, `dur "${raw}" must be a clock value such as 2s or 1200ms`);
  return Number(match[1]) / (match[2] === 'ms' ? 1000 : 1);
}

export function loopSeconds(svg: Element): number | null {
  const raw = svg.getAttribute('data-loop');
  if (raw === null) return null;
  assert.match(raw, /^\d+(?:\.\d+)?s$/, `data-loop must look like "13.5s": "${raw}"`);
  return Number(raw.slice(0, -1));
}

export function assertLoopConsistent(svg: Element): void {
  const loop = loopSeconds(svg);
  if (loop === null) return;
  const durs = smilElements(svg)
    .map((el) => el.getAttribute('dur'))
    .filter((d): d is string => d !== null && d !== 'indefinite')
    .map(durSeconds);
  assert.ok(durs.includes(loop), `data-loop ${loop}s must equal the story's dur`);
  assert.deepEqual(
    durs.filter((d) => d > loop),
    [],
    `no animation may run longer than data-loop ${loop}s`,
  );
}

export function assertSvgContract(text: string, block: string): void {
  const { svg } = parseSvg(text);
  assertRootSvg(svg);
  assertAccessible(svg);
  assertEmbedsStyleBlock(text, block);
  assertNoCssOutsideBlock(text, block);
  assertNoRawColors(text, block);
  assertNoDimmedPaint(text);
  assertSmilOnly(svg, text, block);
  assertKeyTimesWellFormed(svg);
  assertLoopConsistent(svg);
}
