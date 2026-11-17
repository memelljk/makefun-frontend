// serve.ts — a tiny static server for local development of the app in
// app/ (Node 22, standard library only). Start it with `node serve.ts`
// and it answers on http://localhost:8080; pass `--port 9000` for another
// port. It serves the MIME types the app uses, maps "/" to index.html,
// answers HEAD with headers and no body, and never serves a path that
// escapes app/. Development only, not a production server.

import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

const appRoot = path.resolve(url.fileURLToPath(new URL('./app', import.meta.url)));

const flagAt = process.argv.indexOf('--port');
const rawPort = Number(process.argv[flagAt + 1]);
const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : 8080;

const mimeFor = (extension) => {
  switch (extension) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  } // extension
}; // mimeFor

const fileFor = (requestPath) => {
  const target = requestPath.endsWith('/') ? `${requestPath}index.html` : requestPath;
  const file = path.resolve(appRoot, `.${target}`);
  return file === appRoot || file.startsWith(appRoot + path.sep) ? file : null;
}; // fileFor

// A file's bytes, or null when it is missing, a directory, or unreadable.
const readAppFile = (file) => stat(file)
  .then((info) => (info.isFile() ? readFile(file) : null))
  .catch(() => null);

const headerFor = (file, body) => ({
  'content-type': mimeFor(path.extname(file).toLowerCase()),
  'content-length': body.length,
  'cache-control': 'no-store, must-revalidate',
}); // headerFor

const handleRequest = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.writeHead(405, { allow: 'GET, HEAD' }).end('only GET and HEAD are served');
  } // method
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); } catch { return res.writeHead(400).end('bad request line'); }
  const file = fileFor(pathname);
  if (file === null) {
    return res.writeHead(403).end('outside the app directory');
  } // outside
  const body = await readAppFile(file);
  if (body === null) {
    return res.writeHead(404).end('no such file');
  } // missing
  res.writeHead(200, headerFor(file, body));
  return res.end(req.method === 'HEAD' ? undefined : body);
}; // handleRequest

const server = http.createServer(handleRequest);

server.listen(port, '127.0.0.1', () => {
  console.log(`Development server: app/ at http://localhost:${server.address().port}`);
}); // listening
