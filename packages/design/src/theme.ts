// The stage is the first plain `@theme {` block in theme.css. The `@theme inline`
// chrome block is for the site only: its values point at chrome variables an SVG lacks.
const STAGE = '@theme {';

const withoutSemicolon = (text: string): string => (text.endsWith(';') ? text.slice(0, -1) : text);

export function parseStageTheme(css: string): ReadonlyMap<string, string> {
  const start = css.indexOf(STAGE);
  const end = css.indexOf('\n}', start);
  if (start === -1 || end === -1) throw new Error('theme.css needs a stage block: @theme { ... }');
  const variables = new Map<string, string>();
  for (const line of css.slice(start + STAGE.length, end).split('\n')) {
    const declaration = withoutSemicolon(line.trim());
    if (!declaration.startsWith('--')) continue;
    const colon = declaration.indexOf(':');
    const value = declaration.slice(colon + 1).trim();
    if (value !== 'initial') variables.set(declaration.slice(2, colon).trim(), value);
  }
  return variables;
}
