/**
 * The Lab viewer.
 *
 * Opens from a tile: the tile's image lifts out and grows into the frame
 * (same ratio, so a translate and a uniform scale), the page fades to paper
 * behind it, and the caption and controls rise in. Closing flies the image
 * back to its tile, scrolling the page under the viewer first if that tile is
 * out of view, and hands focus back to it. Prev / Next (buttons, ← →, swipe)
 * step through what the current filter shows. Every step starts from where
 * things are on screen, so quick presses never jump.
 *
 * History: opening adds one history entry (same URL), so Back, on a phone
 * above all, closes the viewer instead of leaving the Lab; Forward opens it
 * again. Closing from the page steps back off that entry. Astro's router
 * would treat those steps as navigations and reload the Lab; they are held
 * (see onPrep) and never load anything.
 *
 * Reduced motion: everything is instant; swipe still steps.
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { getLenis } from '../../scripts/motion';
import { EASE, EASE_OUT, EASE_PRESS, done, flip, play, pose, stop } from './anim';

export interface Viewer {
  open(tile: HTMLElement): void;
  /** Start loading an entry's large image (on hover or focus of its tile). */
  warm(id: string): void;
  destroy(): void;
}

type State = 'closed' | 'opening' | 'open' | 'closing';

const pad = (n: number) => String(n).padStart(2, '0');

export function setupViewer(
  root: HTMLElement,
  tiles: HTMLElement[],
  visible: () => HTMLElement[],
  reduce: boolean,
): Viewer | null {
  const dialog = root.querySelector<HTMLDialogElement>('[data-viewer]');
  const bg = dialog?.querySelector<HTMLElement>('[data-v-bg]');
  const indexEl = dialog?.querySelector<HTMLElement>('[data-v-index]');
  const totalEl = dialog?.querySelector<HTMLElement>('[data-v-total]');
  const live = dialog?.querySelector<HTMLElement>('[data-v-live]');
  const closeBtn = dialog?.querySelector<HTMLButtonElement>('[data-v-close]');
  const prevBtn = dialog?.querySelector<HTMLButtonElement>('[data-v-prev]');
  const nextBtn = dialog?.querySelector<HTMLButtonElement>('[data-v-next]');
  const nav = dialog?.querySelector<HTMLElement>('.v-nav');
  if (!dialog || !bg || !indexEl || !totalEl || !live || !closeBtn || !prevBtn || !nextBtn || !nav) return null;

  const chrome = Array.from(dialog.querySelectorAll<HTMLElement>('[data-v-chrome]'));
  const frames = new Map<string, HTMLElement>();
  dialog.querySelectorAll<HTMLElement>('[data-v-frame]').forEach((f) => frames.set(f.dataset.vFrame ?? '', f));
  const tileById = new Map<string, HTMLElement>(tiles.map((t) => [t.dataset.id ?? '', t]));

  const holdOf = (f: HTMLElement) => f.querySelector<HTMLElement>('[data-v-hold]') ?? f;
  const capOf = (f: HTMLElement) => f.querySelector<HTMLElement>('[data-v-cap]') ?? f;
  const tileMedia = (t: HTMLElement) => t.querySelector<HTMLElement>('.media') ?? t;

  let state: State = 'closed';
  let list: string[] = [];
  let at = 0;
  let current = '';
  let lifted: HTMLElement | null = null;
  let token = 0;

  // ---------- history ----------
  const KEY = 'labViewer';
  type Entry = Record<string, unknown> | null;
  const entryId = (st: unknown): string | null => {
    const v = (st as Entry)?.[KEY];
    return typeof v === 'string' ? v : null;
  };
  /** The router's position for an entry (the viewer's entry carries its Lab entry's). */
  const indexOf = (st: unknown) => (st as Entry)?.index;
  const labPath = location.pathname;

  // Arriving on a viewer entry (a reload) starts closed: make it a plain Lab entry again.
  if (entryId(history.state) !== null) {
    const plain: Record<string, unknown> = { ...(history.state as Record<string, unknown>) };
    delete plain[KEY];
    history.replaceState(plain, '');
  }

  /** The current history entry is the open viewer's. */
  let onEntry = false;
  /** The router index of this Lab entry; its viewer entry (even one left from an earlier visit) carries the same. */
  let baseIndex: unknown = indexOf(history.state);
  /** A Back of ours is on its way (so a second close request does not step back twice). */
  let leaving = false;
  /** Set by onPop for the rest of this task, in case the router hears the pop after us. */
  let popWasOurs = false;

  /** A Back or Forward between the viewer's entry and the Lab entry right under it. */
  const ourStep = () =>
    location.pathname === labPath &&
    indexOf(history.state) === baseIndex &&
    (onEntry || entryId(history.state) !== null);

  const pushEntry = (id: string) => {
    try {
      baseIndex = indexOf(history.state);
      history.pushState({ ...((history.state as Entry) ?? {}), [KEY]: id }, '');
      onEntry = true;
    } catch {
      onEntry = false;
    }
  };

  const updateEntry = (id: string) => {
    if (onEntry && entryId(history.state) !== null) history.replaceState({ ...(history.state as Entry), [KEY]: id }, '');
  };

  /** Closed from the page: step back off the viewer's entry. */
  const leaveEntry = () => {
    if (!onEntry || leaving || entryId(history.state) === null) return;
    leaving = true;
    history.back();
  };

  /**
   * The router hears Back / Forward before we do and would fetch and swap the
   * Lab again. For our own step, its loader waits instead of loading, and ends
   * (cancelled, so nothing reloads) when the next real navigation starts.
   */
  const onPrep = (ev: Event) => {
    const e = ev as TransitionBeforePreparationEvent;
    if (e.navigationType !== 'traverse' || !(ourStep() || popWasOurs)) return;
    e.loader = () =>
      new Promise<void>((resolve) => {
        const end = () => {
          e.preventDefault();
          resolve();
        };
        if (e.signal.aborted) end();
        else e.signal.addEventListener('abort', end, { once: true });
      });
  };

  // Large images never get dragged out as files.
  dialog.querySelectorAll('img').forEach((img) => (img.draggable = false));

  // ---------- loading ----------
  const warm = (id: string) => {
    const img = frames.get(id)?.querySelector('img');
    if (img && img.loading !== 'eager') img.loading = 'eager';
  };

  /** Paint the tile's already-loaded image under the large one, so a frame is never blank. */
  const seed = (id: string) => {
    const media = frames.get(id)?.querySelector<HTMLElement>('.media');
    const small = tileById.get(id)?.querySelector('img');
    if (!media || !small || media.style.backgroundImage) return;
    if (!small.complete || !small.naturalWidth) return;
    media.style.backgroundImage = `url("${small.currentSrc || small.src}")`;
    media.style.backgroundSize = 'cover';
    media.style.backgroundPosition = 'center';
  };

  const prepare = (id: string) => {
    seed(id);
    warm(id);
    if (list.length > 1) {
      warm(list[(at + 1) % list.length]);
      warm(list[(at - 1 + list.length) % list.length]);
    }
  };

  // ---------- loops ----------
  const startLoop = (id: string) => {
    const src = tileById.get(id)?.dataset.loop;
    const media = frames.get(id)?.querySelector<HTMLElement>('.media');
    if (!src || !media) return;
    let v = media.querySelector('video');
    if (!v) {
      v = document.createElement('video');
      v.className = 'v-loop';
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = src;
      const still = media.querySelector('img');
      if (still) v.poster = still.currentSrc || still.src;
      // Reduced motion: the loop waits for a press.
      if (reduce) v.controls = true;
      media.append(v);
    }
    if (!reduce) v.play().catch(() => {});
  };

  const stopLoop = (id: string) => frames.get(id)?.querySelector('video')?.pause();

  // ---------- state ----------
  const lift = (t: HTMLElement | null) => {
    if (lifted && lifted !== t) lifted.classList.remove('is-lifted');
    lifted = t;
    if (!t) return;
    // A tile still waiting for its scroll reveal takes its final place now (it is covered).
    t.classList.remove('is-armed');
    t.classList.add('is-lifted');
  };

  const setCurrent = (id: string) => {
    for (const [k, f] of frames) {
      const on = k === id;
      f.classList.toggle('is-current', on);
      f.inert = !on;
    }
    const f = frames.get(id);
    if (f) f.hidden = false;
    current = id;
    dialog.setAttribute('aria-labelledby', `lab-v-${id}`);
    indexEl.textContent = pad(at + 1);
    totalEl.textContent = pad(list.length);
    nav.hidden = list.length < 2;
  };

  const announce = () => {
    const title = frames.get(current)?.querySelector('.v-title')?.textContent?.trim() ?? '';
    live.textContent = `${title}, ${at + 1} of ${list.length}`;
  };

  /** Stop any smooth-scroll glide, so the tile is where we measure it. */
  const halt = () => {
    const l = getLenis();
    if (l) l.scrollTo(l.animatedScroll, { immediate: true, force: true });
  };

  const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;

  /** Bring a tile into view under the (opaque) viewer before flying back to it. */
  const ensureInView = (tile: HTMLElement) => {
    const r = tile.getBoundingClientRect();
    const top = headerH() + 8;
    const bottom = window.innerHeight - 8;
    const seen = Math.min(r.bottom, bottom) - Math.max(r.top, top);
    if (seen >= r.height * 0.6) return;
    const y = window.scrollY + r.top - Math.max(top, (window.innerHeight - r.height) / 2);
    const l = getLenis();
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: 'instant' });
  };

  const rise: Keyframe[] = [
    { opacity: 0, transform: 'translate3d(0, 14px, 0)' },
    { opacity: 1, transform: 'none' },
  ];

  // ---------- open ----------
  const open = (tile: HTMLElement, fromHistory = false) => {
    if (state !== 'closed') return;
    const id = tile.dataset.id ?? '';
    const frame = frames.get(id);
    if (!frame) return;
    list = visible().map((t) => t.dataset.id ?? '');
    if (!fromHistory) pushEntry(id);
    at = Math.max(0, list.indexOf(id));
    halt();
    for (const f of frames.values()) f.hidden = true;
    setCurrent(id);
    prepare(id);
    live.textContent = '';
    dialog.showModal();
    closeBtn.focus({ preventScroll: true });
    state = 'opening';
    const my = ++token;
    startLoop(id);
    if (reduce) {
      lift(tile);
      state = 'open';
      return;
    }

    const hold = holdOf(frame);
    const from = tileMedia(tile).getBoundingClientRect();
    const to = hold.getBoundingClientRect();
    lift(tile);
    // A press gets an answer at once: the image starts moving on the first
    // frame and settles softly, and the chrome rises as it nears its place.
    // (Reopened from history, it keeps the site's in-out ease.)
    const ease = fromHistory ? EASE : EASE_PRESS;
    const rise0 = fromHistory ? 380 : 220;
    const a = play(hold, [{ transform: flip(from, to) }, { transform: 'none' }], { duration: 900, easing: ease });
    play(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 560, easing: ease });
    for (const el of [...chrome, capOf(frame)]) play(el, rise, { duration: 800, delay: rise0, easing: EASE_OUT, fill: 'backwards' });
    done(a).then(() => {
      if (my === token && state === 'opening') state = 'open';
    });
  };

  // ---------- step ----------
  const go = (dir: 1 | -1) => {
    if ((state !== 'open' && state !== 'opening') || list.length < 2) return;
    const prevId = current;
    const out = frames.get(prevId);
    at = (at + dir + list.length) % list.length;
    const id = list[at];
    const inn = frames.get(id);
    if (!out || !inn) return;
    const wasShowing = !inn.hidden;
    state = 'open';

    // The tile behind the viewer follows along (it is covered, so this is unseen).
    lift(tileById.get(id) ?? null);
    setCurrent(id);
    updateEntry(id);
    prepare(id);
    announce();
    stopLoop(prevId);
    startLoop(id);

    if (reduce) {
      out.hidden = true;
      return;
    }

    // Outgoing: from wherever it is (mid-flight, mid-drag) out to the side.
    const shift = Math.min(96, window.innerWidth * 0.07);
    const oh = holdOf(out);
    const oc = capOf(out);
    const o = pose(oh);
    const oCap = pose(oc);
    const leave = play(oh, [o, { transform: `translate3d(${-dir * shift}px, 0, 0)`, opacity: 0 }], {
      duration: 420,
      easing: EASE,
      fill: 'forwards',
    });
    // The old caption clears quickly, before the new one starts, so two titles never overlap.
    play(oc, [oCap, { transform: 'translate3d(0, -8px, 0)', opacity: 0 }], { duration: 180, easing: EASE_OUT, fill: 'forwards' });
    done(leave).then((finished) => {
      if (!finished || current === prevId) return;
      out.hidden = true;
      stop(oh);
      stop(oc);
    });

    // Incoming: picks up from where it is if it was still leaving, else comes in from the side.
    const ih = holdOf(inn);
    const ic = capOf(inn);
    const iFrom: Keyframe = wasShowing ? pose(ih) : { transform: `translate3d(${dir * shift * 1.4}px, 0, 0)`, opacity: 0 };
    const cFrom: Keyframe = wasShowing ? pose(ic) : { transform: 'translate3d(0, 12px, 0)', opacity: 0 };
    play(ih, [iFrom, { transform: 'none', opacity: 1 }], {
      duration: 820,
      delay: wasShowing ? 0 : 60,
      easing: EASE_OUT,
      fill: 'backwards',
    });
    play(ic, [cFrom, { transform: 'none', opacity: 1 }], {
      duration: 700,
      delay: wasShowing ? 0 : 200,
      easing: EASE_OUT,
      fill: 'backwards',
    });
  };

  // ---------- close ----------
  const finish = () => {
    token++;
    state = 'closed';
    for (const id of frames.keys()) stopLoop(id);
    if (dialog.open) dialog.close();
    for (const f of frames.values()) {
      stop(f, true);
      f.hidden = true;
      holdOf(f).style.removeProperty('transform');
      holdOf(f).style.removeProperty('opacity');
    }
    stop(bg);
    chrome.forEach((el) => stop(el));
    const tile = tileById.get(current);
    lift(null);
    tile?.querySelector<HTMLButtonElement>('[data-open]')?.focus({ preventScroll: true });
  };

  const close = () => {
    if (state === 'closed' || state === 'closing') return;
    state = 'closing';
    drag = null;
    const my = ++token;
    const frame = frames.get(current);
    const tile = tileById.get(current);
    if (reduce || !frame || !tile || tile.hidden) {
      finish();
      return;
    }
    // Anything still stepping out goes now; only the current image flies home.
    for (const f of frames.values()) {
      if (f === frame || f.hidden) continue;
      stop(f, true);
      f.hidden = true;
    }
    lift(tile);
    ensureInView(tile);
    const hold = holdOf(frame);
    const from = pose(hold);
    const rest = hold.getBoundingClientRect();
    const target = tileMedia(tile).getBoundingClientRect();
    const a = play(hold, [from, { transform: flip(target, rest), opacity: 1 }], {
      duration: 760,
      easing: EASE,
      fill: 'forwards',
    });
    play(bg, [{ opacity: pose(bg).opacity }, { opacity: 0 }], { duration: 520, delay: 180, easing: EASE, fill: 'forwards' });
    for (const el of [...chrome, capOf(frame)]) {
      const p = pose(el);
      play(el, [p, { ...p, opacity: 0 }], { duration: 220, easing: EASE, fill: 'forwards' });
    }
    done(a).then(() => {
      if (my === token) finish();
    });
  };

  /** Close from the page (Close, Esc, a click beside the image). */
  const requestClose = () => {
    if (state === 'closed' || state === 'closing') return;
    close();
    leaveEntry();
  };

  // ---------- swipe / drag on the image ----------
  let drag: {
    pointer: number;
    el: HTMLElement;
    x0: number;
    y0: number;
    dx: number;
    vx: number;
    lx: number;
    lt: number;
    on: boolean;
  } | null = null;
  let dragRaf = 0;
  let swallowClick = false;

  const writeDrag = () => {
    dragRaf = 0;
    if (!drag?.on) return;
    const w = window.innerWidth;
    drag.el.style.transform = `translate3d(${drag.dx.toFixed(1)}px, 0, 0)`;
    drag.el.style.opacity = String(1 - Math.min(0.45, Math.abs(drag.dx) / (w * 0.9)));
  };

  const onDown = (e: PointerEvent) => {
    if (state !== 'open') return;
    if (e.button !== 0 || list.length < 2) return;
    const frame = frames.get(current);
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-v-hold]');
    if (!frame || !el || el !== holdOf(frame)) return;
    drag = { pointer: e.pointerId, el, x0: e.clientX, y0: e.clientY, dx: 0, vx: 0, lx: e.clientX, lt: e.timeStamp, on: false };
  };

  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag = null;
        return;
      }
      if (Math.abs(dx) < 8) return;
      drag.on = true;
      // Take over from any running motion at its current pose, and keep the finger's offset.
      const p = pose(drag.el);
      if (!reduce && p.transform !== 'none') {
        const m = new DOMMatrixReadOnly(p.transform);
        drag.x0 -= m.m41;
      }
      try {
        drag.el.setPointerCapture(drag.pointer);
      } catch {
        /* pointer already gone */
      }
    }
    const dt = Math.max(1, e.timeStamp - drag.lt);
    drag.vx = drag.vx * 0.6 + ((e.clientX - drag.lx) / dt) * 0.4;
    drag.lx = e.clientX;
    drag.lt = e.timeStamp;
    drag.dx = e.clientX - drag.x0;
    if (!reduce && !dragRaf) dragRaf = requestAnimationFrame(writeDrag);
  };

  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    cancelAnimationFrame(dragRaf);
    dragRaf = 0;
    swallowClick = true;
    window.setTimeout(() => (swallowClick = false), 0);
    const far = Math.abs(d.dx) > Math.min(120, window.innerWidth * 0.2);
    const fast = Math.abs(d.vx) > 0.45 && Math.sign(d.vx) === Math.sign(d.dx);
    if (e.type === 'pointerup' && (far || fast)) {
      // Leave from exactly where the finger let go.
      if (!reduce) d.el.style.transform = `translate3d(${d.dx.toFixed(1)}px, 0, 0)`;
      go(d.dx < 0 ? 1 : -1);
      return;
    }
    if (reduce) return;
    const p = pose(d.el);
    play(d.el, [p, { transform: 'none', opacity: 1 }], { duration: 560, easing: EASE_OUT });
  };

  // ---------- events ----------
  const onClick = (e: MouseEvent) => {
    if (swallowClick) return;
    const t = e.target as Element | null;
    if (!t || t.closest('button, video, [data-v-hold], [data-v-cap]')) return;
    requestClose();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      requestClose();
    } else if (
      ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key) ||
      (e.key === ' ' && !(e.target instanceof HTMLButtonElement))
    ) {
      // The page behind stays put.
      e.preventDefault();
    }
  };

  const onCancel = (e: Event) => {
    e.preventDefault();
    requestClose();
  };

  // Closed some other way (the browser can force it): tidy up, and leave the viewer's entry.
  const onNativeClose = () => {
    if (state === 'closed') return;
    finish();
    leaveEntry();
  };

  /** Back / Forward between the Lab and its viewer entry: open or close to match. */
  const onPop = () => {
    if (!ourStep()) return;
    popWasOurs = true;
    window.setTimeout(() => (popWasOurs = false), 0);
    const id = entryId(history.state);
    onEntry = id !== null;
    leaving = false;
    if (id === null) {
      close();
      return;
    }
    // Forward onto the viewer's entry: open it again, if that entry is still on the wall.
    const tile = tileById.get(id);
    if (state === 'closed' && tile && visible().includes(tile)) {
      ensureInView(tile);
      open(tile, true);
    } else {
      leaveEntry();
    }
  };

  // The page behind never scrolls; a two-finger pinch still zooms.
  const blockScroll = (e: Event) => {
    if ('touches' in e && (e as TouchEvent).touches.length > 1) return;
    if (e.cancelable) e.preventDefault();
  };

  const onPrev = () => go(-1);
  const onNext = () => go(1);
  const onCloseBtn = () => requestClose();

  dialog.addEventListener('click', onClick);
  dialog.addEventListener('keydown', onKey);
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('close', onNativeClose);
  dialog.addEventListener('wheel', blockScroll, { passive: false });
  dialog.addEventListener('touchmove', blockScroll, { passive: false });
  dialog.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('popstate', onPop);
  document.addEventListener('astro:before-preparation', onPrep);
  closeBtn.addEventListener('click', onCloseBtn);
  prevBtn.addEventListener('click', onPrev);
  nextBtn.addEventListener('click', onNext);

  return {
    open: (tile: HTMLElement) => open(tile),
    warm,
    destroy() {
      token++;
      cancelAnimationFrame(dragRaf);
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('keydown', onKey);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
      dialog.removeEventListener('wheel', blockScroll);
      dialog.removeEventListener('touchmove', blockScroll);
      dialog.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('astro:before-preparation', onPrep);
      closeBtn.removeEventListener('click', onCloseBtn);
      prevBtn.removeEventListener('click', onPrev);
      nextBtn.removeEventListener('click', onNext);
      state = 'closed';
      for (const id of frames.keys()) stopLoop(id);
      stop(dialog, true);
      if (dialog.open) dialog.close();
      lift(null);
    },
  };
}
