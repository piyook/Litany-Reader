// Litany Reader: a tiny local server with no dependencies.
// It reads the litanies folder fresh on every request.
const http = require('http');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

const { loadEnv, DEFAULT_PORT } = require('./scripts/env');

loadEnv();
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
// Local use stays on this machine only; the Docker image sets HOST=0.0.0.0.
const HOST = process.env.HOST || '127.0.0.1';
const LITANY_DIR = path.join(__dirname, 'litanies');
const PUBLIC_DIR = path.join(__dirname, 'public');
// Written while running so `npm stop` can find the server and ask it to exit.
const STATE_FILE = path.join(__dirname, '.server.json');
const TOKEN = crypto.randomBytes(16).toString('hex');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function listFiles() {
  const names = await fs.readdir(LITANY_DIR);
  return names.filter((n) => n.toLowerCase().endsWith('.txt'));
}

async function parseLitany(file) {
  let text = await fs.readFile(path.join(LITANY_DIR, file), 'utf8');
  text = text.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = lines.shift() || file.replace(/\.txt$/i, '');
  // An optional last line "Author: <name>" is a credit, not a step.
  let author = '';
  const m = lines.length && lines[lines.length - 1].match(/^author\s*:\s*(.+)$/i);
  if (m) { author = m[1].trim(); lines.pop(); }
  return { title, lines, author };
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);

    if (p === '/__shutdown' && req.method === 'POST') {
      if (req.headers['x-litany-token'] !== TOKEN) return send(res, 403, { error: 'Forbidden' });
      send(res, 200, { ok: true });
      return shutdown();
    }

    if (p === '/api/litanies') {
      const files = await listFiles();
      const items = await Promise.all(
        files.map(async (id) => {
          const { title, author } = await parseLitany(id);
          return { id, title, author };
        })
      );
      items.sort((a, b) => a.title.localeCompare(b.title));
      return send(res, 200, items);
    }

    if (p.startsWith('/api/litanies/')) {
      const id = p.slice('/api/litanies/'.length);
      // Only accept a file that is really in the folder (blocks ../ tricks).
      const files = await listFiles();
      if (!files.includes(id)) return send(res, 404, { error: 'Not found' });
      return send(res, 200, await parseLitany(id));
    }

    // Static files from public/
    const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const full = path.resolve(PUBLIC_DIR, rel);
    if (!full.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
    try {
      const data = await fs.readFile(full);
      return send(res, 200, data, TYPES[path.extname(full)] || 'application/octet-stream');
    } catch {
      return send(res, 404, 'Not found', 'text/plain');
    }
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Server error' });
  }
});

function removeStateFile() {
  try {
    const s = JSON.parse(fsSync.readFileSync(STATE_FILE, 'utf8'));
    if (s.pid === process.pid) fsSync.unlinkSync(STATE_FILE);
  } catch {}
}

function shutdown() {
  console.log('Litany Reader stopping.');
  removeStateFile();
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Is the reader already running?`);
  else console.error(err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  fsSync.writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, port: PORT, token: TOKEN }));
  console.log(`Litany Reader running at http://localhost:${PORT}`);
});
