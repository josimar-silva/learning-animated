import type { Page } from '@playwright/test';

import { expect, test } from './_shared/fixtures.ts';
import { type BuiltPage, firstPage } from './_shared/pages.ts';
import { origin } from './_shared/sites.ts';

const lesson = firstPage('data-role="stage"');
const scrubbed = firstPage('data-role="scrubber"');
const stepped = firstPage('data-role="step"');
const viewed = firstPage('data-action="view"');

const stage = (page: Page) => page.locator('[data-role="stage"] object');

// The SVG document inside the <object> loads after the page, and again after a view switch. The
// player can only drive it once the document the object names has loaded.
const shown = (page: Page) =>
  expect
    .poll(() =>
      stage(page).evaluate((object: HTMLObjectElement) => {
        const doc = object.contentDocument;
        return Boolean(doc?.URL.endsWith(object.getAttribute('data')!) && doc.querySelector('svg'));
      }),
    )
    .toBe(true);

async function open(page: Page, built: BuiltPage): Promise<void> {
  await page.goto(`${origin(built.site)}${built.path}`);
  await shown(page);
}

const clock = (page: Page) =>
  stage(page).evaluate((object: HTMLObjectElement) => {
    const svg = object.contentDocument!.querySelector('svg')!;
    return { time: svg.getCurrentTime(), paused: svg.animationsPaused() };
  });

test('the toggle pauses and resumes the animation', async ({ page, problems }) => {
  test.skip(!lesson, 'no animation page yet');
  await open(page, lesson!);
  const toggle = page.locator('[data-action="toggle"]');
  await toggle.click();
  await expect(toggle).toHaveText('Play');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect((await clock(page)).paused).toBe(true);
  await toggle.click();
  await expect(toggle).toHaveText('Pause');
  expect((await clock(page)).paused).toBe(false);
  expect(problems).toEqual([]);
});

test('Space pauses and R restarts', async ({ page }) => {
  test.skip(!lesson, 'no animation page yet');
  await open(page, lesson!);
  await page.keyboard.press('Space');
  expect((await clock(page)).paused).toBe(true);
  await page.keyboard.press('r');
  const { time, paused } = await clock(page);
  expect(paused).toBe(false);
  expect(time).toBeLessThan(1);
});

test('dragging the scrubber pauses and seeks', async ({ page }) => {
  test.skip(!scrubbed, 'no lesson with a story loop yet');
  await open(page, scrubbed!);
  await page.locator('[data-role="scrubber"]').fill('2');
  const { time, paused } = await clock(page);
  expect(paused).toBe(true);
  expect(time).toBeCloseTo(2, 1);
});

test('picking a step seeks to it and marks it current', async ({ page }) => {
  test.skip(!stepped, 'no lesson with steps yet');
  await open(page, stepped!);
  const last = page.locator('[data-role="step"]').last();
  const at = Number(await last.getAttribute('data-at'));
  await page.locator('[data-action="toggle"]').click();
  await last.locator('button').click();
  expect((await clock(page)).time).toBeCloseTo(at, 1);
  await expect(last).toHaveAttribute('aria-current', 'step');
});

test('the view toggle swaps the SVG on the stage', async ({ page }) => {
  test.skip(!viewed, 'no lesson with views yet');
  await open(page, viewed!);
  const buttons = page.locator('[data-action="view"]');
  const second = buttons.nth(1);
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(stage(page)).toHaveAttribute('data', (await second.getAttribute('data-src'))!);
});

test('a view switch keeps the instant and the pause', async ({ page }) => {
  test.skip(!viewed, 'no lesson with views yet');
  await open(page, viewed!);
  // Pause well past the start, so a view that restarts from 0 cannot pass for one that kept the moment.
  await expect
    .poll(async () => (await clock(page)).time, { intervals: [100] })
    .toBeGreaterThan(1.5);
  const toggle = page.locator('[data-action="toggle"]');
  await toggle.click();
  const before = await clock(page);
  await page.locator('[data-action="view"]').nth(1).click();
  await shown(page);
  await expect
    .poll(() => clock(page))
    .toEqual({ time: expect.closeTo(before.time, 1), paused: true });
  await toggle.click();
  expect((await clock(page)).paused).toBe(false);
});
