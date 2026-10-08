import type { GitHubActionOptions } from '@estruyf/github-actions-reporter';
import { defineConfig, devices } from '@playwright/test';

import { origin, SITES } from './e2e-tests/_shared/sites.ts';

export default defineConfig({
  testDir: './e2e-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: [
    ['list'],
    [
      '@estruyf/github-actions-reporter',
      {
        title: 'E2E Tests',
        useDetails: true,
        showError: true,
        showAnnotations: true,
        showTags: true,
      } satisfies GitHubActionOptions,
    ],
    [
      'monocart-reporter',
      {
        name: 'UI Coverage',
        outputFile: './e2e-tests-report/index.html',
        coverage: {
          reports: [['lcovonly', { file: 'ui-lcov.info' }]],
          entryFilter: () => true,
          sourceFilter: (sourcePath: string) => sourcePath.includes('/_astro/'),
        },
      },
    ],
  ],
  use: { trace: 'on-first-retry', screenshot: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
    { name: 'microsoft-edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'google-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: SITES.map((site) => ({
    command: `npm run preview --workspace ${site.dir} -- --port ${site.port}`,
    url: `${origin(site)}/`,
    reuseExistingServer: !process.env.CI,
  })),
});
