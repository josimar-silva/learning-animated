import { describe, expect, test } from 'vitest';

import {
  contentIssues,
  contents,
  type Entry,
  figureLabel,
  loopOf,
  neighbors,
  ordered,
  populated,
  sectionName,
  validateContent,
  viewBoxOf,
  viewFiles,
} from './model.ts';
import type { Animation, Section } from './schemas.ts';

const section = (id: string, number: number): Section => ({
  id,
  number,
  title: id.toUpperCase(),
  description: id,
});
const animation = (
  over: Partial<Animation> & Pick<Animation, 'id' | 'section' | 'order'>,
): Animation => ({
  title: 't',
  description: 'd',
  objective: 'o',
  figure: null,
  references: [{ label: 'Guide', url: 'https://quarkus.io/guides/' }],
  ...over,
});
const svg = (extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 560" ${extra}></svg>`;
const entry = (
  a: Animation,
  files: Record<string, string> = { [`${a.id}.svg`]: svg() },
  folder = `${a.section}/${a.id}`,
): Entry => ({ animation: a, folder, svgs: new Map(Object.entries(files)) });

const SECTIONS = [section('b', 2), section('a', 1), section('c', 3)];
const A1 = animation({ id: 'a1', section: 'a', order: 1 });
const B1 = animation({ id: 'b1', section: 'b', order: 1 });
const A2 = animation({ id: 'a2', section: 'a', order: 2 });
const CURRICULUM = { kind: 'curriculum' } as const;

describe('ordering', () => {
  test('ordered sorts by section number, then order', () =>
    expect(ordered(SECTIONS, [B1, A2, A1]).map((a) => a.id)).toEqual(['a1', 'a2', 'b1']));
  test('contents lists every section, empty ones included', () =>
    expect(contents(SECTIONS, [A1]).map((s) => [s.id, s.animations.length])).toEqual([
      ['a', 1],
      ['b', 0],
      ['c', 0],
    ]));
  test('populated keeps only sections with animations', () =>
    expect(populated(SECTIONS, [A1, B1]).map((s) => s.id)).toEqual(['a', 'b']));
  test('neighbors returns prev and next, or null', () => {
    expect(neighbors([1, 2, 3], (n) => n === 2)).toEqual({ prev: 1, next: 3 });
    expect(neighbors([1, 2, 3], (n) => n === 1)).toEqual({ prev: null, next: 2 });
    expect(neighbors([1], (n) => n === 9)).toEqual({ prev: null, next: null });
  });
});

describe('labels and files', () => {
  test('a book names chapters and figures; a curriculum uses the plain title', () => {
    expect(sectionName({ kind: 'book' }, section('ch01', 1))).toBe('Chapter 1: CH01');
    expect(sectionName(CURRICULUM, section('rest', 2))).toBe('REST');
    expect(figureLabel({ kind: 'book' }, { figure: '1-5' })).toBe('Figure 1-5');
    expect(figureLabel({ kind: 'book' }, { figure: null })).toBe('Companion extra');
    expect(figureLabel(CURRICULUM, { figure: null })).toBeNull();
  });
  test('viewFiles names one SVG, or one per view', () => {
    expect(viewFiles(A1)).toEqual(['a1.svg']);
    expect(
      viewFiles({
        id: 'x',
        views: [
          { id: 'before', label: 'Before' },
          { id: 'after', label: 'After' },
        ],
      }),
    ).toEqual(['x.before.svg', 'x.after.svg']);
  });
  test('viewBoxOf and loopOf read the root svg', () => {
    expect(viewBoxOf(svg())).toEqual({ width: 960, height: 560 });
    expect(() => viewBoxOf('<svg/>')).toThrow(/viewBox/);
    expect(loopOf(svg('data-loop="13.5s"'))).toBe(13.5);
    expect(loopOf(svg())).toBeNull();
  });
});

describe('contentIssues', () => {
  const issues = (entries: Entry[], kind: 'book' | 'curriculum' = 'curriculum') =>
    contentIssues({ kind }, SECTIONS, entries);
  test('valid content has none', () =>
    expect(issues([entry(A1), entry(A2), entry(B1)])).toEqual([]));
  test('an unknown section', () =>
    expect(issues([entry(animation({ id: 'x', section: 'zz', order: 1 }))])).toContain(
      'animation "x" names unknown section "zz"',
    ));
  test('a misplaced folder', () =>
    expect(issues([entry(A1, undefined, 'b/a1')])).toContain(
      'animation "a1" must live in animations/a/a1/, not b/a1/',
    ));
  test('duplicate ids and orders', () => {
    const copy = animation({ id: 'a1', section: 'a', order: 1 });
    expect(issues([entry(A1), entry(copy)])).toEqual(
      expect.arrayContaining(['duplicate animation id "a1"', 'duplicate order a #1']),
    );
  });
  test('figures belong to books only', () =>
    expect(issues([entry({ ...A1, figure: '1-1' })])).toContain(
      'animation "a1" has a figure, but only book tracks have figures',
    ));
  test('a curriculum lesson needs a reference', () =>
    expect(issues([entry({ ...A1, references: [] })])).toContain(
      'animation "a1" needs at least one reference',
    ));
  test('the SVG files must match the views', () =>
    expect(issues([entry(A1, {})])).toContain('animation "a1" needs exactly a1.svg; found none'));
  test('steps need data-loop and must rise below it', () => {
    const stepped = {
      ...A1,
      steps: [
        { at: 0, text: 'start' },
        { at: 20, text: 'late' },
      ],
    };
    expect(issues([entry(stepped)])).toContain(
      'animation "a1" has steps, so a1.svg needs data-loop',
    );
    expect(issues([entry(stepped, { 'a1.svg': svg('data-loop="13.5s"') })])).toContain(
      'animation "a1" steps must rise and stay below the 13.5s loop',
    );
  });
  test('validateContent throws with every problem listed', () =>
    expect(() => validateContent(CURRICULUM, SECTIONS, [entry(A1, {})])).toThrow(
      /Content problems:\n- animation "a1" needs exactly/,
    ));
});
