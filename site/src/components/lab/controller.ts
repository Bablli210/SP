/**
 * Lab behaviour: kind filters, hover loops, and the viewer.
 *
 * The inline bootstrap in LabIndex.astro has already applied a ?kind= filter
 * before the first paint. Filtering swaps the masonry's layout (CSS holds one
 * per filter) and animates the change: leavers fade where they stand, the
 * rest glide to their new places (FLIP), newcomers rise in, and the footer
 * glides as the wall changes height. Reduced motion: instant.
 */
import { onPage, reducedMotion } from '../../scripts/motion';
import { EASE, EASE_OUT, done, own, play, stop } from './anim';
import { setupViewer } from './viewer';

onPage(() => {
  const root = document.querySelector<HTMLElement>('[data-lab]');
  if (!root) return;
  const masonry = root.querySelector<HTMLElement>('[data-masonry]');
  const chipsEl = root.querySelector<HTMLElement>('[data-chips]');
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const status = root.querySelector<HTMLElement>('[data-status]');
  if (!masonry || !chipsEl || !countEl || !status) return;

  const reduce = reducedMotion();
  const tiles = Array.from(masonry.querySelectorAll<HTMLElement>('[data-tile]'));
  const chips = Array.from(chipsEl.querySelectorAll<HTMLButtonElement>('[data-chip]'));
  const values = chips.map((c) => c.dataset.chip ?? '');
  const footer = document.querySelector<HTMLElement>('.site-footer');

  const matches = (t: HTMLElement, f: string) => f === 'all' || t.dataset.kind === f;
  const visible = () => tiles.filter((t) => !t.hidden && !t.classList.contains('is-leaving'));

  const readFilter = () => {
    const k = (new URLSearchParams(location.search).get('kind') ?? '').toLowerCase();
    return values.includes(k) ? k : 'all';
  };
  const writeFilter = (f: string) => {
    const url = new URL(location.href);
    if (f === 'all') url.searchParams.delete('kind');
    else url.searchParams.set('kind', f);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  };

  let filter = readFilter();
  let token = 0;
  let shownCount = -1;

  // ---------- the first-load cascade hands over to scripted motion ----------
  const settle = () => root.classList.add('is-settled');
  const cascade = root.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation);
  if (cascade.length) Promise.allSettled(cascade.map((a) => a.finished)).then(settle);
  else settle();

  /** Scroll reveals and the cascade stop here; from now on this script owns the tiles' motion. */
  const takeOver = () => {
    settle();
    for (const t of tiles) t.classList.remove('is-armed');
  };

  // ---------- the footer glides when the wall changes height ----------
  const withFooter = (change: () => void) => {
    if (!footer || reduce) return change();
    const before = footer.getBoundingClientRect().top;
    stop(footer);
    change();
    const dy = before - footer.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5) return;
    play(footer, [{ transform: `translate3d(0, ${dy}px, 0)` }, { transform: 'none' }], { duration: 800, easing: EASE_OUT });
  };

  // ---------- chips, count, announcement ----------
  const syncChips = () => {
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.chip === filter));
  };

  const syncCount = (n: number, animate: boolean) => {
    if (n === shownCount) return;
    const first = shownCount < 0;
    shownCount = n;
    if (first || !animate) {
      countEl.textContent = String(n);
      return;
    }
    stop(countEl);
    const out = play(countEl, [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(0, -60%, 0)', opacity: 0 }], {
      duration: 180,
      easing: EASE,
      fill: 'forwards',
    });
    done(out).then((finished) => {
      if (!finished) return;
      countEl.textContent = String(n);
      out.cancel();
      play(countEl, [{ transform: 'translate3d(0, 60%, 0)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
        duration: 420,
        easing: EASE_OUT,
      });
    });
  };

  const announce = (n: number) => {
    const label = chips.find((c) => c.dataset.chip === filter)?.dataset.label ?? '';
    const what = `${n} ${n === 1 ? 'entry' : 'entries'}`;
    status.textContent = filter === 'all' ? what : `${what}: ${label}`;
  };

  // ---------- layout motion ----------
  const release = (t: HTMLElement) => {
    t.classList.remove('is-leaving');
    t.style.removeProperty('left');
    t.style.removeProperty('top');
  };

  const render = (animate: boolean) => {
    const my = ++token;
    const show = new Set(tiles.filter((t) => matches(t, filter)));

    if (!animate) {
      for (const t of tiles) {
        stop(t);
        release(t);
        t.hidden = !show.has(t);
      }
      masonry.dataset.filter = filter;
      masonry.style.removeProperty('min-height');
      return show.size;
    }

    // 1. First: where everything is on screen now, mid-flight included.
    const first = new Map<HTMLElement, { rect: DOMRect; opacity: number }>();
    for (const t of tiles) {
      if (t.hidden) continue;
      if (t.classList.contains('is-leaving') && !show.has(t)) continue; // already on its way out
      first.set(t, { rect: t.getBoundingClientRect(), opacity: Number(getComputedStyle(t).opacity) });
    }

    // 2. Hand over from the cascade and reveals, stop what runs (leavers keep leaving).
    takeOver();
    for (const t of tiles) {
      if (t.classList.contains('is-leaving') && !show.has(t)) continue;
      stop(t);
      if (t.classList.contains('is-leaving')) release(t);
    }

    const leaving: HTMLElement[] = [];
    const entering: HTMLElement[] = [];
    const staying: HTMLElement[] = [];
    for (const t of tiles) {
      if (t.classList.contains('is-leaving')) continue;
      const was = first.has(t);
      const will = show.has(t);
      if (was && will) staying.push(t);
      else if (was) leaving.push(t);
      else if (will) entering.push(t);
    }

    // 3. Switch layouts; leavers stay where they stood, lifted out of it.
    withFooter(() => {
      masonry.style.minHeight = `${masonry.offsetHeight}px`;
      const box = masonry.getBoundingClientRect();
      for (const t of leaving) {
        const r = first.get(t)?.rect;
        if (!r) continue;
        t.classList.add('is-leaving');
        t.style.left = `${r.left - box.left}px`;
        t.style.top = `${r.top - box.top}px`;
      }
      masonry.dataset.filter = filter;
      for (const t of entering) t.hidden = false;
    });

    // 4. Play.
    const gone = leaving.map(async (t) => {
      const from = first.get(t)?.opacity ?? 1;
      const a = play(t, [{ opacity: from, transform: 'none' }, { opacity: 0, transform: 'scale(0.94)' }], {
        duration: 340,
        easing: EASE,
        fill: 'forwards',
      });
      if (!(await done(a))) return;
      t.hidden = true;
      release(t);
      a.cancel();
    });

    for (const t of staying) {
      const f = first.get(t);
      if (!f) continue;
      const r = t.getBoundingClientRect();
      const dx = f.rect.left - r.left;
      const dy = f.rect.top - r.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && f.opacity > 0.99) continue;
      play(
        t,
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0)`, opacity: f.opacity },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 850, delay: 110, easing: EASE, fill: 'backwards' },
      );
    }

    entering.forEach((t, i) => {
      play(
        t,
        [
          { transform: 'translate3d(0, 40px, 0)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 900, delay: 260 + i * 55, easing: EASE_OUT, fill: 'backwards' },
      );
    });

    // 5. Once the leavers are gone, let the wall take its new height; the footer glides.
    Promise.all(gone).then(() => {
      if (my !== token) return;
      withFooter(() => masonry.style.removeProperty('min-height'));
    });

    return show.size;
  };

  const apply = (next: string, animate: boolean, speak: boolean) => {
    filter = next;
    const n = render(animate);
    syncChips();
    syncCount(n, animate);
    if (speak) announce(n);
  };

  const onChip = (e: Event) => {
    const chip = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-chip]');
    if (!chip) return;
    const v = chip.dataset.chip ?? 'all';
    // A second press on the active kind goes back to All.
    const next = v === filter && v !== 'all' ? 'all' : v;
    if (next === filter) return;
    writeFilter(next);
    apply(next, !reduce, true);
  };

  // ---------- hover loops (desktop pointer only, never with reduced motion) ----------
  // A loop shows only while its tile is under the pointer: `hovered` is the intent,
  // the video's own events (which also fire when a clip wraps) never override it.
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const loopTimers = new Map<HTMLElement, number>();
  const hovered = new Set<HTMLElement>();

  const loopOf = (t: HTMLElement) => {
    const src = t.dataset.loop;
    const media = t.querySelector<HTMLElement>('.media');
    if (!src || !media) return null;
    let v = media.querySelector('video');
    if (!v) {
      v = document.createElement('video');
      v.className = 'tile-loop';
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.setAttribute('aria-hidden', 'true');
      v.src = src;
      const shown = v;
      v.addEventListener('playing', () => {
        if (hovered.has(t)) shown.classList.add('is-playing');
      });
      media.append(v);
    }
    return v;
  };

  // ---------- viewer ----------
  const viewer = setupViewer(root, tiles, visible, reduce);

  const tileFrom = (e: Event) => (e.target as Element | null)?.closest<HTMLElement>('[data-tile]') ?? null;

  const onOver = (e: PointerEvent) => {
    const t = tileFrom(e);
    if (!t || t.contains(e.relatedTarget as Node | null)) return;
    viewer?.warm(t.dataset.id ?? '');
    if (reduce || e.pointerType !== 'mouse' || !fine.matches) return;
    const v = loopOf(t);
    if (!v) return;
    hovered.add(t);
    window.clearTimeout(loopTimers.get(t));
    // Back before the pause: it never stopped, so no 'playing' event will come.
    if (!v.paused && v.readyState >= 3) v.classList.add('is-playing');
    else v.play().catch(() => {});
  };

  const onOut = (e: PointerEvent) => {
    const t = tileFrom(e);
    if (!t || t.contains(e.relatedTarget as Node | null)) return;
    hovered.delete(t);
    const v = t.querySelector<HTMLVideoElement>('video.tile-loop');
    if (!v) return;
    v.classList.remove('is-playing');
    // Pause once it has faded, so it never freezes in view.
    window.clearTimeout(loopTimers.get(t));
    loopTimers.set(
      t,
      window.setTimeout(() => {
        if (hovered.has(t)) return;
        v.pause();
        v.classList.remove('is-playing');
      }, 500),
    );
  };

  const onFocusIn = (e: FocusEvent) => {
    const t = tileFrom(e);
    if (t) viewer?.warm(t.dataset.id ?? '');
  };

  const onOpen = (e: MouseEvent) => {
    const btn = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-open]');
    const t = btn?.closest<HTMLElement>('[data-tile]');
    if (!btn || !t || t.classList.contains('is-leaving')) return;
    viewer?.open(t);
  };

  // ---------- initial state (idempotent with the bootstrap) ----------
  root.querySelectorAll<HTMLElement>('[data-js-only]').forEach((el) => (el.hidden = false));
  apply(filter, false, false);

  chipsEl.addEventListener('click', onChip);
  masonry.addEventListener('click', onOpen);
  masonry.addEventListener('pointerover', onOver);
  masonry.addEventListener('pointerout', onOut);
  masonry.addEventListener('focusin', onFocusIn);

  return () => {
    token++;
    chipsEl.removeEventListener('click', onChip);
    masonry.removeEventListener('click', onOpen);
    masonry.removeEventListener('pointerover', onOver);
    masonry.removeEventListener('pointerout', onOut);
    masonry.removeEventListener('focusin', onFocusIn);
    loopTimers.forEach((id) => window.clearTimeout(id));
    hovered.clear();
    masonry.querySelectorAll('video').forEach((v) => v.pause());
    viewer?.destroy();
    if (footer) own(footer).forEach((a) => a.cancel());
  };
});
