import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const profile = resolve(".scratch/edge-rects");
rmSync(profile, { recursive: true, force: true });

const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
  "--allow-file-access-from-files", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wait() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return; } catch {}
    await sleep(150);
  }
  throw new Error("no debugger");
}

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.onopen = () => {
      let id = 1; const pend = new Map(); const evs = [];
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
        else if (m.method) evs.push(m);
      };
      res({ send: (me, pa = {}) => new Promise((rs, rj) => { const i = id++; pend.set(i, { res: rs, rej: rj }); ws.send(JSON.stringify({ id: i, method: me, params: pa })); }), evs, close: () => ws.close() });
    };
    ws.onerror = rej;
  });
}

function waitEv(evs, me, t = 15000) {
  const s = Date.now();
  return new Promise((res, rej) => {
    const c = () => { const f = evs.find((e) => e.method === me); if (f) return res(f); if (Date.now() - s > t) return rej(new Error("timeout")); setTimeout(c, 60); };
    c();
  });
}

const EXPR = `(() => {
  const sel = ['.title','.title__hollow','.statement','.ichigo','.frag','.phrase--a','.phrase--b','.phrase--c','.poster__foot','.masthead','.deep__big','.smile'];
  const out = {};
  sel.forEach(s => {
    const el = document.querySelector(s);
    if (!el) { out[s] = null; return; }
    const r = el.getBoundingClientRect();
    out[s] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  out._scrollW = document.documentElement.scrollWidth;
  out._innerW = window.innerWidth;
  out._docH = document.documentElement.scrollHeight;
  return out;
})()`;

async function run(width, height, mobile) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const c = await connect(t.webSocketDebuggerUrl);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await c.send("Page.navigate", { url: pathToFileURL(resolve("still-alive/hollow/index.html")).href });
  await waitEv(c.evs, "Page.loadEventFired");
  await sleep(1800);
  const r = await c.send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
  c.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
  return { width, ...r.result.value };
}

try {
  await wait();
  console.log(JSON.stringify([await run(1440, 900, false), await run(390, 844, true)], null, 2));
} catch (e) { console.error(e); process.exitCode = 1; }
finally { edge.kill(); }