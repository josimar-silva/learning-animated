import { expect, test } from '@playwright/test';

import { origin, SITES } from './_shared/sites.ts';

for (const site of SITES) {
  test.describe(`${site.id} crawl files and headers`, () => {
    test('sitemap.xml is served as XML and lists the home page', async ({ request }) => {
      const response = await request.get(`${origin(site)}/sitemap.xml`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('xml');
      expect(await response.text()).toMatch(/<loc>https:\/\/[^<]+\/<\/loc>/);
    });

    test('robots.txt and the noindex header agree', async ({ request }) => {
      const robots = await (await request.get(`${origin(site)}/robots.txt`)).text();
      const hidden = /^Disallow: \/$/m.test(robots);
      const home = await request.get(`${origin(site)}/`);
      expect(home.headers()['x-robots-tag'] === 'noindex').toBe(hidden);
      if (!hidden) expect(robots).toContain('Sitemap: https://');
    });

    test('pages carry the content security policy', async ({ request }) => {
      const csp =
        (await request.get(`${origin(site)}/`)).headers()['content-security-policy'] ?? '';
      expect(csp).toContain("object-src 'self'");
      expect(csp).toContain("frame-ancestors 'self'");
    });
  });
}
