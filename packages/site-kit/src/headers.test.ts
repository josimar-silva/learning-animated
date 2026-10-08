import { createHash } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import {
  CONTENT_SECURITY_POLICY,
  headersFile,
  pageHeaders,
  scriptHash,
  SECURITY_HEADERS,
} from './headers.ts';
import { THEME_BOOT } from './theme-boot.ts';

const hash = `'sha256-${createHash('sha256').update(THEME_BOOT).digest('base64')}'`;

test("the CSP is Kafka's, with the theme boot script hashed", () => {
  expect(scriptHash(THEME_BOOT)).toBe(hash);
  expect(CONTENT_SECURITY_POLICY).toBe(
    [
      "default-src 'self'",
      `script-src 'self' ${hash} https://static.cloudflareinsights.com`,
      "connect-src 'self' https://cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self'",
      "font-src 'self'",
      "object-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'self'",
    ].join('; '),
  );
});

describe('headersFile', () => {
  test('every page gets the security baseline', () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headersFile({ launched: true })).toContain(`/*\n`);
      expect(headersFile({ launched: true })).toContain(`  ${name}: ${value}\n`);
    }
  });
  test('an unlaunched site asks not to be indexed', () => {
    expect(headersFile({ launched: false })).toContain('  X-Robots-Tag: noindex\n');
    expect(headersFile({ launched: true })).not.toContain('X-Robots-Tag');
    expect(pageHeaders({ launched: false })['X-Robots-Tag']).toBe('noindex');
  });
  test('hashed assets are immutable and embeds work cross-origin', () => {
    const file = headersFile({ launched: true });
    expect(file).toContain('/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n');
    expect(file).toContain(
      '/embed/*\n  Cross-Origin-Resource-Policy: cross-origin\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=86400\n',
    );
  });
});
