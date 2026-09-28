/**
 * Warm a case study's hero before the page transition captures it, so the
 * cover that morphs into it never lands on an empty frame.
 *
 * Importing this module installs one listener for the whole visit: whenever a
 * navigation heads for a case page, the router's loader is wrapped so that,
 * once the new page's HTML is in, its hero image is fetched and decoded (up to
 * a short cap) before the transition starts. Once decoded in this document,
 * the swapped-in <img> is complete the moment it is inserted.
 *
 * Only pages whose scripts import it can warm the first case they open; see
 * the report's shared request (motion.ts, which every page loads).
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { reducedMotion } from '../../scripts/motion';

export const CASE_PATH = /^\/work\/[^/]+\/?$/;

/** Fetch and decode the hero of a case document (parsed, not yet swapped in). */
export async function warmCaseHero(doc: Document, cap = 450): Promise<void> {
  const img = doc.querySelector<HTMLImageElement>('[data-case-hero] img');
  if (!img) return;
  const pre = new Image();
  const sizes = img.getAttribute('sizes');
  const srcset = img.getAttribute('srcset');
  const src = img.getAttribute('src');
  if (sizes) pre.sizes = sizes;
  if (srcset) pre.srcset = srcset;
  if (src) pre.src = src;
  await Promise.race([pre.decode().catch(() => {}), new Promise((r) => window.setTimeout(r, cap))]);
}

const FLAG = '__spCaseWarm';
const w = window as unknown as Record<string, boolean | undefined>;

// Once per visit, however many bundles include this module.
if (!w[FLAG]) {
  w[FLAG] = true;
  document.addEventListener('astro:before-preparation', (ev) => {
    const e = ev as TransitionBeforePreparationEvent;
    if (!CASE_PATH.test(e.to.pathname) || reducedMotion()) return;
    const load = e.loader;
    e.loader = async () => {
      await load();
      if (!e.signal.aborted && !e.defaultPrevented) await warmCaseHero(e.newDocument);
    };
  });
}
