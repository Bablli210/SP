/**
 * Work index behaviour: filters, the list/grid switch, the count, and the
 * covers' part in page transitions.
 *
 * - Arriving: arrive.ts sets up the incoming index before the transition
 *   captures it (imported here, so it is registered once the index has loaded).
 *   Back from a case (Close, Esc, Back), keyboard focus returns to that
 *   project's row or card when the page comes back to it, else to the content,
 *   so the next Tab carries on from there instead of from the top.
 * - Leaving: only the cover of the case being opened keeps its name; the rest
 *   leave with the page.
 * - On the page: filters and view switches animate; nothing reloads. On a
 *   phone the filter rows scroll sideways; a chip reached with the keyboard is
 *   brought fully into view.
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { onPage, reducedMotion } from '../../scripts/motion';
import { coverOf, nameOnly, pathOf, shownShare, takeArrival, trimPath } from './arrive';
import { applySet, commit, stop, own, EASE, EASE_OUT, TAG, SETTLE_TAG, type SetMotion } from './flip';
import { setupPeek } from './peek';
import {
  applyInitial,
  factsOf,
  matches,
  paintChips,
  saveView,
  writeFilter,
  type Facts,
  type View,
} from './state';

const VIEWS: View[] = ['list', 'grid'];
/** A case study's path (trailing slash trimmed). */
const CASE_PATH = /^\/work\/[^/]+$/;

const MOTION: Record<View, SetMotion> = {
  list: {
    leave: { transform: 'translate3d(0, -10px, 0)' },
    enter: (el) => {
      const inner = el.querySelector<HTMLElement>('.row-in');
      return [
        ...(inner ? [{ target: inner, from: { transform: 'translate3d(0, calc(100% + 16px), 0)' } }] : []),
        { target: el, from: { transform: 'scaleX(0)' }, pseudo: '::after' },
      ];
    },
  },
  grid: {
    leave: { transform: 'scale(0.94)' },
    enter: (el) => [{ target: el, from: { transform: 'translate3d(0, 40px, 0)', opacity: 0 } }],
  },
};

/** Decode the case hero before the morph starts, so the cover never lands on an empty frame. Capped. */
async function warmHero(doc: Document, cap = 450) {
  const img = doc.querySelector<HTMLImageElement>('[data-case-hero] img');
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

/* ---------- the page ---------- */

onPage(() => {
  const root = document.querySelector<HTMLElement>('[data-work]');
  if (!root) return;
  const stage = root.querySelector<HTMLElement>('[data-stage]');
  const filters = root.querySelector<HTMLElement>('[data-filters]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const status = root.querySelector<HTMLElement>('[data-status]');
  const listPanel = root.querySelector<HTMLElement>('[data-panel="list"]');
  const gridPanel = root.querySelector<HTMLElement>('[data-panel="grid"]');
  if (!stage || !filters || !empty || !countEl || !status || !listPanel || !gridPanel) return;

  const reduce = reducedMotion();
  const panels: Record<View, HTMLElement> = { list: listPanel, grid: gridPanel };
  const containers: Record<View, HTMLElement> = {
    list: listPanel.querySelector<HTMLElement>('[data-items]') ?? listPanel,
    grid: gridPanel.querySelector<HTMLElement>('[data-items]') ?? gridPanel,
  };
  const items: Record<View, HTMLElement[]> = {
    list: Array.from(containers.list.querySelectorAll<HTMLElement>('[data-item]')),
    grid: Array.from(containers.grid.querySelectorAll<HTMLElement>('[data-item]')),
  };
  const chips = Array.from(filters.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const viewBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-view-btn]'));
  const footer = document.querySelector<HTMLElement>('.site-footer');

  const facts = new Map<string, Facts>();
  for (const el of items.list) facts.set(el.dataset.id ?? '', factsOf(el));
  const ids = Array.from(facts.keys());
  const factList = Array.from(facts.values());
  const labelOf = (kind: string, value: string | null) =>
    chips.find((c) => c.dataset.filter === kind && c.dataset.value === value)?.dataset.label ?? value ?? '';

  // Idempotent: an arrival by page transition has already had this done before the swap.
  let { view, filter: state } = applyInitial(root, new URL(location.href));
  // The address bar shows the filter actually applied, in its tidy form.
  writeFilter(state);
  let token = 0;
  let shownCount = Number(countEl.textContent);

  // ---------- the first-load reveal hands over to script-driven motion ----------
  /** The first-load keyframes in WorkList.astro and WorkGrid.astro. */
  const REVEALS = ['work-row-rise', 'work-rule-draw', 'work-cell-in'];
  const isReveal = (a: Animation): a is CSSAnimation => a instanceof CSSAnimation && REVEALS.includes(a.animationName);

  /**
   * End the CSS reveal (so items shown later do not replay it). Anything still
   * revealing continues from exactly where it is, as a script animation over
   * the time it had left, so nothing jumps.
   */
  const settle = () => {
    if (root.classList.contains('is-settled')) return;
    const handoff = root.getAnimations({ subtree: true }).flatMap((a) => {
      if (!isReveal(a) || a.playState !== 'running') return [];
      const fx = a.effect;
      if (!(fx instanceof KeyframeEffect) || !(fx.target instanceof HTMLElement)) return [];
      const t = fx.getComputedTiming();
      const left = Number(t.endTime) - Number(t.localTime ?? 0);
      if (!(left > 16)) return [];
      const cs = getComputedStyle(fx.target, fx.pseudoElement);
      return [{ target: fx.target, pseudo: fx.pseudoElement, transform: cs.transform, opacity: cs.opacity, left }];
    });
    root.classList.add('is-settled');
    for (const h of handoff) {
      h.target.animate([{ transform: h.transform, opacity: h.opacity }, { transform: 'none', opacity: 1 }], {
        duration: h.left,
        easing: EASE_OUT,
        id: SETTLE_TAG,
        pseudoElement: h.pseudo ?? undefined,
      });
    }
  };
  const reveal = root.getAnimations({ subtree: true }).filter(isReveal);
  if (reveal.length) Promise.allSettled(reveal.map((a) => a.finished)).then(settle);
  else settle();

  // ---------- the footer glides when the archive changes height ----------
  const withFooter = (change: () => void) => {
    if (!footer || reduce) return change();
    const before = footer.getBoundingClientRect().top;
    stop(footer);
    change();
    const dy = before - footer.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5) return;
    footer.animate([{ transform: `translate3d(0, ${dy}px, 0)` }, { transform: 'none' }], {
      duration: 800,
      easing: EASE_OUT,
      id: TAG,
    });
  };

  // ---------- count and announcement ----------
  const syncCount = (n: number, animate: boolean) => {
    if (n === shownCount) return;
    shownCount = n;
    if (!animate) {
      stop(countEl);
      countEl.textContent = String(n);
      return;
    }
    stop(countEl);
    const out = countEl.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate3d(0, -60%, 0)', opacity: 0 }], {
      duration: 180,
      easing: EASE,
      fill: 'forwards',
      id: TAG,
    });
    out.finished.then(
      () => {
        countEl.textContent = String(n);
        out.cancel();
        countEl.animate([{ transform: 'translate3d(0, 60%, 0)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
          duration: 420,
          easing: EASE_OUT,
          id: TAG,
        });
      },
      () => {},
    );
  };

  const announce = (n: number) => {
    const parts = [state.d ? labelOf('d', state.d) : '', state.s ? labelOf('s', state.s) : ''].filter(Boolean);
    const what = `${n} ${n === 1 ? 'project' : 'projects'}`;
    status.textContent = n === 0 ? 'Nothing here yet' : parts.length ? `${what}: ${parts.join(', ')}` : `${what}`;
  };

  // ---------- filtering ----------
  const render = (animate: boolean) => {
    const visible = new Set(ids.filter((id) => matches(facts.get(id)!, state)));
    const n = visible.size;
    const my = ++token;

    if (!animate) {
      for (const v of VIEWS) {
        commit(items[v]);
        for (const el of items[v]) el.hidden = !visible.has(el.dataset.id ?? '');
      }
      stop(empty);
      empty.hidden = n > 0;
      stage.style.removeProperty('min-height');
    } else {
      const other = view === 'list' ? 'grid' : 'list';
      commit(items[other]);
      for (const el of items[other]) el.hidden = !visible.has(el.dataset.id ?? '');

      let left: Promise<void> = Promise.resolve();
      withFooter(() => {
        // Hold the height while leavers fade so nothing below jumps; release after.
        stage.style.minHeight = `${stage.offsetHeight}px`;
        if (n > 0 && !empty.hidden) {
          stop(empty);
          empty.hidden = true;
        }
        const set = items[view];
        const show = new Set(set.filter((el) => visible.has(el.dataset.id ?? '')));
        ({ left } = applySet(containers[view], set, show, MOTION[view]));
      });
      left.then(() => {
        if (my !== token) return;
        withFooter(() => {
          stage.style.removeProperty('min-height');
          if (n === 0 && empty.hidden) {
            empty.hidden = false;
            empty.animate([{ transform: 'translate3d(0, 24px, 0)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
              duration: 800,
              easing: EASE_OUT,
              id: TAG,
            });
          }
        });
      });
    }

    paintChips(chips, state, factList);
    syncCount(n, animate);
    announce(n);
  };

  const onChip = (e: Event) => {
    const chip = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-filter]');
    if (!chip) return;
    const kind = chip.dataset.filter;
    const v = chip.dataset.value ?? null;
    const prev = state;
    if (kind === 'all') state = { d: null, s: null };
    else if (kind === 'd') state = { ...state, d: state.d === v ? null : v };
    else if (kind === 's') state = { ...state, s: state.s === v ? null : v };
    else return;
    if (state.d === prev.d && state.s === prev.s) return;
    settle();
    writeFilter(state);
    render(!reduce);
  };

  const onReset = () => {
    state = { d: null, s: null };
    settle();
    writeFilter(state);
    render(!reduce);
    chips.find((c) => c.dataset.filter === 'all')?.focus();
  };

  // ---------- views ----------
  const peek = setupPeek(root, listPanel);

  const syncViewButtons = () => {
    for (const b of viewBtns) b.setAttribute('aria-pressed', String(b.dataset.viewBtn === view));
  };

  const setView = (next: View, animate: boolean) => {
    if (next === view) return;
    settle();
    // Land anything in flight: the previous switch and any filter motion.
    for (const v of VIEWS) {
      commit(items[v]);
      stop(panels[v]);
      panels[v].classList.remove('is-out');
      panels[v].hidden = v !== view;
    }
    const from = panels[view];
    const to = panels[next];
    view = next;
    root.dataset.view = next;
    syncViewButtons();
    saveView(next);
    peek?.setEnabled(next === 'list');

    if (!animate) {
      from.hidden = true;
      to.hidden = false;
      stage.style.removeProperty('min-height');
      return;
    }

    const my = ++token;
    withFooter(() => {
      stage.style.minHeight = `${stage.offsetHeight}px`;
      from.classList.add('is-out');
      to.hidden = false;
    });
    const out = from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, -12px, 0)' }], {
      duration: 320,
      easing: EASE,
      fill: 'forwards',
      id: TAG,
    });
    to.animate([{ opacity: 0, transform: 'translate3d(0, 20px, 0)' }, { opacity: 1, transform: 'none' }], {
      duration: 900,
      delay: 140,
      easing: EASE_OUT,
      fill: 'backwards',
      id: TAG,
    });
    // A light cascade inside the incoming view.
    items[next]
      .filter((el) => !el.hidden)
      .slice(0, 12)
      .forEach((el, i) => {
        const target = next === 'list' ? el.querySelector<HTMLElement>('.row-in') : el;
        target?.animate(
          [{ transform: next === 'list' ? 'translate3d(0, 60%, 0)' : 'translate3d(0, 32px, 0)' }, { transform: 'none' }],
          { duration: 1000, delay: 160 + i * 45, easing: EASE_OUT, fill: 'backwards', id: TAG },
        );
      });
    out.finished.then(
      () => {
        from.hidden = true;
        from.classList.remove('is-out');
        out.cancel();
        if (my !== token) return;
        withFooter(() => stage.style.removeProperty('min-height'));
      },
      () => {},
    );
  };

  // ---------- phone: a chip reached with the keyboard comes fully into its row's view ----------
  const onFilterFocus = (e: FocusEvent) => {
    const chip = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-filter]') : null;
    const scroller = chip?.closest<HTMLElement>('[data-scroller]');
    // Keyboard only: a tapped chip stays under the finger.
    if (!chip || !scroller || !chip.matches(':focus-visible')) return;
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return; // the row wraps (desktop): nothing hides
    // The row's scroll-padding keeps the chip and its focus ring clear of the faded edges.
    const cs = getComputedStyle(scroller);
    const padL = parseFloat(cs.scrollPaddingLeft) || 0;
    const padR = parseFloat(cs.scrollPaddingRight) || 0;
    const box = scroller.getBoundingClientRect();
    const r = chip.getBoundingClientRect();
    let dx = 0;
    if (r.left < box.left + padL) dx = r.left - (box.left + padL);
    else if (r.right > box.right - padR) dx = Math.min(r.right - (box.right - padR), r.left - (box.left + padL));
    if (Math.abs(dx) < 1) return;
    // Only the row moves, never the page.
    scroller.scrollBy({ left: dx, behavior: reduce ? 'instant' : 'smooth' });
  };

  const onViewBtn = (e: Event) => {
    const btn = (e.currentTarget as HTMLButtonElement | null)?.dataset.viewBtn;
    if (btn === 'list' || btn === 'grid') setView(btn, !reduce);
  };

  // ---------- leaving: only the opened case's cover travels ----------
  const onBeforePreparation = (ev: Event) => {
    const e = ev as TransitionBeforePreparationEvent;
    const to = trimPath(e.to.pathname);
    const gridShown = !gridPanel.hidden && !gridPanel.classList.contains('is-out');
    const keep =
      (gridShown &&
        items.grid.find((it) => {
          if (it.hidden || it.classList.contains('is-leaving') || pathOf(it) !== to) return false;
          const r = coverOf(it)?.getBoundingClientRect();
          return !!r && r.bottom > 0 && r.top < window.innerHeight;
        })) ||
      null;
    nameOnly(items.grid, keep);
    // The list hands its floating cover over instead (peek.ts names it on click).
    const morphs = !!keep || !!root.querySelector('[data-peek] .media[style*="view-transition-name"]');
    if (morphs && !reduce) {
      const load = e.loader;
      e.loader = async () => {
        await load();
        await warmHero(e.newDocument);
      };
    }
  };

  // ---------- start (applyInitial has painted the view, chips and count) ----------
  peek?.setEnabled(view === 'list');

  // On a phone, bring a deep-linked chip into its scroller's view.
  for (const c of chips) {
    if (c.getAttribute('aria-pressed') !== 'true' || c.dataset.filter === 'all') continue;
    const scroller = c.closest<HTMLElement>('[data-scroller]');
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      // Leave a sliver of the previous chip showing, so the row reads as scrollable.
      scroller.scrollLeft += c.getBoundingClientRect().left - scroller.getBoundingClientRect().left - 30;
    }
  }

  filters.addEventListener('click', onChip);
  filters.addEventListener('focusin', onFilterFocus);
  const resetBtn = empty.querySelector<HTMLButtonElement>('[data-reset]');
  resetBtn?.addEventListener('click', onReset);
  viewBtns.forEach((b) => b.addEventListener('click', onViewBtn));
  document.addEventListener('astro:before-preparation', onBeforePreparation);

  // ---------- back from a case: the keyboard position returns with the scroll ----------
  const arrived = takeArrival();
  if (arrived && CASE_PATH.test(arrived.from) && (!document.activeElement || document.activeElement === document.body)) {
    // The project's row or card in the view showing (both views link to it).
    const link = items[view].find((it) => !it.hidden && pathOf(it) === arrived.from)?.querySelector<HTMLElement>('a');
    // A step back restores the place it was opened from. A new visit (Close or Esc after
    // Next project, a menu link) starts at the top, where that row may be out of sight:
    // then the content takes focus, so the next Tab starts there rather than in the header.
    const target = arrived.type === 'traverse' && link && shownShare(link) >= 0.5 ? link : document.getElementById('main');
    target?.focus({ preventScroll: true });
  }

  return () => {
    token++;
    filters.removeEventListener('click', onChip);
    filters.removeEventListener('focusin', onFilterFocus);
    resetBtn?.removeEventListener('click', onReset);
    viewBtns.forEach((b) => b.removeEventListener('click', onViewBtn));
    document.removeEventListener('astro:before-preparation', onBeforePreparation);
    peek?.destroy();
    if (footer) own(footer).forEach((a) => a.cancel());
  };
});
