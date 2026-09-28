// Minimal static server for previewing site/ locally: npm run serve
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { SITE_DIR } from './lib/config.js';

const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.normalize(path.join(SITE_DIR, urlPath));
  if (!file.startsWith(SITE_DIR)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');

  fs.stat(file, (err, stat) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    // Always re-check with the server so rebuilt pages show up on reload.
    res.setHeader('Cache-Control', 'no-cache');
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    // Range requests so video seeking/looping works like on a real host.
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`Serving site/ at http://localhost:${PORT}`);
});
