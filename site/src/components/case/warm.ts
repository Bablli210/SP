/**
 * Warm a case study's hero before the page transition captures it, so the
 * cover that morphs into it lands on the image, not on an empty frame.
 *
 * Base.astro imports this on every page, and it is the only warm-up: every
 * navigation into a case (from the ring, the work index, a Next band, a
 * services card...) comes through this one listener, so page scripts leave
 * the router's loader alone. Once the new page's HTML is in, its hero image
 * is fetched and decoded; once decoded in this document, the swapped-in <img>
 * is complete the moment it is inserted.
 *
 * The page holds still while this waits, so the wait is capped, and the cap
 * is a budget counted from the start of the navigation, not from the HTML's
 * arrival: a slow page fetch is never followed by a second full wait. A slow
 * network costs the morph a frame, not the visitor a pause. Past the budget
 * the transition starts anyway: the travelling cover stays solid while the
 * hero fades in over it through the second half of the morph ([slug].astro),
 * and that incoming view is live, so an image that lands during the morph
 * still shows.
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { reducedMotion } from '../../scripts/motion';

const CASE_PATH = /^\/work\/[^/]+\/?$/;
/** The longest a click into a case waits for the hero, HTML fetch included (ms). */
const BUDGET = 300;

/** Start fetching and decoding the hero of a case document (parsed, not yet swapped in). */
function decodeHero(doc: Document): Promise<void> | null {
  const img = doc.querySelector<HTMLImageElement>('[data-case-hero] img');
  if (!img) return null;
  const pre = new Image();
  pre.fetchPriority = 'high';
  const sizes = img.getAttribute('sizes');
  const srcset = img.getAttribute('srcset');
  const src = img.getAttribute('src');
  if (sizes) pre.sizes = sizes;
  if (srcset) pre.srcset = srcset;
  if (src) pre.src = src;
  return pre.decode().catch(() => {});
}

document.addEventListener('astro:before-preparation', (ev) => {
  const e = ev as TransitionBeforePreparationEvent;
  // Reduced motion: nothing morphs, so nothing to wait for.
  if (!CASE_PATH.test(e.to.pathname) || reducedMotion()) return;
  const start = performance.now();
  const load = e.loader;
  e.loader = async () => {
    await load();
    if (e.signal.aborted || e.defaultPrevented) return;
    const decoded = decodeHero(e.newDocument);
    const left = BUDGET - (performance.now() - start);
    // Out of budget: the fetch is under way; the morph starts now and the image shows when it lands.
    if (!decoded || left <= 0) return;
    let timer = 0;
    await Promise.race([decoded, new Promise<void>((r) => (timer = window.setTimeout(r, left)))]);
    window.clearTimeout(timer);
  };
});
