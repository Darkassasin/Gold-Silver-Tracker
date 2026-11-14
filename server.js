// Zero-dependency server (Node 18+): serves /public and proxies /proxy/* to the FENEGOSIDA API
// so the dashboard still works if the API blocks cross-origin browser requests.
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'https://api.fenegosida.org/api/website/v1/Dashboard';
const ROOT = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

http.createServer(async (req, res) => {
  if (req.url.startsWith('/proxy/')) {
    try {
      const r = await fetch(BASE + req.url.slice('/proxy'.length));
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end('{"error":"Could not reach the FENEGOSIDA API"}');
    }
    return;
  }
  const url = req.url.split('?')[0];
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Gold & silver tracker running at http://localhost:${PORT}`));
