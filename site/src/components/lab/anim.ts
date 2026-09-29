/**
 * Small helpers for the Lab's scripted motion (transform and opacity only).
 * Every animation carries TAG, so the page can find and stop its own, and
 * anything interrupted restarts from where it is on screen, never from a jump.
 */
export const EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';
export const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** Motion that answers a press: starts at once, settles softly (--ease-press in global.css). */
export const EASE_PRESS = 'cubic-bezier(0.2, 0, 0, 1)';
export const TAG = 'lab-motion';

export const own = (el: Element, subtree = false): Animation[] =>
  el.getAnimations({ subtree }).filter((a) => a.id === TAG);

export const stop = (el: Element, subtree = false): void => own(el, subtree).forEach((a) => a.cancel());

export type Pose = {
  transform: string;
  opacity: number;
};

/** Where an element is right now (mid-animation or mid-drag included); then stop its motion. */
export function pose(el: HTMLElement): Pose {
  const cs = getComputedStyle(el);
  const p = { transform: cs.transform, opacity: Number(cs.opacity) };
  stop(el);
  el.style.removeProperty('transform');
  el.style.removeProperty('opacity');
  return p;
}

export function play(el: Element, keyframes: Keyframe[], opts: KeyframeAnimationOptions): Animation {
  return el.animate(keyframes, { ...opts, id: TAG });
}

/** Transform that puts a box laid out at `to` over the box `from` (transform-origin 0 0, same ratio). */
export const flip = (from: DOMRect, to: DOMRect): string =>
  `translate3d(${(from.left - to.left).toFixed(2)}px, ${(from.top - to.top).toFixed(2)}px, 0) scale(${(from.width / to.width).toFixed(5)})`;

/** Settles with the animation, whether it finished or was cancelled. */
export const done = (a: Animation): Promise<boolean> =>
  a.finished.then(
    () => true,
    () => false,
  );
