import { expect, test as base } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

export const test = base.extend<{ autoTestFixture: string; problems: string[] }>({
  // JS and CSS coverage for the UI report. Playwright's coverage API exists in Chromium only.
  autoTestFixture: [
    async ({ page }, use, testInfo) => {
      const isChromium = testInfo.project.name === 'chromium';
      if (isChromium) {
        await Promise.all([
          page.coverage.startJSCoverage({ resetOnNavigation: false }),
          page.coverage.startCSSCoverage({ resetOnNavigation: false }),
        ]);
      }
      await use('autoTestFixture');
      if (isChromium) {
        const [jsCoverage, cssCoverage] = await Promise.all([
          page.coverage.stopJSCoverage(),
          page.coverage.stopCSSCoverage(),
        ]);
        await addCoverageReport([...jsCoverage, ...cssCoverage], testInfo);
      }
    },
    { scope: 'test', auto: true },
  ],
  // Console errors, uncaught errors, CSP violations, and failed responses seen during the test.
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP blocked ${event.blockedURI} (${event.violatedDirective})`);
      });
    });
    await use(problems);
  },
});

export { expect };
