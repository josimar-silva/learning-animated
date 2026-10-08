import { contentDirOf, loadEntries } from './disk.ts';
import {
  animationsFor,
  contents,
  loopOf,
  neighbors,
  ordered,
  populated,
  sectionName,
  viewBoxOf,
  viewFiles,
} from './model.ts';
import { embedPath, pathForAnimation, pathForSection } from './routes.ts';
import {
  type Animation,
  animationSchema,
  type Section,
  sectionDataSchema,
  type Track,
} from './schemas.ts';

type RawEntry = { readonly id: string; readonly data: unknown };
// The track passes Astro's getCollection in, so site-kit never imports astro:content.
export type GetCollection = (name: 'sections' | 'animations') => Promise<readonly RawEntry[]>;
export type ViewProps = {
  id: string | null;
  label: string | null;
  src: string;
  width: number;
  height: number;
};

export async function readContent(getCollection: GetCollection) {
  const sections: Section[] = (await getCollection('sections'))
    .map((e) => ({ id: e.id, ...sectionDataSchema.parse(e.data) }))
    .sort((a, b) => a.number - b.number);
  const raw = await getCollection('animations');
  const animations: Animation[] = raw.map((e) => animationSchema.parse(e.data));
  const entries = new Map(animations.map((a, i) => [a.id, raw[i]!]));
  return { sections, animations, entries };
}

const footer = (track: Track, sections: readonly Section[], animations: readonly Animation[]) =>
  populated(sections, animations).map((s) => ({
    name: sectionName(track, s),
    path: pathForSection(s),
  }));

export async function homeProps(track: Track, getCollection: GetCollection) {
  const { sections, animations } = await readContent(getCollection);
  const legacyMap = track.legacyRedirects
    ? Object.fromEntries(animations.map((a) => [a.id, pathForAnimation(a)]))
    : undefined;
  return { contents: contents(sections, animations), legacyMap };
}

export async function footerProps(track: Track, getCollection: GetCollection) {
  const { sections, animations } = await readContent(getCollection);
  return { sections: footer(track, sections, animations) };
}

export async function sectionPaths(track: Track, getCollection: GetCollection) {
  const { sections, animations } = await readContent(getCollection);
  const shown = populated(sections, animations);
  return shown.map((section) => ({
    params: { section: section.id },
    props: {
      section,
      animations: animationsFor(section, animations),
      ...neighbors(shown, (s) => s.id === section.id),
      sections: footer(track, sections, animations),
    },
  }));
}

export async function animationPaths(
  track: Track,
  getCollection: GetCollection,
  root: string = process.cwd(),
) {
  const { sections, animations, entries } = await readContent(getCollection);
  const svgs = new Map(loadEntries(contentDirOf(root)).map((e) => [e.animation.id, e.svgs]));
  const all = ordered(sections, animations);
  return all.map((animation) => {
    const files = viewFiles(animation);
    const texts = svgs.get(animation.id) ?? new Map<string, string>();
    const views: ViewProps[] = files.map((file, i) => ({
      id: animation.views?.[i]?.id ?? null,
      label: animation.views?.[i]?.label ?? null,
      src: embedPath(animation.id, animation.views?.[i]?.id),
      ...viewBoxOf(texts.get(file) ?? ''),
    }));
    return {
      params: { section: animation.section, id: animation.id },
      props: {
        section: sections.find((s) => s.id === animation.section)!,
        animation,
        views,
        loop: loopOf(texts.get(files[0]!) ?? ''),
        entry: entries.get(animation.id)!,
        ...neighbors(all, (a) => a.id === animation.id),
        sections: footer(track, sections, animations),
      },
    };
  });
}
