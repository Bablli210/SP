/**
 * Arriving at the work index by a page transition.
 *
 * The router captures the incoming page as soon as it is swapped in, before
 * page scripts run, so the index is put in its starting state on the incoming
 * document: the remembered view, the URL's filter, and only the cover that has
 * a partner on the page being left (a case hero, a ring plate) keeps its
 * shared-element name. The index then arrives settled, so that cover rests in
 * place while it morphs. A history step back arrives settled too.
 *
 * The partner is picked before the swap (only the page being left can say what
 * it shows), but the decision to morph is made after it: once the router has
 * put the page at its final scroll (the top for a new visit, the old place for
 * a step back) and before the new state is captured. A cover that will not be
 * mostly on screen there loses its name, so the hero never dives off the
 * screen after a cover further down; it fades where it is instead.
 *
 * It also notes where each page change comes from and how, so the index can
 * hand keyboard focus back to the project a visitor closed (controller.ts).
 *
 * Importing this module registers the listeners once; they outlive page swaps.
 * It must be loaded before the navigation starts to take effect (controller.ts
 * loads it with the index; a site-wide import covers first visits).
 */
import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from 'astro:transitions/client';
import { applyInitial } from './state';

export const trimPath = (p: string) => p.replace(/\/+$/, '');
export const pathOf = (item: HTMLElement) =>
  trimPath(new URL(item.querySelector('a')?.getAttribute('href') ?? '', location.href).pathname);
export const coverOf = (item: HTMLElement) => item.querySelector<HTMLElement>('.media');
export const gridItems = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-panel="grid"] [data-item]'));

/**
 * How much of an element shows between the fixed header and the bottom of the
 * screen, as a share of its height (0 to 1).
 */
export function shownShare(el: Element): number {
  const r = el.getBoundingClientRect();
  if (r.height <= 0) return 0;
  const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
  const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, headerH);
  return Math.max(0, seen) / r.height;
}

/** Name the kept cover (its stylesheet name applies) and switch every other one off. */
export function nameOnly(items: HTMLElement[], keep: HTMLElement | null) {
  for (const item of items) {
    const media = coverOf(item);
    if (!media) continue;
    if (item === keep) media.style.removeProperty('view-transition-name');
    else media.style.setProperty('view-transition-name', 'none');
  }
}

/** Shared-element names shown on the page being left (its old state is already captured). */
function namesShown(): Set<string> {
  const names = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>('[data-astro-transition-scope], [style*="view-transition-name"]')) {
    const name = getComputedStyle(el).getPropertyValue('view-transition-name');
    if (!name || name === 'none') continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue;
    names.add(name);
  }
  return names;
}

/* ---------- where the latest page change came from ---------- */

export type Arrival = {
  /** Path of the page left, without a trailing slash. */
  from: string;
  type: TransitionBeforePreparationEvent['navigationType'];
};

let arrival: Arrival | null = null;

document.addEventListener('astro:before-preparation', (ev) => {
  const e = ev as TransitionBeforePreparationEvent;
  arrival = { from: trimPath(e.from.pathname), type: e.navigationType };
});

/** The page change that brought this page in, read once (null on a fresh load). */
export function takeArrival(): Arrival | null {
  const a = arrival;
  arrival = null;
  return a;
}

/* ---------- the incoming index ---------- */

/** Set before the swap, decided after it. */
let pending: { root: HTMLElement; items: HTMLElement[]; keep: HTMLElement; traverse: boolean } | null = null;

document.addEventListener('astro:before-swap', (ev) => {
  const e = ev as TransitionBeforeSwapEvent;
  pending = null;
  const root = e.newDocument.querySelector<HTMLElement>('[data-work]');
  if (!root) return;
  const { view } = applyInitial(root, new URL(e.to));
  const items = gridItems(root);
  const shown = view === 'grid' ? namesShown() : new Set<string>();
  const keep = items.find((it) => !it.hidden && shown.has(it.dataset.plate ?? '')) ?? null;
  nameOnly(items, keep);
  const traverse = e.navigationType === 'traverse';
  // Settled from the first frame: the kept cover rests where the morph lands (confirmed below).
  if (keep || traverse) root.classList.add('is-settled');
  if (keep) pending = { root, items, keep, traverse };
});

document.addEventListener('astro:after-swap', () => {
  const p = pending;
  pending = null;
  if (!p || !p.root.isConnected) return;
  const media = coverOf(p.keep);
  // Mostly on screen, as the case asks of its hero before handing it back.
  if (media && shownShare(media) >= 0.5) return;
  nameOnly(p.items, null);
  // Nothing morphs: a new visit arrives like any other, with its reveal; a step back stays put.
  if (!p.traverse) p.root.classList.remove('is-settled');
});
