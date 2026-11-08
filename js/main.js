// ---- Date-limited content ----
// data-until="YYYY-MM-DD" on any element (or `until` on a home hero slide) is the last day it shows,
// in the visitor's local time. From the next day it is removed, e.g. Buy tickets buttons after a concert.
function icsoExpired(until) {
  if (!until) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(until);
  if (!m) { console.warn('Ignoring badly formatted date (use YYYY-MM-DD):', until); return false; }
  return Date.now() >= new Date(+m[1], +m[2] - 1, +m[3] + 1).getTime();
}
window.icsoExpired = icsoExpired;
document.querySelectorAll('[data-until]').forEach(el => { if (icsoExpired(el.dataset.until)) el.remove(); });

// ---- Mobile nav toggle ----
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('navToggle');
  const nav = document.querySelector('nav.main');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
  }
});

// ---- Sticky header shrink-on-scroll ----
(() => {
  const header = document.getElementById('site-header');
  if (!header) return;
  const onScroll = () => {
    if (window.scrollY > 40) header.classList.add('scrolled');
    else if (window.scrollY < 10) header.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();

// ---- Scroll-reveal via IntersectionObserver ----
function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.in-view)');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}
window.initReveal = initReveal;
document.addEventListener('DOMContentLoaded', initReveal);

// ---- Count-up for "N years" figures ----
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-founded]').forEach(el => {
    const target = new Date().getFullYear() - parseInt(el.dataset.founded, 10);
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
});

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---- Intro splash (once per browser session) ----
(() => {
  const overlay = document.getElementById('introOverlay');
  if (!overlay) return;
  let seen = false;
  try { seen = !!sessionStorage.getItem('icso_intro_shown'); } catch (e) {}
  // Skip entirely if already shown this session or the visitor prefers reduced motion
  if (seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.remove();
    return;
  }
  document.body.classList.add('intro-lock');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    overlay.classList.add('hide');
    document.body.classList.remove('intro-lock');
    try { sessionStorage.setItem('icso_intro_shown', '1'); } catch (e) {}
    setTimeout(() => overlay.remove(), 700);
  };
  // Fixed length: just long enough for the logo, rule and tagline animations (they end at 1.6s).
  // No longer waits for every image and the video to load.
  setTimeout(finish, 1600);
  overlay.addEventListener('click', finish);
})();

// ---- Split headings into words and fade/rise them in, staggered ----
function splitWords(root) {
  if (root.dataset.split) return;
  root.dataset.split = '1';
  root.classList.add('split-ready');   // <-- add this line
  function walk(node) {
    if (node.nodeType === 3) {
      const parts = node.textContent.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      parts.forEach(p => {
        if (p === '' ) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = p;
        frag.appendChild(span);
      });
      node.replaceWith(frag);
    } else if (node.nodeType === 1) {
      if (node.id) return; // leave dynamic elements (e.g. the year counter) alone
      if (node.tagName === 'A') { node.classList.add('word'); return; } // animate the whole link as one piece, keep its underline intact
      [...node.childNodes].forEach(walk);
    }
  }
  [...root.childNodes].forEach(walk);
}
function revealWords(root, baseDelay) {
  root.querySelectorAll('.word').forEach((w, i) => {
    w.style.transitionDelay = (baseDelay + i * 32) + 'ms';
    requestAnimationFrame(() => w.classList.add('in'));
  });
}
document.addEventListener('DOMContentLoaded', () => {
  // Hero headings: split immediately, reveal once the intro (if any) is out of the way
  const introDelay = document.getElementById('introOverlay') ? 1400 : 0;
  document.querySelectorAll('.hero h1, .hero .eyebrow, .hero .lede').forEach(el => {
    splitWords(el);
    revealWords(el, introDelay);
  });
  // Other headings: split now, reveal on scroll into view
  const others = document.querySelectorAll('main h2');
  others.forEach(splitWords);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          revealWords(entry.target, 0);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    others.forEach(el => io.observe(el));
  } else {
    others.forEach(el => revealWords(el, 0));
  }
});
window.splitWords = splitWords;
window.revealWords = revealWords;

// ---- Home page: hero carousel ----
document.addEventListener('DOMContentLoaded', () => {
  const heroSection = document.getElementById('heroCarousel');
  if (!heroSection || !window.__heroSlides || !window.__heroSlides.length) return;
  const heroSlides = window.__heroSlides;

  let heroIndex = 0;
  const heroDots = document.getElementById('heroDots');
  const bgA = document.getElementById('heroBgA'), bgB = document.getElementById('heroBgB');
  let activeBg = bgA, inactiveBg = bgB;
  const wrapA = document.getElementById('heroWrapA'), wrapB = document.getElementById('heroWrapB');
  let activeWrap = wrapA, inactiveWrap = wrapB;

  function fillWrap(el, s) {
    el.innerHTML = `<p class="eyebrow">${s.eyebrow}</p><h1>${s.title}</h1><p class="lede">${s.lede}</p>`;
    delete el.dataset.split;
    el.querySelectorAll('.eyebrow, h1, .lede').forEach(node => window.splitWords(node));
  }

  activeBg.style.backgroundImage = `url('${heroSlides[0].img}')`;
  fillWrap(activeWrap, heroSlides[0]);
  const introDelay = document.getElementById('introOverlay') ? 1400 : 0;
  activeWrap.querySelectorAll('.eyebrow, h1, .lede').forEach(node => window.revealWords(node, introDelay));
  inactiveWrap.style.transform = 'translateX(9999px)';

  // Slide images load on demand: slide 1 is preloaded in the page head, the next slide is
  // fetched once the page has loaded (and after each change), and any other slide as soon as
  // the visitor points at or focuses the control that would show it.
  const preloaded = new Set([heroSlides[0].img]);
  function preloadSlide(i) {
    const img = heroSlides[(i + heroSlides.length) % heroSlides.length].img;
    if (preloaded.has(img)) return;
    preloaded.add(img);
    new Image().src = img;
  }
  const preloadNext = () => preloadSlide(heroIndex + 1);
  if (document.readyState === 'complete') preloadNext();
  else window.addEventListener('load', preloadNext, { once: true });

  const plainText = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.trim(); };
  const dots = heroSlides.map((s, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show slide ${i + 1}: ${plainText(s.title)}`);
    if (i === 0) { dot.classList.add('active'); dot.setAttribute('aria-current', 'true'); }
    ['pointerenter', 'focus'].forEach(ev => dot.addEventListener(ev, () => preloadSlide(i)));
    dot.addEventListener('click', () => {
      if (i !== heroIndex && showHero(i, i > heroIndex ? 1 : -1)) restartAuto();
    });
    heroDots.appendChild(dot);
    return dot;
  });

  // Returns false (and does nothing) while a slide transition is still running
  let animating = false;
  function showHero(i, direction = 1) {
    if (animating) return false;
    animating = true;
    heroIndex = (i + heroSlides.length) % heroSlides.length;
    const s = heroSlides[heroIndex];
    const dist = heroSection.offsetWidth;

    inactiveBg.style.transition = 'none';
    inactiveBg.style.backgroundImage = `url('${s.img}')`;
    inactiveBg.style.transform = `translateX(${dist * direction}px)`;
    inactiveBg.style.zIndex = 1;
    activeBg.style.zIndex = 0;

    inactiveWrap.style.transition = 'none';
    fillWrap(inactiveWrap, s);
    inactiveWrap.querySelectorAll('.eyebrow, h1, .lede').forEach(node => window.revealWords(node, 150));
    inactiveWrap.style.transform = `translateX(${dist * direction}px)`;

    void inactiveBg.offsetWidth;

    requestAnimationFrame(() => {
      inactiveBg.style.transition = 'transform .4s ease';
      activeBg.style.transition = 'transform .4s ease';
      inactiveWrap.style.transition = 'transform .4s ease';
      activeWrap.style.transition = 'transform .4s ease';

      activeBg.style.transform = `translateX(${-dist * direction}px)`;
      inactiveBg.style.transform = 'translateX(0px)';
      activeWrap.style.transform = `translateX(${-dist * direction}px)`;
      inactiveWrap.style.transform = 'translateX(0px)';
    });

    setTimeout(() => {
      [activeBg, inactiveBg] = [inactiveBg, activeBg];
      [activeWrap, inactiveWrap] = [inactiveWrap, activeWrap];
      animating = false;
      preloadNext();
    }, 400);

    dots.forEach((d, idx) => {
      const on = idx === heroIndex;
      d.classList.toggle('active', on);
      if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
    return true;
  }

  // ---- Auto-advance: every 7s; paused on hover, by the pause button, or by prefers-reduced-motion ----
  const INTERVAL = 7000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let auto = null;
  let hovering = false;
  let userPaused = reducedMotion.matches;

  function stopAuto() { clearInterval(auto); auto = null; }
  function startAuto() {
    stopAuto();
    if (userPaused || hovering) return;
    auto = setInterval(() => showHero(heroIndex + 1, 1), INTERVAL);
  }
  const restartAuto = startAuto;

  const iconPause = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  const iconPlay = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="7 5 19 12 7 19"/></svg>';
  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.id = 'heroPause';
  function syncPauseBtn() {
    pauseBtn.innerHTML = userPaused ? iconPlay : iconPause;
    pauseBtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
    pauseBtn.setAttribute('aria-pressed', userPaused);
  }
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    syncPauseBtn();
    startAuto();
  });
  heroDots.appendChild(pauseBtn);
  syncPauseBtn();

  reducedMotion.addEventListener?.('change', e => {
    userPaused = e.matches;
    syncPauseBtn();
    startAuto();
  });

  ['pointerenter', 'focus'].forEach(ev => document.getElementById('heroPrev').addEventListener(ev, () => preloadSlide(heroIndex - 1)));
  document.getElementById('heroPrev').addEventListener('click', () => { if (showHero(heroIndex - 1, -1)) restartAuto(); });
  document.getElementById('heroNext').addEventListener('click', () => { if (showHero(heroIndex + 1, 1)) restartAuto(); });

  heroSection.addEventListener('mouseenter', () => { hovering = true; stopAuto(); });
  heroSection.addEventListener('mouseleave', () => { hovering = false; startAuto(); });

  startAuto();
});