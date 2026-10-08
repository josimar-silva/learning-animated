import { EMBED_HEADERS, IMMUTABLE, pageHeaders } from './headers.ts';
import type { Track } from './schemas.ts';

const lines = (headers: Readonly<Record<string, string>>, indent: string): string =>
  Object.entries(headers)
    .map(([name, value]) => `${indent}add_header ${name} "${value}" always;`)
    .join('\n');

// A location that declares its own add_header drops the server's, so the two
// locations that add headers repeat the whole baseline.
export function nginxConf(track: Pick<Track, 'launched' | 'legacyRedirects'>): string {
  const page = pageHeaders(track);
  const legacy = track.legacyRedirects
    ? '\n    location /src/animations/ {\n      rewrite ^/src/animations/[a-z0-9-]+/([a-z0-9-]+)/[a-z0-9-]+\\.svg$ /embed/$1.svg permanent;\n      return 404;\n    }\n'
    : '';
  return `worker_processes  1;

error_log  /var/log/nginx/error.log warn;
pid        /tmp/nginx.pid;

events {
  worker_connections  1024;
}

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;
  server_tokens off;

  log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

  access_log  /var/log/nginx/access.log  main;

  sendfile    on;

  keepalive_timeout  90;

  server {
    listen       3000;
    server_name  localhost;
    absolute_redirect off;
    root   /usr/share/nginx/html;

${lines(page, '    ')}

    location / {
      try_files $uri $uri/ $uri.html =404;
    }

    location /_astro/ {
${lines(page, '      ')}
      add_header Cache-Control "${IMMUTABLE}" always;
    }

    location /embed/ {
${lines({ ...page, ...EMBED_HEADERS }, '      ')}
    }
${legacy}
    error_page 404 /404.html;
  }

  server {
    listen 9091;
    server_name localhost;

    location /api/health {
      return 200 "{\\"status\\":\\"ok\\"}";
      add_header Content-Type text/plain;
      access_log off;
    }

    location /api/metrics {
      stub_status;
      access_log off;
    }
  }
}
`;
}
