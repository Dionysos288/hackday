// bake-land.mjs <land-particles.json> [out.png] [dot] [blur]
// Bakes the wheel's land map: the points of land (unit vectors [x, y, z]) drawn as soft dots on a 512 by 256 map,
// longitude across and latitude down, white on black. The globe's shader reads this picture, so the page loads a
// small image instead of the list of points. Drawn in headless Chrome with the same 2D canvas calls the wheel used.
import { spawn } from 'node:child_process'; import { readFileSync, writeFileSync } from 'node:fs';
const [src, out = 'public/wheel/land.png', dot = '1.3', blur = '2.5'] = process.argv.slice(2);
if (!src) { console.log('usage: node tools/bake-land.mjs <land-particles.json> [out.png] [dot] [blur]'); process.exit(1); }
const points = readFileSync(src, 'utf8');
const port = 9700 + Math.floor(Math.random() * 90), prof = '/tmp/bake-land-' + port;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let ws;
for (let i = 0; i < 60 && !ws; i++) { try { ws = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* not up yet */ } await sleep(150); }
const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r)); let id = 0; const pend = new Map();
sock.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const draw = `(() => {
  const LAND = { w: 512, h: 256, dot: ${+dot}, blur: ${+blur} }, points = ${points};
  const map = document.createElement('canvas'); map.width = LAND.w; map.height = LAND.h;
  const pen = map.getContext('2d'); pen.fillRect(0, 0, LAND.w, LAND.h);
  pen.filter = 'blur(' + LAND.blur + 'px)'; pen.fillStyle = '#fff'; pen.beginPath();
  for (const [x, y, z] of points) {
    const latitude = Math.asin(y), across = (Math.atan2(x, z) / (Math.PI * 2) + 0.5) * LAND.w, down = (0.5 - latitude / Math.PI) * LAND.h;
    const wide = Math.min(LAND.dot / Math.cos(latitude), 12);
    const copies = across < 16 ? [across, across + LAND.w] : across > LAND.w - 16 ? [across, across - LAND.w] : [across];
    for (const at of copies) { pen.moveTo(at + wide, down); pen.ellipse(at, down, wide, LAND.dot, 0, 0, Math.PI * 2); }
  }
  pen.fill(); return map.toDataURL('image/png');
})()`;
const r = await send('Runtime.evaluate', { expression: draw, returnByValue: true });
writeFileSync(out, Buffer.from(r.result.value.split(',')[1], 'base64'));
console.log('wrote', out); sock.close(); chrome.kill();
