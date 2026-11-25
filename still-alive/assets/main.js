/* ==========================================================================
   STILL ALIVE — interactions
   ========================================================================== */
(function () {
  'use strict';

  const body = document.body;
  const nav = document.getElementById('nav');
  const progressBar = document.getElementById('progressBar');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* Scroll progress + nav state ------------------------------------------ */
  let scrollQueued = false;

  function updateScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const top = window.scrollY || doc.scrollTop || 0;
    const ratio = max > 0 ? Math.min(1, Math.max(0, top / max)) : 0;

    progressBar.style.width = (ratio * 100).toFixed(2) + '%';
    nav.classList.toggle('is-scrolled', top > 20);
    scrollQueued = false;
  }

  window.addEventListener('scroll', function () {
    if (!scrollQueued) {
      scrollQueued = true;
      window.requestAnimationFrame(updateScroll);
    }
  }, { passive: true });
  updateScroll();

  /* Reveal on scroll ------------------------------------------------------ */
  const revealEls = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Mobile menu ----------------------------------------------------------- */
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const menuLabel = menuToggle.querySelector('.menu-toggle__label');
  const mainEl = document.querySelector('main');
  const footEl = document.querySelector('.foot');
  const menuLinks = mobileMenu.querySelectorAll('a');

  function setMenu(open, restoreFocus) {
    body.classList.toggle('menu-open', open);
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    menuToggle.setAttribute('aria-expanded', String(open));
    menuLabel.textContent = open ? 'CLOSE' : 'MENU';
    mainEl.inert = open;
    footEl.inert = open;

    if (open) {
      const firstLink = mobileMenu.querySelector('a');
      if (firstLink) firstLink.focus({ preventScroll: true });
    } else if (restoreFocus) {
      menuToggle.focus({ preventScroll: true });
    }
  }

  menuToggle.addEventListener('click', function () {
    setMenu(!body.classList.contains('menu-open'), false);
  });

  menuLinks.forEach(function (link) {
    link.addEventListener('click', function () { setMenu(false, false); });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && body.classList.contains('menu-open')) {
      setMenu(false, true);
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 900 && body.classList.contains('menu-open')) {
      setMenu(false, false);
    }
  });

  /* Accordion ------------------------------------------------------------- */
  const accItems = Array.prototype.slice.call(document.querySelectorAll('.acc__item'));

  function setAccItem(item, open) {
    const trigger = item.querySelector('.acc__trigger');
    const panel = item.querySelector('.acc__panel');
    item.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    panel.toggleAttribute('inert', !open);
  }

  accItems.forEach(function (item) {
    setAccItem(item, item.classList.contains('is-open'));
    item.querySelector('.acc__trigger').addEventListener('click', function () {
      const willOpen = !item.classList.contains('is-open');
      accItems.forEach(function (other) {
        setAccItem(other, other === item ? willOpen : false);
      });
    });
  });

  /* Custom cursor --------------------------------------------------------- */
  const cursor = document.querySelector('.cursor');

  if (cursor && finePointer.matches && !reduceMotion.matches) {
    let cursorOn = false;

    window.addEventListener('pointermove', function (event) {
      cursor.style.transform =
        'translate3d(' + event.clientX + 'px,' + event.clientY + 'px,0) translate(-50%,-50%)';
      if (!cursorOn) {
        cursorOn = true;
        cursor.classList.add('is-on');
      }
    }, { passive: true });

    document.addEventListener('mouseover', function (event) {
      if (event.target.closest('a, button, input, .acc__trigger, .card')) {
        cursor.classList.add('is-active');
      }
    });

    document.addEventListener('mouseout', function (event) {
      if (event.target.closest('a, button, input, .acc__trigger, .card')) {
        cursor.classList.remove('is-active');
      }
    });

    document.addEventListener('mouseleave', function () {
      cursor.classList.remove('is-on');
      cursorOn = false;
    });
  }

  /* Hero parallax --------------------------------------------------------- */
  const hero = document.querySelector('.hero');
  const stage = document.getElementById('stage');

  if (stage && finePointer.matches && !reduceMotion.matches) {
    let pointerQueued = false;
    let pointerX = 0;
    let pointerY = 0;

    hero.addEventListener('pointermove', function (event) {
      const rect = hero.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

      if (!pointerQueued) {
        pointerQueued = true;
        window.requestAnimationFrame(function () {
          stage.style.setProperty('--mx', pointerX.toFixed(3));
          stage.style.setProperty('--my', pointerY.toFixed(3));
          pointerQueued = false;
        });
      }
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      stage.style.setProperty('--mx', '0');
      stage.style.setProperty('--my', '0');
    });
  }

  /* Distort button -------------------------------------------------------- */
  const distortButton = document.getElementById('distort');
  let distortTimer = null;

  if (distortButton) {
    distortButton.addEventListener('click', function () {
      if (reduceMotion.matches) return;

      body.classList.remove('is-distorting');
      void body.offsetWidth;
      body.classList.add('is-distorting');

      window.clearTimeout(distortTimer);
      distortTimer = window.setTimeout(function () {
        body.classList.remove('is-distorting');
      }, 900);
    });
  }

  /* Newsletter (fictional) ------------------------------------------------ */
  const signupForm = document.getElementById('signup');
  const emailInput = document.getElementById('email');
  const signupButton = document.getElementById('signupBtn');
  const signupMessage = document.getElementById('signupMsg');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (signupForm) {
    signupForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const value = emailInput.value.trim();

      signupForm.classList.remove('is-success', 'is-error');

      if (!emailPattern.test(value)) {
        signupForm.classList.add('is-error');
        signupMessage.textContent = 'THAT DOES NOT LOOK LIKE AN ADDRESS. TRY AGAIN.';
        emailInput.focus();
        return;
      }

      signupForm.classList.add('is-success');
      signupMessage.textContent = 'SIGNAL RECEIVED. STAY ALIVE.';
      signupButton.textContent = 'SENT ✦';
      signupButton.disabled = true;
      emailInput.value = '';
      emailInput.disabled = true;
    });
  }

  /* Local clock ----------------------------------------------------------- */
  const clock = document.getElementById('clock');

  if (clock) {
    const tick = function () {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
    };
    tick();
    window.setInterval(tick, 1000);
  }

  /* Smooth in-page focus handling ---------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function () {
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;

      target.setAttribute('tabindex', '-1');
      window.setTimeout(function () { target.focus({ preventScroll: true }); }, 420);
    });
  });
})();
