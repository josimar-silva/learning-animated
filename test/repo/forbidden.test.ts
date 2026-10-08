import { expect, test } from 'vitest';

import { findInText, report, termsFrom } from '../../scripts/lib/forbidden.ts';

test('terms are trimmed, lowercased, and blank lines dropped', () =>
  expect(termsFrom(' Acme \n\nwidgetco\n')).toEqual(['acme', 'widgetco']));
test('matches ignore case and report line and term numbers', () =>
  expect(findInText('a.md', 'fine\nan ACME line\nwidgetco and acme', ['acme', 'widgetco'])).toEqual(
    [
      { where: 'a.md:2', term: 1 },
      { where: 'a.md:3', term: 1 },
      { where: 'a.md:3', term: 2 },
    ],
  ));
test('the report never prints a term', () => {
  const out = report(findInText('a.md', 'acme', ['acme']));
  expect(out).toBe('a.md:1: forbidden term #1');
  expect(out).not.toContain('acme');
});
