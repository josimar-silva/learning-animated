import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FENCED = /^(`{3,}|~{3,}).*\n[\s\S]*?^\1[ \t]*$/gm;
const INLINE_CODE = /`[^`\n]*`/g;
const HEADING = /^#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/gm;
const LINK = /\]\(([^)\s]+)[^)]*\)|\b(?:href|src)="([^"]+)"/g;
const EXTERNAL = /^[a-z][a-z+.-]*:/i;

const exists = (path: string): boolean => statSync(path, { throwIfNoEntry: false }) !== undefined;
const prose = (path: string): string => readFileSync(path, 'utf8').replace(FENCED, '');

function guides(): string[] {
  const docs = join(ROOT, 'docs');
  const nested = exists(docs)
    ? readdirSync(docs, { recursive: true, encoding: 'utf8' }).map((file) => join('docs', file))
    : [];
  return [...readdirSync(ROOT), ...nested].filter((file) => file.endsWith('.md'));
}

// GitHub's rule: lowercase, keep letters, marks, numbers, `_`, `-`, and spaces, then dash the spaces.
function anchors(markdown: string): Set<string> {
  return new Set(
    [...markdown.matchAll(HEADING)].map(([, text]) =>
      text!
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
        .replace(/ /g, '-'),
    ),
  );
}

function resolves(guide: string, target: string): boolean {
  const [path = '', hash] = target.split('#');
  const file = path ? join(ROOT, dirname(guide), decodeURIComponent(path)) : join(ROOT, guide);
  if (!exists(file)) return false;
  return (
    hash === undefined ||
    !file.endsWith('.md') ||
    anchors(prose(file)).has(decodeURIComponent(hash))
  );
}

test('every relative link in the root and docs/ Markdown files resolves', () => {
  const broken = guides().flatMap((guide) =>
    [...prose(join(ROOT, guide)).replace(INLINE_CODE, '').matchAll(LINK)]
      .map(([, markdown, html]) => (markdown ?? html)!)
      .filter((target) => !EXTERNAL.test(target) && !resolves(guide, target))
      .map((target) => `${guide}: ${target}`),
  );
  expect(broken).toEqual([]);
});
