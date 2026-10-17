# Testing

Tests come first: write one, watch it fail, then write the code that makes it pass.

## Commands

| Command                      | Checks                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `just test`                  | Every Vitest project: packages, tracks, and repository checks                   |
| `just check`                 | ESLint, Prettier, TypeScript, the `LA-STYLE` blocks, and `astro check`          |
| `just check-dist`            | The built sites: links, inline scripts, and indexing                            |
| `just forbidden-terms`       | Tracked files, and with `--commits <range>` commit metadata, for private terms  |
| `just test-e2e-on <project>` | Every built page in one browser project                                         |
| `just test-e2e`              | Builds every site, then runs the end-to-end suite in all seven browser projects |

`just pre-commit` runs `just check` and `just test`. If you'd rather not install just, `npm test`, `npm run test-e2e`, `npm run lint`, `npm run format`, and `npm run format:check` cover part of the same ground.

## Unit and content tests

`just test` runs [Vitest](https://vitest.dev/) once across the projects in [`vitest.config.ts`](../vitest.config.ts): one per package, with tests next to the code they cover, one per track, and `repo` for the checks in [`test/repo`](../test/repo).

Each track's `test/content.test.ts` checks its content: the sections and animations validate, every SVG passes the [SVG contract](../packages/design/signature.md#contract), and every id in the track's `embed-ids.txt` still exists, so a published embed keeps working. Kafka's [`attribution.test.ts`](../tracks/kafka/test/attribution.test.ts) keeps the book's credit and the license links in [`ATTRIBUTION.md`](../tracks/kafka/ATTRIBUTION.md) and in the README.

[`contract.ts`](../packages/svg-kit/src/contract.ts) implements the contract, and `contract.test.ts` pins each rule. [Accessibility](../packages/design/signature.md#accessibility) explains the contrast levels the palette test enforces and why the contract bans `fill-opacity` and `stroke-opacity`.

## Repository checks

| Test                                                        | Guards                                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`conventions`](../test/repo/conventions.test.ts)           | The standard recipes, exact dependency pins, `@types/node` matching `.nvmrc`, no em or en dashes, and the shared files                           |
| [`workflows`](../test/repo/workflows.test.ts)               | SHA-pinned actions, top-level permissions, runner hardening, egress allow-lists, Astro telemetry, and how Deploy, Docker, and CD ship every site |
| [`docker`](../test/repo/docker.test.ts)                     | Digest-pinned base images, one Dockerfile for every site, and telemetry off in the build                                                         |
| [`boundaries`](../test/repo/boundaries.test.ts)             | Imports stay in their workspace and its declared dependencies, and no track depends on another                                                   |
| [`e2e`](../test/repo/e2e.test.ts)                           | The CI container's Playwright version, every browser project in CI, and a preview server per site                                                |
| [`palette-contrast`](../test/repo/palette-contrast.test.ts) | WCAG AA for the palette: 4.5:1 for text pairs, 3:1 for graphical marks                                                                           |
| [`brand`](../test/repo/brand.test.ts)                       | The family logo as each site's favicon (Kafka keeps its own) and the README's top image                                                          |
| [`doc-links`](../test/repo/doc-links.test.ts)               | Relative links and `#anchors` in the root and `docs/` Markdown files                                                                             |

The `audit`, `forbidden`, `gen`, `kafka-content`, and `kafka-style` tests cover the logic behind the CLIs in `scripts/`.

## Built sites

`just check-dist` audits every page of every built site. Each root-relative link must resolve to a built file, the theme boot must be the only inline script (the CSP allows it by its hash), and `robots.txt` and `_headers` must agree about indexing.

## Forbidden terms

`just forbidden-terms` scans every tracked file, and with `--commits <range>` each commit's author, committer, and message, for terms from a private list: the `FORBIDDEN_TERMS` secret in CI, or a git-ignored `.forbidden-terms` file locally. CI logs of a public repository are public, so a finding names only the file and line, or the commit, and the term's number in the list, never the term itself. Without a list, the scan skips, and CI shows a warning.

## End-to-end suite

The suite in [`e2e-tests`](../e2e-tests) loads the built sites in real browsers with [Playwright](https://playwright.dev/). It serves each site with `astro preview`, which sends the production headers, and opens every page in that site's `sitemap.xml`, so a page added later is covered without writing a test for it. A page fails on any console error, uncaught exception, CSP violation, or response with an error status.

The suite also checks that `sitemap.xml` is served, that `robots.txt` agrees with the `noindex` header, and that pages carry the content security policy. It checks that the theme button switches to dark and remembers it, that the menu opens and closes on phone screens, and that every SVG an embed box offers is served. On a lesson page it drives the player: the Pause and Play button, the Space and R shortcuts, the scrubber, the steps, and the views. Each player test skips until a lesson has the feature it drives.

[`playwright.config.ts`](../playwright.config.ts) defines seven browser projects: `chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`, `microsoft-edge`, and `google-chrome`. To run the suite in Chromium:

```bash
npx playwright install --only-shell chromium  # once
just build-all
just test-e2e-on chromium
```

`just test-e2e` runs every project, so it also needs `npx playwright install firefox webkit` and local installs of Microsoft Edge and Google Chrome.

## CI

CI runs `just check`, `just test`, `just build-all`, `just check-dist`, and the forbidden-terms scan on every pull request and every push to `main`. Each browser project then runs as its own `Test E2E (<project>)` job in the official Playwright container, against the sites the `verify` job built, and the Chromium job uploads a UI coverage report.

Every job hardens the runner first and blocks egress to its own sorted list of `host:port` endpoints. The end-to-end jobs only audit, because Harden-Runner can't monitor a job that runs in a container. If a job fails on a blocked endpoint, open the Harden-Runner insights link in its job summary and, if the endpoint is legitimate, add it to the job's `allowed-endpoints`.
