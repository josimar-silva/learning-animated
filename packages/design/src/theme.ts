// The stage is the first plain `@theme {` block in theme.css. The `@theme inline`
// chrome block is for the site only: its values point at chrome variables an SVG lacks.
const STAGE_BLOCK = /@theme\s*\{([\s\S]*?)\n\}/;
const DECLARATION = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;

export function parseStageTheme(css: string): ReadonlyMap<string, string> {
  const match = STAGE_BLOCK.exec(css);
  if (!match) throw new Error('theme.css needs a stage block: @theme { ... }');
  const variables = new Map<string, string>();
  for (const [, name, value] of match[1]!.matchAll(DECLARATION)) {
    if (value!.trim() !== 'initial') variables.set(name!, value!.trim());
  }
  return variables;
}
