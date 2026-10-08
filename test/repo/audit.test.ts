import { expect, test } from 'vitest';

import { auditPage, existsIn, siteProblems } from '../../scripts/lib/audit.ts';

const BOOT = 'try{}catch(e){}';
const exists = existsIn('dist', (path) =>
  ['dist/index.html', 'dist/about/index.html', 'dist/_astro/a.js', 'dist/embed/x.svg'].includes(
    path,
  ),
);

test('root links must resolve to built files', () => {
  const html =
    '<a href="/about/"></a><a href="/missing/"></a><script type="module" src="/_astro/a.js"></script><object data="/embed/x.svg"></object><a href="https://example.com/"></a>';
  expect(auditPage('index.html', html, exists, BOOT)).toEqual([
    'index.html: broken link /missing/',
  ]);
});
test('the theme boot is the only inline script allowed', () => {
  const html = `<script>${BOOT}</script><script type="application/ld+json">{}</script><script type="application/json" data-role="legacy-map">{}</script><script>alert(1)</script>`;
  expect(auditPage('p.html', html, exists, BOOT)).toEqual([
    'p.html: an inline script the CSP does not allow',
  ]);
});
test('robots.txt and _headers must agree about indexing', () => {
  expect(
    siteProblems({ robots: 'User-agent: *\nDisallow: /\n', headers: '  X-Robots-Tag: noindex\n' }),
  ).toEqual([]);
  expect(siteProblems({ robots: 'User-agent: *\nDisallow: /\n', headers: '' })).toHaveLength(1);
});

test('a full page with a doctype, query strings, fragments, and external links', () => {
  const html =
    '<!doctype html><html><head><script type="module" src="/_astro/a.js?v=1"></script></head><body><a href="/about/#top">a</a><a href="//cdn.example/x">b</a><img src="/missing.png"></body></html>';
  expect(auditPage('index.html', html, exists, BOOT)).toEqual([
    'index.html: broken link /missing.png',
  ]);
});
test('a script with an end tag the old regex would have missed is still audited', () => {
  expect(auditPage('p.html', '<script>alert(1)</script >', exists, BOOT)).toEqual([
    'p.html: an inline script the CSP does not allow',
  ]);
});
