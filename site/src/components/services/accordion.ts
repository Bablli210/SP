/**
 * Services accordion (client).
 *
 * - One row open at a time. Rows are <button aria-expanded aria-controls>
 *   headings; arrow keys, Home and End move between them.
 * - A toggle changes the layout once: panel heights snap (Disciplines.astro
 *   never animates them). Then every block of the page glides from where it
 *   was on screen to its new place, transform only (FLIP): the page head above
 *   the list, the rows, and everything after the list (its end block, the
 *   footer). Rows are opaque and stacked in order, so the rows below slide off
 *   an opening panel and over a closing one.
 * - The clicked header holds still: one scroll correction in the same frame,
 *   so a row collapsing above it slides the rows and page head above it down
 *   instead. When the opened panel would end below the fold, the page then
 *   eases up through the smooth scroller so the work comes into view; a wheel,
 *   a press or a scrolling key takes over from it where it is.
 * - An open answers a press, so it starts at once (--acc-press); a close keeps
 *   --ease. Nothing reads layout while anything moves.
 * - /services/#<key> (and later hash changes) open that row and scroll to it.
 *   The inline script in Disciplines.astro applies the arrival state (hash or
 *   remembered row) before the first paint; this module keeps it in sync.
 * - Covers lean toward the pointer on hover (lerped, one loop, stops when
 *   settled). Off for touch and for reduced motion, where every state change
 *   is instant.
 */
import { onPage, getLenis, reducedMotion, lerp, clamp } from '../../scripts/motion';

/** Space kept clear under an opened panel. */
const MARGIN = 28;
/** Field in history.state holding the open row's key (null: all closed). The inline script in Disciplines.astro reads it too. */
const STATE_KEY = 'spServicesOpen';
/** Marks the reveal scroll in Lenis's userData, so a key only ever stops the scroll this module started. */
const REVEAL = 'spServicesReveal';
/** Keys that scroll the page when nothing handles them first. */
const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);
/** Cover hover: scale, and how much of the overhang the lean may use. */
const HOVER_SCALE = 1.06;
const LEAN = 0.85;

type Curve = [number, number, number, number];

/** A CSS cubic-bezier() as a JS easing, solved by bisection (robust for any control points). */
function bezier([x1, y1, x2, y2]: Curve): (x: number) => number {
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

/** The four numbers of a CSS cubic-bezier(), or the fallback. */
function curve(css: string, fallback: Curve): Curve {
  const n = css.match(/cubic-bezier\(([^)]+)\)/)?.[1].split(',').map(Number) ?? [];
  return n.length === 4 && n.every(Number.isFinite) ? [n[0], n[1], n[2], n[3]] : fallback;
}

const css = ([a, b, c, d]: Curve) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;

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

/**
 * The page's in-flow blocks before and after `el` (its ancestors' siblings
 * included, up to <body>): everything that moves on screen when the list
 * changes height. Fixed, absolute and hidden elements are left alone.
 */
function flowAround(el: Element): { before: HTMLElement[]; after: HTMLElement[] } {
  const before: HTMLElement[] = [];
  const after: HTMLElement[] = [];
  const inFlow = (n: Element): n is HTMLElement => {
    if (!(n instanceof HTMLElement)) return false;
    const cs = getComputedStyle(n);
    return cs.display !== 'none' && cs.display !== 'contents' && cs.position !== 'fixed' && cs.position !== 'absolute';
  };
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    for (let s = node.previousElementSibling; s; s = s.previousElementSibling) if (inFlow(s)) before.push(s);
    for (let s = node.nextElementSibling; s; s = s.nextElementSibling) if (inFlow(s)) after.push(s);
  }
  return { before, after };
}

onPage(() => {
  const acc = document.querySelector<HTMLElement>('[data-acc]');
  if (!acc) return;

  const rows = Array.from(acc.querySelectorAll<HTMLElement>('[data-row]'));
  const btns: HTMLButtonElement[] = [];
  for (const row of rows) {
    const btn = row.querySelector<HTMLButtonElement>('[data-btn]');
    if (!btn) return;
    btns.push(btn);
  }

  const offs: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };

  const rootStyle = getComputedStyle(document.documentElement);
  const accStyle = getComputedStyle(acc);
  const headerH = parseFloat(rootStyle.getPropertyValue('--header-h')) || 72;
  /** Where a row's top comes to rest under the site header: its scroll-margin, shared with deep links. */
  const restTop = () => parseFloat(getComputedStyle(rows[0]).scrollMarginTop) || headerH + 12;
  const dur = ms(accStyle.getPropertyValue('--acc-dur'), 850);
  /** Opening answers a press (quick start); closing moves between two resting states (--ease). */
  const pressCurve = curve(accStyle.getPropertyValue('--acc-press'), [0.2, 0, 0, 1]);
  const easeCurve = curve(rootStyle.getPropertyValue('--ease'), [0.7, 0, 0.2, 1]);
  const pressEase = bezier(pressCurve);

  /** Blocks that glide with the rows. The list's structure is fixed for the life of the page. */
  const { before, after } = flowAround(acc);
  const blocks = [...before, ...rows, ...after];
  const firstAfter = before.length + rows.length;

  // ---------- state ----------
  const isOpen = (i: number) => rows[i].classList.contains('is-open');
  const openKey = () => rows.find((r) => r.classList.contains('is-open'))?.id ?? null;

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

  /** The router's index of this history entry, for an entry the router did not make (see adopt()). */
  let lastIndex = 0;
  const noteIndex = () => {
    const st: unknown = history.state;
    if (st && typeof st === 'object' && typeof (st as { index?: unknown }).index === 'number') {
      lastIndex = (st as { index: number }).index;
    }
  };
  noteIndex();

  /**
   * Keep the open row in this history entry (alongside the router's own scroll
   * position), so coming back from a case study restores the same row at the
   * same place instead of the default layout under a stale scroll offset.
   */
  const remember = (key: string | null) => {
    const st: unknown = history.state;
    if (st && typeof st === 'object') history.replaceState({ ...st, [STATE_KEY]: key }, '');
    noteIndex();
  };

  /** Apply a state change with every transition switched off, then settle layout. */
  const instant = (fn: () => void) => {
    acc.setAttribute('data-instant', '');
    fn();
    void acc.offsetHeight;
    acc.removeAttribute('data-instant');
  };

  // ---------- motion: blocks glide (transform), the page may ease up after ----------
  let flips: Animation[] = [];
  let revealOff: (() => void) | null = null;

  /**
   * Drop any smooth-scroll glide or inertia, so nothing pulls against a scroll position set here.
   * Only while it glides: stopping restyles the whole page (Lenis toggles a class on <html>).
   */
  const settleLenis = () => {
    const lenis = getLenis();
    if (lenis && !lenis.isStopped && lenis.isScrolling === 'smooth') {
      lenis.stop();
      lenis.start();
    }
  };

  /** Stop the reveal scroll where it is (only if it is still ours: a wheel or a touch may have taken over). */
  const stopReveal = () => {
    revealOff?.();
    revealOff = null;
    const lenis = getLenis();
    if (lenis?.userData?.[REVEAL]) {
      settleLenis();
      lenis.userData = {};
    }
  };

  /** Closed panels that still show while the rows below slide over them. */
  const endClosing = () => rows.forEach((r) => r.classList.remove('is-closing'));

  /** Jump everything to its resting state. */
  const stopMotion = () => {
    stopReveal();
    for (const a of flips) a.cancel();
    flips = [];
    endClosing();
  };

  /** Ease the page to `to` in step with the opening glide; the reader's own scrolling takes over at once. */
  const reveal = (to: number) => {
    const lenis = getLenis();
    if (!lenis || lenis.isStopped) {
      window.scrollTo({ top: to, behavior: 'smooth' });
      return;
    }
    lenis.scrollTo(to, {
      duration: dur / 1000,
      easing: pressEase,
      userData: { [REVEAL]: true },
      onComplete: () => {
        revealOff?.();
        revealOff = null;
      },
    });
    /*
     * The hand wins: a wheel, a press (touch, pen, the scrollbar) or a scrolling key stops the
     * glide where it is, before the smooth scroller reads the input (capture) or the key
     * scrolls natively (a running glide would override it). Keys already used by the
     * accordion (arrows between headers) do not count.
     */
    const early: AddEventListenerOptions = { passive: true, capture: true };
    const onKey = (e: Event) => {
      if (scrollsPage(e as KeyboardEvent)) stopReveal();
    };
    window.addEventListener('wheel', stopReveal, early);
    window.addEventListener('pointerdown', stopReveal, early);
    window.addEventListener('keydown', onKey);
    revealOff = () => {
      window.removeEventListener('wheel', stopReveal, early);
      window.removeEventListener('pointerdown', stopReveal, early);
      window.removeEventListener('keydown', onKey);
    };
  };

  const toggle = (i: number) => {
    const opening = !isOpen(i);
    const still = reducedMotion();
    stopReveal();
    settleLenis();
    // Hands the arrival cascade over to the transitions. The reads below apply it before the classes
    // change, so covers that arrived with the page fade out as they close instead of vanishing.
    acc.classList.add('is-settled');

    // First: where every block is on screen now, mid-glide included (layout itself is clean here).
    const first = blocks.map((b) => b.getBoundingClientRect().top);
    const showing = rows.map((r, k) => isOpen(k) || r.classList.contains('is-closing'));
    stopMotion();

    const apply = () => {
      rows.forEach((r, k) => {
        setOpen(k, k === i ? opening : false);
        r.classList.toggle('is-closing', !still && showing[k] && !isOpen(k));
      });
      remember(opening ? rows[i].id : null);
    };
    if (still) instant(apply);
    else apply();

    // Last: the one layout this change needs, in page coordinates (a shorter page may have clamped the scroll).
    const y = window.scrollY;
    const last = blocks.map((b) => b.getBoundingClientRect().top + y);
    const height = rows[i].getBoundingClientRect().height;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    // Hold the clicked header where it is on screen...
    const at = before.length + i;
    const hold = clamp(last[at] - first[at], 0, max);
    // ...and, when the opened panel would end below the fold, bring it up (never lifting the header past its resting place).
    let lift = 0;
    if (opening) {
      const top = last[at] - hold;
      lift = Math.max(0, Math.min(top + height + MARGIN - window.innerHeight, top - restTop()));
    }
    const to = clamp(hold + lift, 0, max);

    if (still) {
      setScroll(to);
      getLenis()?.resize();
      return;
    }

    if (Math.abs(hold - y) > 0.5) setScroll(hold);
    const s = window.scrollY;
    // Measured before any transform applies: Lenis takes the page's new height.
    getLenis()?.resize();

    const easing = css(opening ? pressCurve : easeCurve);
    blocks.forEach((b, k) => {
      const d = first[k] - (last[k] - s);
      // Blocks after the list glide even when they end where they started: an animated
      // transform stacks them above the rows, so a closing panel never shows over the footer.
      if (Math.abs(d) < 0.5 && k < firstAfter) return;
      flips.push(b.animate([{ transform: `translate3d(0, ${d.toFixed(2)}px, 0)` }, { transform: 'none' }], { duration: dur, easing }));
    });

    // When the glide ends, closed panels stop showing in that same frame.
    const run = flips;
    Promise.all(run.map((a) => a.finished)).then(
      () => {
        if (flips !== run) return;
        flips = [];
        // Only the measurements: a reset here would cut short a wheel the reader has started meanwhile.
        getLenis()?.dimensions.resize();
        endClosing();
      },
      () => {},
    );

    if (to - s > 0.5) reveal(to);
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
    stopMotion();
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
    stopMotion();
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
  remember(openKey());

  // Later, on this page: a typed hash, back/forward between entries of this page, or a same-page
  // hash link (the router moves to those itself without firing hashchange).
  // A traversal restores what that entry remembers; a new hash opens its row.
  const path = location.pathname;
  const here = () => location.pathname === path;
  let poppedAt = -1;
  let navTimer = 0;

  /*
   * A hash typed in the address bar (or set with location.hash) makes a history
   * entry with no state, and Astro's router ignores popstate for such entries:
   * after leaving it by a site link, Back would change the URL but leave the
   * other page showing. So the entry gets the router's shape (the index of the
   * entry it came from, as the router does for its own hash moves) and this
   * page's open row. Scheduled as a microtask from popstate: the router's own
   * hash links pass through a stateless entry too, and it restores their state
   * synchronously, before that runs.
   */
  const adopt = () => {
    if (history.state !== null || !here()) return;
    history.replaceState({ index: lastIndex, scrollX: window.scrollX, scrollY: window.scrollY, [STATE_KEY]: openKey() }, '');
  };

  listen(window, 'popstate', () => {
    if (!here()) return;
    poppedAt = performance.now();
    if (history.state === null) queueMicrotask(adopt);
    else noteIndex();
    if (!fromHistory()) fromHash(false);
  });
  listen(window, 'hashchange', () => {
    if (!here()) return;
    // Before the guard below: a typed hash fires popstate first, and its entry may still have no state.
    adopt();
    // A traversal fires popstate then hashchange; the entry's own state has already been applied.
    if (performance.now() - poppedAt > 100) fromHash(false);
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
    stopMotion();
    if (leanRaf) cancelAnimationFrame(leanRaf);
    leanRaf = 0;
    for (const l of leans.values()) l.img.style.transform = '';
    leans.clear();
    if (idleId && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
    if (timeoutId) window.clearTimeout(timeoutId);
    offs.forEach((off) => off());
  };
});
