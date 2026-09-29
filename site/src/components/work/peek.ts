/**
 * The cover that follows the cursor over the list view. Placement and motion
 * are shared with the home Index (src/scripts/preview-follow.ts): beside the
 * pointer, never over the hovered name, below the header, one rAF loop that
 * lerps, leans and stops once settled. Keyboard focus places it after the
 * focused row's name, just below the row (or above it near the bottom), so
 * the row's focus ring stays clear. Reduced motion: no lag, lean or rise.
 */
import { headerHeight, reducedMotion } from '../../scripts/motion';
import { aimAtPointer, aimAtRow, follower, type PreviewBox } from '../../scripts/preview-follow';

export interface Peek {
  /** The list view is showing (the peek only works there). */
  setEnabled(on: boolean): void;
  destroy(): void;
}

export function setupPeek(root: HTMLElement, list: HTMLElement): Peek | null {
  const el = root.querySelector<HTMLElement>('[data-peek]');
  if (!el) return null;

  const fine = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
  const reduce = reducedMotion();
  const f = follower(el, reduce);
  const frames = new Map<string, HTMLElement>();
  el.querySelectorAll<HTMLElement>('[data-peek-id]').forEach((fr) => frames.set(fr.dataset.peekId ?? '', fr));

  let enabled = true;
  let shown = false;
  let active: string | null = null;
  let named: HTMLElement | null = null;
  let px = -1;
  let py = -1;
  let box: PreviewBox = { w: 0, h: 0, top: 80 };

  const measure = () => {
    box = { w: el.offsetWidth, h: el.offsetHeight, top: headerHeight() + 8 };
  };
  measure();

  /** How far a hovered name slides over (var(--nudge) in WorkList.astro), px. */
  const shiftOf = (name: HTMLElement) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--nudge').trim();
    const n = parseFloat(v) || 0;
    return v.endsWith('em') ? n * parseFloat(getComputedStyle(name).fontSize) : n;
  };

  /**
   * Right edge of a row's name where it comes to rest: its layout box, plus
   * the slide when hovered. (Its drawn box would lag while the slide runs.)
   */
  const nameRight = (row: HTMLElement, hovered: boolean) => {
    const name = row.querySelector<HTMLElement>('.c-name');
    const parent = name?.offsetParent;
    if (!name || !parent) return 0;
    const left = parent.getBoundingClientRect().left + parent.clientLeft;
    return left + name.offsetLeft + name.offsetWidth + (hovered ? shiftOf(name) : 0);
  };

  const toPointer = (row: HTMLElement) => {
    if (!box.w) measure();
    f.to(aimAtPointer(px, py, nameRight(row, true), box), !shown);
  };

  const toRow = (row: HTMLElement) => {
    if (!box.w) measure();
    f.to(aimAtRow(row.getBoundingClientRect(), nameRight(row, false), box), !shown);
  };

  const clearName = () => {
    if (named) named.style.removeProperty('view-transition-name');
    named = null;
  };

  const show = (id: string) => {
    if (!enabled || !fine.matches) return;
    if (id !== active) {
      if (active) frames.get(active)?.classList.remove('is-active');
      frames.get(id)?.classList.add('is-active');
      active = id;
    }
    if (!shown) {
      shown = true;
      el.classList.add('is-on');
    }
  };

  const hide = () => {
    if (!shown) return;
    shown = false;
    el.classList.remove('is-on');
    clearName();
  };

  const rowAt = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null;
    const row = target.closest<HTMLElement>('[data-row]');
    return row && list.contains(row) && !list.hidden ? row : null;
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    px = e.clientX;
    py = e.clientY;
    const row = rowAt(e.target);
    if (!row) return hide();
    if (!enabled || !fine.matches) return;
    toPointer(row);
    show(row.dataset.id ?? '');
  };

  // Rows slide under a still pointer while the page scrolls: re-check what is under it.
  const onScroll = () => {
    if (px < 0 || !enabled) return;
    const row = rowAt(document.elementFromPoint(px, py));
    if (!row) return hide();
    if (!fine.matches) return;
    toPointer(row);
    show(row.dataset.id ?? '');
  };

  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) hide();
  };

  const onFocusIn = (e: FocusEvent) => {
    const row = rowAt(e.target);
    if (!row || !row.matches(':focus-visible')) return;
    if (!enabled || !fine.matches) return;
    toRow(row);
    show(row.dataset.id ?? '');
  };

  const onFocusOut = (e: FocusEvent) => {
    if (!rowAt(e.relatedTarget)) hide();
  };

  // Following a row: the floating cover becomes the shared element that morphs into the case hero.
  const onClick = (e: MouseEvent) => {
    const row = rowAt(e.target);
    if (!row || !shown || row.dataset.id !== active) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const frame = frames.get(active);
    const media = frame?.querySelector<HTMLElement>('.media');
    if (!frame || !media || !frame.dataset.plate) return;
    clearName();
    media.style.setProperty('view-transition-name', frame.dataset.plate);
    named = media;
  };

  const onFine = () => {
    if (!fine.matches) hide();
    measure();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure);
  document.addEventListener('mouseout', onOut);
  list.addEventListener('focusin', onFocusIn);
  list.addEventListener('focusout', onFocusOut);
  list.addEventListener('click', onClick);
  fine.addEventListener('change', onFine);

  return {
    setEnabled(on: boolean) {
      enabled = on;
      if (!on) hide();
    },
    destroy() {
      f.stop();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      document.removeEventListener('mouseout', onOut);
      list.removeEventListener('focusin', onFocusIn);
      list.removeEventListener('focusout', onFocusOut);
      list.removeEventListener('click', onClick);
      fine.removeEventListener('change', onFine);
    },
  };
}
