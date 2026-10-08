import type { Animation, Section, Track } from './schemas.ts';

// One animation as stored on disk: validated frontmatter, its folder under
// animations/, and the SVG files beside it.
export type Entry = {
  readonly animation: Animation;
  readonly folder: string;
  readonly svgs: ReadonlyMap<string, string>;
};

const VIEW_BOX = /<svg\b[^>]*\bviewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/;
const LOOP = /<svg\b[^>]*\bdata-loop="(\d+(?:\.\d+)?)s"/;

export function ordered(
  sections: readonly Section[],
  animations: readonly Animation[],
): Animation[] {
  const rank = new Map(sections.map((s) => [s.id, s.number]));
  return [...animations].sort(
    (a, b) => (rank.get(a.section) ?? 0) - (rank.get(b.section) ?? 0) || a.order - b.order,
  );
}

export function animationsFor(
  section: Pick<Section, 'id'>,
  animations: readonly Animation[],
): Animation[] {
  return animations.filter((a) => a.section === section.id).sort((a, b) => a.order - b.order);
}

export function contents(
  sections: readonly Section[],
  animations: readonly Animation[],
): Array<Section & { animations: Animation[] }> {
  return [...sections]
    .sort((a, b) => a.number - b.number)
    .map((s) => ({ ...s, animations: animationsFor(s, animations) }));
}

export function populated(
  sections: readonly Section[],
  animations: readonly Animation[],
): Section[] {
  return contents(sections, animations)
    .filter((s) => s.animations.length > 0)
    .map(({ animations: _, ...s }) => s);
}

export function neighbors<T>(
  items: readonly T[],
  isCurrent: (item: T) => boolean,
): { prev: T | null; next: T | null } {
  const i = items.findIndex(isCurrent);
  if (i === -1) return { prev: null, next: null };
  return { prev: items[i - 1] ?? null, next: items[i + 1] ?? null };
}

export function sectionName(track: Pick<Track, 'kind'>, section: Section): string {
  return track.kind === 'book' ? `Chapter ${section.number}: ${section.title}` : section.title;
}

export function figureLabel(
  track: Pick<Track, 'kind'>,
  animation: Pick<Animation, 'figure'>,
): string | null {
  if (track.kind !== 'book') return null;
  return animation.figure ? `Figure ${animation.figure}` : 'Companion extra';
}

export function viewFiles(animation: Pick<Animation, 'id' | 'views'>): string[] {
  return animation.views
    ? animation.views.map((v) => `${animation.id}.${v.id}.svg`)
    : [`${animation.id}.svg`];
}

export function viewBoxOf(svgText: string): { width: number; height: number } {
  const match = VIEW_BOX.exec(svgText);
  if (!match) throw new Error('an animation SVG needs a viewBox of the form "0 0 W H"');
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function loopOf(svgText: string): number | null {
  const match = LOOP.exec(svgText);
  return match ? Number(match[1]) : null;
}

const duplicates = <T>(values: readonly T[]): T[] => [
  ...new Set(values.filter((v, i) => values.indexOf(v) !== i)),
];

export function contentIssues(
  track: Pick<Track, 'kind'>,
  sections: readonly Section[],
  entries: readonly Entry[],
): string[] {
  const issues: string[] = [];
  for (const id of duplicates(sections.map((s) => s.id)))
    issues.push(`duplicate section id "${id}"`);
  for (const n of duplicates(sections.map((s) => s.number)))
    issues.push(`duplicate section number ${n}`);
  for (const id of duplicates(entries.map((e) => e.animation.id)))
    issues.push(`duplicate animation id "${id}"`);
  for (const key of duplicates(entries.map((e) => `${e.animation.section} #${e.animation.order}`)))
    issues.push(`duplicate order ${key}`);
  const sectionIds = new Set(sections.map((s) => s.id));
  for (const { animation: a, folder, svgs } of entries) {
    const where = `animation "${a.id}"`;
    if (!sectionIds.has(a.section)) issues.push(`${where} names unknown section "${a.section}"`);
    if (folder !== `${a.section}/${a.id}`)
      issues.push(`${where} must live in animations/${a.section}/${a.id}/, not ${folder}/`);
    if (track.kind !== 'book' && a.figure !== null)
      issues.push(`${where} has a figure, but only book tracks have figures`);
    if (track.kind === 'curriculum' && a.references.length === 0)
      issues.push(`${where} needs at least one reference`);
    const expected = viewFiles(a).sort();
    const actual = [...svgs.keys()].sort();
    if (expected.join() !== actual.join())
      issues.push(
        `${where} needs exactly ${expected.join(', ')}; found ${actual.join(', ') || 'none'}`,
      );
    if (!a.steps) continue;
    const ats = a.steps.map((s) => s.at);
    for (const file of expected) {
      const loop = loopOf(svgs.get(file) ?? '');
      if (loop === null) issues.push(`${where} has steps, so ${file} needs data-loop`);
      else if (ats.some((t, i) => t >= loop || (i > 0 && t <= ats[i - 1]!)))
        issues.push(`${where} steps must rise and stay below the ${loop}s loop`);
    }
  }
  return issues;
}

export function validateContent(
  track: Pick<Track, 'kind'>,
  sections: readonly Section[],
  entries: readonly Entry[],
): void {
  const issues = contentIssues(track, sections, entries);
  if (issues.length > 0) throw new Error(`Content problems:\n- ${issues.join('\n- ')}`);
}
