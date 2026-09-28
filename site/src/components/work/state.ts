/**
 * Work index state: which discipline and sector are selected, and the view.
 * The URL carries the filter (?d=identity, ?s=hospitality) so other pages can
 * deep-link; the chosen view is remembered per visitor.
 *
 * applyInitial() puts a work index into its starting state without motion. It
 * runs on the incoming document before the router swaps it in (so the page
 * transition captures the right view, filter and covers) and again on page
 * load. On a full load, the inline script in WorkIndex.astro flags the view
 * on <html> before the index is parsed, so the first paint is already right.
 */
export type View = 'list' | 'grid';
export type FilterState = { d: string | null; s: string | null };
export type Facts = { d: string[]; s: string };

export const VIEW_KEY = 'sp-work-view';
/** Below this the grid (single-column cards) is the default view. */
export const PHONE = '(max-width: 760px)';

export const slug = (v: string | null | undefined): string =>
  String(v ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const factsOf = (el: HTMLElement): Facts => ({
  d: (el.dataset.d ?? '').split(' ').filter(Boolean),
  s: el.dataset.s ?? '',
});

export const matches = (f: Facts, st: FilterState): boolean =>
  (!st.d || f.d.includes(st.d)) && (!st.s || slug(f.s) === slug(st.s));

/** Read the filter from a query string (slug or label, any case), keeping only values that exist. */
export function readFilter(search: string, disciplines: string[], sectors: string[]): FilterState {
  const q = new URLSearchParams(search);
  const d = slug(q.get('d'));
  const s = slug(q.get('s'));
  return {
    d: disciplines.find((v) => slug(v) === d) ?? null,
    s: sectors.find((v) => slug(v) === s) ?? null,
  };
}

/** Mirror the filter into the URL in its tidy form (?s=food-and-beverage), without a history entry. */
export function writeFilter(st: FilterState): void {
  const url = new URL(location.href);
  if (st.d) url.searchParams.set('d', slug(st.d));
  else url.searchParams.delete('d');
  if (st.s) url.searchParams.set('s', slug(st.s));
  else url.searchParams.delete('s');
  if (url.href !== location.href) history.replaceState(history.state, '', url);
}

export function loadView(): View | null {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'list' || v === 'grid' ? v : null;
  } catch {
    return null;
  }
}

export function saveView(v: View): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* private mode or blocked storage: the choice just is not remembered */
  }
}

export const defaultView = (): View => (window.matchMedia(PHONE).matches ? 'grid' : 'list');

/* ---------- painting state into a work index (any document, no motion) ---------- */

const all = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T[] =>
  Array.from(root.querySelectorAll<T>(sel));

export const chipsOf = (root: ParentNode) => all<HTMLButtonElement>(root, '[data-filter]');

export const valuesOf = (chips: HTMLElement[], kind: 'd' | 's') =>
  chips.filter((c) => c.dataset.filter === kind).map((c) => c.dataset.value ?? '');

/** One fact set per project (the list rows hold one of each). */
export const factsIn = (root: ParentNode) => all(root, '[data-panel="list"] [data-item]').map(factsOf);

/** Pressed state and facet counts: what each chip would show given the other group's choice. */
export function paintChips(chips: HTMLElement[], st: FilterState, facts: Facts[]): void {
  for (const c of chips) {
    const kind = c.dataset.filter;
    const v = c.dataset.value ?? null;
    const pressed = kind === 'all' ? !st.d && !st.s : kind === 'd' ? st.d === v : st.s === v;
    c.setAttribute('aria-pressed', String(pressed));
    const probe: FilterState = kind === 'all' ? { d: null, s: null } : kind === 'd' ? { ...st, d: v } : { ...st, s: v };
    const n = facts.filter((f) => matches(f, probe)).length;
    const nEl = c.querySelector<HTMLElement>('[data-n]');
    if (nEl) nEl.textContent = String(n);
    const srEl = c.querySelector<HTMLElement>('[data-n-sr]');
    if (srEl) srEl.textContent = `, ${n} ${n === 1 ? 'project' : 'projects'}`;
    c.toggleAttribute('data-zero', n === 0);
  }
}

export function showView(root: HTMLElement, view: View): void {
  root.dataset.view = view;
  for (const p of all(root, '[data-panel]')) p.hidden = p.dataset.panel !== view;
  for (const b of all(root, '[data-view-btn]')) b.setAttribute('aria-pressed', String(b.dataset.viewBtn === view));
}

/** Show exactly the matching items in both views, with chips, count and empty state to match. */
export function showFilter(root: HTMLElement, st: FilterState): number {
  let n = 0;
  for (const el of all(root, '[data-item]')) {
    const ok = matches(factsOf(el), st);
    el.hidden = !ok;
    if (ok && el.closest('[data-panel="list"]')) n++;
  }
  paintChips(chipsOf(root), st, factsIn(root));
  const count = root.querySelector<HTMLElement>('[data-count]');
  if (count) count.textContent = String(n);
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  if (empty) empty.hidden = n > 0;
  return n;
}

/** The starting state: the remembered (or default) view and the URL's filter. */
export function applyInitial(root: HTMLElement, url: URL): { view: View; filter: FilterState } {
  const view = loadView() ?? defaultView();
  showView(root, view);
  const chips = chipsOf(root);
  const filter = readFilter(url.search, valuesOf(chips, 'd'), valuesOf(chips, 's'));
  showFilter(root, filter);
  return { view, filter };
}
