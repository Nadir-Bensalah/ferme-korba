/**
 * Petits effets des pages vitrine, sans bibliothèque :
 * - [data-draw] : une ligne SVG qui se dessine quand elle entre à l'écran ;
 * - [data-count] : un chiffre qui compte de 0 à sa valeur au premier passage.
 * Sans JS, tout est déjà affiché. Relancé à chaque changement de page.
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el: HTMLElement) {
  const raw = el.dataset.count ?? '';
  const m = raw.match(/^(\d[\d\s]*)(.*)$/);
  if (!m) return;
  const target = Number((m[1] ?? '').replace(/\s/g, ''));
  const suffix = m[2] ?? '';
  const fmt = new Intl.NumberFormat(document.documentElement.lang || 'fr', { useGrouping: false });
  if (!Number.isFinite(target) || target === 0 || reduced()) {
    el.textContent = raw;
    return;
  }
  const duration = Math.min(1800, 700 + target * 0.6);
  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(2, -10 * p);
    el.textContent = fmt.format(Math.round(target * (p === 1 ? 1 : eased))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = raw;
  };
  requestAnimationFrame(tick);
}

function arm() {
  const draws = Array.from(document.querySelectorAll<HTMLElement>('[data-draw]:not(.is-in)'));
  const counts = Array.from(document.querySelectorAll<HTMLElement>('[data-count]:not([data-counted])'));
  if (!draws.length && !counts.length) return;
  if (!('IntersectionObserver' in window)) {
    draws.forEach((e) => e.classList.add('is-in'));
    counts.forEach((e) => (e.dataset.counted = '1'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        if (el.dataset.draw !== undefined) el.classList.add('is-in');
        if (el.dataset.count !== undefined && !el.dataset.counted) {
          el.dataset.counted = '1';
          countUp(el);
        }
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.2 },
  );
  draws.forEach((e) => io.observe(e));
  counts.forEach((e) => io.observe(e));
}

arm();
document.addEventListener('astro:page-load', arm);
