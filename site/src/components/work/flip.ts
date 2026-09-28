/**
 * Layout motion for the work index, transform and opacity only.
 *
 * applySet() shows exactly a subset of items. Leavers are lifted out of the
 * flow and fade where they stand, the rest glide to their new places (FLIP),
 * newcomers rise in. It measures what is on screen, so a change that arrives
 * mid-animation picks up from where things are instead of jumping.
 */
export const EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';
export const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** Every animation this page starts carries this id, so it can find and stop its own. */
export const TAG = 'work-motion';

/**
 * The first-load reveal, handed over to script at the point it had reached
 * (see settle() in controller.ts). It keeps running under later motion, except
 * on an element that layout motion moves: that motion measures from where the
 * element is on screen, so it takes over from the hand-off.
 */
export const SETTLE_TAG = 'work-settle';

export const own = (el: Element, subtree = false): Animation[] =>
  el.getAnimations({ subtree }).filter((a) => a.id === TAG);

export const stop = (el: Element, subtree = false): void => own(el, subtree).forEach((a) => a.cancel());

const yieldSettle = (el: Element): void =>
  el.getAnimations().forEach((a) => {
    if (a.id === SETTLE_TAG) a.cancel();
  });

export interface SetMotion {
  /** Keyframe a leaver fades to. */
  leave: Keyframe;
  /** Element and keyframes a newcomer rises from. */
  enter: (el: HTMLElement) => Array<{ target: HTMLElement; from: Keyframe; pseudo?: string }>;
}

function release(el: HTMLElement): void {
  el.classList.remove('is-leaving');
  for (const p of ['position', 'left', 'top', 'width', 'height', 'margin'] as const) el.style.removeProperty(p);
}

/** Jump every item to its final state (used before a view switch or teardown). */
export function commit(items: HTMLElement[]): void {
  for (const el of items) {
    stop(el, true);
    if (el.classList.contains('is-leaving')) {
      el.hidden = true;
      release(el);
    }
  }
}

/**
 * Show exactly `show` among `items` inside `container` (the items' positioned parent).
 * Resolves `left` once the leavers are gone from the layout.
 */
export function applySet(
  container: HTMLElement,
  items: HTMLElement[],
  show: Set<HTMLElement>,
  motion: SetMotion,
): { left: Promise<void> } {
  const box = container.getBoundingClientRect();
  const originX = box.left + container.clientLeft;
  const originY = box.top + container.clientTop;

  // 1. First: where everything is right now, mid-flight included.
  const first = new Map<HTMLElement, { rect: DOMRect; opacity: number }>();
  for (const el of items) {
    if (el.hidden) continue;
    if (el.classList.contains('is-leaving') && !show.has(el)) continue; // already on its way out
    first.set(el, { rect: el.getBoundingClientRect(), opacity: Number(getComputedStyle(el).opacity) });
  }

  // 2. Stop what was running, except leavers that keep leaving.
  for (const el of items) {
    const stillLeaving = el.classList.contains('is-leaving') && !show.has(el);
    if (stillLeaving) continue;
    stop(el, true);
    yieldSettle(el);
    if (el.classList.contains('is-leaving')) release(el);
  }

  const leaving: HTMLElement[] = [];
  const entering: HTMLElement[] = [];
  const staying: HTMLElement[] = [];
  for (const el of items) {
    if (el.classList.contains('is-leaving')) continue;
    const was = first.has(el);
    const will = show.has(el);
    if (was && will) staying.push(el);
    else if (was) leaving.push(el);
    else if (will) entering.push(el);
  }

  // 3. Lift leavers out of the flow at the spot they occupy on screen.
  for (const el of leaving) {
    const r = first.get(el)!.rect;
    el.classList.add('is-leaving');
    el.style.position = 'absolute';
    el.style.left = `${r.left - originX}px`;
    el.style.top = `${r.top - originY}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
    el.style.margin = '0';
  }
  for (const el of entering) el.hidden = false;

  // 4. Last + invert + play.
  const pending: Promise<unknown>[] = [];
  for (const el of leaving) {
    const from = first.get(el)!.opacity;
    const a = el.animate([{ opacity: from }, { ...motion.leave, opacity: 0 }], {
      duration: 340,
      easing: EASE,
      fill: 'forwards',
      id: TAG,
    });
    pending.push(
      a.finished.then(
        () => {
          el.hidden = true;
          release(el);
          a.cancel();
        },
        () => {},
      ),
    );
  }
  for (const el of staying) {
    const f = first.get(el)!;
    const r = el.getBoundingClientRect();
    const dx = f.rect.left - r.left;
    const dy = f.rect.top - r.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && f.opacity > 0.99) continue;
    el.animate(
      [
        { transform: `translate3d(${dx}px, ${dy}px, 0)`, opacity: f.opacity },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 850, delay: 110, easing: EASE, fill: 'backwards', id: TAG },
    );
  }
  entering.forEach((el, i) => {
    for (const { target, from, pseudo } of motion.enter(el)) {
      target.animate([from, { transform: 'none', opacity: 1 }], {
        duration: 900,
        delay: 260 + i * 55,
        easing: EASE_OUT,
        fill: 'backwards',
        id: TAG,
        pseudoElement: pseudo,
      });
    }
  });

  return { left: Promise.all(pending).then(() => undefined) };
}
