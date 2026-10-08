import { createHash } from 'node:crypto';

import { THEME_BOOT } from './theme-boot.ts';

export function scriptHash(source: string): string {
  return `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
}

// Scripts load only from this origin, plus the hashed theme boot script and the Web
// Analytics beacon that Cloudflare's edge injects into every page, with the
// connect-src it reports through (Cloudflare's documented CSP requirement). The
// edge's JavaScript Detections bootstrap stays blocked: it changes per request, so
// only a per-response nonce could allow it, and a static site cannot issue one.
// Styles allow inline because every animation SVG embeds its token <style> block and
// the stage sets its aspect ratio inline; nothing on the site is user generated.
// There is no upgrade-insecure-requests: it would break the plain-http nginx image.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${scriptHash(THEME_BOOT)} https://static.cloudflareinsights.com`,
  "connect-src 'self' https://cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "object-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Embeds load from other origins (GitHub, blogs, slides), so these say so explicitly.
export const EMBED_HEADERS: Readonly<Record<string, string>> = {
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=86400',
};

export const IMMUTABLE = 'public, max-age=31536000, immutable';

export function pageHeaders({ launched }: { launched: boolean }): Record<string, string> {
  return launched ? { ...SECURITY_HEADERS } : { ...SECURITY_HEADERS, 'X-Robots-Tag': 'noindex' };
}

const rule = (path: string, headers: Readonly<Record<string, string>>): string =>
  `${path}\n${Object.entries(headers)
    .map(([name, value]) => `  ${name}: ${value}\n`)
    .join('')}`;

export function headersFile(track: { launched: boolean }): string {
  return (
    rule('/*', pageHeaders(track)) +
    rule('/_astro/*', { 'Cache-Control': IMMUTABLE }) +
    rule('/embed/*', EMBED_HEADERS)
  );
}
