import { readFileSync } from 'node:fs';

import { frontmatterOf } from '@learning-animated/site-kit/disk';
import { parseSvg } from '@learning-animated/svg-kit/parse';
import { hiddenThroughout, opacityAt, shownThroughout } from '@learning-animated/svg-kit/timeline';
import { expect, test } from 'vitest';

import { render } from './two-datasources.gen.ts';

const LOOP = 25;
const at = (seconds: number): number => seconds / LOOP;
const between = (from: number, to: number): [number, number] => [at(from), at(to)];
const text = readFileSync(new URL('./two-datasources.svg', import.meta.url), 'utf8');
const { svg } = parseSvg(text);
const selector = (role: string, datasource: string, attempt: string): string =>
  `[data-role="${role}"]${datasource && `[data-datasource="${datasource}"]`}${attempt && `[data-attempt="${attempt}"]`}`;
const of = (role: string, datasource = '', attempt = ''): Element => {
  const found = svg.querySelector(selector(role, datasource, attempt));
  if (!found) throw new Error(`missing ${selector(role, datasource, attempt)}`);
  return found;
};
const absent = (role: string, datasource = '', attempt = ''): boolean =>
  svg.querySelector(selector(role, datasource, attempt)) === null;
const { steps } = frontmatterOf(readFileSync(new URL('./index.md', import.meta.url), 'utf8')) as {
  steps: { at: number; text: string }[];
};

const DATASOURCES = ['inventory', 'accounts'] as const;
const POOL_SIZES = { inventory: 5, accounts: 3 } as const;
// When each connection joins the XA transaction.
const XA_JOINS = { inventory: 18, accounts: 19.5 } as const;

test('the generator reproduces the committed SVG', () => {
  expect(render()).toBe(text);
});

test('one story lasts 25 s', () => {
  expect(svg.getAttribute('data-loop')).toBe('25s');
});

test('one request reads the seats from inventory, then the buyer from accounts', () => {
  expect(svg.querySelectorAll('[data-role="request"]')).toHaveLength(1);
  expect(of('table', 'inventory').textContent).toContain('A12');
  expect(of('table', 'inventory').textContent).toContain('A13');
  expect(of('table', 'accounts').textContent).toContain('4012');
  const seats = of('statement', 'inventory', 'read');
  const buyer = of('statement', 'accounts', 'read');
  expect(seats.textContent?.trim()).toBe('SELECT * FROM seats');
  expect(buyer.textContent?.trim()).toBe('SELECT * FROM buyers');
  expect(hiddenThroughout(seats, between(0, 3.9))).toBe(true);
  expect(shownThroughout(seats, between(4.1, 5.4))).toBe(true);
  expect(hiddenThroughout(seats, between(5.6, 24.9))).toBe(true);
  expect(hiddenThroughout(buyer, between(0, 7.4))).toBe(true);
  expect(shownThroughout(buyer, between(7.6, 8.9))).toBe(true);
  expect(hiddenThroughout(buyer, between(9.1, 24.9))).toBe(true);
  expect(shownThroughout(of('read-marker', 'inventory'), between(4.1, 5.4))).toBe(true);
  expect(hiddenThroughout(of('read-marker', 'inventory'), between(5.6, 24.9))).toBe(true);
  expect(shownThroughout(of('read-marker', 'accounts'), between(7.6, 8.9))).toBe(true);
  expect(hiddenThroughout(of('read-marker', 'accounts'), between(0, 7.4))).toBe(true);
});

test('both reads run outside any transaction', () => {
  for (const attempt of ['default', 'xa'])
    expect(hiddenThroughout(of('transaction', '', attempt), between(0, 9.9))).toBe(true);
});

test('each query goes through the pool of its own named datasource', () => {
  for (const datasource of DATASOURCES) {
    expect(of('field', datasource).textContent?.trim()).toBe(
      `@Inject @DataSource("${datasource}") AgroalDataSource ${datasource}`,
    );
    const pool = of('pool', datasource);
    expect(pool.querySelectorAll('[data-role="connection"]')).toHaveLength(POOL_SIZES[datasource]);
    expect(pool.textContent).toContain(
      `quarkus.datasource.${datasource}.jdbc.max-size=${POOL_SIZES[datasource]}`,
    );
  }
  expect(shownThroughout(of('field-active', 'inventory'), between(3.1, 3.9))).toBe(true);
  expect(shownThroughout(of('borrowed', 'inventory'), between(3.6, 5.4))).toBe(true);
  expect(hiddenThroughout(of('field-active', 'accounts'), between(0, 6.4))).toBe(true);
  expect(hiddenThroughout(of('borrowed', 'accounts'), between(0, 6.9))).toBe(true);
  expect(shownThroughout(of('field-active', 'accounts'), between(6.6, 7.4))).toBe(true);
  expect(shownThroughout(of('borrowed', 'accounts'), between(7.1, 8.9))).toBe(true);
  expect(hiddenThroughout(of('field-active', 'inventory'), between(4.1, 9.9))).toBe(true);
  // Each connection goes back to its own pool once its query is done.
  expect(hiddenThroughout(of('borrowed', 'inventory'), between(5.6, 9.9))).toBe(true);
  expect(hiddenThroughout(of('borrowed', 'accounts'), between(9.1, 9.9))).toBe(true);
});

test('without XA, the accounts connection cannot join, and the seat update rolls back', () => {
  const transaction = of('transaction', '', 'default');
  expect(shownThroughout(transaction, between(10.1, 16.9))).toBe(true);
  expect(hiddenThroughout(transaction, between(17.1, 24.9))).toBe(true);
  for (const datasource of DATASOURCES)
    expect(hiddenThroughout(of('xa-config', datasource), between(0, 16.9))).toBe(true);
  expect(hiddenThroughout(of('enlisted', 'inventory', 'default'), between(0, 10.9))).toBe(true);
  expect(shownThroughout(of('enlisted', 'inventory', 'default'), between(11.1, 16.9))).toBe(true);
  expect(absent('enlisted', 'accounts', 'default')).toBe(true);
  const failed = of('enlist-failed', 'accounts', 'default');
  expect(failed.textContent?.trim()).toBe('Failed to enlist');
  expect(hiddenThroughout(failed, between(0, 14.4))).toBe(true);
  expect(shownThroughout(failed, between(14.6, 16.9))).toBe(true);
  expect(absent('statement', 'accounts', 'default')).toBe(true);
  expect(of('statement', 'inventory', 'default').textContent?.trim()).toBe(
    "UPDATE seats SET state = 'sold'",
  );
  const sold = of('pending', 'inventory', 'default');
  expect(hiddenThroughout(sold, between(0, 11.4))).toBe(true);
  expect(shownThroughout(sold, between(11.6, 15.4))).toBe(true);
  expect(hiddenThroughout(sold, between(15.6, 24.9))).toBe(true);
  const outcome = of('outcome', '', 'default');
  expect(outcome.textContent?.trim()).toBe('rolled back');
  expect(hiddenThroughout(outcome, between(0, 15.4))).toBe(true);
  expect(shownThroughout(outcome, between(15.6, 16.9))).toBe(true);
});

test('with jdbc.transactions=xa on both, both connections join and commit in two phases', () => {
  const transaction = of('transaction', '', 'xa');
  expect(hiddenThroughout(transaction, between(0, 16.9))).toBe(true);
  expect(shownThroughout(transaction, between(17.1, 24.9))).toBe(true);
  expect(absent('enlist-failed', '', 'xa')).toBe(true);
  for (const datasource of DATASOURCES) {
    const config = of('xa-config', datasource);
    expect(config.textContent?.trim()).toBe(
      `quarkus.datasource.${datasource}.jdbc.transactions=xa`,
    );
    expect(shownThroughout(config, between(17.1, 24.9))).toBe(true);
    const enlisted = of('enlisted', datasource, 'xa');
    expect(hiddenThroughout(enlisted, between(0, XA_JOINS[datasource] - 0.1))).toBe(true);
    expect(shownThroughout(enlisted, between(XA_JOINS[datasource] + 0.1, 24.9))).toBe(true);
    expect(hiddenThroughout(of('pending', datasource, 'xa'), between(23.1, 24.9))).toBe(true);
    const prepared = of('prepared', datasource);
    expect(hiddenThroughout(prepared, between(0, 21.4))).toBe(true);
    expect(shownThroughout(prepared, between(21.6, 22.9))).toBe(true);
    expect(hiddenThroughout(prepared, between(23.1, 24.9))).toBe(true);
    for (const role of ['committed', 'saved']) {
      expect(hiddenThroughout(of(role, datasource), between(0, 22.9))).toBe(true);
      expect(shownThroughout(of(role, datasource), between(23.1, 24.9))).toBe(true);
    }
  }
  expect(shownThroughout(of('pending', 'inventory', 'xa'), between(18.6, 22.9))).toBe(true);
  expect(shownThroughout(of('pending', 'accounts', 'xa'), between(20.1, 22.9))).toBe(true);
  expect(of('statement', 'accounts', 'xa').textContent?.trim()).toBe('INSERT INTO purchases');
  const outcome = of('outcome', '', 'xa');
  expect(outcome.textContent?.trim()).toBe('committed');
  expect(hiddenThroughout(outcome, between(0, 22.9))).toBe(true);
  expect(shownThroughout(outcome, between(23.1, 24.9))).toBe(true);
});

test('the drawn captions and the page steps tell the same story', () => {
  const captions = [...svg.querySelectorAll('[data-role="caption"]')];
  expect(captions.map((caption) => caption.textContent?.trim())).toEqual(
    steps.map((step) => step.text),
  );
  steps.forEach((step, i) => expect(opacityAt(captions[i]!, at(step.at + 0.05))).toBe(1));
});
