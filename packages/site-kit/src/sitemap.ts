import { absoluteUrl } from './routes.ts';

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(siteUrl: string, paths: readonly string[], lastmod: string): string {
  const urls = paths
    .map(
      (path) =>
        `  <url>\n    <loc>${escapeXml(absoluteUrl(siteUrl, path))}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}
