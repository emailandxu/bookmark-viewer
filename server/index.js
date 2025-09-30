import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { loadWatchedBookmarks } from './bookmarks.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const PUBLIC_DIR = resolve(process.cwd(), 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

function sendText(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
}

async function serveStaticAsset(pathname, res) {
  const filePath = pathname === '/' ? join(PUBLIC_DIR, 'index.html') : join(PUBLIC_DIR, pathname);
  const normalized = normalize(filePath);

  if (!normalized.startsWith(PUBLIC_DIR)) {
    sendText(res, 404, 'Not found');
    return;
  }

  if (!existsSync(normalized)) {
    sendText(res, 404, 'Not found');
    return;
  }

  const stats = await stat(normalized);
  if (stats.isDirectory()) {
    const indexPath = join(normalized, 'index.html');
    if (!existsSync(indexPath)) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    return serveStaticAsset(join(pathname, 'index.html'), res);
  }

  const ext = extname(normalized);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  const file = await readFile(normalized);
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', file.byteLength);
  if (ext !== '.html') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  res.end(file);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/watched') {
      const data = await loadWatchedBookmarks();
      sendJson(res, 200, data);
      return;
    }

    if (req.method !== 'GET') {
      sendText(res, 405, 'Method not allowed');
      return;
    }

    await serveStaticAsset(url.pathname, res);
  } catch (error) {
    console.error('Request failed', error);
    sendJson(res, 500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Bookmark viewer listening on http://localhost:${PORT}`);
});
