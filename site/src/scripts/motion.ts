/**
 * Motion core shared by every page.
 *
 * - Smooth scroll (Lenis) on pages that opt in, off for reduced motion.
 * - onPage(): run page setup after every navigation (Astro's ClientRouter
 *   swaps the page without a reload) and clean it up before the next swap.
 * - Scroll reveals that start from a visible state (content never waits on JS).
 */
import Lenis from 'lenis';

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;
let rafId = 0;

export function getLenis(): Lenis | null {
  return lenis;
}

function startLenis() {
  if (lenis || reducedMotion()) return;
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
  const loop = (time: number) => {
    lenis?.raf(time);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function stopLenis() {
  if (!lenis) return;
  cancelAnimationFrame(rafId);
  lenis.destroy();
  lenis = null;
}

/** Pages opt out of smooth scroll with <body data-smooth="off"> (e.g. the home ring). */
function syncSmooth() {
  if (document.body.dataset.smooth === 'off') stopLenis();
  else startLenis();
  lenis?.scrollTo(0, { immediate: true });
}

type Cleanup = void | (() => void);
/**
 * Run `setup` on every page load, including after client-side navigation.
 * Return a cleanup function to remove listeners before the page is swapped.
 */
export function onPage(setup: () => Cleanup) {
  let cleanup: Cleanup;
  document.addEventListener('astro:page-load', () => {
    cleanup = setup();
  });
  document.addEventListener('astro:before-swap', () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
  });
}

/** Elements with .reveal ease up into place as they enter the viewport. */
function setupReveals(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
  if (!els.length || reducedMotion() || !('IntersectionObserver' in window)) return () => {};
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of els) {
    // Only arm what is below the fold; anything already visible stays put.
    if (el.getBoundingClientRect().top > window.innerHeight * 0.92) {
      el.classList.add('is-armed');
      io.observe(el);
    }
  }
  return () => io.disconnect();
}

onPage(() => {
  syncSmooth();
  return setupReveals();
});

/** Linear interpolation helper for rAF-driven motion. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
