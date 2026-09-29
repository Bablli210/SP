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

/**
 * Settle Lenis where the page is now: any glide still running is dropped
 * (stop() and start() both reset it, in one task, so the page never renders
 * stopped), and it ends up running whatever stopped it before.
 */
function settleLenis() {
  if (!lenis) return;
  lenis.stop();
  lenis.start();
}

/**
 * Pages opt out of smooth scroll with <body data-smooth="off"> (e.g. the home ring).
 * Lenis is created or destroyed to match, and adopts wherever the router put the
 * page (the top, an anchor, or the restored position on Back) instead of forcing
 * the top.
 */
function syncSmooth() {
  if (document.body.dataset.smooth === 'off') stopLenis();
  else startLenis();
}

/*
 * Page changes. Lenis ignores native scrolling while it glides, so a glide left
 * running would carry on into the next page and overwrite where the router put
 * it (the top, or the position restored on Back).
 *
 * - Before the next page is fetched, freeze the old one where the visitor
 *   clicked: the old snapshot and any shared-element morph start from there.
 *   A stopped Lenis (the open menu) is left as it is.
 * - Right after the swap (the router has just scrolled), adopt that position,
 *   drop any glide started while the page was loading, restart Lenis if a
 *   component left it stopped, and measure the new page. Swapping the root
 *   attributes also strips Lenis's classes from <html>; restarting puts them back.
 */
document.addEventListener('astro:before-preparation', () => {
  if (lenis && !lenis.isStopped) settleLenis();
});

document.addEventListener('astro:after-swap', () => {
  syncSmooth();
  if (!lenis) return;
  settleLenis();
  lenis.resize();
});

type Cleanup = void | (() => void);
/**
 * Run `setup` on every page load, including after client-side navigation.
 * Return a cleanup function to remove listeners before the page is swapped.
 *
 * Setup runs once per page: the router can fire astro:page-load twice for the
 * same page (when a newer navigation overtakes one whose scripts are still
 * loading), and a second setup would leak the first one's listeners. Astro
 * replaces <body> on every swap, so the body identifies the page.
 */
export function onPage(setup: () => Cleanup) {
  let cleanup: Cleanup;
  let setUpFor: HTMLElement | null = null;
  document.addEventListener('astro:page-load', () => {
    if (setUpFor === document.body) return;
    if (typeof cleanup === 'function') cleanup();
    setUpFor = document.body;
    cleanup = setup();
  });
  document.addEventListener('astro:before-swap', () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    setUpFor = null;
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
  // The first load has no swap; later loads were synced at the swap already.
  syncSmooth();
  // Safety net: no page inherits a scroller that something left stopped.
  // (This runs before any component's setup, so a component that stops
  // Lenis on purpose still does so.)
  if (lenis?.isStopped) lenis.start();
  return setupReveals();
});

/** Linear interpolation helper for rAF-driven motion. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
