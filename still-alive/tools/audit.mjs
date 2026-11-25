import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const profile = resolve(".scratch/edge-audit");
rmSync(profile, { recursive: true, force: true });

const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
  "--allow-file-access-from-files", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(150);
  }
  throw new Error("no debugger");
}

function connect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      let id = 1;
      const pending = new Map();
      const events = [];
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) {
          const p = pending.get(m.id);
          pending.delete(m.id);
          m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
        } else if (m.method) events.push(m);
      };
      res({
        send: (method, params = {}) => new Promise((rs, rj) => {
          const i = id++;
          pending.set(i, { resolve: rs, reject: rj });
          ws.send(JSON.stringify({ id: i, method, params }));
        }),
        events,
        close: () => ws.close(),
      });
    };
    ws.onerror = rej;
  });
}

function waitEvent(events, method, timeout = 15000) {
  const start = Date.now();
  return new Promise((res, rej) => {
    const check = () => {
      const f = events.find((e) => e.method === method);
      if (f) return res(f);
      if (Date.now() - start > timeout) return rej(new Error("timeout " + method));
      setTimeout(check, 60);
    };
    check();
  });
}

const EXPR = `(() => {
  const out = { overflowX: document.documentElement.scrollWidth - window.innerWidth, imgs: [], wide: [] };
  document.querySelectorAll('img').forEach(i => out.imgs.push({
    src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth
  }));
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed') {
      out.wide.push({ sel: el.className || el.tagName, w: Math.round(r.width) });
    }
  });
  out.wide = out.wide.slice(0, 8);
  return out;
})()`;

async function audit(path, width, height, mobile) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const c = await connect(t.webSocketDebuggerUrl);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await c.send("Page.navigate", { url: pathToFileURL(resolve("still-alive", path)).href });
  await waitEvent(c.events, "Page.loadEventFired");
  await sleep(1500);
  const r = await c.send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
  const errs = c.events.filter((e) => e.method === "Runtime.exceptionThrown").length;
  c.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
  return { path, width, errs, ...r.result.value };
}

try {
  await waitForDebugger();
  const out = [];
  out.push(await audit("hollow/index.html", 1440, 900, false));
  out.push(await audit("hollow/index.html", 390, 844, true));
  out.push(await audit("index.html", 1440, 900, false));
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  edge.kill();
}