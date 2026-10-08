---
name: animate-lesson
description: Use when adding or porting an animation lesson in learning-animated. Covers the neutral-domain redraw, the story-beat test written first, the LA-STYLE and SMIL rules, references, and the hand-off. Load it before creating anything under tracks/*/src/content/animations/.
---

# Animate a lesson

A lesson is one folder, `tracks/<track>/src/content/animations/<section>/<id>/`, holding `index.md`, the SVG (or one SVG per view), `<id>.test.ts`, and an optional `<id>.gen.ts`. A lesson is one PR.

## Rules

- Recast work-derived lessons in the track's domain: concert ticketing for Quarkus (checkout holds seats in the database, charges a payment provider, then emails the tickets) and the boarding-pass decoder for Java string parsing. Use no employer, product, service, topic, class, payload, or partner names. Rewrite any code the SVG shows instead of copying it.
- Style only with LA-STYLE utilities and `la-*` components. `packages/design/signature.md` lists them, with the role recipes. Use no other CSS, no `style` attributes, no raw colors, and no `fill-opacity` or `stroke-opacity`.
- Animate with SMIL only. When the lesson has steps, give the root `data-loop="<seconds>s"`, equal to the story's `dur`.
- Give the root `role="img"`, a `<title>`, and a `<desc>` that says in plain sentences what the animation shows.
- A curriculum lesson cites at least one official reference: the Quarkus guide section, the JEP, the JDK source line, or the article it explains.
- No em dashes or en dashes anywhere, SVG text included.

## Steps

1. Read the source the task names and write down the one idea, the objective, and the moments a reader should notice.
2. Create `index.md`: the frontmatter (`id`, `section`, `order`, `title`, `description`, `objective`, `references`, plus `views` or `steps` when the lesson needs them) and the concept text as the body.
3. Write `<id>.test.ts` first. State the story beats as timed facts with `@learning-animated/svg-kit/timeline` (`opacityAt`, `onsetOf`, `shownThroughout`, `hiddenThroughout`), and select elements by `data-role`. Run `just test` and watch it fail.
4. Draw the SVG by hand, or generate it when one story table should drive every timing: `<id>.gen.ts` exports `render(): string`, built with `@learning-animated/svg-kit/author`, which returns the whole SVG with `canonicalStyleBlock()` embedded. `just gen <path to <id>.gen.ts>` writes the file, and the lesson test checks that `render()` equals the committed SVG byte for byte. For a hand-drawn SVG, leave the LA-STYLE markers empty and run `just style`.
5. Run `just test` and `just check` until both pass, then `just build-all` and `just test-e2e-on chromium`. The end-to-end suite opens every page, including the new lesson's, and drives its player. Then run `just dev <track>` and watch the lesson play, scrub, and switch views.
6. Commit as `feat(<track>): animate <lesson>`, with the test and the SVG in the same commit.

## Hand-off

Push with an explicit refspec, `git push -u origin HEAD:<track>/<id>`, so the remote branch has the lesson's name whatever the local branch is called. Then post the compare URL (`https://github.com/josimar-silva/learning-animated/compare/main...<branch>?expand=1`), the PR title (the commit subject), and a description of at most 10 lines: the idea the lesson teaches, and what a reviewer should watch for in the preview.
