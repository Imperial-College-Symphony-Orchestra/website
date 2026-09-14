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
  const seen = sessionStorage.getItem('icso_intro_shown');
  if (seen) {
    overlay.remove();
    return;
  }
  document.body.classList.add('intro-lock');
  const finish = () => {
    overlay.classList.add('hide');
    document.body.classList.remove('intro-lock');
    sessionStorage.setItem('icso_intro_shown', '1');
    setTimeout(() => overlay.remove(), 700);
  };
  const minTime = new Promise(r => setTimeout(r, 1650));
  const ready = new Promise(r => window.addEventListener('load', r, { once: true }));
  Promise.all([minTime, ready]).then(finish);
  setTimeout(finish, 4000);
  overlay.addEventListener('click', finish);
})();

// ---- Bottom banner: stays fixed while scrolling, slides away once the real footer is reached ----
(() => {
  const banner = document.getElementById('stickyBanner');
  const footer = document.getElementById('site-footer');
  if (!banner || !footer) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => {
      banner.classList.toggle('hide', entry.isIntersecting);
    }, { threshold: 0 });
    io.observe(footer);
  }
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

// ---- Home page: video lazy-load on scroll into view ----
document.addEventListener('DOMContentLoaded', () => {
  const watchEl = document.getElementById('watchVideo');
  if (!watchEl) return;
  const id = watchEl.dataset.videoId;
  const START = 5487;

  watchEl.innerHTML = `
    <iframe id="watchIframe" src="https://www.youtube.com/embed/${id}?enablejsapi=1&mute=1&start=${START}&rel=0" title="ICSO in concert" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    <button id="unmuteBtn" class="unmute-btn">🔇 Unmute</button>
  `;
  const iframe = document.getElementById('watchIframe');
  const unmuteBtn = document.getElementById('unmuteBtn');
  const post = (func, args = []) => iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');

  let started = false;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !started) {
        started = true;
        post('seekTo', [START, true]);
        post('playVideo');
      }
    });
  }, { threshold: 0.5 });
  observer.observe(watchEl);

  unmuteBtn.addEventListener('click', () => {
    post('unMute');
    unmuteBtn.textContent = '🔊 Sound on';
    unmuteBtn.disabled = true;
  });
});

// ---- Home page: hero carousel ----
document.addEventListener('DOMContentLoaded', () => {
  const heroSection = document.getElementById('heroCarousel');
  if (!heroSection || !window.__heroSlides) return;
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

  heroSlides.forEach((_, i) => {
    const dot = document.createElement('span');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => { if (i !== heroIndex) showHero(i, i > heroIndex ? 1 : -1); });
    heroDots.appendChild(dot);
  });

  function showHero(i, direction = 1) {
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
    }, 400);

    [...heroDots.children].forEach((d, idx) => d.classList.toggle('active', idx === heroIndex));
  }

  document.getElementById('heroPrev').addEventListener('click', () => showHero(heroIndex - 1, -1));
  document.getElementById('heroNext').addEventListener('click', () => showHero(heroIndex + 1, 1));

  // auto-advance every 7s, pausing on hover
  let auto = setInterval(() => showHero(heroIndex + 1, 1), 10000);
  heroSection.addEventListener('mouseenter', () => clearInterval(auto));
  heroSection.addEventListener('mouseleave', () => { auto = setInterval(() => showHero(heroIndex + 1, 1), 7000); });
});