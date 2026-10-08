import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { describe, expect, test } from 'vitest';

const LOOP = 20;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'build-time' | 'runtime'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./config-picks-the-adapter.${name}.svg`, import.meta.url), 'utf8'),
  );
  return {
    svg,
    all: (selector) => [...svg.querySelectorAll(selector)],
    one: (selector) => {
      const found = svg.querySelector(selector);
      if (!found) throw new Error(`${name}: missing ${selector}`);
      return found;
    },
  };
}

const buildTime = load('build-time');
const runtime = load('runtime');

// The adapters whose elements of one role a view shows at a moment.
const adaptersAt = (view: View, role: string, seconds: number): string[] =>
  view
    .all(`[data-role="${role}"]`)
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map((el) => el.getAttribute('data-adapter') ?? '');

const captionsAt = (view: View, seconds: number): string[] =>
  view
    .all('[data-role="caption"]')
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map((el) => el.textContent.trim());

describe.each([
  ['build-time', buildTime, '@IfBuildProperty('],
  ['runtime', runtime, '@LookupIfProperty('],
] as const)('the %s view', (_name, view, annotation) => {
  test('one story lasts 20 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('20s');
  });

  test(`both adapter classes carry ${annotation} with their own value`, () => {
    const classes = view.all('[data-role="class"]');
    expect(classes.map((el) => el.getAttribute('data-adapter'))).toEqual(['card', 'sandbox']);
    const [card, sandbox] = classes.map((el) => el.textContent);
    for (const text of [card, sandbox]) {
      expect(text).toContain(annotation);
      expect(text).toContain('name = "payment.gateway"');
    }
    expect(card).toContain('stringValue = "card")');
    expect(card).toContain('class CardGateway');
    expect(sandbox).toContain('stringValue = "sandbox")');
    expect(sandbox).toContain('class SandboxGateway');
  });

  test('the application starts with card at 4 s, then restarts with sandbox at 8 s', () => {
    const card = view.one('[data-role="start-value"][data-value="card"]');
    const sandbox = view.one('[data-role="start-value"][data-value="sandbox"]');
    expect(hiddenThroughout(card, between(0, 3.9))).toBe(true);
    expect(shownThroughout(card, between(4.1, 7.9))).toBe(true);
    expect(hiddenThroughout(card, between(8.1, 19.9))).toBe(true);
    expect(hiddenThroughout(sandbox, between(0, 7.9))).toBe(true);
    expect(shownThroughout(sandbox, between(8.1, 19.4))).toBe(true);
  });

  test('no adapter exists or is chosen before the first build finishes', () => {
    expect(adaptersAt(view, 'bean', 1.5)).toEqual([]);
    expect(adaptersAt(view, 'resolved', 1.5)).toEqual([]);
  });

  test('one caption shows at a time, and the story clears before the loop restarts', () => {
    for (let t = 0.25; t < 19.5; t += 0.5) expect(captionsAt(view, t)).toHaveLength(1);
    expect(captionsAt(view, 19.75)).toEqual([]);
    for (const role of ['bean', 'no-bean', 'resolved', 'skipped'])
      expect(adaptersAt(view, role, 19.75)).toEqual([]);
  });
});

describe('build time: @IfBuildProperty decides which adapter is a bean', () => {
  test('the build runs twice and checks the annotations each time', () => {
    for (const role of ['build-run', 'check']) {
      const el = buildTime.one(`[data-role="${role}"]`);
      expect(shownThroughout(el, between(1.1, 2.9))).toBe(true);
      expect(hiddenThroughout(el, between(3.1, 11.9))).toBe(true);
      expect(shownThroughout(el, between(13.1, 14.9))).toBe(true);
      expect(hiddenThroughout(el, between(15.1, 19.9))).toBe(true);
    }
  });

  test('build 1 reads card, and only CardGateway becomes a bean', () => {
    const value = buildTime.one('[data-role="build-value"][data-value="card"]');
    expect(shownThroughout(value, between(0.1, 11.9))).toBe(true);
    for (const t of [2.5, 5.5, 9.5, 11.5]) {
      expect(adaptersAt(buildTime, 'bean', t)).toEqual(['card']);
      expect(adaptersAt(buildTime, 'no-bean', t)).toEqual(['sandbox']);
    }
  });

  test('a plain @Inject gets the only PaymentGateway bean', () => {
    expect(buildTime.one('[data-role="injection"]').textContent.trim()).toBe(
      '@Inject PaymentGateway gateway;',
    );
    expect(adaptersAt(buildTime, 'resolved', 4.5)).toEqual([]);
    expect(adaptersAt(buildTime, 'resolved', 5.5)).toEqual(['card']);
  });

  test('restarting with sandbox changes nothing: the value is ignored', () => {
    const ignored = buildTime.one('[data-role="ignored"]');
    expect(hiddenThroughout(ignored, between(0, 8.9))).toBe(true);
    expect(shownThroughout(ignored, between(9.1, 19.4))).toBe(true);
    const card = buildTime.one('[data-role="resolved"][data-adapter="card"]');
    expect(shownThroughout(card, between(5.1, 11.9))).toBe(true);
    for (const t of [9.5, 11.5]) expect(adaptersAt(buildTime, 'bean', t)).toEqual(['card']);
  });

  test('build 2 reads sandbox, and only SandboxGateway becomes a bean', () => {
    const value = buildTime.one('[data-role="build-value"][data-value="sandbox"]');
    expect(hiddenThroughout(value, between(0, 11.9))).toBe(true);
    expect(shownThroughout(value, between(12.1, 19.4))).toBe(true);
    expect(adaptersAt(buildTime, 'bean', 13.5)).toEqual([]);
    for (const t of [14.5, 17.5, 19.25]) {
      expect(adaptersAt(buildTime, 'bean', t)).toEqual(['sandbox']);
      expect(adaptersAt(buildTime, 'no-bean', t)).toEqual(['card']);
    }
  });

  test('after the rebuild, the same @Inject gets SandboxGateway', () => {
    const sandbox = buildTime.one('[data-role="resolved"][data-adapter="sandbox"]');
    expect(hiddenThroughout(sandbox, between(0, 16.9))).toBe(true);
    expect(shownThroughout(sandbox, between(17.1, 19.4))).toBe(true);
    expect(adaptersAt(buildTime, 'resolved', 14.5)).toEqual([]);
  });
});

describe('runtime: @LookupIfProperty keeps both beans and filters the lookup', () => {
  test('the build runs once and checks no property', () => {
    const run = runtime.one('[data-role="build-run"]');
    expect(shownThroughout(run, between(0.1, 2.9))).toBe(true);
    expect(hiddenThroughout(run, between(3.1, 19.9))).toBe(true);
    expect(runtime.all('[data-role="build-value"]')).toEqual([]);
    expect(hiddenThroughout(runtime.one('[data-role="check"]'), between(0, 3.9))).toBe(true);
  });

  test('both adapters are beans from the one build on', () => {
    for (const adapter of ['card', 'sandbox']) {
      const bean = runtime.one(`[data-role="bean"][data-adapter="${adapter}"]`);
      expect(shownThroughout(bean, between(2.1, 19.4))).toBe(true);
    }
    expect(runtime.all('[data-role="no-bean"]')).toEqual([]);
  });

  test('checkout looks the adapter up through Instance', () => {
    expect(runtime.one('[data-role="injection"]').textContent.trim()).toBe(
      '@Inject Instance<PaymentGateway> gateway;',
    );
  });

  test('the lookup checks the annotations at each start, not during the build', () => {
    const check = runtime.one('[data-role="check"]');
    expect(shownThroughout(check, between(4.1, 4.9))).toBe(true);
    expect(hiddenThroughout(check, between(5.1, 7.9))).toBe(true);
    expect(shownThroughout(check, between(8.1, 8.9))).toBe(true);
    expect(hiddenThroughout(check, between(9.1, 19.9))).toBe(true);
  });

  test('started with card, get() returns CardGateway and skips SandboxGateway', () => {
    expect(adaptersAt(runtime, 'resolved', 4.5)).toEqual([]);
    for (const t of [5.5, 7.5]) {
      expect(adaptersAt(runtime, 'resolved', t)).toEqual(['card']);
      expect(adaptersAt(runtime, 'skipped', t)).toEqual(['sandbox']);
    }
  });

  test('restarted with sandbox, the same build returns SandboxGateway', () => {
    for (const t of [9.5, 14.5, 19.25]) {
      expect(adaptersAt(runtime, 'resolved', t)).toEqual(['sandbox']);
      expect(adaptersAt(runtime, 'skipped', t)).toEqual(['card']);
    }
  });
});
