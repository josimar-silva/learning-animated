import { expect, test } from 'vitest';

import { sitemapXml } from './sitemap.ts';

test("the sitemap keeps Kafka's format", () => {
  expect(sitemapXml('https://java.learning-animated.com/', ['/', '/strings/'], '2026-10-07')).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url>\n    <loc>https://java.learning-animated.com/</loc>\n    <lastmod>2026-10-07</lastmod>\n  </url>\n' +
      '  <url>\n    <loc>https://java.learning-animated.com/strings/</loc>\n    <lastmod>2026-10-07</lastmod>\n  </url>\n' +
      '</urlset>\n',
  );
});
