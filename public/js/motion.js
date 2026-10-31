/* Hareket yardımcıları: kaydırınca belirme, sayı sayma, kart eğme, sayfa geçişleri.
 * "Hareketi azalt" ayarı açık olan kullanıcılarda tüm animasyonlar kapanır, içerik direkt görünür.
 */
(function () {
  const SP = window.SP;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) document.documentElement.classList.add('motion');

  let io = null;
  function reveal(root = document) {
    const els = root.querySelectorAll('.rv:not(.in)');
    if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    if (!io) io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e));
    // güvenlik ağı: gözlemci hiç tetiklenmezse içerik gizli kalmasın
    setTimeout(() => els.forEach((e) => { const r = e.getBoundingClientRect(); if (r.top < innerHeight) e.classList.add('in'); }), 1800);
  }

  // Sayıyı 0'dan hedefe say (Türkçe biçimle)
  function countUp(el, to, { dur = 1400, prefix = '', suffix = '', decimals = 0, delay = 0 } = {}) {
    const fmt = (n) => prefix + n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (reduce) { el.textContent = fmt(to); return; }
    el.textContent = fmt(0);
    setTimeout(() => {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(to * e);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  }
  // Ekrana girince saymaya başla
  function countOnView(el, to, opts) {
    if (reduce || !('IntersectionObserver' in window)) return countUp(el, to, opts);
    el.textContent = (opts && opts.prefix || '') + '0' + (opts && opts.suffix || '');
    const o = new IntersectionObserver(([en]) => { if (en.isIntersecting) { countUp(el, to, opts); o.disconnect(); } }, { threshold: 0.5 });
    o.observe(el);
  }

  // Fareyle hafif 3B eğme
  function tilt(el, max = 7) {
    if (reduce || matchMedia('(hover: none)').matches) return;
    const host = el.parentElement;
    let raf = 0;
    host.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--rx', (-y * max).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (x * max).toFixed(2) + 'deg');
        el.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
      });
    });
    host.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  }

  // Başlığı kelimelere böl, sırayla yükselt
  function splitWords(el, baseDelay = 0, step = 70) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    el.setAttribute('aria-label', words.join(' '));
    words.forEach((w, i) => {
      const outer = document.createElement('span'); outer.className = 'w'; outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span'); inner.textContent = w; inner.style.animationDelay = (baseDelay + i * step) + 'ms';
      outer.appendChild(inner); el.appendChild(outer); el.appendChild(document.createTextNode(' '));
    });
    return el;
  }

  // Sayfa geçişi: destekleyen tarayıcıda View Transitions, diğerlerinde yumuşak belirme
  function transition(update) {
    if (reduce) return update();
    if (document.startViewTransition) {
      let done;
      const p = new Promise((r) => (done = r));
      document.startViewTransition(async () => { await update(); done(); });
      return p;
    }
    return update();
  }

  // Nav: kaydırınca camlaşır
  function stickyNav(nav) {
    const on = () => nav.classList.toggle('scrolled', scrollY > 24);
    addEventListener('scroll', on, { passive: true }); on();
  }

  SP.motion = { reduce, reveal, countUp, countOnView, tilt, splitWords, transition, stickyNav };
})();
