import { readFileSync } from 'node:fs';

import { type Site, SITES } from './sites.ts';

export type BuiltPage = { readonly site: Site; readonly path: string; readonly html: string };

const built = (site: Site, rel: string): string => {
  try {
    return readFileSync(new URL(`../../${site.dir}/dist/${rel}`, import.meta.url), 'utf8');
  } catch {
    throw new Error(`${site.dir}/dist/${rel} is missing: run \`just build-all\` first`);
  }
};

// Every page a site's sitemap lists, read from its build: Playwright collects tests before any server starts.
export function builtPages(site: Site): BuiltPage[] {
  return [...built(site, 'sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
    const path = new URL(loc!).pathname;
    return { site, path, html: built(site, `${path.slice(1)}index.html`) };
  });
}

export const ALL_PAGES: readonly BuiltPage[] = SITES.flatMap(builtPages);

export const firstPage = (marker: string): BuiltPage | undefined =>
  ALL_PAGES.find((page) => page.html.includes(marker));
