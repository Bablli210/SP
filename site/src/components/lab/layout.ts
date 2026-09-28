/**
 * Lab masonry, packed at build time.
 *
 * Every tile's height is its column width times its image ratio, so a whole
 * layout can be written in CSS: a tile sits in column `c`, `k` column-widths
 * and `m` gaps from the top. We pack one layout per filter and per column
 * count, hand them to the page as custom properties, and CSS picks the right
 * one. The page lays out before any script runs, resizes for free, and the
 * filter script only has to animate between layouts it never computes.
 */
import type { ImageMetadata } from 'astro';

export const FILTERS = ['all', 'type', 'motion', '3d', 'recap'] as const;
export type Filter = (typeof FILTERS)[number];
export type Kind = Exclude<Filter, 'all'>;

export const KIND_LABEL: Record<Kind, string> = {
  type: 'Type',
  motion: 'Motion',
  '3d': '3D',
  recap: 'Recap',
};

/**
 * Column counts and how far each column starts down, in column widths.
 * Four on desktop (wireframe: 0, 80, 0, 40px at 1440), two below 1025px.
 */
export const LAYOUTS = [
  { cols: 4, offsets: [0, 0.24, 0, 0.12] },
  { cols: 2, offsets: [0, 0.22] },
] as const;

/** A gap is roughly this share of a column width; used only to choose columns. */
const GAP_SHARE = 0.05;
/** How many of the last tiles may take the second-shortest column to even out the bottom edge. */
const TAIL = 8;
/** Cost of each such detour, in column widths, so reading order bends only when it pays. */
const DETOUR = 0.15;

export interface Slot {
  /** column index */
  c: number;
  /** distance from the top in column widths (offset + ratios above) */
  k: number;
  /** gaps above */
  m: number;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Choose a column for each tile (height / width ratios, in reading order).
 * The first row goes left to right so small sets never leave a hole; then
 * each tile drops into the shortest column, except that the last few may
 * take the second-shortest when that leaves a noticeably more even bottom.
 */
function columns(ratios: number[], cols: number, offsets: readonly number[]): number[] {
  const n = ratios.length;
  const k = Array.from({ length: cols }, (_, i) => offsets[i] ?? 0);
  const m = Array.from({ length: cols }, () => 0);
  const out: number[] = [];
  const h = (c: number) => k[c] + m[c] * GAP_SHARE;
  const byHeight = () =>
    Array.from({ length: cols }, (_, c) => c).sort((a, b) => h(a) - h(b) || a - b);
  const put = (i: number, c: number, sign = 1) => {
    k[c] += sign * ratios[i];
    m[c] += sign;
    out[i] = c;
  };

  const tailFrom = Math.max(cols, n - TAIL);
  for (let i = 0; i < Math.min(n, tailFrom); i++) put(i, i < cols ? i : byHeight()[0]);
  if (tailFrom >= n) return out;

  let best = { cost: Infinity, cols: [] as number[] };
  const walk = (i: number, detours: number) => {
    if (i === n) {
      const hs = Array.from({ length: cols }, (_, c) => h(c));
      const cost = Math.max(...hs) - Math.min(...hs) + detours * DETOUR;
      if (cost < best.cost - 1e-9) best = { cost, cols: out.slice(tailFrom, n) };
      return;
    }
    byHeight()
      .slice(0, 2)
      .forEach((c, rank) => {
        put(i, c);
        walk(i + 1, detours + rank);
        put(i, c, -1);
      });
  };
  walk(tailFrom, 0);
  best.cols.forEach((c, j) => (out[tailFrom + j] = c));
  return out;
}

/** Place tiles; returns each slot and a CSS height for the whole wall. */
export function pack(ratios: number[], cols: number, offsets: readonly number[]): { slots: Slot[]; height: string } {
  const choice = columns(ratios, cols, offsets);
  const k = Array.from({ length: cols }, (_, i) => offsets[i] ?? 0);
  const m = Array.from({ length: cols }, () => 0);
  const slots = ratios.map((r, i) => {
    const c = choice[i];
    const slot = { c, k: round(k[c]), m: m[c] };
    k[c] += r;
    m[c] += 1;
    return slot;
  });
  const parts = k
    .map((kc, c) => (m[c] ? `${round(kc)} * var(--cw) + ${m[c] - 1} * var(--gap)` : ''))
    .filter(Boolean);
  const height = parts.length ? `max(${parts.join(', ')})` : '0px';
  return { slots, height };
}

/** One Lab entry, flattened for the page. */
export interface LabItem {
  id: string;
  title: string;
  kind: Kind;
  kindLabel: string;
  /** "Sep 2025" */
  date: string;
  /** "2025-09-01" */
  iso: string;
  tool?: string;
  image: ImageMetadata;
  alt: string;
  loop?: string;
  /** Inline custom properties that place this tile in every layout it belongs to. */
  place: string;
}

export interface LabChip {
  value: Filter;
  label: string;
  count: number;
}
