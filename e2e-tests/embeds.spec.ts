import { expect, test } from '@playwright/test';

import { ALL_PAGES } from './_shared/pages.ts';
import { origin } from './_shared/sites.ts';

for (const { site, path, html } of ALL_PAGES.filter((page) =>
  page.html.includes('data-role="embed"'),
)) {
  test(`${site.id} ${path} serves every SVG its embed box offers`, async ({ request }) => {
    const files = [
      ...new Set(
        [...html.matchAll(/href="(\/embed\/[a-z0-9.-]+\.svg)"/g)].map(([, href]) => href!),
      ),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const response = await request.get(`${origin(site)}${file}`);
      expect(response.status(), file).toBe(200);
      expect(response.headers()['content-type'], file).toContain('image/svg+xml');
      expect(await response.text(), file).toContain('role="img"');
    }
  });
}
