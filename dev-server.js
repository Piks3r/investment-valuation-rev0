// Local dev server — serves static files + proxies /api/yahoo
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // ── /api/yahoo proxy ──────────────────────────────────────────────────
  if (parsed.pathname === '/api/yahoo') {
    const target = parsed.query.url;
    if (!target) { res.writeHead(400); res.end('missing url'); return; }
    const decoded = decodeURIComponent(target);
    const options = url.parse(decoded);
    options.headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

    https.get(options, upstream => {
      let body = '';
      upstream.on('data', d => body += d);
      upstream.on('end', () => {
        res.writeHead(upstream.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(body);
      });
    }).on('error', e => {
      res.writeHead(502); res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // ── Static files ──────────────────────────────────────────────────────
  let filePath = path.join(ROOT, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
