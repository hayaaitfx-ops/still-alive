/* ==========================================================================
   WHITE — World 02
   Small, dependency-free behaviours: header state, reveals, hero parallax.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header state ---------------------------------------------------------- */
  var header = document.querySelector('.top');
  if (header) {
    var setHeader = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    setHeader();
    window.addEventListener('scroll', setHeader, { passive: true });
  }

  /* Reveal on scroll ------------------------------------------------------ */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Hero parallax --------------------------------------------------------- */
  var hero = document.querySelector('.hero');
  var art = document.querySelector('.hero__art');

  if (hero && art && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    var frame = null;

    hero.addEventListener('pointermove', function (event) {
      if (frame) return;
      frame = window.requestAnimationFrame(function () {
        frame = null;
        var rect = hero.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        art.style.setProperty('--mx', x.toFixed(3));
        art.style.setProperty('--my', y.toFixed(3));
      });
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      art.style.setProperty('--mx', '0');
      art.style.setProperty('--my', '0');
    });
  }
})();
