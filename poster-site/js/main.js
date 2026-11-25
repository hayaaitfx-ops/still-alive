// Subtle motion only: the poster stays the subject.
// Uses the independent `translate` property so CSS transforms (rotations) are untouched.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const collage = document.querySelector('.collage');
  if (!collage) return;

  const specs = [
    ['.hand-light-wrap', 1.8, 1.3, 26000],
    ['.hand-dark-wrap', 1.1, 0.9, 21000],
    ['.bird-blue', 2.6, 1.9, 14000],
    ['.ring-blue-ellipse', 0.9, 0.6, 33000],
    ['.curves', 0.7, 0.5, 41000],
    ['.circle-gray', 0.8, 0.6, 37000],
    ['.dotfield--top', 0.6, 0.5, 45000],
    ['.panel-b', 0.7, 0.4, 39000],
    ['.print-defects', 0.5, 0.4, 52000],
  ];

  const items = specs.map(([sel, ax, ay, period], i) => {
    const el = collage.querySelector(sel);
    return el ? { el, ax, ay, period, phase: i * 1.37 } : null;
  }).filter(Boolean);

  if (!items.length) return;

  let raf = 0;
  const t0 = performance.now();

  const frame = (now) => {
    raf = 0;
    const t = (now - t0) / 1000;
    for (const it of items) {
      const a = Math.sin((t / it.period) * 1000 * Math.PI * 2 + it.phase);
      const b = Math.cos((t / (it.period * 1.31)) * 1000 * Math.PI * 2 + it.phase);
      it.el.style.translate = `${(it.ax * a).toFixed(3)}cqw ${(it.ay * b).toFixed(3)}cqw`;
    }
    if (!document.hidden) raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  start();
})();
