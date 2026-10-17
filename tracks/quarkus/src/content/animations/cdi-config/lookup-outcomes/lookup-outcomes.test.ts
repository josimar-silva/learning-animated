import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { describe, expect, test } from 'vitest';

import { render } from './lookup-outcomes.gen.ts';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./lookup-outcomes.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const all = (selector: string): Element[] => [...svg.querySelectorAll(selector)];
const one = (selector: string): Element => {
  const found = svg.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

// One attribute of every element of a role that shows at a moment.
const shownAt = (role: string, attribute: string, seconds: number): string[] =>
  all(`[data-role="${role}"]`)
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map((el) => el.getAttribute(attribute) ?? '');
const keptAt = (seconds: number): string[] => shownAt('kept', 'data-adapter', seconds);
const skippedAt = (seconds: number): string[] => shownAt('skipped', 'data-adapter', seconds);
const answerAt = (seconds: number): string[] => shownAt('answer', 'data-outcome', seconds);
const answer = (outcome: string): Element => one(`[data-role="answer"][data-outcome="${outcome}"]`);

// Each setup starts, checks the conditions for 2 s, then answers until the next one starts.
const SETUPS = [
  { start: 0, answer: 3, end: 6.5 },
  { start: 6.5, answer: 9.5, end: 13 },
  { start: 13, answer: 16, end: 20 },
] as const;

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 20 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('20s');
});

test('checkout looks the adapter up through Instance and calls get()', () => {
  expect(one('[data-role="injection"]').textContent.trim()).toBe(
    '@Inject Instance<PaymentGateway> gateway;',
  );
  expect(one('[data-role="checkout"]').textContent).toContain('gateway.get().charge(order);');
});

test('both adapter classes carry @LookupIfProperty on payment.gateway with their own value', () => {
  const classes = all('[data-role="class"]');
  expect(classes.map((el) => el.getAttribute('data-adapter'))).toEqual(['card', 'sandbox']);
  for (const adapter of ['card', 'sandbox']) {
    const condition = one(`[data-role="condition"][data-adapter="${adapter}"]`).textContent;
    expect(condition).toContain('@LookupIfProperty(');
    expect(condition).toContain('name = "payment.gateway",');
    expect(condition).toContain(`stringValue = "${adapter}")`);
  }
  const [card, sandbox] = classes.map((el) => el.textContent);
  expect(card).toContain('class CardGateway');
  expect(sandbox).toContain('class SandboxGateway');
});

test('SandboxGateway keeps its condition for two setups and loses it for the third', () => {
  expect(shownThroughout(one('[data-role="condition"][data-adapter="card"]'), [0, 1])).toBe(true);
  const condition = one('[data-role="condition"][data-adapter="sandbox"]');
  expect(shownThroughout(condition, between(0, 12.9))).toBe(true);
  expect(hiddenThroughout(condition, between(13.1, 19.9))).toBe(true);
  const none = one('[data-role="no-condition"][data-adapter="sandbox"]');
  expect(hiddenThroughout(none, between(0, 12.9))).toBe(true);
  expect(shownThroughout(none, between(13.1, 19.9))).toBe(true);
});

test('the application starts without payment.gateway, then with card', () => {
  const unset = one('[data-role="start-value"][data-value="unset"]');
  const card = one('[data-role="start-value"][data-value="card"]');
  expect(shownThroughout(unset, between(0, 6.4))).toBe(true);
  expect(hiddenThroughout(unset, between(6.6, 19.9))).toBe(true);
  expect(hiddenThroughout(card, between(0, 6.4))).toBe(true);
  expect(shownThroughout(card, between(6.6, 19.9))).toBe(true);
});

test('each setup checks the conditions before the lookup answers', () => {
  const card = one('[data-role="check"][data-adapter="card"]');
  const sandbox = one('[data-role="check"][data-adapter="sandbox"]');
  for (const { start, answer: answered } of SETUPS) {
    expect(hiddenThroughout(card, between(start, start + 0.9))).toBe(true);
    expect(shownThroughout(card, between(start + 1.1, answered - 0.1))).toBe(true);
    for (const t of [start + 0.5, start + 1.5, answered - 0.5]) {
      expect(answerAt(t)).toEqual([]);
      expect(keptAt(t)).toEqual([]);
      expect(skippedAt(t)).toEqual([]);
    }
  }
  expect(shownThroughout(sandbox, between(1.1, 2.9))).toBe(true);
  expect(shownThroughout(sandbox, between(7.6, 9.4))).toBe(true);
  expect(hiddenThroughout(sandbox, between(13, 19.9))).toBe(true);
});

test('checkout calls get() whenever the lookup answers, and only then', () => {
  const call = one('[data-role="call"]');
  for (const { start, answer: answered, end } of SETUPS) {
    expect(hiddenThroughout(call, between(start + 0.1, answered - 0.1))).toBe(true);
    expect(shownThroughout(call, between(answered + 0.1, end - 0.1))).toBe(true);
  }
});

describe('what the lookup answers', () => {
  test('started without the property, no bean is left: isUnsatisfied() is true and get() throws', () => {
    for (const t of [3.5, 6]) {
      expect(skippedAt(t)).toEqual(['card', 'sandbox']);
      expect(keptAt(t)).toEqual([]);
      expect(answerAt(t)).toEqual(['unsatisfied']);
    }
    const unsatisfied = answer('unsatisfied').textContent;
    expect(unsatisfied).toContain('isUnsatisfied() is true');
    expect(unsatisfied).toContain('get() throws');
    expect(unsatisfied).toContain('UnsatisfiedResolutionException');
  });

  test('restarted with card, exactly one bean is left, and get() returns CardGateway', () => {
    for (const t of [10, 12.5]) {
      expect(keptAt(t)).toEqual(['card']);
      expect(skippedAt(t)).toEqual(['sandbox']);
      expect(answerAt(t)).toEqual(['resolvable']);
    }
    const resolvable = answer('resolvable').textContent;
    expect(resolvable).toContain('isResolvable() is true');
    expect(resolvable).toContain('get() returns');
  });

  test('with no condition on SandboxGateway, two beans are left: isAmbiguous() is true and get() throws', () => {
    for (const t of [16.5, 19.5]) {
      expect(keptAt(t)).toEqual(['card', 'sandbox']);
      expect(skippedAt(t)).toEqual([]);
      expect(answerAt(t)).toEqual(['ambiguous']);
    }
    const ambiguous = answer('ambiguous').textContent;
    expect(ambiguous).toContain('isAmbiguous() is true');
    expect(ambiguous).toContain('get() throws');
    expect(ambiguous).toContain('AmbiguousResolutionException');
  });
});

test('the drawn captions and the page steps tell the same story, one caption at a time', () => {
  const captions = all('[data-role="caption"]');
  expect(captions.map((caption) => caption.textContent.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
  for (let t = 0.25; t < LOOP; t += 0.5) {
    expect(captions.filter((caption) => opacityAt(caption, at(t)) === 1)).toHaveLength(1);
  }
});
