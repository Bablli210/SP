/**
 * The cover that follows the cursor over the list view.
 * One rAF loop: it lerps toward the pointer, leans with the speed it trails
 * by, and stops as soon as it has settled. Keyboard focus places it beside
 * the focused row. Reduced motion: it sits at the pointer with no lag or lean.
 */
import { reducedMotion, clamp } from '../../scripts/motion';

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
  const frames = new Map<string, HTMLElement>();
  el.querySelectorAll<HTMLElement>('[data-peek-id]').forEach((f) => frames.set(f.dataset.peekId ?? '', f));

  let enabled = true;
  let shown = false;
  let active: string | null = null;
  let named: HTMLElement | null = null;
  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  let rot = 0;
  let raf = 0;
  let last = 0;
  let px = -1;
  let py = -1;
  let w = 0;
  let h = 0;
  let headerH = 72;

  const measure = () => {
    w = el.offsetWidth;
    h = el.offsetHeight;
    headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
  };
  measure();

  const write = () => {
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg)`;
  };

  /**
   * Aim beside the pointer, but never over the hovered name: the cover keeps
   * clear of it and swings to the pointer's other side near the right edge.
   */
  const aimAtPointer = (row: HTMLElement) => {
    const gap = 28;
    const vw = document.documentElement.clientWidth;
    const name = row.querySelector<HTMLElement>('.c-name');
    const clear = name ? name.getBoundingClientRect().right + gap : 0;
    tx = Math.max(px + gap, clear);
    if (tx + w > vw - 16) tx = px - gap - w;
    ty = clamp(py - h / 2, headerH + 8, window.innerHeight - h - 16);
  };

  const aimAtRow = (row: HTMLElement) => {
    const r = row.getBoundingClientRect();
    const name = row.querySelector<HTMLElement>('.c-name');
    tx = Math.min((name?.getBoundingClientRect().right ?? r.left) + 28, r.right - w - 16);
    ty = clamp(r.top + r.height / 2 - h / 2, headerH + 8, window.innerHeight - h - 16);
  };

  const tick = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    if (reduce) {
      x = tx;
      y = ty;
      rot = 0;
    } else {
      const k = 1 - Math.pow(1 - 0.14, dt / 16.667);
      x += (tx - x) * k;
      y += (ty - y) * k;
      const lean = clamp((tx - x) * 0.035, -7, 7);
      rot += (lean - rot) * Math.min(1, k * 1.6);
    }
    const settled = Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1 && Math.abs(rot) < 0.01;
    if (settled) {
      x = tx;
      y = ty;
      rot = 0;
    }
    write();
    raf = settled ? 0 : requestAnimationFrame(tick);
  };

  const kick = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
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
      // Arrive at the target with a short rise instead of flying in from afar.
      x = tx;
      y = ty + (reduce ? 0 : 24);
      rot = 0;
      el.classList.add('is-on');
    }
    kick();
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
    aimAtPointer(row);
    show(row.dataset.id ?? '');
  };

  // Rows slide under a still pointer while the page scrolls: re-check what is under it.
  const onScroll = () => {
    if (px < 0 || !enabled) return;
    const row = rowAt(document.elementFromPoint(px, py));
    if (!row) return hide();
    aimAtPointer(row);
    show(row.dataset.id ?? '');
  };

  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) hide();
  };

  const onFocusIn = (e: FocusEvent) => {
    const row = rowAt(e.target);
    if (!row || !row.matches(':focus-visible')) return;
    aimAtRow(row);
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
      cancelAnimationFrame(raf);
      raf = 0;
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
