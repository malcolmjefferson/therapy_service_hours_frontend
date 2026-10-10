// Local stand-in for CloudFront + API Gateway, used only to exercise the smoke spec without AWS.
// It mirrors the infra web construct: security headers on every response, SPA rewrite for
// extensionless paths, immutable hashed assets, no-cache index.html, and problem+json from /api/*.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const SECURITY = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://local').pathname;
  if (path === '/api/v1/healthz') {
    res.writeHead(200, { ...SECURITY, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end('{"status":"ok","version":"local-smoke"}');
    return;
  }
  if (path.startsWith('/api/')) {
    res.writeHead(404, { ...SECURITY, 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' });
    res.end(
      '{"type":"urn:therapy-service-hours:problem:not-found","title":"Not Found","status":404,"request_id":"local"}',
    );
    return;
  }
  const last = path.slice(path.lastIndexOf('/') + 1);
  const file = last.includes('.') ? normalize(join(dist, path)) : join(dist, 'index.html');
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { ...SECURITY, 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  const isIndex = file.endsWith('index.html');
  res.writeHead(200, {
    ...SECURITY,
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('local smoke server on http://127.0.0.1:4173'));
