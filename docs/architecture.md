# Architecture

Learning Animated is an npm workspace: three packages hold what every site shares, and each track is a thin Astro site built on them. A track never imports another track, and packages never import tracks.

We keep the code and the diagrams simple and honest: small pieces that do one thing, tests that describe behavior first, and no accidental complexity.

## Packages

| Package                                     | Holds                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`packages/design`](../packages/design)     | `theme.css`, the `LA-STYLE` generator and its sync CLI, the Inter font, the logo, `signature.md` |
| [`packages/svg-kit`](../packages/svg-kit)   | The SVG contract and the timeline, author, and contrast helpers                                  |
| [`packages/site-kit`](../packages/site-kit) | Content schemas, page and chrome components, browser modules, and the Astro integration          |

[`theme.css`](../packages/design/theme.css) is the single source for every color, font, and size. Tailwind reads it for the site chrome, and the `LA-STYLE` generator reads its first `@theme` block, the stage, for the SVGs. `just style` copies that block into every animation SVG, so a lesson keeps its look wherever it ends up. [The LA-STYLE block](../packages/design/signature.md#the-la-style-block) explains what it holds and how to change it.

`svg-kit` exports `assertSvgContract`, the rules every animation SVG must pass, listed in [Contract](../packages/design/signature.md#contract). Its helpers serve the tests and the generators:

- `timeline.ts` reads a SMIL timeline as a function of loop time, so a test can ask what an element shows at any moment.
- `author.ts` writes the timelines of generated SVGs: `show` turns intervals into a discrete opacity timeline, `move` turns waypoints into a translate animation, and `escapeXml` escapes text for markup.
- `contrast.ts` computes WCAG relative luminance and contrast ratios for the palette contrast test.

`site-kit` holds the Zod schemas for tracks, sections, and animations, the page and chrome components, and the browser modules for playback and the theme toggle. Its Astro integration validates a site's content as Astro starts. After a build, it writes `_headers`, `robots.txt`, `sitemap.xml`, the `/embed/` SVGs, and an nginx config that sends the same headers.

## Sites

Each track in `tracks/<id>` is a thin Astro project: a `track.ts` that names the site, its content (`sections.json`, `about.md`, and one folder per animation under `src/content/animations`), and five pages that render the kit's components. The home page in `home/` lists the tracks that are live and counts each one's animations from its folder.

A track site serves these routes:

| Route              | Page                                    |
| ------------------ | --------------------------------------- |
| `/`                | The track's contents                    |
| `/<section>/`      | One section                             |
| `/<section>/<id>/` | One lesson                              |
| `/about/`          | The about page                          |
| `/embed/<id>.svg`  | A lesson's SVG, for embedding elsewhere |

A site stays out of search engines, with a `noindex` header and a `robots.txt` that disallows everything, until its `track.ts` sets `launched: true`.

## Layout

```
justfile                        task runner: run `just` to list every recipe
Dockerfile                      one image per site: node builds the site, nginx serves it
vitest.config.ts                the Vitest projects: every package, every track, and test/repo
playwright.config.ts            the end-to-end browser projects, reporters, and preview servers
docs/                           this guide and the testing guide
packages/design/theme.css       every color, font, and size (single source of truth)
packages/design/signature.md    the aesthetic signature, in prose
packages/design/logo.svg        the project mark, drawn from the stage palette
packages/design/fonts/          Inter, self-hosted, with its license
packages/design/src/            theme parser, LA-STYLE generator, and sync
packages/design/bin/la-style.ts the sync CLI behind just style and just style-check
packages/svg-kit/src/           parse, contract, timeline, author, and contrast helpers
packages/site-kit/src/          schemas, content model, routes, headers, SEO, and the integration
packages/site-kit/src/pages/    the pages every site renders, built from src/components
packages/site-kit/src/client/   browser modules: playback, views, scrubber, steps, theme, and menu
tracks/<id>/                    one Astro site per track: track.ts, content, pages, and tests
home/                           the family home page for learning-animated.com
scripts/                        check-dist, forbidden-terms, gen, and port-kafka CLIs, logic in lib/
test/repo/                      repository-wide tests, listed in the testing guide
e2e-tests/                      Playwright specs that open every built page, helpers in _shared/
.github/workflows/              CI, CodeQL, Scorecard, Deploy, Docker, and CD
.github/skills/animate-lesson/  the checklist for adding a lesson
```

## Container images

Every site also ships as a container image that serves its built pages from an unprivileged nginx. Build and run one locally with:

```bash
just build-image kafka      # docker build --build-arg SITE=kafka -t learning-animated-kafka:dev .
just start-container kafka  # serve it on http://localhost:3000
```

One multi-stage [Dockerfile](../Dockerfile) builds any site. The `SITE` build argument picks the site, a node stage builds it, and the nginx stage serves its `dist/` on port 3000. The nginx config is the `nginx.generated.conf` the build writes beside the site, so the container serves each page from its own directory, answers unknown paths with the custom `404.html`, and sends the same security headers as Cloudflare Pages.

The [Docker workflow](../.github/workflows/docker.yaml) pushes one image per site to `ghcr.io/josimar-silva/learning-animated/<site>`, tagged with the package version, and also as `latest` when that version is a release. It then scans each image with Trivy and uploads the high and critical findings to GitHub code scanning.
