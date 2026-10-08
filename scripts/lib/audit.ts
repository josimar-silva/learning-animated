import { parseHTML } from 'linkedom';

export type Exists = (path: string) => boolean;

const LINKS = ['href', 'src', 'data'] as const;
const DATA_SCRIPT = /^application\/(?:ld\+)?json$/;

// Parsing the page, instead of matching tags with regexes, sees every element the way a browser does.
export function auditPage(
  page: string,
  html: string,
  exists: Exists,
  allowedInline: string,
): string[] {
  const { document } = parseHTML(html);
  const problems: string[] = [];
  for (const element of document.querySelectorAll('[href], [src], [data]')) {
    for (const name of LINKS) {
      const value = element.getAttribute(name);
      if (!value?.startsWith('/') || value.startsWith('//')) continue;
      const path = value.split(/[?#]/, 1)[0]!;
      if (!exists(path)) problems.push(`${page}: broken link ${path}`);
    }
  }
  for (const script of document.querySelectorAll('script')) {
    if (script.hasAttribute('src') || DATA_SCRIPT.test(script.getAttribute('type') ?? '')) continue;
    if (script.textContent !== allowedInline)
      problems.push(`${page}: an inline script the CSP does not allow`);
  }
  return problems;
}

export function existsIn(distDir: string, fileExists: (path: string) => boolean): Exists {
  return (path) =>
    fileExists(path.endsWith('/') ? `${distDir}${path}index.html` : `${distDir}${path}`);
}

export function siteProblems({ headers, robots }: { headers: string; robots: string }): string[] {
  const blocked = robots.includes('Disallow: /');
  const noindex = headers.includes('X-Robots-Tag: noindex');
  return blocked === noindex ? [] : ['robots.txt and _headers disagree about indexing'];
}
