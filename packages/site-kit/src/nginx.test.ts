import { expect, test } from 'vitest';

import { SECURITY_HEADERS } from './headers.ts';
import { nginxConf } from './nginx.ts';

test('every location repeats the full security baseline', () => {
  const conf = nginxConf({ launched: true, legacyRedirects: false });
  for (const name of Object.keys(SECURITY_HEADERS)) {
    expect(conf.match(new RegExp(`add_header ${name} `, 'g'))).toHaveLength(3);
  }
  expect(conf).toMatch(/listen\s+3000;/);
  expect(conf).toMatch(/listen\s+9091;/);
  expect(conf).toContain('pid        /tmp/nginx.pid;');
});
test('unlaunched images send noindex too', () =>
  expect(nginxConf({ launched: false, legacyRedirects: false })).toContain(
    'add_header X-Robots-Tag "noindex" always;',
  ));
test('only Kafka rewrites its legacy SVG paths', () => {
  expect(nginxConf({ launched: true, legacyRedirects: true })).toContain(
    'rewrite ^/src/animations/[a-z0-9-]+/([a-z0-9-]+)/[a-z0-9-]+\\.svg$ /embed/$1.svg permanent;',
  );
  expect(nginxConf({ launched: true, legacyRedirects: false })).not.toContain('/src/animations/');
});
