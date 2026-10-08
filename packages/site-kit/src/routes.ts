import type { Animation, Section } from './schemas.ts';

export const pathForHome = (): string => '/';
export const pathForAbout = (): string => '/about/';
export const pathForNotFound = (): string => '/404.html';
export const pathForSection = (section: Pick<Section, 'id'>): string => `/${section.id}/`;
export const pathForAnimation = (a: Pick<Animation, 'id' | 'section'>): string =>
  `/${a.section}/${a.id}/`;
export const embedPath = (id: string, view?: string | null): string =>
  `/embed/${view ? `${id}.${view}` : id}.svg`;
// Kafka once served SVGs from their source folders. These paths now redirect to /embed/.
export const legacySvgPath = (a: Pick<Animation, 'id' | 'section'>): string =>
  `/src/animations/${a.section}/${a.id}/${a.id}.svg`;
export const absoluteUrl = (siteUrl: string, path: string): string => new URL(path, siteUrl).href;
