import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import type { AstroIntegration } from 'astro';
import { passthroughImageService } from 'astro/config';

import { contentDirOf, loadEntries, loadSections } from './disk.ts';
import { headersFile, pageHeaders } from './headers.ts';
import { validateContent } from './model.ts';
import { nginxConf } from './nginx.ts';
import { legacySvgPath } from './routes.ts';
import type { Track } from './schemas.ts';
import { robotsTxt } from './seo.ts';
import { sitemapXml } from './sitemap.ts';

export function builtPaths(outDir: string): string[] {
  return readdirSync(outDir, { recursive: true, withFileTypes: true })
    .filter((f) => f.isFile() && f.name === 'index.html')
    .map((f) => {
      const dir = relative(outDir, f.parentPath).split(sep).join('/');
      return dir === '' ? '/' : `/${dir}/`;
    })
    .sort();
}

export function repoVersion(from: URL): string {
  let dir = fileURLToPath(from);
  for (;;) {
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
        workspaces?: unknown;
        version?: string;
      };
      if (pkg.workspaces && pkg.version) return pkg.version;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error('no workspace root package.json above the site');
    dir = parent;
  }
}

export function writeSiteFiles({
  outDir,
  siteDir,
  track,
  lastmod,
}: {
  outDir: string;
  siteDir: string;
  track: Track;
  lastmod: string;
}): void {
  const entries = track.kind === 'home' ? [] : loadEntries(contentDirOf(siteDir));
  mkdirSync(join(outDir, 'embed'), { recursive: true });
  for (const { svgs } of entries) {
    for (const [file, text] of svgs) writeFileSync(join(outDir, 'embed', file), text);
  }
  writeFileSync(join(outDir, '_headers'), headersFile(track));
  writeFileSync(join(outDir, 'robots.txt'), robotsTxt(track));
  writeFileSync(
    join(outDir, 'sitemap.xml'),
    sitemapXml(track.site.url, builtPaths(outDir), lastmod),
  );
  if (track.legacyRedirects) {
    const lines = entries.map(
      ({ animation }) => `${legacySvgPath(animation)} /embed/${animation.id}.svg 301\n`,
    );
    writeFileSync(join(outDir, '_redirects'), lines.join(''));
  }
  // The container build copies this next to the site's dist (see the Dockerfile).
  writeFileSync(join(siteDir, 'nginx.generated.conf'), nginxConf(track));
}

// Serves /embed/<file>.svg straight from the content folder while `astro dev` runs.
export function embedMiddleware(contentDir: URL) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const match = /^\/embed\/([a-z0-9.-]+\.svg)$/.exec(req.url ?? '');
    const text = match
      ? loadEntries(contentDir)
          .map((e) => e.svgs.get(match[1]!))
          .find(Boolean)
      : undefined;
    if (!text) return next();
    res.setHeader('Content-Type', 'image/svg+xml');
    res.end(text);
  };
}

export function learningAnimated({ track }: { track: Track }): AstroIntegration {
  let root: URL;
  return {
    name: 'learning-animated',
    hooks: {
      'astro:config:setup': ({ config, command, updateConfig }) => {
        root = config.root;
        if (track.kind !== 'home') {
          const dir = contentDirOf(root);
          validateContent(track, loadSections(dir), loadEntries(dir));
        }
        updateConfig({
          site: track.site.url,
          trailingSlash: 'always',
          // Astro 7 defaults to 'jsx', which strips the spaces between inline elements.
          compressHTML: true,
          build: { format: 'directory', inlineStylesheets: 'never' },
          image: { service: passthroughImageService() },
          vite: {
            plugins: [tailwindcss()],
            define: { 'import.meta.env.LA_VERSION': JSON.stringify(repoVersion(root)) },
            // Never inline scripts or assets: the CSP allows one inline script, the theme boot.
            build: { assetsInlineLimit: 0 },
          },
          ...(command === 'preview' ? { server: { headers: pageHeaders(track) } } : {}),
        });
      },
      'astro:server:setup': ({ server }) => {
        if (track.kind !== 'home') server.middlewares.use(embedMiddleware(contentDirOf(root)));
      },
      'astro:build:done': ({ dir }) => {
        writeSiteFiles({
          outDir: fileURLToPath(dir),
          siteDir: fileURLToPath(root),
          track,
          lastmod: new Date().toISOString().slice(0, 10),
        });
      },
    },
  };
}
