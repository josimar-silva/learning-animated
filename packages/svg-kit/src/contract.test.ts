import { describe, expect, test } from 'vitest';

import {
  assertKeyTimesWellFormed,
  assertLoopConsistent,
  assertSvgContract,
  durSeconds,
} from './contract.ts';
import { parseSvg } from './parse.ts';

const BLOCK =
  '/* LA-STYLE:START */\n:root {\n  --color-sky: #38bdf8;\n}\n.fill-sky { fill: var(--color-sky); }\n/* LA-STYLE:END */';
const PULSE =
  '<animate attributeName="opacity" dur="2s" values="0;1" keyTimes="0;1" repeatCount="indefinite"/>';

function svg({
  root = '',
  body = `<rect class="fill-sky" width="10" height="10">${PULSE}</rect>`,
  style = BLOCK,
  title = 'T',
  desc = 'D',
  viewBox = 'viewBox="0 0 100 50"',
} = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${viewBox} role="img" ${root}><title>${title}</title><desc>${desc}</desc><style>${style}</style>${body}</svg>`;
}

const check = (text: string) => () => assertSvgContract(text, BLOCK);

describe('assertSvgContract', () => {
  test('passes on good markup', () => expect(check(svg())).not.toThrow());
  test('needs a viewBox', () => expect(check(svg({ viewBox: '' }))).toThrow(/viewBox/));
  test('needs a title and a desc', () => {
    expect(check(svg({ title: '' }))).toThrow(/title/);
    expect(check(svg({ desc: '' }))).toThrow(/desc/);
  });
  test('needs the canonical block', () =>
    expect(check(svg({ style: BLOCK.replace('#38bdf8', '#38bdf9') }))).toThrow(/LA-STYLE/));
  test('rejects CSS outside the block', () => {
    expect(check(svg({ style: `${BLOCK}\n.x { fill: none; }` }))).toThrow(/LA-STYLE block/);
    expect(check(svg({ body: `<rect style="fill: none">${PULSE}</rect>` }))).toThrow(
      /style attributes/,
    );
  });
  test('ignores a style element holding only a comment', () =>
    expect(
      check(svg({ body: `<style><!-- note --></style><rect>${PULSE}</rect>` })),
    ).not.toThrow());
  test('ignores a style element holding only an empty CDATA section', () =>
    expect(check(svg({ body: `<style><![CDATA[]]></style><rect>${PULSE}</rect>` }))).not.toThrow());
  test('rejects a rule beside a comment', () =>
    expect(check(svg({ style: `${BLOCK}<!-- note -->.x { fill: none; }` }))).toThrow(
      /LA-STYLE block/,
    ));
  test('rejects a style attribute on the root', () =>
    expect(check(svg({ root: 'style="fill: none"' }))).toThrow(/style attributes/));
  test('rejects raw colors', () =>
    expect(check(svg({ body: `<rect fill="#ffffff">${PULSE}</rect>` }))).toThrow(/raw colors/));
  test('rejects a raw color behind spaces and a quote', () =>
    expect(check(svg({ body: `<rect fill = " #ffffff">${PULSE}</rect>` }))).toThrow(/raw colors/));
  test('rejects dimmed paint', () =>
    expect(check(svg({ body: `<rect fill-opacity="0.5">${PULSE}</rect>` }))).toThrow(
      /full strength/,
    ));
  test('needs SMIL and rejects CSS animation', () => {
    expect(check(svg({ body: '<rect class="fill-sky"/>' }))).toThrow(/SMIL/);
    expect(
      check(
        svg({
          style: `${BLOCK}<!-- -->`,
          body: `<rect class="fill-sky">${PULSE}</rect><style>@keyframes x {}</style>`,
        }),
      ),
    ).toThrow();
  });
});

describe('assertKeyTimesWellFormed', () => {
  const at = (attrs: string) => () =>
    assertKeyTimesWellFormed(
      parseSvg(svg({ body: `<rect><animate attributeName="x" dur="2s" ${attrs}/></rect>` })).svg,
    );
  test('passes when keyTimes start at 0, end at 1, and match values', () =>
    expect(at('keyTimes="0;0.5;1" values="0;5;10"')).not.toThrow());
  test('ignores an animate with no keyTimes', () => expect(at('values="0;10"')).not.toThrow());
  test('must start at 0', () => expect(at('keyTimes="0.1;1" values="0;10"')).toThrow(/start at 0/));
  test('linear must end at 1', () =>
    expect(at('keyTimes="0;0.5" values="0;10"')).toThrow(/end at 1/));
  test('must never decrease', () =>
    expect(at('keyTimes="0;0.6;0.5;1" values="0;1;2;3"')).toThrow(/decrease/));
  test('must match the values count', () =>
    expect(at('keyTimes="0;1" values="0;5;10"')).toThrow(/as many entries/));
  test('discrete may end before 1', () =>
    expect(at('calcMode="discrete" keyTimes="0;0.5" values="0;1"')).not.toThrow());
  test('stays within 0 to 1', () =>
    expect(at('calcMode="discrete" keyTimes="0;1.5" values="0;1"')).toThrow(/range/));
});

describe('data-loop', () => {
  const loop = (root: string, durs: string[]) => () =>
    assertLoopConsistent(
      parseSvg(
        svg({
          root,
          body: durs
            .map(
              (d) =>
                `<rect><animate attributeName="opacity" dur="${d}" values="0;1" keyTimes="0;1"/></rect>`,
            )
            .join(''),
        }),
      ).svg,
    );
  test('is optional', () => expect(loop('', ['4.5s', '6s'])).not.toThrow());
  test('must equal the story dur', () =>
    expect(loop('data-loop="13.5s"', ['12s'])).toThrow(/equal/));
  test('allows shorter decorative cycles', () =>
    expect(loop('data-loop="13.5s"', ['13.5s', '1s'])).not.toThrow());
  test('rejects a longer animation', () =>
    expect(loop('data-loop="12s"', ['12s', '18s'])).toThrow(/longer/));
  test('reads milliseconds', () => expect(durSeconds('1200ms')).toBe(1.2));
});
