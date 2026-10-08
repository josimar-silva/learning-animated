import { expect, test } from './_shared/fixtures.ts';
import { origin, SITES, TRACKS } from './_shared/sites.ts';

test.use({ colorScheme: 'light' });

for (const site of SITES) {
  test.describe(`${site.id} chrome`, () => {
    test('the theme button switches to dark and remembers it', async ({ page, problems }) => {
      await page.goto(`${origin(site)}/`);
      const html = page.locator('html');
      const button = page.locator('[data-action="theme"]');
      await expect(html).not.toHaveClass(/\bdark\b/);
      await button.click();
      await expect(html).toHaveClass(/\bdark\b/);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(html).toHaveClass(/\bdark\b/);
      expect(problems).toEqual([]);
    });

    test('the footer links the author', async ({ page }) => {
      await page.goto(`${origin(site)}/`);
      await expect(
        page.locator('footer a[href="https://josimar-silva.com"]').first(),
      ).toBeVisible();
    });

    test('the header logo loads under the real headers', async ({ page, problems }) => {
      await page.goto(`${origin(site)}/`);
      const logo = page.locator('header a[href="/"] img');
      await expect(logo).toHaveJSProperty('complete', true);
      expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  });
}

for (const site of TRACKS) {
  test(`${site.id} opens and closes the menu on small screens`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the menu button is for small screens');
    await page.goto(`${origin(site)}/`);
    const button = page.locator('[data-action="menu"]');
    const nav = page.locator(`#${await button.getAttribute('aria-controls')}`);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });
}
