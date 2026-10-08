# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

`learning-animated` hosts animated learning sites, one per track, plus a home page at learning-animated.com. The first tracks are Kafka (a companion to the book _Kafka: The Definitive Guide_), Quarkus, and Java, and more can follow. Every lesson is a looping SMIL SVG, and that SVG is also the canonical file for embeds.

## Layout

| Path                   | Holds                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| `packages/design`      | `theme.css`, the `LA-STYLE` generator and sync CLI, fonts, `signature.md`    |
| `packages/svg-kit`     | SVG contract, timeline, contrast, and author helpers                         |
| `packages/site-kit`    | Astro components, content schemas, the integration, headers, browser modules |
| `tracks/<id>`          | One site per track: config, content, thin pages, tests                       |
| `home`                 | The family home page                                                         |
| `test/repo`, `scripts` | Repository-wide checks and CLIs                                              |

A track never imports another track, and packages never import tracks.

## Rules

- Test-driven: write the failing test, make it pass with the simplest code, then refactor. Config and build files are the exception.
- Conventional Commits, one logical change per commit, and every commit green. A test and the code that makes it pass share a commit.
- No em dashes or en dashes anywhere, including SVG text and commit messages.
- Prose goes through the humanizer skill.
- No work names: no employer, product, service, topic, class, payload, or partner names. CI scans content and commit metadata against a private list.

## SVG contract

Read `packages/design/signature.md` before drawing. Author with palette utilities (`fill-<color>`, `stroke-<color>`) and `la-*` components only, and run `just style` after editing `packages/design/theme.css`. Geometry that isn't a color (dash arrays, line caps, letter spacing) goes in presentation attributes. Every animation SVG must pass `assertSvgContract` from `packages/svg-kit`:

- a `viewBox`, and `role="img"` with a non-empty `<title>` and `<desc>`;
- the canonical `LA-STYLE` block, embedded verbatim;
- no CSS outside that block: no other rules and no `style` attributes;
- no raw colors (hex, `rgb()`, `hsl()`) in color properties;
- no `fill-opacity` or `stroke-opacity`;
- SMIL only: no `@keyframes` and no CSS `animation`;
- well-formed `keyTimes`;
- optionally, `data-loop="<seconds>s"` on the root, equal to the story's `dur`, with no animation running longer.

## Adding a lesson

Before you create anything under `tracks/*/src/content/animations/`, load the animate-lesson skill, [`.github/skills/animate-lesson/SKILL.md`](.github/skills/animate-lesson/SKILL.md), and follow its steps. It covers the redraw into the track's domain, the story-beat test that comes first, the generator flow, and the hand-off.

## Identity and pull requests

- Before the first commit in any clone or worktree, compare `git config user.email` with the email in `~/projects/personal/kafka-the-definitive-guide-animated/.git/config`. If they differ, stop and ask. Never commit with the machine's global identity.
- Push with `git push -u origin HEAD:<branch>` so the remote branch gets the planned name, whatever the local branch is called.
- Never edit secrets or touch Cloudflare or DNS. After pushing, report the PR URL, or the compare URL if nobody asked for a PR, with a Conventional Commit title and a description of at most 10 lines of prose.

## Common tasks

    just                         # list recipes
    just test                    # run every suite
    just check                   # lint, format check, type-check, astro check
    just format                  # apply lint fixes and formatting
    just style                   # re-embed the LA-STYLE block into every SVG
    just style-check             # fail if an SVG's LA-STYLE block drifted
    just dev <site>              # dev server for home, kafka, quarkus, or java
    just build <site>            # build one site into its dist/
    just build-all               # build every site
    just preview <site>          # serve a built site with its production headers
    just check-dist              # audit the built sites' links and inline scripts
    just forbidden-terms         # scan files (and --commits <range>) for forbidden terms
    just gen <file>              # write the SVG an <id>.gen.ts generator describes
    just build-image <site>      # build a site's nginx image
    just start-container <site>  # serve that image on http://localhost:3000
    just pre-release             # strip -SNAPSHOT and commit the release bump
