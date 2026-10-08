import { readFileSync } from 'node:fs';

import { canonicalStyleBlock } from '@learning-animated/design/canonical';
import { assertSvgContract } from '@learning-animated/svg-kit/contract';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { expect, test } from 'vitest';

import {
  assertSameLook,
  KAFKA_TOKENS,
  parseCss,
  portKafkaSvg,
  resolveVars,
} from '../../scripts/lib/kafka-style.ts';

const block = canonicalStyleBlock();
const TOKENS = readFileSync(new URL('./fixtures/kf-tokens.css', import.meta.url), 'utf8');

const kafkaSvg = (rules: string, body: string): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img"><title>t</title><desc>d</desc>' +
  `<style>\n${TOKENS}\n${rules}\n</style>${body}` +
  '<rect width="1" height="1" opacity="0"><animate attributeName="opacity" values="0;1" keyTimes="0;1" dur="2s" repeatCount="indefinite"/></rect></svg>\n';
const port = (rules: string, body: string): Element =>
  parseSvg(portKafkaSvg(kafkaSvg(rules, body), block)).svg;
const byId = (svg: Element, id: string): Element => svg.querySelector(`#${id}`)!;

const CELL =
  '.kf-cell { fill: var(--kf-cell); stroke: var(--kf-cell-stroke); stroke-width: var(--kf-stroke); }';
const LABEL_BODY =
  'font-family: var(--kf-font); font-size: var(--kf-fs-label); fill: var(--kf-ink);';
const LABEL = `.kf-label { ${LABEL_BODY} }`;

test('a rule that matches a component becomes that component', () => {
  expect(byId(port(CELL, '<rect id="a" class="kf-cell"/>'), 'a').getAttribute('class')).toBe(
    'la-cell',
  );
});

test('classes cascade before they are mapped', () => {
  const svg = port(
    `${LABEL}\n.kf-muted { fill: var(--kf-muted); }`,
    '<text id="a" class="kf-label kf-muted">x</text>',
  );
  expect(byId(svg, 'a').getAttribute('class')).toBe('la-note');
});

test('declarations a component lacks become utilities next to it', () => {
  const svg = port(
    `.kf-label { ${LABEL_BODY} font-weight: 600; }`,
    '<text id="a" class="kf-label">x</text>',
  );
  expect(byId(svg, 'a').getAttribute('class')).toBe('la-label font-semibold');
});

test('declarations without a utility become presentation attributes', () => {
  const rule =
    '.kf-dash { fill: none; stroke: var(--kf-flow); stroke-width: var(--kf-stroke); stroke-dasharray: 5 4; }';
  const a = byId(port(rule, '<path id="a" class="kf-dash" d="M0 0H9"/>'), 'a');
  expect(a.getAttribute('class')).toBe('la-arrow');
  expect(a.getAttribute('stroke-dasharray')).toBe('5 4');
});

test('a descendant rule styles the matching children', () => {
  const svg = port(
    '.kf-pill rect { fill: var(--kf-leader); }',
    '<g id="g" class="kf-pill"><rect id="a" width="1" height="1"/></g>',
  );
  expect(byId(svg, 'a').getAttribute('class')).toBe('fill-amber');
  expect(byId(svg, 'g').hasAttribute('class')).toBe(false);
});

test('a one-declaration component replaces only the Kafka class it is named after', () => {
  const svg = port(
    '.kf-flow-dot { fill: var(--kf-cell-new-stroke); }',
    '<circle id="a" class="kf-flow-dot" r="3"/>',
  );
  expect(byId(svg, 'a').getAttribute('class')).toBe('la-flow-dot');
});

test("Kafka's producer stroke becomes emerald", () => {
  const svg = port(
    '.kf-producer { stroke: var(--kf-producer-stroke); }',
    '<rect id="a" class="kf-producer"/>',
  );
  expect(byId(svg, 'a').getAttribute('class')).toBe('stroke-emerald');
});

test('new-assignment marks gain the role the chapter 4 tests select by', () => {
  const rule =
    '.kf-arrow--new { fill: none; stroke: var(--kf-cell-new-stroke); stroke-width: var(--kf-stroke); }';
  expect(
    byId(port(rule, '<path id="a" class="kf-arrow--new" d="M0 0H9"/>'), 'a').getAttribute(
      'data-role',
    ),
  ).toBe('glow');
});

test('ids, data attributes, and SMIL survive the port', () => {
  const svg = port('', '<g id="g" data-role="log" data-partition="0"/>');
  expect(byId(svg, 'g').getAttribute('data-partition')).toBe('0');
  expect(svg.querySelector('animate')!.getAttribute('values')).toBe('0;1');
});

test('the output satisfies the SVG contract', () => {
  const out = portKafkaSvg(kafkaSvg(CELL, '<rect class="kf-cell"/>'), block);
  expect(() => assertSvgContract(out, block)).not.toThrow();
});

test('an unmapped token stops the port', () => {
  expect(() =>
    portKafkaSvg(kafkaSvg('.kf-r { rx: var(--kf-radius); }', '<rect class="kf-r"/>'), block),
  ).toThrow(/--kf-radius/);
});

test('a selector outside the supported forms stops the port', () => {
  expect(() => portKafkaSvg(kafkaSvg('#a { fill: none; }', '<rect id="a"/>'), block)).toThrow(
    /unsupported selector/,
  );
});

test('the look check catches a changed color', () => {
  const before = kafkaSvg('.kf-c { fill: var(--kf-cell); }', '<rect class="kf-c"/>');
  const after = portKafkaSvg(before, block).replace('class="fill-cell"', 'class="fill-amber"');
  expect(() => assertSameLook(before, after, block)).toThrow(/fill: #f6a723/);
});

test('every Kafka token keeps its value, except the producer stroke that emerald absorbs', () => {
  const kafka = parseCss(TOKENS).variables;
  const theme = parseCss(block).variables;
  const drifted = Object.entries(KAFKA_TOKENS)
    .map(([name, replacement]) => [name, kafka.get(name), resolveVars(replacement, theme)] as const)
    .filter(([, from, to]) => from !== to);
  expect(drifted).toEqual([['kf-producer-stroke', '#34d39a', '#34d399']]);
});
