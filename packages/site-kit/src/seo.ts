import { AUTHOR } from './family.ts';
import { sectionName } from './model.ts';
import { absoluteUrl, pathForAnimation, pathForSection } from './routes.ts';
import type { Animation, Section, Track } from './schemas.ts';

const CONTEXT = 'https://schema.org';
export const LOCALE = 'en';

const person = (name: string, url?: string) =>
  url ? { '@type': 'Person', name, url } : { '@type': 'Person', name };
const author = () => person(AUTHOR.name, AUTHOR.url);

export function websiteJsonLd(track: Track) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: track.site.name,
    alternateName: track.site.shortName,
    url: track.site.url,
    description: track.site.tagline,
    inLanguage: LOCALE,
    author: author(),
  };
}

export function breadcrumbJsonLd(
  track: Track,
  items: ReadonlyArray<{ name: string; path: string }>,
) {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(track.site.url, item.path),
    })),
  };
}

function bookJsonLd(source: NonNullable<Track['source']>) {
  return {
    '@type': 'Book',
    name: source.title,
    bookEdition: source.edition,
    author: source.authors.map((name) => person(name)),
    publisher: { '@type': 'Organization', name: source.publisher },
    datePublished: String(source.year),
    url: source.url,
  };
}

export function learningResourceJsonLd(track: Track, section: Section, animation: Animation) {
  return {
    '@context': CONTEXT,
    '@type': 'LearningResource',
    name: animation.title,
    description: animation.description,
    learningResourceType: 'Animation',
    inLanguage: LOCALE,
    url: absoluteUrl(track.site.url, pathForAnimation(animation)),
    isPartOf: {
      '@type': 'WebPage',
      name: sectionName(track, section),
      url: absoluteUrl(track.site.url, pathForSection(section)),
    },
    ...(track.source ? { about: bookJsonLd(track.source) } : {}),
    ...(animation.references.length > 0
      ? {
          citation: animation.references.map((r) => ({
            '@type': 'CreativeWork',
            name: r.label,
            url: r.url,
          })),
        }
      : {}),
    author: author(),
  };
}

// Escaping "</" keeps a string value from closing the script element early.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

export function robotsTxt(track: Pick<Track, 'launched' | 'site'>): string {
  return track.launched
    ? `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(track.site.url, '/sitemap.xml')}\n`
    : 'User-agent: *\nDisallow: /\n';
}
