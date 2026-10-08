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

## Identity and pull requests

- Before the first commit in any clone or worktree, compare `git config user.email` with the email in `~/projects/personal/kafka-the-definitive-guide-animated/.git/config`. If they differ, stop and ask. Never commit with the machine's global identity.
- Push with `git push -u origin HEAD:<branch>` so the remote branch gets the planned name, whatever the local branch is called.
- Never open PRs, edit secrets, or touch Cloudflare or DNS. After pushing, hand over the compare URL, a Conventional Commit PR title, and a description of at most 10 lines of prose.

## Common tasks

    just            # list recipes
    just test       # run every suite
    just check      # lint, format check, type-check
    just format     # apply lint fixes and formatting
