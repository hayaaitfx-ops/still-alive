/* ==========================================================================
   THE HOLLOW — Issue 02
   Parallax de camadas, glitch de impressão e o fragmento da máscara.
   Tudo em transform/opacity. Nada de animação pesada.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  /* ---------------------------------------------------------------- parallax */
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-depth]'));
  var ichigo = document.querySelector('.ichigo');
  var poster = document.querySelector('.poster');
  var target = { x: 0, y: 0 };
  var current = { x: 0, y: 0 };
  var raf = null;

  function loop() {
    current.x += (target.x - current.x) * 0.08;
    current.y += (target.y - current.y) * 0.08;

    document.documentElement.style.setProperty('--px', current.x.toFixed(3));
    document.documentElement.style.setProperty('--py', current.y.toFixed(3));

    if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) {
      raf = window.requestAnimationFrame(loop);
    } else {
      raf = null;
    }
  }

  function kick() {
    if (raf === null) raf = window.requestAnimationFrame(loop);
  }

  if (!reduce && fine && poster) {
    poster.addEventListener('pointermove', function (event) {
      var rect = poster.getBoundingClientRect();
      target.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      target.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      kick();
    }, { passive: true });

    poster.addEventListener('pointerleave', function () {
      target.x = 0;
      target.y = 0;
      kick();
    });
  }

  /* ------------------------------------------------------------------ glitch */
  var glitchTimer = null;

  function glitch(ms) {
    if (reduce) return;
    document.body.classList.add('is-glitching');
    if (glitchTimer) window.clearTimeout(glitchTimer);
    glitchTimer = window.setTimeout(function () {
      document.body.classList.remove('is-glitching');
    }, ms || 320);
  }

  if (!reduce) {
    // falhas esporádicas, bem espaçadas
    window.setInterval(function () {
      if (document.hidden) return;
      if (Math.random() > 0.55) glitch(260);
    }, 5200);

    if (ichigo) {
      ichigo.addEventListener('pointerenter', function () { glitch(300); });
    }
  }

  /* ------------------------------------------------- fragmento da máscara */
  var frag = document.querySelector('.frag');
  var invadeTimer = null;

  function setInvaded(on) {
    document.body.classList.toggle('is-invaded', on);
    if (frag) frag.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  if (frag) {
    frag.addEventListener('click', function () {
      var on = !document.body.classList.contains('is-invaded');
      setInvaded(on);
      glitch(420);

      if (invadeTimer) window.clearTimeout(invadeTimer);
      if (on) {
        invadeTimer = window.setTimeout(function () { setInvaded(false); }, 2600);
      }
    });
  }

  /* --------------------------------------------------------------- teclado */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setInvaded(false);
  });

  /* ---------------------------------------------------------------- reveal */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.1 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();