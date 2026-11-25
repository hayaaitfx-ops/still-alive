import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const profile = resolve(".scratch/edge-interact");
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

const evaluate = (c, expression) => c.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });

try {
  await wait();
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const c = await connect(t.webSocketDebuggerUrl);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });
  await c.send("Page.navigate", { url: pathToFileURL(resolve("still-alive/hollow/index.html")).href });
  await waitEv(c.evs, "Page.loadEventFired");
  await sleep(1500);

  const links = await evaluate(c, `Array.from(document.querySelectorAll('.worlds__link, .deep__foot a')).map(a => ({text:a.textContent.trim(), href:a.getAttribute('href')}))`);

  const before = await evaluate(c, `document.body.className`);
  await evaluate(c, `document.querySelector('.frag').click()`);
  await sleep(120);
  const during = await evaluate(c, `({cls: document.body.className, pressed: document.querySelector('.frag').getAttribute('aria-pressed')})`);
  await sleep(2900);
  const after = await evaluate(c, `({cls: document.body.className, pressed: document.querySelector('.frag').getAttribute('aria-pressed')})`);

  await evaluate(c, `(() => { const p = document.querySelector('.poster'); const r = p.getBoundingClientRect(); p.dispatchEvent(new PointerEvent('pointermove', {clientX: r.left + r.width*0.9, clientY: r.top + r.height*0.2, bubbles: true})); })()`);
  await sleep(600);
  const px = await evaluate(c, `document.documentElement.style.getPropertyValue('--px')`);

  const errs = c.evs.filter((e) => e.method === "Runtime.exceptionThrown").length;
  console.log(JSON.stringify({ links, before, during, after, parallaxVar: px, errors: errs }, null, 2));
  c.close();
} catch (e) { console.error(e); process.exitCode = 1; }
finally { edge.kill(); }