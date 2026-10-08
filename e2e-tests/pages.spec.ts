import { expect, test } from './_shared/fixtures.ts';
import { ALL_PAGES } from './_shared/pages.ts';
import { origin, SITES } from './_shared/sites.ts';

for (const { site, path } of ALL_PAGES) {
  test(`${site.id} ${path} loads cleanly`, async ({ page, problems }) => {
    const response = await page.goto(`${origin(site)}${path}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('h1')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });
}

for (const site of SITES) {
  test(`${site.id} answers an unknown path with its 404 page`, async ({ page }) => {
    const response = await page.goto(`${origin(site)}/no-such-page/`);
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveCount(1);
  });
}
