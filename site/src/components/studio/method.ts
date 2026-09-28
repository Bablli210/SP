/**
 * The method strip on the Studio page (components/studio/Method.astro).
 *
 * Mouse and trackpad ("drag" mode): the strip moves by transform. One rAF loop
 * eases its position toward a target and stops when it settles.
 * - A drag follows the hand; on release the strip keeps the hand's speed and
 *   glides to the nearest step. Past either end it resists, then eases back
 *   (no overshoot, no bounce).
 * - Horizontal wheel and trackpad swipes move it; vertical wheel scrolls the page.
 * - The ← → buttons, arrow keys, Home and End step through.
 * - Each image drifts a little inside its frame as the strip moves.
 *
 * Touch screens ("native" mode) keep the CSS scroller with snap points, which
 * is also the no-script fallback. The buttons and the progress rail work in
 * both modes. Reduced motion: no glide, no throw, no drift; steps are instant.
 *
 * When the five steps (nearly) fit, the strip is "static": a plain full-width
 * row with nothing to move, so the controls, the rail and the region's focus
 * stop go away.
 */
import { reducedMotion } from '../../scripts/motion';

/** Time constants (ms) of the eased follow: while the hand drives, and while gliding to rest. */
const TAU_HAND = 45;
const TAU_GLIDE = 240;
/** Slowest the strip moves before it stops (px per ms): the last pixels finish briskly, not in a crawl. */
const MIN_SPEED = 0.05;
/** A press that travels further than this (px) is a drag. */
const DRAG_THRESHOLD = 5;
/** A release this far past a step (share of one step) carries on to the next one. */
const COMMIT = 0.22;
/** Longest throw, in steps. */
const MAX_THROW = 2.5;
/** Image drift inside its frame at the viewport edge, % of the image width. Keep below (zoom - 1) / 2. */
const DRIFT = 5;
const ZOOM = 1.12;

const FINE = '(hover: hover) and (pointer: fine)';

/** Below this much travel (share of one step) the row is laid out to fit instead of moving. */
const STATIC_BELOW = 0.5;

const LABELS: Record<Mode, string> = {
  drag: 'Method, {n} steps. Drag, or use the arrow keys, to move through them.',
  native: 'Method, {n} steps. Swipe or scroll sideways to move through them.',
};

type Mode = 'drag' | 'native';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function initMethod(): (() => void) | void {
  const root = document.querySelector<HTMLElement>('[data-method]');
  if (!root) return;
  const viewport = root.querySelector<HTMLElement>('[data-viewport]');
  const track = root.querySelector<HTMLElement>('[data-track]');
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
  if (!viewport || !track || !steps.length) return;
  const thumb = root.querySelector<HTMLElement>('[data-thumb]');
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-prev]');
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-next]');
  const imgs = steps.map((s) => s.querySelector<HTMLImageElement>('.media img'));

  const reduce = reducedMotion();
  const fine = window.matchMedia(FINE);
  let mode: Mode = 'native';
  let drift = false;
  let still = false; // the static row: everything fits, nothing moves

  /* ---------- geometry (re-measured on resize) ---------- */
  let vw = 0; // visible width
  let max = 0; // furthest the strip travels
  let stops: number[] = [0]; // rest positions, one per step that can lead
  let spacing = 1; // one step: card + gap
  let centers: number[] = []; // card centres in track coordinates
  let ratio = 1; // visible share of the strip

  function measure() {
    // Measure the strip at its natural width (the static row is laid out to fit, so it can't tell).
    root!.classList.remove('is-static');
    vw = viewport!.clientWidth;
    const tw = track!.offsetWidth;
    max = Math.max(0, Math.round(tw - vw));
    spacing = steps.length > 1 ? steps[1].offsetLeft - steps[0].offsetLeft : steps[0].offsetWidth || 1;
    // A strip that barely overflows (or doesn't) becomes a full-width row: nothing to move.
    setStill(max < spacing * STATIC_BELOW);
    if (still) max = 0;
    const padL = parseFloat(getComputedStyle(track!).paddingLeft) || 0;
    const raw = steps.map((s) => Math.round(clamp(s.offsetLeft - padL, 0, max)));
    stops = raw.filter((v, i) => i === 0 || v - raw[i - 1] > 2);
    if (stops[stops.length - 1] < max) stops.push(max);
    centers = steps.map((s) => s.offsetLeft + s.offsetWidth / 2);
    ratio = still ? 1 : tw > 0 ? Math.min(1, vw / tw) : 1;
    if (thumb) thumb.style.width = `${(ratio * 100).toFixed(3)}%`;
  }

  /** The static row drops the region's focus stop and name: there is nothing to operate. */
  function setStill(next: boolean) {
    still = next;
    root!.classList.toggle('is-static', still);
    if (still) {
      viewport!.removeAttribute('tabindex');
      viewport!.removeAttribute('role');
      viewport!.removeAttribute('aria-label');
    } else {
      viewport!.setAttribute('tabindex', '0');
      viewport!.setAttribute('role', 'region');
      viewport!.setAttribute('aria-label', LABELS[mode].replace('{n}', String(steps.length)));
    }
  }

  /** Nearest rest position, leaning `dir` (±1) by COMMIT of a step. */
  function pick(pos: number, dir: number) {
    const aim = clamp(pos + dir * spacing * COMMIT, 0, max);
    let best = stops[0];
    for (const s of stops) if (Math.abs(s - aim) < Math.abs(best - aim)) best = s;
    return best;
  }

  const nearestIndex = (pos: number) => {
    let bi = 0;
    stops.forEach((s, i) => {
      if (Math.abs(s - pos) < Math.abs(stops[bi] - pos)) bi = i;
    });
    return bi;
  };

  /** Resistance past either end: follows at half speed, then less and less. */
  const rubber = (o: number) => {
    const d = 200;
    return d * (1 - 1 / ((o * 0.5) / d + 1));
  };
  const band = (v: number) => (v < 0 ? -rubber(-v) : v > max ? max + rubber(v - max) : v);

  /* ---------- paint ---------- */
  let x = 0; // shown position
  let target = 0; // where it is heading (raw, may be past the ends while dragging)
  let atStart: boolean | null = null;
  let atEnd: boolean | null = null;

  function syncButtons(pos: number) {
    const s = still || pos <= 1;
    const e = still || pos >= max - 1;
    if (s !== atStart) prevBtn?.setAttribute('aria-disabled', String((atStart = s)));
    if (e !== atEnd) nextBtn?.setAttribute('aria-disabled', String((atEnd = e)));
  }

  function progress(pos: number) {
    if (!thumb) return;
    const p = max > 0 ? clamp(pos / max, 0, 1) : 0;
    thumb.style.transform = `translate3d(${(p * (1 / ratio - 1) * 100).toFixed(3)}%, 0, 0)`;
  }

  function paint() {
    track!.style.transform = `translate3d(${(-x).toFixed(2)}px, 0, 0)`;
    if (drift) {
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (!img) continue;
        const n = still ? 0 : clamp((centers[i] - x - vw / 2) / vw, -1, 1);
        img.style.transform = `translate3d(${(-n * DRIFT).toFixed(3)}%, 0, 0) scale(${ZOOM})`;
      }
    }
    progress(x);
  }

  /* ---------- loop ---------- */
  let raf = 0;
  let lastT = 0;
  let dragging = false;
  let wheeling = false;

  function tick(now: number) {
    // The first frame after a start has no previous time (and a frame's timestamp
    // can predate the call that asked for it): count it as one frame.
    const dt = lastT ? clamp(now - lastT, 1, 48) : 16.7;
    lastT = now;
    const hand = dragging || wheeling;
    const goal = dragging ? band(target) : target;
    const diff = goal - x;
    if (reduce) x = goal;
    else {
      let move = diff * (1 - Math.exp(-dt / (hand ? TAU_HAND : TAU_GLIDE)));
      // In the last few pixels, finish at a slow constant speed instead of creeping.
      const floor = MIN_SPEED * dt;
      if (Math.abs(move) < floor) move = Math.sign(diff) * Math.min(Math.abs(diff), floor);
      x += move;
    }
    const done = Math.abs(goal - x) < 0.01;
    if (done) x = goal;
    paint();
    if (done) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function kick() {
    syncButtons(target);
    if (raf) return;
    lastT = 0;
    raf = requestAnimationFrame(tick);
  }

  /** Move to a rest position: eased in drag mode, the native scroller otherwise. */
  function to(dest: number) {
    if (mode === 'drag') {
      target = dest;
      kick();
    } else {
      viewport!.scrollTo({ left: dest, behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  function go(dir: number) {
    const cur = mode === 'drag' ? target : viewport!.scrollLeft;
    const dest =
      dir > 0 ? (stops.find((s) => s > cur + 2) ?? max) : ([...stops].reverse().find((s) => s < cur - 2) ?? 0);
    to(dest);
  }

  /* ---------- drag ---------- */
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let from = 0;
  let moved = false;
  let samples: [number, number][] = [];

  function onPointerDown(e: PointerEvent) {
    if (mode !== 'drag' || still || !e.isPrimary || dragging) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = e.clientY;
    // Catch the strip where it is, even mid-glide.
    target = from = x;
    samples = [[e.timeStamp, x]];
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    if (raf) kick();
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (!moved) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // A vertical touch swipe is the page scrolling, not the strip.
      if (e.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) {
        endDrag(true, e.timeStamp);
        return;
      }
      moved = true;
      root!.classList.add('is-dragging');
    }
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    if (!dx) return;
    target -= dx;
    samples.push([e.timeStamp, band(target)]);
    while (samples.length > 2 && e.timeStamp - samples[0][0] > 100) samples.shift();
    kick();
  }

  function detachDrag() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  function endDrag(cancelled: boolean, time: number) {
    if (!dragging) return;
    dragging = false;
    pointerId = -1;
    detachDrag();
    root!.classList.remove('is-dragging');
    const pos = band(target);
    let dest = pos;
    if (moved && !cancelled && !reduce && samples.length > 1) {
      const [t0, x0] = samples[0];
      const [t1, x1] = samples[samples.length - 1];
      const v = t1 > t0 && time - t1 < 80 ? (x1 - x0) / (t1 - t0) : 0; // px per ms
      // An eased follow with time constant T travels v·T: project the glide.
      dest = pos + clamp(v * TAU_GLIDE, -MAX_THROW * spacing, MAX_THROW * spacing);
    }
    target = pick(dest, moved ? Math.sign(dest - from) : 0);
    kick();
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    endDrag(e.type === 'pointercancel', e.timeStamp);
  }

  function onBlur() {
    endDrag(true, performance.now());
  }

  function onDragStart(e: DragEvent) {
    e.preventDefault();
  }

  /* ---------- wheel and trackpad ---------- */
  let wheelTimer = 0;
  let wheelDir = 0;

  function endWheel() {
    wheeling = false;
    target = pick(target, wheelDir);
    kick();
  }

  function onWheel(e: WheelEvent) {
    if (mode !== 'drag' || still || e.ctrlKey || dragging) return;
    let d = e.deltaX;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) {
      // Vertical: the page scrolls (Lenis), unless shift turns it sideways.
      if (!e.shiftKey) return;
      d = e.deltaY;
    }
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= vw;
    e.preventDefault();
    e.stopPropagation();
    if (!d) return;
    wheeling = true;
    wheelDir = Math.sign(d);
    target = clamp(target + d, 0, max);
    kick();
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(endWheel, 140);
  }

  /* ---------- keys and buttons ---------- */
  function onKey(e: KeyboardEvent) {
    if (mode !== 'drag' || still || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(max);
    else return;
    e.preventDefault();
  }

  const onPrev = () => {
    if (prevBtn?.getAttribute('aria-disabled') !== 'true') go(-1);
  };
  const onNext = () => {
    if (nextBtn?.getAttribute('aria-disabled') !== 'true') go(1);
  };

  /* ---------- native scroller ---------- */
  let scrollRaf = 0;
  function onScroll() {
    if (mode !== 'native' || scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      x = viewport!.scrollLeft;
      progress(x);
      syncButtons(x);
    });
  }

  /* ---------- modes ---------- */
  function setMode(next: Mode) {
    if (next === 'drag') {
      const at = viewport!.scrollLeft;
      mode = 'drag';
      drift = !reduce;
      root!.classList.add('is-drag');
      root!.classList.toggle('is-drift', drift);
      viewport!.scrollLeft = 0;
      measure();
      x = target = pick(at, 0);
      paint();
      syncButtons(target);
    } else {
      // Drop any drag or wheel in progress without settling it: the scroller takes over.
      if (dragging) {
        dragging = false;
        pointerId = -1;
        detachDrag();
        root!.classList.remove('is-dragging');
      }
      window.clearTimeout(wheelTimer);
      wheeling = false;
      cancelAnimationFrame(raf);
      raf = 0;
      mode = 'native';
      drift = false;
      root!.classList.remove('is-drag', 'is-drift');
      track!.style.transform = '';
      imgs.forEach((img) => img?.style.removeProperty('transform'));
      measure();
      // Land where the strip was heading; the scroller snaps from there.
      viewport!.scrollLeft = clamp(target, 0, max);
      x = viewport!.scrollLeft;
      progress(x);
      syncButtons(x);
    }
  }

  const onMode = () => setMode(fine.matches ? 'drag' : 'native');

  /* ---------- resize ---------- */
  let seenVW = -1;
  let seenTW = -1;
  let seenVH = window.innerHeight;
  let resizeRaf = 0;

  function relayout() {
    if (mode === 'drag') {
      if (dragging) {
        measure();
        // The row now fits: let go, it has nowhere to move.
        if (still) endDrag(true, performance.now());
        return;
      }
      // Stay on the same step; jump there, no glide.
      const i = nearestIndex(target);
      measure();
      cancelAnimationFrame(raf);
      raf = 0;
      x = target = stops[Math.min(i, stops.length - 1)];
      paint();
      syncButtons(target);
    } else {
      measure();
      x = viewport!.scrollLeft;
      progress(x);
      syncButtons(x);
    }
  }

  const ro = new ResizeObserver(() => {
    // Only widths matter (heights change as fonts and images arrive).
    const w = viewport!.clientWidth;
    const t = track!.offsetWidth;
    if (w === seenVW && t === seenTW) return;
    seenVW = w;
    seenTW = t;
    relayout();
  });

  /* The card size also follows the window height, which the static row (laid out
     to fit the width) doesn't show to the observer. Mouse and trackpad only: on
     touch screens the height moves with the browser's toolbars. */
  function onResize() {
    if (!fine.matches || window.innerHeight === seenVH || resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      seenVH = window.innerHeight;
      relayout();
    });
  }

  /* Steps off to the side sit behind a clip that native lazy loading does not
     see through: load them all once the strip is near. */
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      imgs.forEach((img) => {
        if (img) img.loading = 'eager';
      });
      io.disconnect();
    },
    { rootMargin: '600px 0px' },
  );

  root.classList.add('is-ready');
  measure();
  setMode(fine.matches ? 'drag' : 'native');
  ro.observe(viewport);
  ro.observe(track);
  io.observe(viewport);

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('dragstart', onDragStart);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('keydown', onKey);
  viewport.addEventListener('scroll', onScroll, { passive: true });
  prevBtn?.addEventListener('click', onPrev);
  nextBtn?.addEventListener('click', onNext);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);
  fine.addEventListener('change', onMode);

  return () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(scrollRaf);
    cancelAnimationFrame(resizeRaf);
    raf = scrollRaf = resizeRaf = 0;
    window.clearTimeout(wheelTimer);
    detachDrag();
    dragging = wheeling = false;
    ro.disconnect();
    io.disconnect();
    viewport.removeEventListener('pointerdown', onPointerDown);
    viewport.removeEventListener('dragstart', onDragStart);
    viewport.removeEventListener('wheel', onWheel);
    viewport.removeEventListener('keydown', onKey);
    viewport.removeEventListener('scroll', onScroll);
    prevBtn?.removeEventListener('click', onPrev);
    nextBtn?.removeEventListener('click', onNext);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    fine.removeEventListener('change', onMode);
    root.classList.remove('is-ready');
  };
}
