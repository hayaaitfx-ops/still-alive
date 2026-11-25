import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const root = resolve("still-alive");
const profile = resolve(".scratch/edge-profile");
const outDir = resolve("still-alive/shots");
mkdirSync(outDir, { recursive: true });
rmSync(profile, { recursive: true, force: true });

const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--allow-file-access-from-files",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(150);
  }
  throw new Error("Edge debugger did not start");
}

function connect(wsUrl) {
  return new Promise((resolveConn, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      let nextId = 1;
      const pending = new Map();
      const events = [];
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve: res, reject: rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(JSON.stringify(msg.error)));
          else res(msg.result);
        } else if (msg.method) {
          events.push(msg);
        }
      };
      const send = (method, params = {}) => new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
      resolveConn({ ws, send, events });
    };
    ws.onerror = reject;
  });
}

function waitEvent(events, method, timeout = 15000) {
  const start = Date.now();
  return new Promise((resolveEvent, reject) => {
    const check = () => {
      const found = events.find((e) => e.method === method);
      if (found) return resolveEvent(found);
      if (Date.now() - start > timeout) return reject(new Error(`Timed out waiting for ${method}`));
      setTimeout(check, 60);
    };
    check();
  });
}

async function shoot({ name, path, width, height, mobile = false }) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const conn = await connect(target.webSocketDebuggerUrl);
  const { send, events } = conn;

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile,
    screenWidth: width, screenHeight: height,
  });
  await send("Page.navigate", { url: pathToFileURL(resolve(root, path)).href });
  await waitEvent(events, "Page.loadEventFired");
  await sleep(1600);
  await send("Runtime.evaluate", {
    expression: `document.fonts.ready.then(() => {
      document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
      const s = document.createElement('style');
      s.textContent = '.noise,.grain{display:none!important}';
      document.head.appendChild(s);
    })`,
    awaitPromise: true,
  });
  await sleep(900);

  const metrics = await send("Page.getLayoutMetrics");
  const widthPx = Math.ceil(metrics.cssContentSize.width);
  const heightPx = Math.ceil(metrics.cssContentSize.height);
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: widthPx, height: heightPx, scale: 1 },
  });
  writeFileSync(resolve(outDir, `${name}.png`), Buffer.from(shot.data, "base64"));

  const errors = events.filter((e) => e.method === "Runtime.exceptionThrown");
  conn.ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
  return { name, widthPx, heightPx, errors: errors.length };
}

try {
  await waitForDebugger();
  const results = [];
  results.push(await shoot({ name: "zine-1440", path: "index.html", width: 1440, height: 900 }));
  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  edge.kill();
}
