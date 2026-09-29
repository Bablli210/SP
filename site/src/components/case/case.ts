/**
 * Case study behaviour.
 *
 * - Parallax: the hero cover and the Next band's cover drift slower than the
 *   page. Driven by the scroll itself (Lenis' scroll event, which fires in the
 *   same frame it moves the page, or the native scroll event), so there is no
 *   loop to run and nothing to settle. Transform only; off for reduced motion.
 * - Close and Esc: back to the page the case was opened from, with its place
 *   kept: the nearest earlier page of this site in the tab's history that is
 *   not a case (the ring, the work index with its filter, Services...), so a
 *   run of Next projects closes as a whole. With none (arrived directly, or a
 *   browser without the Navigation API), to /work/. Once a way out has
 *   started, further presses do nothing (a double click must never step back
 *   twice). Close sits in the header row (Header.astro) and stays put.
 * - Header: Header.astro turns its backdrop solid once the hero (marked
 *   data-header-until) has passed beneath it.
 * - Shared elements: on the way out, only the element that should morph keeps
 *   its name: the hero when it is mostly on screen and we head for the ring
 *   or the index, the Next band's cover when we head for the next case (and
 *   then the next page is told, so it keeps this one still under the cover
 *   while it grows; see [slug].astro). The hero is warmed first (warm.ts).
 * - Film: plays muted only while on screen; a control pauses or plays it.
 */
import { navigate, type TransitionBeforePreparationEvent, type TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { onPage, reducedMotion, getLenis, clamp } from '../../scripts/motion';

/** The pages a case hands its hero back to (it morphs into their plate): the home ring and the work index. */
const INDEX_PATH = /^\/(?:work\/?)?$/;
/** A case study; Close never returns to one. */
const CASE_PATH = /^\/work\/[^/]+\/?$/;
const CLOSE_HREF = '/work/';
/** Hero cover drifts at 70% of the page's speed; the Next band's at 90%. */
const HERO_RATE = 0.3;
const NEXT_RATE = 0.1;
/** Set on the incoming page's root while it arrives from the previous case's Next band. */
const ARRIVAL_ATTR = 'data-case-arrival';

const samePath = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

/** Minimal shape of the Navigation API (Chromium, Safari 26+); absent elsewhere. */
interface NavEntry {
  url: string | null;
}
interface NavigationLike {
  currentEntry: { index: number } | null;
  entries(): NavEntry[];
}

/**
 * How many steps back in this tab's history the page this case was opened
 * from is: the nearest earlier entry of this site that is not a case. 0 when
 * there is none or the browser cannot tell.
 */
function stepsToOpener(): number {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  const index = nav?.currentEntry?.index ?? -1;
  if (!nav || index < 1) return 0;
  const entries = nav.entries();
  for (let i = index - 1; i >= 0; i--) {
    const url = entries[i]?.url;
    if (!url) return 0;
    const u = new URL(url);
    if (u.origin !== location.origin) return 0;
    if (!CASE_PATH.test(u.pathname)) return index - i;
  }
  return 0;
}

/**
 * Tell the next case that it arrives from this one's Next band: its root
 * carries ARRIVAL_ATTR through the page transition (so [slug].astro keeps this
 * page still under the cover while it grows, instead of showing the new
 * page's hero ground around it), and drops it once the transition is over.
 * Only for this navigation: if it is given up, a later swap is not marked.
 */
function markNextArrival(e: TransitionBeforePreparationEvent) {
  const onSwap = (ev: Event) => {
    const s = ev as TransitionBeforeSwapEvent;
    // The router copies the new root's attributes onto this one as it swaps.
    s.newDocument.documentElement.setAttribute(ARRIVAL_ATTR, 'next');
    const drop = () => document.documentElement.removeAttribute(ARRIVAL_ATTR);
    if (s.viewTransition) s.viewTransition.finished.then(drop, drop);
    else drop();
  };
  document.addEventListener('astro:before-swap', onSwap, { once: true, signal: e.signal });
}

const timecode = (s: number) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

onPage(() => {
  const root = document.querySelector<HTMLElement>('[data-case]');
  if (!root) return;

  const reduce = reducedMotion();
  const cleanups: Array<() => void> = [];
  const listen = <K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  const hero = root.querySelector<HTMLElement>('[data-case-hero]');
  const heroMedia = hero?.querySelector<HTMLElement>('.media') ?? null;
  const heroImg = heroMedia?.querySelector('img') ?? null;
  const title = root.querySelector<HTMLElement>('[data-case-title]');
  // Close belongs to the header row, so it is looked for on the whole page.
  const closeLink = document.querySelector<HTMLAnchorElement>('[data-case-close]');
  const next = document.querySelector<HTMLElement>('[data-case-next]');
  const nextLink = next?.querySelector<HTMLAnchorElement>('[data-next-link]') ?? null;
  const nextMedia = nextLink?.querySelector<HTMLElement>('.media') ?? null;
  const nextImg = nextMedia?.querySelector('img') ?? null;

  /* ---------- Close and Esc ---------- */

  /*
   * Set as soon as a way out starts (a step back in history or a navigation),
   * so a second click or Esc before the page swaps never adds a second step
   * back. history.go() is asynchronous: if, against expectation, no navigation
   * follows it, the guard lifts again so Close never goes dead.
   */
  let leaving = false;
  let navStarted = false;
  let leaveTimer = 0;
  const startLeaving = () => {
    leaving = true;
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => {
      if (!navStarted) leaving = false;
    }, 1500);
  };
  cleanups.push(() => window.clearTimeout(leaveTimer));

  /** Returns true when it handled the navigation itself (back to the page the case was opened from). */
  const closeCase = (): boolean => {
    const steps = stepsToOpener();
    if (!steps) return false;
    startLeaving();
    history.go(-steps);
    return true;
  };

  if (closeLink) {
    const onCloseClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (leaving) {
        e.preventDefault();
        return;
      }
      if (closeCase()) e.preventDefault();
    };
    closeLink.addEventListener('click', onCloseClick);
    cleanups.push(() => closeLink.removeEventListener('click', onCloseClick));
  }

  listen(window, 'keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    // The menu (a modal dialog) closes on Esc by itself; leave that to it.
    if (document.querySelector('dialog[open]')) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (leaving) return;
    if (!closeCase()) {
      startLeaving();
      void navigate(CLOSE_HREF);
    }
  });

  /* ---------- Scroll: parallax ---------- */

  let vh = 0;
  let heroTop = 0;
  let heroH = 0;
  let bandTop = 0;
  let bandH = 0;
  let dLo = 0;
  let dHi = 0;
  let bandScale = 1;

  /** Set when the hero is handed back to the ring or the index: its framing is frozen. */
  let handingBack = false;

  const paint = (y: number) => {
    if (heroImg && !handingBack) {
      const top = heroTop - y;
      if (top + heroH > 0 && top < vh) {
        const off = Math.max(0, -top) * HERO_RATE;
        heroImg.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
      }
    }
    if (nextImg && nextLink) {
      const top = bandTop - y;
      if (top < vh && top + bandH > 0) {
        // Distance of the band's centre from the screen's centre, over the range it can travel.
        const dist = clamp(top + bandH / 2 - vh / 2, dLo, dHi);
        const off = -NEXT_RATE * (dist - (dHi + dLo) / 2);
        nextImg.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0) scale(${bandScale.toFixed(4)})`;
      }
    }
  };

  const onScroll = () => {
    if (!reduce) paint(window.scrollY);
  };

  const measure = () => {
    vh = window.innerHeight;
    const sy = window.scrollY;
    if (hero) {
      heroTop = hero.getBoundingClientRect().top + sy;
      heroH = hero.offsetHeight;
    }
    if (nextLink) {
      bandTop = nextLink.getBoundingClientRect().top + sy;
      bandH = nextLink.offsetHeight;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
      dHi = vh / 2 + bandH / 2; // band just entering at the bottom
      const dEnd = bandTop + bandH / 2 - maxScroll - vh / 2; // page scrolled to the end
      dLo = clamp(dEnd, -dHi, dHi);
      // Just enough scale that the drifting cover never shows an edge.
      bandScale = 1 + (NEXT_RATE * (dHi - dLo)) / Math.max(1, bandH) + 0.004;
    }
    if (!reduce) paint(sy);
  };

  measure();
  const lenis = getLenis();
  // Lenis emits in the same frame it moves the page (and on native scrolls), so the
  // transforms land with the scroll they belong to. Without it, the native event does.
  if (lenis) cleanups.push(lenis.on('scroll', onScroll));
  else listen(window, 'scroll', onScroll, { passive: true });

  let live = true;
  let measureRaf = 0;
  const remeasure = () => {
    if (measureRaf || !live) return;
    measureRaf = requestAnimationFrame(() => {
      measureRaf = 0;
      measure();
    });
  };
  listen(window, 'resize', remeasure);
  // Late layout changes (fonts, the footer) move the band; measure again when they land.
  const ro = new ResizeObserver(remeasure);
  ro.observe(document.body);
  void document.fonts?.ready.then(remeasure);
  cleanups.push(() => {
    live = false;
    ro.disconnect();
    cancelAnimationFrame(measureRaf);
  });

  /* ---------- Shared elements on the way out ---------- */

  const onBeforePreparation = (ev: Event) => {
    const e = ev as TransitionBeforePreparationEvent;
    const to = e.to.pathname;
    // A navigation is under way: Close and Esc stand down until the page swaps.
    leaving = true;
    navStarted = true;

    // The title only ever fades in on arrival; it never travels. Close keeps its
    // name: it holds still on the way to another case and fades out above the
    // header on the way anywhere else ([slug].astro, global.css).
    title?.style.setProperty('view-transition-name', 'none');

    if (heroMedia) {
      // Hand the cover back only while it is mostly on screen: from further down,
      // the morph would start from a strip of it. Then it leaves with the page.
      const r = heroMedia.getBoundingClientRect();
      const handBack = INDEX_PATH.test(to) && r.top > -0.2 * window.innerHeight && r.bottom > 0;
      if (handBack) {
        // Drop the parallax offset so the snapshot has the plate's own framing.
        handingBack = true;
        if (heroImg) heroImg.style.transform = '';
        heroMedia.style.removeProperty('view-transition-name');
      } else {
        heroMedia.style.setProperty('view-transition-name', 'none');
      }
    }

    // The Next band's cover becomes the next case's hero, when it is on screen to
    // travel from (Forward from further up the page just changes pages).
    if (nextLink && nextMedia) {
      const plate = nextLink.dataset.plate;
      const r = nextMedia.getBoundingClientRect();
      const toNext = !!plate && samePath(to, new URL(nextLink.href).pathname) && r.bottom > 0 && r.top < window.innerHeight;
      if (toNext) {
        nextMedia.style.setProperty('view-transition-name', plate);
        if (!reduce) markNextArrival(e);
      } else {
        nextMedia.style.removeProperty('view-transition-name');
      }
    }
  };
  document.addEventListener('astro:before-preparation', onBeforePreparation);
  cleanups.push(() => document.removeEventListener('astro:before-preparation', onBeforePreparation));

  /* ---------- Film ---------- */

  root.querySelectorAll<HTMLElement>('[data-film]').forEach((fig) => {
    const video = fig.querySelector<HTMLVideoElement>('[data-film-video]');
    const toggle = fig.querySelector<HTMLButtonElement>('[data-film-toggle]');
    const state = fig.querySelector<HTMLElement>('[data-film-state]');
    const tc = fig.querySelector<HTMLElement>('[data-film-tc]');
    if (!video || !toggle) return;

    video.muted = true;
    let inView = false;
    // Reduced motion: the film waits for a click. Otherwise it runs while on screen until paused.
    let held = reduce;

    const sync = () => {
      if (inView && !held) video.play().catch(() => {});
      else if (!video.paused) video.pause();
    };
    const label = () => {
      const playing = !video.paused;
      if (state) state.textContent = playing ? 'Pause' : 'Play';
      toggle.setAttribute('aria-label', playing ? 'Pause film' : 'Play film');
    };
    const onTime = () => {
      if (tc) tc.textContent = timecode(video.currentTime);
    };
    const onToggle = () => {
      held = !video.paused;
      if (held) video.pause();
      else video.play().catch(() => {});
    };

    video.addEventListener('play', label);
    video.addEventListener('pause', label);
    video.addEventListener('timeupdate', onTime);
    toggle.addEventListener('click', onToggle);

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.25 },
    );
    io.observe(video);

    cleanups.push(() => {
      io.disconnect();
      video.pause();
      video.removeEventListener('play', label);
      video.removeEventListener('pause', label);
      video.removeEventListener('timeupdate', onTime);
      toggle.removeEventListener('click', onToggle);
    });
  });

  return () => {
    for (const fn of cleanups.splice(0)) fn();
  };
});
