/**
 * Services accordion (client).
 *
 * - One row open at a time. Rows are <button aria-expanded aria-controls>
 *   headings; arrow keys, Home and End move between them.
 * - Panel height is a CSS transition (grid rows 0fr -> 1fr). While it runs,
 *   one rAF loop keeps the clicked header still on screen (a row above it may
 *   be collapsing) and, when the opening panel would end below the fold, eases
 *   the page up in step with the panel so the work comes into view. When the
 *   reader takes over (wheel, touch, a scrolling key), the reveal stops and any
 *   row above that is still collapsing finishes at once, with the matching
 *   scroll in the same frame, so nothing under the hand moves.
 * - /services/#<key> (and later hash changes) open that row and scroll to it.
 *   The inline script in Disciplines.astro applies the arrival state (hash or
 *   remembered row) before the first paint; this module keeps it in sync.
 * - Covers lean toward the pointer on hover (lerped, one loop, stops when
 *   settled). Off for touch and for reduced motion, where every state change
 *   is instant.
 */
import { onPage, getLenis, reducedMotion, lerp } from '../../scripts/motion';

/** Space kept clear under an opened panel. */
const MARGIN = 28;
/** Field in history.state holding the open row's key (null: all closed). The inline script in Disciplines.astro reads it too. */
const STATE_KEY = 'spServicesOpen';
/** Keys that scroll the page when nothing handles them first. */
const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);
/** Cover hover: scale, and how much of the overhang the lean may use. */
const HOVER_SCALE = 1.06;
const LEAN = 0.85;

/** A CSS cubic-bezier() as a JS easing, solved by bisection (robust for any control points). */
function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (t: number, p1: number, p2: number) => {
    const u = 1 - t;
    return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
  };
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 22; i++) {
      t = (lo + hi) / 2;
      if (at(t, x1, x2) < x) lo = t;
      else hi = t;
    }
    return at(t, y1, y2);
  };
}

/** The site's easing token as a function, so the scroll moves in step with the CSS panel. */
function easeToken(name: string): (x: number) => number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const n = raw.match(/cubic-bezier\(([^)]+)\)/)?.[1].split(',').map(Number) ?? [];
  return n.length === 4 && n.every(Number.isFinite) ? bezier(n[0], n[1], n[2], n[3]) : bezier(0.7, 0, 0.2, 1);
}

function ms(value: string, fallback: number): number {
  const v = value.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith('ms') ? n : n * 1000;
}

const setScroll = (y: number) => window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });

/** Would this keydown scroll the page? (Tab, Enter and Shift never do; arrows on a header move focus instead.) */
function scrollsPage(ev: KeyboardEvent): boolean {
  if (ev.defaultPrevented || !SCROLL_KEYS.has(ev.key)) return false;
  const t = ev.target instanceof Element ? ev.target : null;
  if (t?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
  // Space presses a button; on a link or anywhere else it pages down.
  if (ev.key === ' ' && t?.closest('button, [role="button"], summary')) return false;
  return true;
}

onPage(() => {
  const acc = document.querySelector<HTMLElement>('[data-acc]');
  if (!acc) return;

  const rows = Array.from(acc.querySelectorAll<HTMLElement>('[data-row]'));
  const btns: HTMLButtonElement[] = [];
  const bodies: HTMLElement[] = [];
  for (const row of rows) {
    const btn = row.querySelector<HTMLButtonElement>('[data-btn]');
    const body = row.querySelector<HTMLElement>('[data-panel] .body');
    if (!btn || !body) return;
    btns.push(btn);
    bodies.push(body);
  }

  const offs: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };

  const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
  /** Where a row's top comes to rest under the site header: its scroll-margin, shared with deep links. */
  const restTop = () => parseFloat(getComputedStyle(rows[0]).scrollMarginTop) || headerH + 12;
  const dur = ms(getComputedStyle(acc).getPropertyValue('--acc-dur'), 850);
  const ease = easeToken('--ease');

  // ---------- state ----------
  const isOpen = (i: number) => rows[i].classList.contains('is-open');

  /** Start loading a row's covers (they are lazy and sit in a closed, zero-height panel). */
  const wake = (i: number) => {
    rows[i].querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
      img.loading = 'eager';
    });
  };

  const setOpen = (i: number, open: boolean) => {
    rows[i].classList.toggle('is-open', open);
    btns[i].setAttribute('aria-expanded', String(open));
    if (open) wake(i);
  };

  /**
   * Keep the open row in this history entry (alongside the router's own scroll
   * position), so coming back from a case study restores the same row at the
   * same place instead of the default layout under a stale scroll offset.
   */
  const remember = (key: string | null) => {
    const st: unknown = history.state;
    if (st && typeof st === 'object') history.replaceState({ ...st, [STATE_KEY]: key }, '');
  };

  /** Apply a state change with every transition switched off, then settle layout. */
  const instant = (fn: () => void) => {
    acc.setAttribute('data-instant', '');
    fn();
    void acc.offsetHeight;
    acc.removeAttribute('data-instant');
  };

  /** Rendered height of everything in the list above row i (transforms do not affect it). */
  const heightAbove = (i: number) => {
    let h = 0;
    for (let k = 0; k < i; k++) h += rows[k].getBoundingClientRect().height;
    return h;
  };

  // ---------- the glide: scroll that follows the panels ----------
  let glideRaf = 0;
  let glideOff: (() => void) | null = null;

  const stopGlide = () => {
    if (glideRaf) cancelAnimationFrame(glideRaf);
    glideRaf = 0;
    glideOff?.();
    glideOff = null;
  };

  const glide = (i: number, before: number, s0: number, reveal: number) => {
    stopGlide();
    // Drop any smooth-scroll inertia so it cannot pull against the loop.
    const lenis = getLenis();
    if (lenis) {
      lenis.stop();
      lenis.start();
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      const y = s0 + (heightAbove(i) - before) + reveal * ease(Math.min(1, t / dur));
      if (Math.abs(y - window.scrollY) > 0.5) setScroll(y);
      if (t < dur + 80) {
        glideRaf = requestAnimationFrame(tick);
      } else {
        stopGlide();
        getLenis()?.resize();
      }
    };
    glideRaf = requestAnimationFrame(tick);

    /*
     * The hand wins, without anything jumping under it. The reveal stops where
     * it is; rows above still collapsing finish now, and the scroll moves by
     * exactly the height they gave up in the same frame, so the header stays
     * put. The opening panel below keeps its own transition.
     */
    const handBack = () => {
      stopGlide();
      // Read before the collapse: a shorter page may clamp scrollY on the way.
      const y = window.scrollY;
      const a = heightAbove(i);
      const closing = rows.slice(0, i).filter((_, k) => !isOpen(k));
      closing.forEach((r) => r.setAttribute('data-instant', ''));
      void acc.offsetHeight;
      const shift = heightAbove(i) - a;
      if (Math.abs(shift) > 0.5 || window.scrollY !== y) setScroll(y + shift);
      closing.forEach((r) => r.removeAttribute('data-instant'));
      // Smooth scroll picks up from the corrected position (its wheel handler runs after this one).
      getLenis()?.resize();
    };
    const onKey = (e: Event) => {
      if (scrollsPage(e as KeyboardEvent)) handBack();
    };
    // Capture, so wheel and touch are handled before the smooth scroller reads them.
    const early: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('wheel', handBack, early);
    window.addEventListener('touchstart', handBack, early);
    // Bubble, so a key the accordion already used (arrows between headers) is seen as handled.
    window.addEventListener('keydown', onKey);
    glideOff = () => {
      window.removeEventListener('wheel', handBack, early);
      window.removeEventListener('touchstart', handBack, early);
      window.removeEventListener('keydown', onKey);
    };
  };

  const toggle = (i: number) => {
    acc.classList.add('is-settled');
    const opening = !isOpen(i);
    const s0 = window.scrollY;
    const before = heightAbove(i);

    // Measured before anything moves. The header is held where it is, so its top now is its top then.
    let reveal = 0;
    if (opening) {
      const head = btns[i].getBoundingClientRect();
      const bottom = head.bottom + bodies[i].getBoundingClientRect().height;
      const need = bottom + MARGIN - window.innerHeight;
      const room = head.top - restTop();
      reveal = Math.max(0, Math.min(need, room));
    }

    const apply = () => {
      rows.forEach((_, k) => setOpen(k, k === i ? opening : false));
      remember(opening ? rows[i].id : null);
    };

    if (reducedMotion()) {
      stopGlide();
      instant(apply);
      setScroll(s0 + (heightAbove(i) - before) + reveal);
      getLenis()?.resize();
      return;
    }

    // Anything above still taking up height (open, or closing from an earlier click) will move this header.
    const shifting = rows.slice(0, i).some((r) => r.querySelector('[data-panel]')!.getBoundingClientRect().height > 0.5);
    apply();
    if (shifting || reveal > 0) glide(i, before, s0, reveal);
  };

  btns.forEach((btn, i) => {
    listen(btn, 'click', () => toggle(i));
    listen(btn, 'pointerenter', () => wake(i));
    listen(btn, 'focus', () => wake(i));
  });

  // Arrow keys, Home and End move between the headers.
  listen(acc, 'keydown', (e) => {
    const ev = e as KeyboardEvent;
    const i = btns.indexOf(ev.target as HTMLButtonElement);
    if (i < 0 || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const n = btns.length;
    const to =
      ev.key === 'ArrowDown' ? (i + 1) % n : ev.key === 'ArrowUp' ? (i - 1 + n) % n : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    ev.preventDefault();
    btns[to].focus();
  });

  // ---------- deep links ----------
  const rowFromHash = () => {
    if (location.hash.length < 2) return -1;
    try {
      const key = decodeURIComponent(location.hash.slice(1));
      return rows.findIndex((r) => r.id === key);
    } catch {
      return -1;
    }
  };

  const jumpTo = (i: number) => {
    const margin = parseFloat(getComputedStyle(rows[i]).scrollMarginTop) || 0;
    setScroll(rows[i].getBoundingClientRect().top + window.scrollY - margin);
    getLenis()?.resize();
  };

  const fromHash = (arriving: boolean) => {
    const i = rowFromHash();
    if (i < 0) return;
    stopGlide();
    if (!isOpen(i)) {
      if (!arriving) acc.classList.add('is-settled');
      instant(() => rows.forEach((_, k) => setOpen(k, k === i)));
    }
    if (!arriving) remember(rows[i].id);
    jumpTo(i);
  };

  /** Back, forward or reload onto an entry that remembers a row: reopen it and put the page back where it was. */
  const fromHistory = () => {
    const st: unknown = history.state;
    if (!st || typeof st !== 'object' || !(STATE_KEY in st)) return false;
    const { [STATE_KEY]: key, scrollY: y } = st as Record<string, unknown>;
    const i = typeof key === 'string' ? rows.findIndex((r) => r.id === key) : -1;
    instant(() => rows.forEach((_, k) => setOpen(k, k === i)));
    if (typeof y === 'number') {
      setScroll(y);
      getLenis()?.resize();
    }
    return true;
  };

  // Arrival: the inline script has already opened a deep-linked row; motion.ts has just reset the scroll.
  if (!fromHistory()) fromHash(true);
  // Record the arrival state too, so a later traversal back to this entry has something to restore.
  const openNow = rows.findIndex((r) => r.classList.contains('is-open'));
  remember(openNow >= 0 ? rows[openNow].id : null);

  // Later, on this page: a typed hash, back/forward between entries of this page, or a same-page
  // hash link (the router moves to those itself without firing hashchange).
  // A traversal restores what that entry remembers; a new hash opens its row.
  const path = location.pathname;
  const here = () => location.pathname === path;
  let poppedAt = -1;
  let navTimer = 0;
  listen(window, 'popstate', () => {
    if (!here()) return;
    poppedAt = performance.now();
    if (!fromHistory()) fromHash(false);
  });
  listen(window, 'hashchange', () => {
    // A traversal fires popstate then hashchange; the entry's own state has already been applied.
    if (here() && performance.now() - poppedAt > 100) fromHash(false);
  });
  listen(document, 'click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href*="#"]');
    if (!(a instanceof HTMLAnchorElement) || a.origin !== location.origin || a.pathname !== path) return;
    window.clearTimeout(navTimer);
    navTimer = window.setTimeout(() => here() && fromHash(false), 0);
  });
  offs.push(() => window.clearTimeout(navTimer));

  // ---------- covers: fade in as they load, warm the rest once the page is idle ----------
  const imgs = Array.from(acc.querySelectorAll<HTMLImageElement>('[data-card] img'));
  for (const img of imgs) {
    const done = () => img.classList.add('is-loaded');
    if (img.complete) done();
    else {
      listen(img, 'load', done, { once: true });
      listen(img, 'error', done, { once: true });
    }
  }
  acc.classList.add('is-ready');

  const warmAll = () => rows.forEach((_, i) => wake(i));
  let idleId = 0;
  let timeoutId = 0;
  if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(warmAll, { timeout: 4000 });
  else timeoutId = window.setTimeout(warmAll, 2000);

  // ---------- covers lean toward the pointer ----------
  type Lean = { img: HTMLElement; x: number; y: number; s: number; tx: number; ty: number; ts: number };
  const leans = new Map<HTMLElement, Lean>();
  let leanRaf = 0;
  let last = 0;

  const leanTick = (now: number) => {
    const dt = Math.min(64, last ? now - last : 16.7);
    last = now;
    const k = 1 - Math.pow(1 - 0.1, dt / 16.7);
    let moving = false;
    for (const [card, l] of leans) {
      l.x = lerp(l.x, l.tx, k);
      l.y = lerp(l.y, l.ty, k);
      l.s = lerp(l.s, l.ts, k);
      const settled = Math.abs(l.x - l.tx) < 0.002 && Math.abs(l.y - l.ty) < 0.002 && Math.abs(l.s - l.ts) < 0.0005;
      if (settled) {
        l.x = l.tx;
        l.y = l.ty;
        l.s = l.ts;
      } else moving = true;
      if (settled && l.ts === 1 && l.tx === 0 && l.ty === 0) {
        l.img.style.transform = '';
        leans.delete(card);
        continue;
      }
      // The lean never exceeds the overhang the scale creates, so no edge ever shows.
      const room = ((l.s - 1) / 2) * 100 * LEAN;
      l.img.style.transform = `translate3d(${(l.x * room).toFixed(3)}%, ${(l.y * room).toFixed(3)}%, 0) scale(${l.s.toFixed(4)})`;
    }
    if (moving) leanRaf = requestAnimationFrame(leanTick);
    else {
      leanRaf = 0;
      last = 0;
    }
  };

  const runLean = () => {
    if (!leanRaf) leanRaf = requestAnimationFrame(leanTick);
  };

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reducedMotion()) {
    acc.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
      const img = card.querySelector<HTMLElement>('.media img');
      if (!img) return;
      const aim = (e: Event) => {
        const ev = e as PointerEvent;
        if (ev.pointerType !== 'mouse') return;
        const r = card.querySelector('.media')!.getBoundingClientRect();
        let l = leans.get(card);
        if (!l) {
          l = { img, x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1 };
          leans.set(card, l);
        }
        l.ts = HOVER_SCALE;
        l.tx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width - 0.5) * 2));
        l.ty = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height - 0.5) * 2));
        runLean();
      };
      const release = () => {
        const l = leans.get(card);
        if (!l) return;
        l.tx = 0;
        l.ty = 0;
        l.ts = 1;
        runLean();
      };
      listen(card, 'pointerenter', aim);
      listen(card, 'pointermove', aim);
      listen(card, 'pointerleave', release);
    });
  }

  return () => {
    stopGlide();
    if (leanRaf) cancelAnimationFrame(leanRaf);
    leanRaf = 0;
    for (const l of leans.values()) l.img.style.transform = '';
    leans.clear();
    if (idleId && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
    if (timeoutId) window.clearTimeout(timeoutId);
    offs.forEach((off) => off());
  };
});
