import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, test, vi } from 'vitest';

import { contentDirOf } from './disk.ts';
import {
  builtPaths,
  embedMiddleware,
  learningAnimated,
  repoVersion,
  writeSiteFiles,
} from './integration.ts';
import { defineTrack } from './schemas.ts';

const SITE = {
  url: 'https://java.learning-animated.com/',
  name: 'J',
  shortName: 'J',
  tagline: 'T',
  repoUrl: 'https://github.com/josimar-silva/learning-animated',
};
const JAVA = defineTrack({ id: 'java', kind: 'curriculum', launched: false, site: SITE });
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';

function site(): { siteDir: string; outDir: string } {
  const siteDir = mkdtempSync(join(tmpdir(), 'site-'));
  mkdirSync(join(siteDir, 'src/content/animations/strings/split'), { recursive: true });
  writeFileSync(
    join(siteDir, 'src/content/sections.json'),
    JSON.stringify([{ id: 'strings', number: 1, title: 'Strings', description: 'd' }]),
  );
  writeFileSync(
    join(siteDir, 'src/content/animations/strings/split/index.md'),
    '---\nid: split\nsection: strings\norder: 1\ntitle: Split\ndescription: d\nobjective: o\nreferences:\n  - label: JDK\n    url: https://openjdk.org/\nviews:\n  - id: before\n    label: Before\n  - id: after\n    label: After\n---\n',
  );
  writeFileSync(
    join(siteDir, 'package.json'),
    JSON.stringify({ version: '0.0.0-test', workspaces: [] }),
  );
  writeFileSync(join(siteDir, 'src/content/animations/strings/split/split.before.svg'), SVG);
  writeFileSync(join(siteDir, 'src/content/animations/strings/split/split.after.svg'), SVG);
  const outDir = join(siteDir, 'dist');
  mkdirSync(join(outDir, 'strings'), { recursive: true });
  writeFileSync(join(outDir, 'index.html'), '');
  writeFileSync(join(outDir, 'strings/index.html'), '');
  writeFileSync(join(outDir, '404.html'), '');
  return { siteDir, outDir };
}

test('builtPaths lists every page and skips 404.html', () =>
  expect(builtPaths(site().outDir)).toEqual(['/', '/strings/']));

test('repoVersion walks up to the workspace root', () => {
  const root = mkdtempSync(join(tmpdir(), 'repo-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ version: '1.2.3', workspaces: ['tracks/*'] }),
  );
  mkdirSync(join(root, 'tracks/java'), { recursive: true });
  writeFileSync(join(root, 'tracks/java/package.json'), JSON.stringify({ version: '0.0.0' }));
  expect(repoVersion(pathToFileURL(join(root, 'tracks/java/')))).toBe('1.2.3');
});

describe('writeSiteFiles', () => {
  const written = () => {
    const { siteDir, outDir } = site();
    writeSiteFiles({ outDir, siteDir, track: JAVA, lastmod: '2026-10-07' });
    return {
      siteDir,
      read: (f: string) => readFileSync(join(outDir, f), 'utf8'),
      has: (f: string) => existsSync(join(outDir, f)),
    };
  };
  test('copies every view to /embed/', () => {
    const { has } = written();
    expect(has('embed/split.before.svg') && has('embed/split.after.svg')).toBe(true);
  });
  test('writes headers, robots, and sitemap for an unlaunched site', () => {
    const { read } = written();
    expect(read('_headers')).toContain('X-Robots-Tag: noindex');
    expect(read('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
    expect(read('sitemap.xml')).toContain('<loc>https://java.learning-animated.com/strings/</loc>');
  });
  test('writes _redirects only for a legacy track', () =>
    expect(written().has('_redirects')).toBe(false));
  test('writes the nginx config beside the site', () =>
    expect(readFileSync(join(written().siteDir, 'nginx.generated.conf'), 'utf8')).toMatch(
      /listen\s+3000;/,
    ));
});

test('embedMiddleware serves SVGs from content and passes the rest on', () => {
  const { siteDir } = site();
  const handle = embedMiddleware(contentDirOf(siteDir));
  const res = { setHeader: vi.fn(), end: vi.fn() };
  const next = vi.fn();
  handle({ url: '/embed/split.after.svg' } as never, res as never, next);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
  expect(res.end).toHaveBeenCalledWith(SVG);
  handle({ url: '/strings/' } as never, res as never, next);
  expect(next).toHaveBeenCalledOnce();
});

test('the integration validates content and configures the site', () => {
  const { siteDir } = site();
  const updateConfig = vi.fn();
  const setup = learningAnimated({ track: JAVA }).hooks['astro:config:setup']!;
  setup({
    config: { root: pathToFileURL(`${siteDir}/`) },
    command: 'build',
    updateConfig,
  } as never);
  expect(updateConfig.mock.calls[0]?.[0]).toMatchObject({
    site: SITE.url,
    trailingSlash: 'always',
    compressHTML: true,
    build: { format: 'directory', inlineStylesheets: 'never' },
  });
  const broken = mkdtempSync(join(tmpdir(), 'broken-'));
  expect(() =>
    setup({
      config: { root: pathToFileURL(`${broken}/`) },
      command: 'build',
      updateConfig,
    } as never),
  ).toThrow();
});
