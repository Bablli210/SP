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
 * Importing this module registers the listener once; it outlives page swaps.
 * It must be loaded before the navigation starts to take effect (controller.ts
 * loads it with the index; a site-wide import covers first visits).
 */
import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { applyInitial } from './state';

export const trimPath = (p: string) => p.replace(/\/+$/, '');
export const pathOf = (item: HTMLElement) =>
  trimPath(new URL(item.querySelector('a')?.getAttribute('href') ?? '', location.href).pathname);
export const coverOf = (item: HTMLElement) => item.querySelector<HTMLElement>('.media');
export const gridItems = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-panel="grid"] [data-item]'));

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

document.addEventListener('astro:before-swap', (ev) => {
  const e = ev as TransitionBeforeSwapEvent;
  const root = e.newDocument.querySelector<HTMLElement>('[data-work]');
  if (!root) return;
  const { view } = applyInitial(root, new URL(e.to));
  const items = gridItems(root);
  const shown = view === 'grid' ? namesShown() : new Set<string>();
  const keep = items.find((it) => !it.hidden && shown.has(it.dataset.plate ?? '')) ?? null;
  nameOnly(items, keep);
  if (keep || e.navigationType === 'traverse') root.classList.add('is-settled');
});
