import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { describe, expect, test } from 'vitest';

const LOOP = 12;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'before' | 'after'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./log-once-or-rethrow.${name}.svg`, import.meta.url), 'utf8'),
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

const before = load('before');
const after = load('after');

// The texts a view shows at a moment, among the elements the selector matches.
const shownAt = (view: View, selector: string, seconds: number): string[] =>
  view
    .all(selector)
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map((el) => el.textContent.trim());

// Hidden until the moment, then shown until the story clears at 11.5 s.
const appearsAt = (el: Element, seconds: number): void => {
  expect(hiddenThroughout(el, between(0, seconds - 0.1))).toBe(true);
  expect(shownThroughout(el, between(seconds + 0.1, 11.4))).toBe(true);
};

describe.each([
  ['before', before],
  ['after', after],
] as const)('the %s view', (_name, view) => {
  test('one story lasts 12 s', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('12s');
  });

  test('the seat query times out at 1.5 s', () => {
    appearsAt(view.one('[data-role="failure"]'), 1.5);
  });

  test('the client gets a 503 at 5.5 s', () => {
    const response = view.one('[data-role="response"]');
    expect(response.textContent).toContain('503');
    appearsAt(response, 5.5);
  });

  test('the log and the count clear before the loop restarts', () => {
    expect(shownAt(view, '[data-role="log-entry"]', 11.7)).toEqual([]);
    expect(shownAt(view, '[data-role="count"]', 11.7)).toEqual(['0']);
  });
});

describe('before: every layer logs, then rethrows', () => {
  test('the same QueryTimeoutException climbs from the database to the mapper', () => {
    expect(before.all('[data-role="exception-name"]').map((el) => el.textContent.trim())).toEqual([
      'QueryTimeoutException',
    ]);
    const exception = before.one('[data-role="exception"]');
    expect(hiddenThroughout(exception, between(0, 1.4))).toBe(true);
    expect(shownThroughout(exception, between(1.6, 4.9))).toBe(true);
    expect(hiddenThroughout(exception, between(5.1, 11.9))).toBe(true);
  });

  test('the repository, the service, and the endpoint each log it, a second apart', () => {
    const entries = before.all('[data-role="log-entry"]');
    expect(entries.map((entry) => entry.getAttribute('data-layer'))).toEqual([
      'repository',
      'service',
      'endpoint',
    ]);
    entries.forEach((entry, i) => appearsAt(entry, 2 + i));
  });

  test('each entry prints the same stack trace again', () => {
    for (const entry of before.all('[data-role="log-entry"]')) {
      expect(entry.textContent).toContain('QueryTimeoutException: query timed out');
      expect(entry.querySelectorAll('[data-role="stack-trace"]')).toHaveLength(1);
    }
  });

  test('the mapper answers 503 without logging', () => {
    const mapper = before.one('[data-role="handling"][data-layer="mapper"]');
    expect(mapper.textContent).toContain('no log');
    appearsAt(mapper, 5);
    expect(before.all('[data-role="log-entry"][data-layer="mapper"]')).toEqual([]);
  });

  test('one failure leaves three stack traces in the log', () => {
    expect(shownAt(before, '[data-role="count"]', 1)).toEqual(['0']);
    expect(shownAt(before, '[data-role="count"]', 2.5)).toEqual(['1']);
    expect(shownAt(before, '[data-role="count"]', 3.5)).toEqual(['2']);
    expect(shownAt(before, '[data-role="count"]', 11)).toEqual(['3']);
  });
});

describe('after: inner layers add context and rethrow, the mapper logs once', () => {
  test('the repository wraps the timeout in SeatHoldFailed, the service wraps that in CheckoutFailed', () => {
    expect(shownAt(after, '[data-role="exception-name"]', 1.7)).toEqual(['QueryTimeoutException']);
    expect(shownAt(after, '[data-role="exception-name"]', 2.5)).toEqual(['SeatHoldFailed']);
    expect(shownAt(after, '[data-role="exception-name"]', 4.5)).toEqual(['CheckoutFailed']);
  });

  test('each wrap adds context and nothing reaches the log', () => {
    const repository = after.one('[data-role="handling"][data-layer="repository"]');
    const service = after.one('[data-role="handling"][data-layer="service"]');
    expect(repository.textContent).toContain('seats A12, A13');
    expect(service.textContent).toContain('order 42');
    appearsAt(repository, 2);
    appearsAt(service, 3);
    expect(shownAt(after, '[data-role="log-entry"]', 4.9)).toEqual([]);
  });

  test('the endpoint lets it pass without a catch', () => {
    const endpoint = after.one('[data-role="handling"][data-layer="endpoint"]');
    expect(endpoint.textContent).toContain('no catch');
    appearsAt(endpoint, 4);
  });

  test('only the mapper logs, once, when it maps the exception at 5 s', () => {
    const entries = after.all('[data-role="log-entry"]');
    expect(entries.map((entry) => entry.getAttribute('data-layer'))).toEqual(['mapper']);
    appearsAt(entries[0]!, 5);
    expect(shownAt(after, '[data-role="count"]', 4.5)).toEqual(['0']);
    expect(shownAt(after, '[data-role="count"]', 11)).toEqual(['1']);
  });

  test("the mapper's entry carries every layer's context and the root cause", () => {
    const entry = after.one('[data-role="log-entry"]');
    expect(entry.textContent).toContain('CheckoutFailed: order 42');
    expect(entry.textContent).toContain('SeatHoldFailed: seats A12, A13');
    expect(entry.textContent).toContain('QueryTimeoutException: query timed out');
    expect(entry.querySelectorAll('[data-role="stack-trace"]')).toHaveLength(1);
  });
});
