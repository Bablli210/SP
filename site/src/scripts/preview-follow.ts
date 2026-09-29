/**
 * The cover preview that follows the cursor over a list of projects: the home
 * Index (src/scripts/ring.ts) and the /work/ list (src/components/work/peek.ts).
 * One place for how it is placed and how it moves, so both lists behave alike.
 *
 * - It sits beside the pointer but never over the hovered name, and swings to
 *   the pointer's other side near the right edge of the window.
 * - It stays below the fixed header and inside the window.
 * - One rAF loop eases it toward its aim and leans it by the distance it
 *   trails; the loop stops once it has settled. It arrives with a short rise.
 * - Reduced motion: it sits at its aim, with no lag, lean or rise.
 *
 * Pure placement and a follower: callers measure (outside any rAF write) and
 * pass the numbers in, so nothing here reads layout.
 */
import { clamp } from './motion';

/** Space between the pointer (or the end of the name) and the preview, px. */
export const PREVIEW_GAP = 28;
/** Margin kept to the window's right and bottom edges, px. */
const EDGE = 16;
/** Space between a keyboard-focused row and the preview above or below it, px. */
const ROW_GAP = 12;
/** Share of the remaining distance covered per 60 Hz frame (a time constant of about 110 ms). */
const FOLLOW = 0.14;
/** Lean (deg) per px the preview trails by, and its limit. */
const LEAN = 0.035;
const MAX_LEAN = 7;
/** The preview appears this far below its aim and rises into place, px. */
const RISE = 24;

export interface PreviewBox {
  /** Size of the preview, px. */
  w: number;
  h: number;
  /** Highest the preview may sit: just under the fixed header, px from the top of the window. */
  top: number;
}

export interface Aim {
  x: number;
  y: number;
}

const inWindow = (y: number, box: PreviewBox) => clamp(y, box.top, Math.max(box.top, window.innerHeight - box.h - EDGE));

/**
 * Beside the pointer at (px, py), clear of the hovered name (its right edge in
 * px, or 0 when there is none to keep clear of).
 */
export function aimAtPointer(px: number, py: number, nameRight: number, box: PreviewBox): Aim {
  const vw = document.documentElement.clientWidth;
  let x = Math.max(px + PREVIEW_GAP, nameRight ? nameRight + PREVIEW_GAP : 0);
  if (x + box.w > vw - EDGE) x = px - PREVIEW_GAP - box.w;
  return { x, y: inWindow(py - box.h / 2, box) };
}

/**
 * Beside a keyboard-focused row: after its name, and just below the row (or
 * above it, near the bottom of the window) so the row's focus ring stays in
 * full view. Level with the row only when neither fits.
 */
export function aimAtRow(row: DOMRect, nameRight: number, box: PreviewBox): Aim {
  const x = Math.min((nameRight || row.left) + PREVIEW_GAP, row.right - box.w - EDGE);
  const below = row.bottom + ROW_GAP;
  const above = row.top - ROW_GAP - box.h;
  if (below + box.h <= window.innerHeight - EDGE) return { x, y: below };
  if (above >= box.top) return { x, y: above };
  return { x, y: inWindow(row.top + row.height / 2 - box.h / 2, box) };
}

export interface Follower {
  /**
   * Head for `aim`. With `arrive`, appear there (rising into place) instead of
   * travelling from wherever the preview last was.
   */
  to(aim: Aim, arrive?: boolean): void;
  /** Stop the loop where it is. */
  stop(): void;
}

export function follower(el: HTMLElement, reduce: boolean): Follower {
  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  let rot = 0;
  let raf = 0;
  let last = 0;

  const tick = (now: number) => {
    // The first frame's timestamp can precede the call that started the loop.
    const dt = last ? Math.min(64, Math.max(1, now - last)) : 16.667;
    last = now;
    if (reduce) {
      x = tx;
      y = ty;
      rot = 0;
    } else {
      const k = 1 - Math.pow(1 - FOLLOW, dt / 16.667);
      x += (tx - x) * k;
      y += (ty - y) * k;
      const lean = clamp((tx - x) * LEAN, -MAX_LEAN, MAX_LEAN);
      rot += (lean - rot) * Math.min(1, k * 1.6);
    }
    const settled = Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1 && Math.abs(rot) < 0.01;
    if (settled) {
      x = tx;
      y = ty;
      rot = 0;
    }
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg)`;
    raf = settled ? 0 : requestAnimationFrame(tick);
  };

  return {
    to(aim, arrive = false) {
      tx = aim.x;
      ty = aim.y;
      if (arrive) {
        x = tx;
        y = ty + (reduce ? 0 : RISE);
        rot = 0;
      }
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
