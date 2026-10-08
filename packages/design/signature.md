# Aesthetic signature

This document describes the visual language every animation shares. `theme.css` holds the values, and the contract in `svg-kit` fails any SVG that strays from them.

## Principles

1. Dark and focused. The stage is a near-black plum rather than pure black, which causes halation and eye fatigue. Purple carries the environment, the brand, and whatever is stored or committed. One warm accent, amber, marks what is new or active, and one red marks failure: a crash, a lost record, a thrown exception.
2. The cell is the hero. One equal-width cell draws a record, a byte, a character, a SIMD lane, or a heap object. Cells sit in a row, numbered by offset or index in a monospace face.
3. Motion explains. Each animation loops one clear idea (append, consume, replicate) on one steady beat, and nothing moves only to decorate.
4. Utilities only. An SVG has no raw colors outside its embedded `LA-STYLE` block. Every color comes from a palette utility or an `la-*` component.
5. Depth by lightness, not shadow. Surfaces step up from `stage` to `surface` to show elevation. Highlights glow: a newly written cell is a dark warm fill ringed by bright amber, so the shared light offset ink stays legible on it.

## The LA-STYLE block

Tailwind can't run where an SVG gets embedded (GitHub, a blog, slides), so each SVG carries one generated `<style>` block between `/* LA-STYLE:START */` and `/* LA-STYLE:END */`. The block holds:

- the stage variables from the first `@theme` block in `theme.css`, declared on `:root`;
- a `fill-` and a `stroke-` utility for every palette color, plus a `font-` and a `text-` utility for every type variable;
- the fixed utilities and the `la-*` components listed below.

Never edit the block by hand. Change `theme.css` (or `src/style-block.ts` for the fixed utilities and the components), then run `just style` to embed the new block in every animation SVG. `just check` runs `just style-check`, which fails when any block has drifted from `theme.css`.

## Palette

Every color comes from the stage block in `theme.css`.

| Utilities                               | Hex       | Typical use                                                                                       |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `fill-stage` `stroke-stage`             | `#0e0b16` | The stage behind the diagram, and the `halo` stroke                                               |
| `fill-surface` `stroke-surface`         | `#191426` | The diagram surface (`la-canvas`); label text on bright fills such as `green`, `sky`, and `amber` |
| `fill-ink` `stroke-ink`                 | `#ece9f7` | Titles and labels (`la-title`, `la-label`)                                                        |
| `fill-ink-muted` `stroke-ink-muted`     | `#a9a3ca` | Notes and secondary text (`la-note`)                                                              |
| `fill-grid` `stroke-grid`               | `#302a4d` | The canvas outline (`la-canvas`)                                                                  |
| `fill-cell` `stroke-cell`               | `#2a2246` | A stored cell's fill (`la-cell`)                                                                  |
| `fill-cell-stroke` `stroke-cell-stroke` | `#7c6ac4` | Cell outlines (`la-cell`, `la-cell-tail`)                                                         |
| `fill-cell-ink` `stroke-cell-ink`       | `#e2ddf5` | Offsets on cells (`la-offset`)                                                                    |
| `fill-cell-new` `stroke-cell-new`       | `#4a3410` | The fill of a cell being written (`la-cell-new`)                                                  |
| `fill-amber` `stroke-amber`             | `#f6a723` | New or active: the new cell's outline, the flow dot, a leader, a blocking request                 |
| `fill-emerald` `stroke-emerald`         | `#34d399` | Success, the read marker, a producer's outline, a non-blocking request                            |
| `fill-green` `stroke-green`             | `#10b981` | A producer's fill                                                                                 |
| `fill-sky` `stroke-sky`                 | `#38bdf8` | A consumer's fill; an I/O thread's outline and title                                              |
| `fill-sky-light` `stroke-sky-light`     | `#7dd3fc` | A consumer's outline                                                                              |
| `fill-violet` `stroke-violet`           | `#9075e8` | Card outlines (`la-card`); a worker thread's outline and title                                    |
| `fill-violet-deep` `stroke-violet-deep` | `#221b3e` | Card fills (`la-card`)                                                                            |
| `fill-lime` `stroke-lime`               | `#65a30d` | A schema registry's outline                                                                       |
| `fill-lime-deep` `stroke-lime-deep`     | `#1e2610` | A schema registry's fill                                                                          |
| `fill-slate` `stroke-slate`             | `#8992aa` | A follower's outline                                                                              |
| `fill-pink` `stroke-pink`               | `#f472b6` | Replication paths                                                                                 |
| `fill-red` `stroke-red`                 | `#f87171` | Failure: verdicts, crashes, blocked threads                                                       |
| `fill-flow` `stroke-flow`               | `#a8a1cf` | Flow arrows (`la-arrow`)                                                                          |
| `fill-flow-strong` `stroke-flow-strong` | `#f1edff` | Emphasized flow arrows and dots                                                                   |

## Utilities

The type variables give `font-sans`, `font-mono`, `text-title` (20px), `text-label` (13px), and `text-offset` (12px). The block also always includes these:

| Utility                                       | Sets                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `fill-none`, `stroke-none`                    | No fill, or no stroke                                                                                  |
| `stroke-1.5`, `stroke-2.5`                    | A stroke width of 1.5 or 2.5                                                                           |
| `font-semibold`, `font-bold`                  | A font weight of 600 or 700                                                                            |
| `anchor-start`, `anchor-middle`, `anchor-end` | `text-anchor`                                                                                          |
| `halo`                                        | A 3px `stage` stroke painted under the text's fill, so a label stays readable where it crosses a shape |

Write `class="stroke-1.5"` in markup; the block escapes the dot in its selector. Geometry that isn't a color, such as dash arrays, line caps, and letter spacing, goes in presentation attributes.

## Components

Components draw the shapes that recur in nearly every animation. The `la-` prefix keeps them apart from utilities. The block lists them after the utilities, so a component wins over a utility that sets the same property: never put both on one element for that property.

| Component        | Draws                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| `la-canvas`      | The diagram surface: `surface` fill, `grid` outline                                     |
| `la-card`        | A container such as a broker, a topic, or a group: `violet-deep` fill, `violet` outline |
| `la-cell`        | A stored cell: `cell` fill, `cell-stroke` outline                                       |
| `la-cell-new`    | A cell being written: `cell-new` fill, `amber` outline                                  |
| `la-cell-tail`   | The dashed placeholder for the next write slot                                          |
| `la-offset`      | The offset or index on a cell, in the monospace face                                    |
| `la-title`       | The figure title: 20px, semibold, `ink`                                                 |
| `la-label`       | Actor and partition labels: 13px, `ink`                                                 |
| `la-note`        | Secondary text: 13px, `ink-muted`                                                       |
| `la-arrow`       | A flow arrow or connector: `flow` stroke, no fill                                       |
| `la-flow-dot`    | A message dot moving along a path: `amber`                                              |
| `la-read-marker` | A consumer's read position: `emerald` outline, 2.5 wide                                 |

## Role recipes

A role is a recipe of palette utilities and components, not a token of its own. Only palette utilities exist and raw colors are banned, so no animation can drift off the palette. Add a row when a lesson needs a new role.

| Messaging role       | Recipe                                  |
| -------------------- | --------------------------------------- |
| Producer             | `fill-green stroke-emerald stroke-1.5`  |
| Consumer             | `fill-sky stroke-sky-light stroke-1.5`  |
| Broker or topic card | `la-card`                               |
| Schema registry      | `fill-lime-deep stroke-lime stroke-1.5` |
| Leader               | `fill-amber`                            |
| Follower             | `fill-none stroke-slate stroke-1.5`     |
| Replication path     | `fill-none stroke-pink stroke-1.5`      |
| Failure              | `fill-red` or `stroke-red`              |

| Threads role            | Recipe                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- |
| I/O thread (event loop) | `fill-surface stroke-sky stroke-1.5` box, `fill-sky` title                        |
| Worker thread           | `stroke-violet` outline, `fill-violet` title                                      |
| Blocked thread          | `fill-surface` slot hatched with `stroke-red` lines, `fill-red` label with `halo` |
| Non-blocking request    | `fill-emerald` dot                                                                |
| Blocking request        | `fill-amber` dot                                                                  |

## Accessibility

Every SVG sets `role="img"`, a `<title>` (a short name), and a `<desc>` (what the animation shows). Write both as plain sentences.

`test/repo/palette-contrast.test.ts` holds the palette to WCAG AA. Text pairs (offsets on cells, labels on actor fills, muted text on surfaces) reach 4.5:1, and graphical marks (cell outlines, arrows, dots, markers) reach 3:1. The test measures each pair at full strength, so `stroke-opacity` and `fill-opacity` are banned: dimming a mark voids the guarantee. Pick another palette color instead. Plain `opacity`, which animations use to bring a thing on and off screen, is fine.

The stage stays dark in both site themes, because the light and dark themes restyle only the chrome around it.

## Contract

Every animation SVG must pass `assertSvgContract` from `@learning-animated/svg-kit/contract`, which checks for:

- an `<svg>` root with the SVG namespace and a four-number `viewBox`;
- `role="img"` with a non-empty `<title>` and `<desc>`;
- the canonical `LA-STYLE` block, embedded verbatim;
- no CSS outside that block: no other rules and no `style` attributes;
- no raw colors (hex, `rgb()`, `hsl()`) in color properties;
- no `fill-opacity` or `stroke-opacity`;
- SMIL only, with no `@keyframes` and no CSS `animation`;
- well-formed `keyTimes`: numeric, starting at 0, never decreasing, within 0 to 1, ending at 1 unless the timeline is discrete, and one per value;
- an optional `data-loop="<seconds>s"` on the root. When present, it equals the `dur` of the story's own animations, and no animation runs longer. Shorter decorative cycles, such as a 1s pulse, may run inside it.
