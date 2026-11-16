// Dev server for the labs: static files plus POST /__save, which writes the lab's full config to saved/<lab>.config.json.
// node tools/serve.mjs [port]   (default 4319). The labs' Save buttons use it when present.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +process.argv[2] || 4319;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/__save') {
      let body = ''; for await (const ch of req) body += ch;
      const cfg = JSON.parse(body); const dir = path.join(root, 'saved'); await mkdir(dir, { recursive: true });
      const name = (url.searchParams.get('name') || 'lab').replace(/[^a-z0-9-]/gi, '');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const pretty = JSON.stringify(cfg, null, 2) + '\n';
      await writeFile(path.join(dir, `${name}.config.json`), pretty);
      await writeFile(path.join(dir, `${name}-${stamp}.json`), pretty);
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ path: `saved/${name}.config.json` })); return;
    }
    let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p); if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file); res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch (e) { res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end(String(e.message)); }
}).listen(port, () => {
  console.log(`http://localhost:${port}`);
});
