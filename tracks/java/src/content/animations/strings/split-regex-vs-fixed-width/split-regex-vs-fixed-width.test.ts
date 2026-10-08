import { readFileSync } from 'node:fs';

import { parseSvg } from '@learning-animated/svg-kit/parse';
import {
  hiddenThroughout,
  onsetOf,
  opacityAt,
  shownThroughout,
  valueAt,
} from '@learning-animated/svg-kit/timeline';
import { describe, expect, test } from 'vitest';

const LOOP = 20;
const CLEAR = 19.5;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];

// Two made-up boarding-pass records in one layout: the name padded to 12 columns,
// then the two airports, the flight, and the seat, one blank column apart.
const CALLS = [
  {
    call: '1',
    record: 'OKAFOR/ADA   LIS OPO TP1946 014C',
    fields: ['OKAFOR/ADA', 'LIS', 'OPO', 'TP1946', '014C'],
    ends: 10,
  },
  {
    call: '2',
    record: 'LI/WEI       OPO FNC TP1693 022A',
    fields: ['LI/WEI', 'OPO', 'FNC', 'TP1693', '022A'],
    ends: CLEAR,
  },
] as const;
const FIELD_NAMES = ['name', 'from', 'to', 'flight', 'seat'];

// The call decode() makes, as written in Java, and the three-character regex split receives.
const SPLIT_CALL = String.raw`record.split("\\s+")`;
const REGEX = String.raw`\s+`;

// String.split skips Pattern.compile for a one-character regex that is not a metacharacter,
// or for a backslash and a character that is neither a letter nor a digit (JDK 25 String.java).
const takesFastPath = (regex: string): boolean =>
  (regex.length === 1 && !'.$|()[{^?*+\\'.includes(regex)) ||
  (regex.length === 2 && regex[0] === '\\' && !/^[0-9A-Za-z]$/.test(regex[1]!));

type View = {
  readonly svg: Element;
  all(selector: string): Element[];
  one(selector: string): Element;
};

function load(name: 'split' | 'fixed-width'): View {
  const { svg } = parseSvg(
    readFileSync(new URL(`./split-regex-vs-fixed-width.${name}.svg`, import.meta.url), 'utf8'),
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

const split = load('split');
const fixed = load('fixed-width');

const text = (el: Element): string => el.textContent.trim();

// A record as a view draws it: one character per cell, and a middle dot for a space.
const recordIn = (view: View, call: string): string =>
  view
    .all(`[data-role="record"][data-call="${call}"] [data-role="char"]`)
    .map((char) => (text(char) === '·' ? ' ' : text(char)))
    .join('');

const cellAt = (view: View, offset: number): { left: number; right: number } => {
  const rect = view.one(`[data-role="cell"][data-offset="${offset}"]`);
  const left = Number(rect.getAttribute('x'));
  return { left, right: left + Number(rect.getAttribute('width')) };
};

// What one call shows under the record: split's tokens, or the fixed-width fields.
const valuesOf = (view: View, role: string, call: string): string[] =>
  view.all(`[data-role="${role}"][data-call="${call}"] [data-role="value"]`).map(text);

const countAt = (view: View, role: string, seconds: number): string[] =>
  view
    .all(`[data-role="${role}"]`)
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map((el) => el.getAttribute('data-count') ?? '');

const captionsAt = (view: View, seconds: number): string[] =>
  view
    .all('[data-role="caption"]')
    .filter((el) => opacityAt(el, at(seconds)) === 1)
    .map(text);

// Hidden until the moment, then shown until it clears.
const appearsAt = (el: Element, seconds: number, clears: number): void => {
  expect(hiddenThroughout(el, between(0, seconds - 0.05))).toBe(true);
  expect(shownThroughout(el, between(seconds + 0.05, clears - 0.05))).toBe(true);
  expect(hiddenThroughout(el, between(clears + 0.05, LOOP))).toBe(true);
};

// Where a record's runs of spaces start and end, as [from, to) offsets.
function spaceRuns(record: string): [number, number][] {
  const runs: [number, number][] = [];
  for (let i = 0; i < record.length; i += 1) {
    if (record[i] !== ' ') continue;
    const start = i;
    while (record[i + 1] === ' ') i += 1;
    runs.push([start, i + 1]);
  }
  return runs;
}

describe.each([
  ['split', split, [6.5, 15]],
  ['fixed-width', fixed, [6.5, 13.5]],
] as const)('the %s view', (_name, view, returns) => {
  test('one story lasts 20 s, on a 960 by 530 stage', () => {
    expect(view.svg.getAttribute('data-loop')).toBe('20s');
    expect(view.svg.getAttribute('viewBox')).toBe('0 0 960 530');
  });

  test('call 1 decodes the first record until 10 s, and call 2 the second until 19.5 s', () => {
    const [first, second] = CALLS;
    expect(recordIn(view, '1')).toBe(first.record);
    expect(recordIn(view, '2')).toBe(second.record);
    const one = view.one('[data-role="record"][data-call="1"]');
    const two = view.one('[data-role="record"][data-call="2"]');
    expect(shownThroughout(one, between(0, 9.95))).toBe(true);
    expect(hiddenThroughout(one, between(10.05, LOOP))).toBe(true);
    appearsAt(two, 10, CLEAR);
  });

  test('the record count reads 1 once call 1 returns, and 2 once call 2 returns', () => {
    const [first, second] = returns;
    expect(countAt(view, 'decoded', first - 0.25)).toEqual(['0']);
    expect(countAt(view, 'decoded', first + 0.25)).toEqual(['1']);
    expect(countAt(view, 'decoded', second - 0.25)).toEqual(['1']);
    expect(countAt(view, 'decoded', second + 0.25)).toEqual(['2']);
    expect(countAt(view, 'decoded', CLEAR + 0.25)).toEqual(['0']);
  });

  test('one caption shows at a time, and the story clears before the loop restarts', () => {
    for (let t = 0.25; t < CLEAR; t += 0.5) expect(captionsAt(view, t)).toHaveLength(1);
    expect(captionsAt(view, 19.75)).toEqual([]);
  });
});

test('split and substring give the same five fields for each record', () => {
  for (const { call, record, fields } of CALLS) {
    expect(record.split(new RegExp(REGEX))).toEqual(fields);
    expect(valuesOf(split, 'token', call)).toEqual(fields);
    expect(valuesOf(fixed, 'field', call)).toEqual(fields);
  }
});

describe('split: every call compiles a Pattern and scans every character', () => {
  const SCANS = [
    { call: '1', from: 3, to: 6.2 },
    { call: '2', from: 11.5, to: 14.7 },
  ] as const;
  const recordOf = (call: string) => CALLS.find((c) => c.call === call)!;

  test(String.raw`the fast path covers "," and "\\|", but not "." or "\\s"`, () => {
    expect(takesFastPath(',')).toBe(true);
    expect(takesFastPath(String.raw`\|`)).toBe(true);
    expect(takesFastPath('.')).toBe(false);
    expect(takesFastPath(String.raw`\s`)).toBe(false);
  });

  test(String.raw`decode() calls split("\\s+"), a regex that misses the fast path`, () => {
    expect(text(split.one('[data-role="call"]'))).toBe(SPLIT_CALL);
    expect(REGEX).toHaveLength(3);
    expect(takesFastPath(REGEX)).toBe(false);
  });

  test('each call checks for the fast path, then compiles a Pattern of its own', () => {
    const verdicts = split.all('[data-role="fast-path"]');
    const patterns = split.all('[data-role="pattern"]');
    expect(verdicts.map((el) => el.getAttribute('data-call'))).toEqual(['1', '2']);
    expect(patterns.map((el) => el.getAttribute('data-call'))).toEqual(['1', '2']);
    for (const verdict of verdicts) expect(text(verdict)).toContain('no fast path');
    appearsAt(verdicts[0]!, 0.5, CLEAR);
    appearsAt(verdicts[1]!, 10.5, CLEAR);
    appearsAt(patterns[0]!, 2, CLEAR);
    appearsAt(patterns[1]!, 11, CLEAR);
  });

  test('the compile count keeps pace with the records: 1 after call 1, 2 after call 2', () => {
    expect(countAt(split, 'compiled', 1.5)).toEqual(['0']);
    expect(countAt(split, 'compiled', 9.5)).toEqual(['1']);
    expect(countAt(split, 'decoded', 9.5)).toEqual(['1']);
    expect(countAt(split, 'compiled', 19)).toEqual(['2']);
    expect(countAt(split, 'decoded', 19)).toEqual(['2']);
  });

  test.each(SCANS)(
    'call $call: a new Matcher scans all 32 characters from $from s to $to s',
    ({ call, from, to }) => {
      const scan = split.one(`[data-role="scan"][data-call="${call}"]`);
      const row = cellAt(split, 31).right - cellAt(split, 0).left;
      expect(valueAt(scan, 'width', at(from), 0)).toBeCloseTo(0);
      expect(valueAt(scan, 'width', at((from + to) / 2), 0)).toBeLessThan(row);
      expect(valueAt(scan, 'width', at(to), 0)).toBeGreaterThanOrEqual(row);
      appearsAt(split.one(`[data-role="matcher"][data-call="${call}"]`), from, CLEAR);
    },
  );

  test.each(SCANS)(
    'call $call: each run of spaces is found as the scan reaches the character after it',
    ({ call }) => {
      const delimiters = split.all(`[data-role="delimiter"][data-call="${call}"]`);
      const runs = delimiters.map((el) => [
        Number(el.getAttribute('data-from')),
        Number(el.getAttribute('data-to')),
      ]);
      expect(runs).toEqual(spaceRuns(recordOf(call).record));
      const scan = split.one(`[data-role="scan"][data-call="${call}"]`);
      const left = cellAt(split, 0).left;
      for (const el of delimiters) {
        const next = Number(el.getAttribute('data-to'));
        const reach = valueAt(scan, 'width', onsetOf(el)!, 0);
        expect(reach).toBeGreaterThan(cellAt(split, next - 1).right - left);
        expect(reach).toBeLessThan(cellAt(split, next).right - left);
      }
    },
  );

  test.each(SCANS)(
    'call $call: a token joins the list when the run after it is found, the last when the scan ends',
    ({ call, to }) => {
      const tokens = split.all(`[data-role="token"][data-call="${call}"]`);
      const delimiters = split.all(`[data-role="delimiter"][data-call="${call}"]`);
      expect(tokens).toHaveLength(delimiters.length + 1);
      delimiters.forEach((el, i) => expect(onsetOf(tokens[i]!)).toBe(onsetOf(el)));
      expect(onsetOf(tokens.at(-1)!)).toBeCloseTo(at(to));
      const { ends } = recordOf(call);
      for (const token of tokens)
        expect(hiddenThroughout(token, between(ends + 0.05, LOOP))).toBe(true);
    },
  );
});

describe('fixed width: substring cuts each field at its known offset', () => {
  const CUT_TIMES = { '1': [2, 3, 4, 5, 6], '2': [11, 11.5, 12, 12.5, 13] } as const;

  // The offsets each substring call in the code names, in field order.
  const cuts = (): [number, number][] =>
    fixed.all('[data-role="code-cut"]').map((el) => {
      const match = /substring\((\d+), (\d+)\)/.exec(text(el));
      if (!match) throw new Error(`not a substring call: ${text(el)}`);
      return [Number(match[1]), Number(match[2])];
    });

  test('no Pattern, no Matcher, no scan, and the compile count stays at 0', () => {
    expect(fixed.all('[data-role="pattern"], [data-role="matcher"], [data-role="scan"]')).toEqual(
      [],
    );
    for (const t of [0.25, 5, 10.25, 15, 19.75])
      expect(countAt(fixed, 'compiled', t)).toEqual(['0']);
  });

  test('decode() cuts with substring and never calls split', () => {
    const code = text(fixed.one('[data-role="code"]'));
    expect(code).toContain('record.substring(');
    expect(code).not.toContain('split');
  });

  test('each substring takes exactly its field from both records, and only the name strips padding', () => {
    const lines = fixed.all('[data-role="code-cut"]');
    expect(lines.map((el) => el.getAttribute('data-field'))).toEqual(FIELD_NAMES);
    const strips = lines.map((el) => text(el).includes('.strip()'));
    expect(strips).toEqual([true, false, false, false, false]);
    for (const { record, fields } of CALLS) {
      const values = cuts().map(([begin, end], i) => {
        const value = record.substring(begin, end);
        return strips[i] ? value.trim() : value;
      });
      expect(values).toEqual(fields);
    }
  });

  test('the layout drawn above the record matches the offsets in the code', () => {
    const layout = (view: View): number[][] =>
      view
        .all('[data-role="layout-field"]')
        .map((el) => [Number(el.getAttribute('data-from')), Number(el.getAttribute('data-to'))]);
    expect(layout(fixed)).toEqual(cuts());
    expect(layout(split)).toEqual(cuts());
  });

  test.each(CALLS)(
    'call $call: each cut outlines exactly its field, one field at a time',
    ({ call, ends }) => {
      cuts().forEach(([begin, end], i) => {
        const field = FIELD_NAMES[i]!;
        const cut = fixed.one(`[data-role="cut"][data-call="${call}"][data-field="${field}"]`);
        const left = Number(cut.getAttribute('x'));
        expect(left).toBe(cellAt(fixed, begin).left);
        expect(left + Number(cut.getAttribute('width'))).toBe(cellAt(fixed, end - 1).right);
        appearsAt(cut, CUT_TIMES[call][i]!, ends);
        const value = fixed.one(`[data-role="field"][data-call="${call}"][data-field="${field}"]`);
        expect(onsetOf(value)).toBe(onsetOf(cut));
      });
    },
  );
});
