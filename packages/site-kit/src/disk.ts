import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse } from 'yaml';

import type { Entry } from './model.ts';
import { animationSchema, type Section, sectionSchema } from './schemas.ts';

export function contentDirOf(root: string | URL): URL {
  const base =
    typeof root === 'string' ? pathToFileURL(root.endsWith('/') ? root : `${root}/`) : root;
  return new URL('src/content/', base);
}

export function frontmatterOf(markdown: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) throw new Error('index.md needs a YAML frontmatter block');
  return parse(match[1]!);
}

export function loadSections(contentDir: URL): Section[] {
  const raw: unknown = JSON.parse(readFileSync(new URL('sections.json', contentDir), 'utf8'));
  return sectionSchema
    .array()
    .parse(raw)
    .sort((a, b) => a.number - b.number);
}

export function loadEntries(contentDir: URL): Entry[] {
  const root = fileURLToPath(new URL('animations/', contentDir));
  let files;
  try {
    files = readdirSync(root, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  return files
    .filter((f) => f.isFile() && f.name === 'index.md')
    .map((f) => {
      const folder = relative(root, f.parentPath).split(sep).join('/');
      let animation;
      try {
        animation = animationSchema.parse(
          frontmatterOf(readFileSync(join(f.parentPath, 'index.md'), 'utf8')),
        );
      } catch (error) {
        throw new Error(`${folder}/index.md: ${(error as Error).message}`, { cause: error });
      }
      const svgs = new Map(
        readdirSync(f.parentPath)
          .filter((name) => name.endsWith('.svg'))
          .sort()
          .map((name) => [name, readFileSync(join(f.parentPath, name), 'utf8')] as const),
      );
      return { animation, folder, svgs };
    })
    .sort((a, b) => a.folder.localeCompare(b.folder));
}
