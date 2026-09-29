/**
 * The home ring (src/components/home/Ring.astro).
 *
 * - One rAF loop eases the ring position toward a target and stops when settled.
 * - Input: drag and swipe with momentum, wheel and trackpad (both axes), arrow
 *   keys, keyboard focus. Release snaps to the nearest plate.
 * - A click (not a drag) on a side plate turns the ring to it; on the front plate
 *   it follows the link and the plate morphs into the case hero (shared name).
 * - Caption, facts and counter swap through a mask as the front plate changes.
 * - Ring | Index toggle, with a cursor-following preview in the index.
 *
 * Positions are in plates (see components/home/geometry.ts), so resizing only
 * re-measures the plate width and never moves the ring to another project.
 */
import { prefetch } from 'astro:prefetch';
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { reducedMotion, clamp } from './motion';
import { GEOMETRY, MOBILE_QUERY, pose, pxPerStep, wrapK, type RingGeometry } from '../components/home/geometry';
import { aimAtPointer, aimAtRow, follower, type PreviewBox } from '../components/home/preview-follow';

const STORE_FRONT = 'sp:ring-front';
const STORE_HINT = 'sp:ring-hint';

/**
 * The caption roll's easing: the --ease token (global.css), read once when the
 * ring starts so the script moves like the stylesheet. The fallback is the
 * token's value today.
 */
let ease = 'cubic-bezier(0.7, 0, 0.2, 1)';
function readEase(from: Element) {
  const token = getComputedStyle(from).getPropertyValue('--ease').trim();
  if (token && CSS.supports('animation-timing-function', token)) ease = token;
}

/** Time constants (ms) of the eased follow: while the hand drives, and while gliding to rest. */
const TAU_HAND = 60;
const TAU_SETTLE = 280;
/** A press that travels further than this (px) is a drag, not a click. */
const DRAG_THRESHOLD = 6;
/** Most plates one flick can travel. */
const MAX_THROW = 3;

type View = 'ring' | 'index';

const mod = (v: number, n: number) => ((v % n) + n) % n;

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode: the ring simply starts at the first project */
  }
}

const geometry = (): RingGeometry => GEOMETRY[window.matchMedia(MOBILE_QUERY).matches ? 'mob' : 'desk'];

/** Layout width of a plate (unaffected by its transform), i.e. W0. */
const plateWidth = (plate: HTMLElement) => parseFloat(getComputedStyle(plate).width) || plate.offsetWidth || 1;

const pad = (v: number) => String(v).padStart(2, '0');

/* ---------- caption ---------- */

function fillName(item: HTMLElement, plate: HTMLElement) {
  item.textContent = plate.dataset.title ?? '';
}

function fillFacts(item: HTMLElement, plate: HTMLElement) {
  const set = (key: string, text: string) => {
    const el = item.querySelector<HTMLElement>(`[data-f="${key}"]`);
    if (el) el.textContent = text;
  };
  set('no', `N°${plate.dataset.no ?? ''}`);
  set('sector', plate.dataset.sector ?? '');
  set('year', plate.dataset.year ?? '');
  set('disc', plate.dataset.disc ?? '');
}

function fillCount(i: number) {
  return (item: HTMLElement) => {
    item.textContent = pad(i + 1);
  };
}

/** The roll that brought each caption line in, kept here so a swap never has to ask the element for it. */
const rolls = new WeakMap<Element, Animation>();

/**
 * Swap the text in a masked box. The outgoing line leaves from wherever it is
 * (so fast spins roll smoothly), the new one slides in from the other side.
 *
 * This runs inside the ring's animation frame, right after the plates are
 * written, so it must not read anything back (no computed style, no
 * getAnimations(): either would force a style and layout pass mid-frame). The
 * outgoing roll has no start keyframe: the browser starts it from the line's
 * current, still-animating position, and the roll that brought the line in
 * keeps running underneath it until the line is removed.
 */
function swap(box: HTMLElement | null, fill: (el: HTMLElement) => void, dir: number, instant: boolean, delay = 0) {
  if (!box) return;
  const current = box.lastElementChild as HTMLElement | null;
  if (!current) return;
  if (instant || !current.animate) {
    for (const el of Array.from(box.children)) if (el !== current) el.remove();
    rolls.get(current)?.cancel();
    rolls.delete(current);
    fill(current);
    return;
  }
  const next = current.cloneNode(true) as HTMLElement;
  fill(next);
  box.append(next);
  // Old and new move in lockstep, one line apart, like a counter rolling over.
  const timing: KeyframeAnimationOptions = { duration: 760, delay, easing: ease, fill: 'both' };
  current.animate([{ transform: `translate3d(0, ${-dir * 112}%, 0)` }], timing).finished.then(
    () => current.remove(),
    () => {},
  );
  const roll = next.animate([{ transform: `translate3d(0, ${dir * 112}%, 0)` }, { transform: 'translate3d(0, 0, 0)' }], timing);
  rolls.set(next, roll);
}

function paintCaption(root: HTMLElement, plates: HTMLElement[], i: number, dir: number, instant: boolean) {
  const plate = plates[i];
  if (!plate) return;
  swap(root.querySelector('[data-swap="name"]'), (el) => fillName(el, plate), dir, instant);
  swap(root.querySelector('[data-swap="facts"]'), (el) => fillFacts(el, plate), dir, instant, 70);
  swap(root.querySelector('[data-swap="count"]'), fillCount(i), dir, instant, 35);
}

/* ---------- plates ---------- */

interface Painted {
  t: string;
  o: string;
  v: string;
  z: string;
  pe: string;
}

function placePlates(
  plates: HTMLElement[],
  veils: (HTMLElement | null)[],
  cache: Painted[],
  cur: number,
  geo: RingGeometry,
  w0: number,
) {
  const n = plates.length;
  for (let i = 0; i < n; i++) {
    const p = pose(geo, wrapK(i - cur, n), n);
    const el = plates[i];
    const c = cache[i];
    const t = `translate3d(${(p.x * w0).toFixed(2)}px, ${(p.y * w0).toFixed(2)}px, 0) rotate(${p.rot.toFixed(5)}rad) scale(${p.s.toFixed(4)})`;
    if (t !== c.t) el.style.transform = c.t = t;
    const o = p.o.toFixed(3);
    if (o !== c.o) el.style.opacity = c.o = o;
    const pe = p.o < 0.05 ? 'none' : '';
    if (pe !== c.pe) el.style.pointerEvents = c.pe = pe;
    const z = String(p.z);
    if (z !== c.z) el.style.zIndex = c.z = z;
    const v = p.veil.toFixed(3);
    const veil = veils[i];
    if (veil && v !== c.v) veil.style.opacity = c.v = v;
  }
}

const freshCache = (n: number): Painted[] => Array.from({ length: n }, () => ({ t: '', o: '', v: '', z: '', pe: '' }));

/* ---------- shared-element names ---------- */

const CASE_PATH = /^\/work\/([^/]+)\/?$/;

const mediaOf = (plate: HTMLElement) => plate.querySelector<HTMLElement>('.media');

/** Index of the plate for a case page's path, or -1. */
function plateForPath(plates: HTMLElement[], path: string): number {
  const m = CASE_PATH.exec(path);
  if (!m) return -1;
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* malformed escape: compare as is */
  }
  return plates.findIndex((p) => p.dataset.slug === slug);
}

/**
 * Only one plate may take part in a page transition: the one that morphs into
 * (or out of) a case hero. Plates are unnamed in the stylesheet (Ring.astro);
 * this names the kept plate from its data-vt and pins every other one to none.
 * keep = -1 leaves no plate named.
 */
function nameOnly(plates: HTMLElement[], keep: number) {
  plates.forEach((p, i) => {
    const m = mediaOf(p);
    if (!m) return;
    const name = i === keep ? p.dataset.vt : '';
    m.style.setProperty('view-transition-name', name || 'none');
  });
}

/**
 * Before the transition starts, decode the image the shared element becomes on
 * the next page, so the morph never lands on an empty frame. Capped short: the
 * page holds still while this waits (the pressed plate shows the click landed),
 * and a slow network should cost the morph a frame, not the visitor a pause.
 */
async function warmShared(doc: Document, name: string, cap = 250) {
  const css = Array.from(doc.querySelectorAll('style'))
    .map((st) => st.textContent ?? '')
    .join('\n');
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hit = new RegExp(`\\[data-astro-transition-scope="([^"]+)"\\]\\s*\\{\\s*view-transition-name:\\s*${esc}\\s*;`).exec(css);
  if (!hit) return;
  const img = doc.querySelector<HTMLImageElement>(`[data-astro-transition-scope="${hit[1]}"] img`);
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

/* ---------- arriving by a page transition ---------- */

let fromPath = '';
document.addEventListener('astro:before-preparation', (e) => {
  fromPath = (e as TransitionBeforePreparationEvent).from.pathname;
});

/**
 * Runs right after the router swaps in the home page and before the page
 * transition captures it: lay the ring out on the project we came back from
 * (so its case hero morphs back into its plate), or where the visitor left it.
 *
 * This only runs once ring.ts has loaded, i.e. the visitor has been on the
 * home before in this tab. Arriving for the first time, every plate keeps the
 * stylesheet's view-transition-name: none and the page simply crossfades.
 */
document.addEventListener('astro:after-swap', () => {
  const root = document.querySelector<HTMLElement>('[data-ring]');
  if (!root) return;
  root.removeAttribute('data-intro');
  if (read(STORE_HINT)) root.classList.add('hint-off');
  const plates = Array.from(root.querySelectorAll<HTMLElement>('[data-plate]'));
  const n = plates.length;
  if (!n) return;
  let front = Number(read(STORE_FRONT) ?? 0);
  if (!Number.isInteger(front) || front < 0 || front >= n) front = 0;
  const keep = plateForPath(plates, fromPath);
  if (keep >= 0) front = keep;
  // Only the plate we came back to morphs; the others arrive with the page.
  nameOnly(plates, keep);
  root.dataset.front = String(front);
  if (front === 0) return;
  const veils = plates.map((p) => p.querySelector<HTMLElement>('.plate-veil'));
  placePlates(plates, veils, freshCache(n), front, geometry(), plateWidth(plates[0]));
  plates.forEach((p, i) => p.classList.toggle('is-front', i === front));
  paintCaption(root, plates, front, 1, true);
});

/* ---------- the ring ---------- */

export function initRing(): (() => void) | void {
  const root = document.querySelector<HTMLElement>('[data-ring]');
  if (!root) return;
  const stage = root.querySelector<HTMLElement>('[data-stage]');
  const plates = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-plate]'));
  const n = plates.length;
  if (!stage || !n) return;

  const veils = plates.map((p) => p.querySelector<HTMLElement>('.plate-veil'));
  const live = root.querySelector<HTMLElement>('[data-live]');
  const viewBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-view-btn]'));
  const index = root.querySelector<HTMLElement>('[data-index]');
  const rowsEl = root.querySelector<HTMLElement>('[data-rows]');
  const rows = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-row]'));
  const peek = root.querySelector<HTMLElement>('[data-peek]');
  const peekItems = Array.from(root.querySelectorAll<HTMLElement>('[data-peek-item]'));

  const reduce = reducedMotion();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  readEase(root);
  const cache = freshCache(n);
  let geo = geometry();
  let w0 = plateWidth(plates[0]);

  const start = Number(root.dataset.front ?? 0);
  let cur = Number.isInteger(start) && start >= 0 && start < n ? start : 0;
  let target = cur;
  let active = mod(Math.round(cur), n);
  let announced = active;
  let view: View = 'ring';
  /** Shared-element name handed to the index preview for the next page transition. */
  let peekName = '';
  let hintOff = root.classList.contains('hint-off');
  if (!hintOff && read(STORE_HINT)) {
    root.classList.add('hint-off');
    hintOff = true;
  }

  // A page transition is running: no intro, the ring is already in place.
  if (document.documentElement.hasAttribute('data-astro-transition')) root.removeAttribute('data-intro');
  const introTimer = window.setTimeout(() => root.removeAttribute('data-intro'), 2400);

  /* ---------- loop ---------- */
  let raf = 0;
  let lastT = 0;
  let moving = false;
  let dragging = false;
  let wheeling = false;

  const render = () => placePlates(plates, veils, cache, cur, geo, w0);

  function syncActive() {
    const a = mod(Math.round(cur), n);
    if (a === active) return;
    const dir = Math.sign(wrapK(a - active, n)) || 1;
    plates[active]?.classList.remove('is-front');
    plates[a].classList.add('is-front');
    active = a;
    root!.removeAttribute('data-intro');
    paintCaption(root!, plates, a, dir, reduce);
  }

  function settle() {
    moving = false;
    root!.classList.remove('is-moving');
    // keep the numbers small on long sessions
    if (Math.abs(cur) > n * 64) {
      const shift = Math.round(cur / n) * n;
      cur -= shift;
      target -= shift;
    }
    const front = mod(Math.round(cur), n);
    write(STORE_FRONT, String(front));
    try {
      prefetch(plates[front].href);
    } catch {
      /* prefetch is a nicety */
    }
  }

  function tick(now: number) {
    // The first frame's timestamp can precede kick()'s clock read; never step backwards.
    const dt = lastT ? Math.min(50, Math.max(1, now - lastT)) : 16.7;
    lastT = now;
    const hand = dragging || wheeling;
    const diff = target - cur;
    if (reduce) cur = target;
    else {
      let move = diff * (1 - Math.exp(-dt / (hand ? TAU_HAND : TAU_SETTLE)));
      // Below ~0.2px a frame, finish at that speed instead of creeping forever.
      const floor = (0.012 * dt) / w0;
      if (Math.abs(move) < floor) move = Math.sign(diff) * Math.min(Math.abs(diff), floor);
      cur += move;
    }
    const done = Math.abs(target - cur) < 1e-6;
    if (done) cur = target;
    render();
    syncActive();
    if (done) {
      raf = 0;
      if (!hand) settle();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (!moving) {
      moving = true;
      root!.classList.add('is-moving');
    }
    if (raf) return;
    lastT = 0;
    raf = requestAnimationFrame(tick);
  }

  function goTo(i: number) {
    const base = Math.round(target);
    target = base + wrapK(i - base, n);
    kick();
  }

  function step(dir: number) {
    target = Math.round(target) + dir;
    kick();
  }

  function dismissHint() {
    if (hintOff) return;
    hintOff = true;
    root!.classList.add('hint-off');
    write(STORE_HINT, '1');
  }

  /* ---------- announcements ---------- */
  /*
   * A focused plate speaks for itself (its name carries its position, see
   * Ring.astro), so the live region only covers turns that move no focus:
   * arrows on the stage, wheel, drag and clicks. It speaks as soon as the input
   * has named its destination (not when the ring comes to rest, a second and a
   * half later), and a quick run of presses says only where it ends.
   */
  let announceTimer = 0;
  const isPlate = (el: Element | null) => !!el && el.matches('[data-plate]') && root!.contains(el);

  function announce(i: number) {
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      const ae = document.activeElement;
      if (!live || i === announced || isPlate(ae)) return;
      // Focus has left the ring for the rest of the page: that has the floor now.
      if (ae && ae !== document.body && ae.id !== 'main' && !root!.contains(ae)) return;
      live.textContent = `${plates[i].dataset.title}, ${i + 1} of ${n}`;
      announced = i;
    }, 250);
  }

  /**
   * Focus has just spoken plate i: drop anything pending, and clear the region
   * so the next announcement is heard even if its text repeats the last one.
   */
  function spoken(i: number) {
    window.clearTimeout(announceTimer);
    announced = i;
    if (live) live.textContent = '';
  }

  /** The plate the ring is turning to (or resting on). */
  const heading = () => mod(Math.round(target), n);

  /* ---------- drag / swipe ---------- */
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let dragMoved = false;
  let grab = 0;
  let samples: [number, number][] = [];

  function onPointerDown(e: PointerEvent) {
    if (view !== 'ring' || !e.isPrimary || dragging) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = e.clientY;
    const hit = (e.target as Element).closest<HTMLAnchorElement>('[data-plate]');
    grab = hit ? plates.indexOf(hit) : mod(Math.round(cur), n);
    target = cur; // catch the ring where it is
    samples = [[e.timeStamp, target]];
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (!dragMoved && Math.hypot(e.clientX - startX, e.clientY - startY) > DRAG_THRESHOLD) {
      dragMoved = true;
      root!.classList.add('is-dragging');
      dismissHint();
    }
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    if (!dx) return;
    // The plate under the hand follows it exactly.
    const perStep = Math.max(pxPerStep(geo, wrapK(grab - target, n), w0), w0 * 0.3);
    target -= dx / perStep;
    samples.push([e.timeStamp, target]);
    while (samples.length > 2 && e.timeStamp - samples[0][0] > 100) samples.shift();
    kick();
  }

  function endDrag(cancelled: boolean, time: number) {
    if (!dragging) return;
    dragging = false;
    pointerId = -1;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    root!.classList.remove('is-dragging');
    let dest = target;
    if (dragMoved && !cancelled && !reduce && samples.length > 1) {
      const [t0, x0] = samples[0];
      const [t1, x1] = samples[samples.length - 1];
      const v = t1 > t0 && time - t1 < 80 ? (x1 - x0) / (t1 - t0) : 0; // plates per ms
      // Project the glide: an eased follow with time constant T travels v·T.
      dest = target + clamp(v * TAU_SETTLE, -MAX_THROW, MAX_THROW);
    }
    target = Math.round(dest);
    if (dragMoved && !cancelled) announce(heading());
    // A plain press on a still ring changes nothing: no loop, no layer churn.
    if (target !== cur || moving) kick();
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    endDrag(e.type === 'pointercancel', e.timeStamp);
  }

  function onBlur() {
    endDrag(true, performance.now());
  }

  // No text selection, native image drag or focus ring on press.
  function onMouseDown(e: MouseEvent) {
    if (e.button === 0) e.preventDefault();
  }

  function onDragStart(e: DragEvent) {
    e.preventDefault();
  }

  function onClick(e: MouseEvent) {
    const plate = (e.target as Element).closest<HTMLAnchorElement>('[data-plate]');
    if (!plate) return;
    // After a drag the press is not a click: never navigate.
    if (dragMoved && e.detail !== 0) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const i = plates.indexOf(plate);
    if (i !== heading()) {
      e.preventDefault();
      e.stopPropagation();
      dismissHint();
      goTo(i);
      announce(i);
      return;
    }
    // Front plate: follow the link. The router morphs the plate into the case hero;
    // until it starts, the plate gives a little so the click is seen to land.
    write(STORE_FRONT, String(i));
    press(plate);
  }

  let pressed: HTMLElement | null = null;
  let pressTimer = 0;
  function press(plate: HTMLElement) {
    unpress();
    pressed = plate;
    plate.classList.add('is-pressed');
    // Should the navigation never happen, let go.
    pressTimer = window.setTimeout(unpress, 2000);
  }

  function unpress() {
    window.clearTimeout(pressTimer);
    pressed?.classList.remove('is-pressed');
    pressed = null;
  }

  /* ---------- wheel / trackpad ---------- */
  let wheelFrom = 0;
  let wheelTimer = 0;
  let wheelAcc = 0;
  let wheelLock = false;

  function endWheel() {
    wheeling = false;
    const moved = target - wheelFrom;
    const base = Math.round(wheelFrom);
    // Settle on the next plate in the direction of travel.
    if (Math.abs(moved) < 0.04) target = Math.round(target);
    else if (moved > 0) target = Math.max(Math.ceil(target - 0.25), base + 1);
    else target = Math.min(Math.floor(target + 0.25), base - 1);
    announce(heading());
    kick();
  }

  function onWheel(e: WheelEvent) {
    if (view !== 'ring' || e.ctrlKey || dragging) return;
    let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    e.preventDefault();
    if (!d) return;
    dismissHint();
    window.clearTimeout(wheelTimer);
    if (reduce) {
      // One step per gesture, no glide.
      wheelAcc += d;
      if (!wheelLock && Math.abs(wheelAcc) > 30) {
        step(Math.sign(wheelAcc));
        announce(heading());
        wheelLock = true;
      }
      wheelTimer = window.setTimeout(() => {
        wheelAcc = 0;
        wheelLock = false;
      }, 200);
      return;
    }
    if (!wheeling) {
      wheeling = true;
      wheelFrom = target;
    }
    target += clamp(d / clamp(w0 * 1.1, 300, 560), -0.5, 0.5);
    wheelTimer = window.setTimeout(endWheel, 150);
    kick();
  }

  /* ---------- keyboard and focus ---------- */
  function onKey(e: KeyboardEvent) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.querySelector('dialog[open]')) return;
    const ae = document.activeElement as HTMLElement | null;

    if (view === 'index') {
      if (e.key === 'Escape') {
        e.preventDefault();
        setView('ring');
        viewBtns.find((b) => b.dataset.viewBtn === 'ring')?.focus();
        return;
      }
      const at = ae ? rows.indexOf(ae as HTMLAnchorElement) : -1;
      if (at >= 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        rows[clamp(at + (e.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1)].focus();
      }
      return;
    }

    const onPlate = !!ae && ae.matches('[data-plate]') && root!.contains(ae);
    // Anywhere in the home UI (stage, plates, view toggle) or nowhere in particular.
    const neutral = !ae || ae === document.body || ae.id === 'main' || root!.contains(ae);
    if (!onPlate && !neutral) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        step(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        step(-1);
        break;
      case 'Home':
        goTo(0);
        break;
      case 'End':
        goTo(n - 1);
        break;
      case 'Enter':
        // Open the front project, as a click on it would.
        if (ae !== stage) return;
        e.preventDefault();
        plates[heading()].click();
        return;
      default:
        return;
    }
    e.preventDefault();
    dismissHint();
    // On a plate, focus follows the ring and the plate's name says where it is;
    // anywhere else (the stage, the view toggle) the live region says it.
    if (onPlate) plates[heading()].focus({ preventScroll: true });
    else announce(heading());
  }

  function onFocusIn(e: FocusEvent) {
    const plate = (e.target as Element).closest?.<HTMLAnchorElement>('[data-plate]');
    if (!plate || dragging || !plate.matches(':focus-visible')) return;
    const i = plates.indexOf(plate);
    goTo(i);
    spoken(i);
  }

  /* ---------- views ---------- */
  function setView(next: View) {
    if (next === view) return;
    view = next;
    if (dragging) endDrag(true, performance.now());
    if (wheeling) {
      window.clearTimeout(wheelTimer);
      endWheel();
    }
    // Plates leave nearest-first; they come back after the list has gone.
    for (let i = 0; i < n; i++) {
      const d = Math.min(3, Math.abs(wrapK(i - cur, n)));
      const delay = reduce ? 0 : next === 'index' ? d * 55 : 240 + d * 70;
      plates[i].style.setProperty('--dd', `${Math.round(delay)}ms`);
    }
    root!.removeAttribute('data-intro');
    root!.dataset.view = next;
    for (const b of viewBtns) b.setAttribute('aria-pressed', String(b.dataset.viewBtn === next));
    stage!.inert = next !== 'ring';
    if (index) {
      index.inert = next !== 'index';
      if (next === 'index') index.scrollTop = 0;
    }
    if (next === 'ring') {
      hidePeek();
      // A preview that was handed the shared name gives it back.
      if (peekName) {
        peekItems.forEach((it) => it.style.removeProperty('view-transition-name'));
        peekName = '';
      }
    }
    dismissHint();
  }

  function onViewClick(e: MouseEvent) {
    const v = (e.currentTarget as HTMLElement).dataset.viewBtn;
    if (v === 'ring' || v === 'index') setView(v);
  }

  /* ---------- index preview ---------- */
  /*
   * Placement and motion come from components/home/preview-follow.ts: beside
   * the pointer, never over the hovered name, below the header, with the same
   * follow, lean and rise as the /work/ list. A keyboard-focused row gets it
   * after its name, just above or below the row so its focus ring stays clear.
   */
  const peekFollow = peek ? follower(peek, reduce) : null;
  let peekShown = false;
  let peekSlug = '';
  /** The row the preview belongs to, and whether keyboard focus (not the pointer) put it there. */
  let peekRow: HTMLElement | null = null;
  let peekByKey = false;
  let pointerX = -1;
  let pointerY = -1;
  let peekBox: PreviewBox | null = null;
  /** How far a hovered name slides over, px (--name-shift in IndexList.astro). */
  let nameShift = 0;

  /**
   * The preview's size, and the highest it may sit: the top of the list, just
   * under the header. Measured on first use and again after a resize. Null
   * while the preview is not displayed (no fine pointer, or not ready yet).
   */
  function measurePeek(): PreviewBox | null {
    if (peekBox || !peek || !index) return peekBox;
    const w = peek.offsetWidth;
    if (!w) return null;
    peekBox = { w, h: peek.offsetHeight || w * 1.25, top: index.getBoundingClientRect().top };
    const name = rowsEl?.querySelector('.name');
    nameShift = name ? parseFloat(getComputedStyle(name).getPropertyValue('--name-shift')) || 0 : 0;
    return peekBox;
  }

  /**
   * Right edge of a row's name where it comes to rest: its layout box, plus the
   * slide when hovered. (Its drawn box would lag while the slide runs.)
   */
  function nameRight(row: HTMLElement, hovered: boolean): number {
    const name = row.querySelector<HTMLElement>('.name');
    const parent = name?.offsetParent;
    if (!name || !parent) return 0;
    const left = parent.getBoundingClientRect().left + parent.clientLeft;
    return left + name.offsetLeft + name.offsetWidth + (hovered ? nameShift : 0);
  }

  function placePeek(row: HTMLElement, byKey: boolean): boolean {
    const box = measurePeek();
    if (!box || !peekFollow) return false;
    const aim = byKey
      ? aimAtRow(row.getBoundingClientRect(), nameRight(row, false), box)
      : aimAtPointer(pointerX, pointerY, nameRight(row, true), box);
    // A hidden preview appears at its aim instead of flying in from its last spot.
    peekFollow.to(aim, !peekShown);
    return true;
  }

  function showPeek(row: HTMLElement, byKey: boolean) {
    const slug = row.dataset.slug;
    if (!peek || !slug || view !== 'index' || !fine.matches) return;
    if (!placePeek(row, byKey)) return;
    peekRow = row;
    peekByKey = byKey;
    if (slug !== peekSlug) {
      for (const it of peekItems) it.classList.toggle('is-on', it.dataset.peekItem === slug);
      peekSlug = slug;
    }
    peekShown = true;
    peek.classList.add('is-on');
  }

  function hidePeek() {
    peekShown = false;
    peekRow = null;
    peek?.classList.remove('is-on');
  }

  const rowOf = (el: EventTarget | null) => (el instanceof Element ? el.closest<HTMLElement>('[data-row]') : null);

  function onRowsOver(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    pointerX = e.clientX;
    pointerY = e.clientY;
    const row = rowOf(e.target);
    if (row) showPeek(row, false);
  }

  function onWindowMove(e: PointerEvent) {
    if (view !== 'index' || e.pointerType !== 'mouse') return;
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (peekShown && peekRow && !peekByKey) placePeek(peekRow, false);
  }

  function onRowsFocusIn(e: FocusEvent) {
    const row = rowOf(e.target);
    if (row?.matches(':focus-visible')) showPeek(row, true);
  }

  function onRowsFocusOut(e: FocusEvent) {
    if (peekByKey && !rowOf(e.relatedTarget)) hidePeek();
  }

  // The list scrolls under a still pointer (or a focused row moves): follow what is there now.
  function onIndexScroll() {
    if (!peekShown || !peekRow) return;
    if (peekByKey) {
      placePeek(peekRow, true);
      return;
    }
    const row = rowOf(document.elementFromPoint(pointerX, pointerY));
    if (row && rowsEl?.contains(row)) showPeek(row, false);
    else hidePeek();
  }

  /* ---------- leaving the page ---------- */

  function onBeforePreparation(ev: Event) {
    const e = ev as TransitionBeforePreparationEvent;
    let keep = -1;
    // Only a case page has a partner for a plate (its hero), and only a plate
    // in full view may travel: a snapshot ignores the plate's fade and veil.
    if (view === 'ring' && !peekName) {
      const i = plateForPath(plates, e.to.pathname);
      if (i >= 0 && Math.abs(wrapK(i - cur, n)) <= 1.01) keep = i;
    }
    nameOnly(plates, keep);
    const name = peekName || (keep >= 0 ? (plates[keep].dataset.vt ?? '') : '');
    if (!name || reduce) return;
    const load = e.loader;
    e.loader = async () => {
      await load();
      await warmShared(e.newDocument, name);
    };
  }

  function onRowClick(e: MouseEvent) {
    const row = (e.target as Element).closest<HTMLAnchorElement>('[data-row]');
    if (!row || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const slug = row.dataset.slug ?? '';
    const i = plates.findIndex((p) => p.dataset.slug === slug);
    if (i >= 0) write(STORE_FRONT, String(i));
    // Hand the shared name to the preview so it, not the hidden plate, becomes the case hero.
    if (!peek || !peekShown || peekSlug !== slug) return;
    const item = peekItems.find((it) => it.dataset.peekItem === slug);
    const name = row.dataset.vt;
    if (!item || !name) return;
    item.style.setProperty('view-transition-name', name);
    peekName = name;
  }

  /* ---------- resize ---------- */
  let resizeRaf = 0;
  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      geo = geometry();
      w0 = plateWidth(plates[0]);
      for (const c of cache) c.t = '';
      render();
      peekBox = null;
      if (peekShown && !fine.matches) hidePeek();
    });
  }

  /* ---------- start ---------- */
  plates.forEach((p, i) => p.classList.toggle('is-front', i === active));
  render();

  // Once the first screen is in, fetch the rest of the plates and the previews.
  const warm = () => {
    root!.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
    root!.setAttribute('data-peek-ready', '');
  };
  const hasIdle = typeof window.requestIdleCallback === 'function';
  const idleId = hasIdle ? window.requestIdleCallback(warm, { timeout: 2500 }) : window.setTimeout(warm, 1500);

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('mousedown', onMouseDown);
  stage.addEventListener('dragstart', onDragStart);
  stage.addEventListener('click', onClick, true);
  stage.addEventListener('focusin', onFocusIn);
  root.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onWindowMove, { passive: true });
  viewBtns.forEach((b) => b.addEventListener('click', onViewClick));
  rowsEl?.addEventListener('pointerover', onRowsOver);
  rowsEl?.addEventListener('pointerleave', hidePeek);
  rowsEl?.addEventListener('focusin', onRowsFocusIn);
  rowsEl?.addEventListener('focusout', onRowsFocusOut);
  rowsEl?.addEventListener('click', onRowClick);
  index?.addEventListener('scroll', onIndexScroll, { passive: true });
  document.addEventListener('astro:before-preparation', onBeforePreparation);

  return () => {
    endDrag(true, performance.now());
    unpress();
    cancelAnimationFrame(raf);
    peekFollow?.stop();
    cancelAnimationFrame(resizeRaf);
    window.clearTimeout(wheelTimer);
    window.clearTimeout(introTimer);
    window.clearTimeout(announceTimer);
    if (hasIdle) window.cancelIdleCallback(idleId);
    else window.clearTimeout(idleId);
    write(STORE_FRONT, String(heading()));
    stage.removeEventListener('pointerdown', onPointerDown);
    stage.removeEventListener('mousedown', onMouseDown);
    stage.removeEventListener('dragstart', onDragStart);
    stage.removeEventListener('click', onClick, true);
    stage.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onWindowMove);
    viewBtns.forEach((b) => b.removeEventListener('click', onViewClick));
    rowsEl?.removeEventListener('pointerover', onRowsOver);
    rowsEl?.removeEventListener('pointerleave', hidePeek);
    rowsEl?.removeEventListener('focusin', onRowsFocusIn);
    rowsEl?.removeEventListener('focusout', onRowsFocusOut);
    rowsEl?.removeEventListener('click', onRowClick);
    index?.removeEventListener('scroll', onIndexScroll);
    document.removeEventListener('astro:before-preparation', onBeforePreparation);
  };
}
