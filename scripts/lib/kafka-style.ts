import { END, START } from '@learning-animated/design/style-block';
import { embedBlock } from '@learning-animated/design/sync';
import { parseSvg, tagOf } from '@learning-animated/svg-kit/parse';

type Declaration = readonly [property: string, value: string];
type Selector = { readonly className: string; readonly descendantTag: string | null };
type Rule = { readonly selector: Selector; readonly declarations: readonly Declaration[] };
export type Css = {
  readonly variables: ReadonlyMap<string, string>;
  readonly rules: readonly Rule[];
};

// What each Kafka token becomes on the shared palette. A rule that uses a token
// missing here has no counterpart, so it stops the port.
export const KAFKA_TOKENS: Readonly<Record<string, string>> = {
  'kf-bg': 'var(--color-stage)',
  'kf-surface': 'var(--color-surface)',
  'kf-ink': 'var(--color-ink)',
  'kf-muted': 'var(--color-ink-muted)',
  'kf-grid': 'var(--color-grid)',
  'kf-cell': 'var(--color-cell)',
  'kf-cell-stroke': 'var(--color-cell-stroke)',
  'kf-cell-ink': 'var(--color-cell-ink)',
  'kf-cell-new': 'var(--color-cell-new)',
  'kf-cell-new-stroke': 'var(--color-amber)',
  'kf-cell-read': 'var(--color-emerald)',
  'kf-producer': 'var(--color-green)',
  'kf-producer-stroke': 'var(--color-emerald)',
  'kf-consumer': 'var(--color-sky)',
  'kf-consumer-stroke': 'var(--color-sky-light)',
  'kf-broker': 'var(--color-violet-deep)',
  'kf-broker-stroke': 'var(--color-violet)',
  'kf-registry': 'var(--color-lime-deep)',
  'kf-registry-stroke': 'var(--color-lime)',
  'kf-leader': 'var(--color-amber)',
  'kf-follower': 'var(--color-slate)',
  'kf-flow': 'var(--color-flow)',
  'kf-flow-strong': 'var(--color-flow-strong)',
  'kf-replicate': 'var(--color-pink)',
  'kf-fail': 'var(--color-red)',
  'kf-font': 'var(--font-sans)',
  'kf-mono': 'var(--font-mono)',
  'kf-fs-title': 'var(--text-title)',
  'kf-fs-label': 'var(--text-label)',
  'kf-fs-offset': 'var(--text-offset)',
  'kf-stroke': '1.5',
  'kf-stroke-strong': '2.5',
};

// Kafka's producer stroke sat one step from emerald, and the palette keeps only emerald.
const DRIFT: ReadonlyMap<string, string> = new Map([['#34d39a', '#34d399']]);

// Classes that Kafka's tests select by and that no component names. The port marks them with a role.
const ROLE_HOOKS: Readonly<Record<string, string>> = { 'kf-arrow--new': 'glow' };

// The properties the port may move, which are also the presentation attributes the look check reads.
const PROPERTIES: readonly string[] = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'paint-order',
];

const SELECTOR = /^\.((?:[a-z0-9-]|\\.)+)(?:\s+([a-z]+))?$/;
const VAR = /var\(--([a-z0-9-]+)\)/g;

function parseSelector(raw: string): Selector {
  const match = SELECTOR.exec(raw.trim());
  if (!match) throw new Error(`unsupported selector: ${raw.trim()}`);
  return { className: match[1]!.replace(/\\(.)/g, '$1'), descendantTag: match[2] ?? null };
}

function declarationsOf(body: string): Declaration[] {
  return body
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(':');
      return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as const;
    });
}

// Scans with indexOf rather than lazy regexes, so input without a closing token stays linear.
function withoutComments(css: string): string {
  let out = '';
  let at = 0;
  for (let open = css.indexOf('/*'); open !== -1; open = css.indexOf('/*', at)) {
    const close = css.indexOf('*/', open + 2);
    if (close === -1) throw new Error('unterminated CSS comment');
    out += css.slice(at, open);
    at = close + 2;
  }
  return out + css.slice(at);
}

export function parseCss(css: string): Css {
  const variables = new Map<string, string>();
  const rules: Rule[] = [];
  const text = withoutComments(css);
  let at = 0;
  for (let open = text.indexOf('{'); open !== -1; open = text.indexOf('{', at)) {
    const close = text.indexOf('}', open + 1);
    if (close === -1) throw new Error('unterminated CSS rule');
    const selector = text.slice(at, open).trim();
    const body = text.slice(open + 1, close);
    if (selector === ':root') {
      for (const [name, value] of declarationsOf(body))
        variables.set(name.replace(/^--/, ''), value);
    } else {
      rules.push({ selector: parseSelector(selector), declarations: declarationsOf(body) });
    }
    at = close + 1;
  }
  return { variables, rules };
}

export function resolveVars(value: string, variables: ReadonlyMap<string, string>): string {
  return value.replace(VAR, (_, name: string) => {
    const resolved = variables.get(name);
    if (resolved === undefined) throw new Error(`undefined variable --${name}`);
    return resolved;
  });
}

// Read through the DOM, so quotes a serializer escaped come back decoded.
const styleOf = (text: string): string =>
  parseSvg(text).svg.querySelector('style')?.textContent ?? '';
const classesOf = (el: Element): string[] =>
  (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const elementsOf = (svg: Element): Element[] => [svg, ...svg.querySelectorAll('*')];
const isComponent = (rule: Rule): boolean => rule.selector.className.startsWith('la-');
const keyOf = ([property, value]: Declaration): string => `${property}: ${value}`;

function matches(el: Element, { className, descendantTag }: Selector): boolean {
  if (descendantTag === null) return classesOf(el).includes(className);
  if (tagOf(el) !== descendantTag) return false;
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    if (classesOf(parent).includes(className)) return true;
  }
  return false;
}

// Matching rules apply by specificity, then source order, as in the browser's cascade.
function cascade(el: Element, rules: readonly Rule[]): Map<string, string> {
  const weight = (rule: Rule): number => (rule.selector.descendantTag === null ? 10 : 11);
  const ordered = rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => weight(a.rule) - weight(b.rule) || a.index - b.index);
  const declared = new Map<string, string>();
  for (const { rule } of ordered) {
    if (matches(el, rule.selector))
      for (const [property, value] of rule.declarations) declared.set(property, value);
  }
  return declared;
}

function translate([property, value]: Declaration): Declaration {
  const translated = value.replace(VAR, (_, name: string) => {
    const replacement = KAFKA_TOKENS[name];
    if (replacement === undefined) throw new Error(`unmapped Kafka token --${name}`);
    return replacement;
  });
  if (!PROPERTIES.includes(property)) throw new Error(`unsupported property: ${property}`);
  return [property, translated];
}

function restyle(
  declared: ReadonlyMap<string, string>,
  kafkaClasses: readonly string[],
  components: readonly Rule[],
  utilities: ReadonlyMap<string, string>,
): { classes: string[]; attributes: Declaration[] } {
  const has = ([property, value]: Declaration): boolean => declared.get(property) === value;
  // A one-declaration component says no more than a utility, so it replaces only the Kafka class it is named after.
  const eligible = (rule: Rule): boolean =>
    rule.declarations.length > 1 ||
    kafkaClasses.includes(rule.selector.className.replace(/^la-/, 'kf-'));
  const component = components
    .filter((rule) => eligible(rule) && rule.declarations.every(has))
    .reduce<Rule | null>(
      (best, rule) => (best && best.declarations.length >= rule.declarations.length ? best : rule),
      null,
    );
  const covered = new Set(component?.declarations.map(([property]) => property));
  const classes = component ? [component.selector.className] : [];
  const attributes: Declaration[] = [];
  for (const declaration of declared) {
    if (covered.has(declaration[0])) continue;
    const utility = utilities.get(keyOf(declaration));
    if (utility) classes.push(utility);
    else if (declaration[1].includes('var('))
      throw new Error(`no utility for ${keyOf(declaration)}`);
    else attributes.push(declaration);
  }
  return { classes, attributes };
}

function withRoleHooks(text: string): string {
  const { svg } = parseSvg(text);
  for (const el of elementsOf(svg)) {
    for (const [className, role] of Object.entries(ROLE_HOOKS)) {
      if (!classesOf(el).includes(className)) continue;
      if (el.hasAttribute('data-role'))
        throw new Error(`.${className} already has data-role="${el.getAttribute('data-role')}"`);
      el.setAttribute('data-role', role);
    }
  }
  return `${svg.outerHTML}\n`;
}

function convert(text: string, block: string): string {
  const kafka = parseCss(styleOf(text));
  const shared = parseCss(block).rules;
  const components = shared.filter(isComponent);
  const utilities = new Map(
    shared
      .filter((rule) => !isComponent(rule) && rule.declarations.length === 1)
      .map((rule) => [keyOf(rule.declarations[0]!), rule.selector.className] as const),
  );
  const { svg } = parseSvg(text);
  // Plan every element first: descendant rules read the old classes of ancestors.
  const plans = elementsOf(svg).map((el) => ({
    el,
    kept: classesOf(el).filter((name) => !name.startsWith('kf-')),
    ...restyle(
      new Map([...cascade(el, kafka.rules)].map(translate)),
      classesOf(el),
      components,
      utilities,
    ),
  }));
  for (const { el, kept, classes, attributes } of plans) {
    const names = [...kept, ...classes];
    if (names.length > 0) el.setAttribute('class', names.join(' '));
    else el.removeAttribute('class');
    for (const [property, value] of attributes) el.setAttribute(property, value);
  }
  svg.querySelector('style')!.textContent = `\n${START}\n${END}\n`;
  return embedBlock(`${svg.outerHTML}\n`, block);
}

// One line per element: its tag, its attributes other than styling, its text, and the
// styles it ends up with after inheritance.
function look(text: string, css: Css, adjust: (value: string) => string): string[] {
  const lines: string[] = [];
  const walk = (el: Element, inherited: ReadonlyMap<string, string>): void => {
    const specified = new Map<string, string>();
    for (const property of PROPERTIES) {
      const value = el.getAttribute(property);
      if (value !== null) specified.set(property, value);
    }
    for (const [property, value] of cascade(el, css.rules)) specified.set(property, value);
    const computed = new Map(inherited);
    for (const [property, value] of specified) {
      computed.set(
        property,
        adjust(resolveVars(value, css.variables).replace(/\s+/g, ' ').trim().toLowerCase()),
      );
    }
    const tag = tagOf(el);
    const attributes = el
      .getAttributeNames()
      .filter((name) => name !== 'class' && !PROPERTIES.includes(name))
      .sort()
      .map((name) => `${name}="${el.getAttribute(name)}"`);
    const words = ['text', 'tspan', 'title', 'desc'].includes(tag)
      ? ` "${(el.textContent ?? '').replace(/\s+/g, ' ').trim()}"`
      : '';
    const styles = [...computed].sort(([a], [b]) => a.localeCompare(b)).map(keyOf);
    lines.push(`<${[tag, ...attributes].join(' ')}>${words} { ${styles.join('; ')} }`);
    if (tag !== 'style') for (const child of el.children) walk(child, computed);
  };
  walk(parseSvg(text).svg, new Map());
  return lines;
}

export function assertSameLook(kafkaText: string, portedText: string, block: string): void {
  const before = look(
    kafkaText,
    parseCss(styleOf(kafkaText)),
    (value) => DRIFT.get(value) ?? value,
  );
  const after = look(portedText, parseCss(block), (value) => value);
  const changes = before.flatMap((line, i) =>
    line === after[i] ? [] : [`${line}\n  became ${after[i] ?? 'nothing'}`],
  );
  if (after.length > before.length)
    changes.push(`${after.length - before.length} elements appeared`);
  if (changes.length > 0)
    throw new Error(`the port changed how elements look:\n${changes.join('\n')}`);
}

export function portKafkaSvg(kafkaText: string, block: string): string {
  const hooked = withRoleHooks(kafkaText);
  const ported = convert(hooked, block);
  assertSameLook(hooked, ported, block);
  return ported;
}
