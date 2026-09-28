/**
 * Geometry of the home ring. Pure maths, shared by the server (first paint,
 * before any script runs) and by src/scripts/ring.ts (every frame after).
 *
 * Plates stand on a large circle whose centre sits below the viewport. The
 * front plate stands upright on the top of the circle; the others lean
 * outward along it. Everything is measured in plate widths (W0, the width of
 * the front plate), so the layout scales with the viewport and a resize never
 * changes which plate is where.
 *
 * Position on the ring is `k`: the plate's distance from the front, in plates
 * (0 = front, 1 = next to the right, -1 = next to the left). Plates shrink with
 * distance and are packed edge to edge with a constant gap, so the spacing
 * follows their size (neighbours of the front are pushed out, far ones close up).
 */

export type RingMode = 'desk' | 'mob';

export interface RingGeometry {
  /** Scale at distance u is a - b·min(u, cap) + c·bump(u); a + c = 1 at the front. */
  a: number;
  b: number;
  c: number;
  cap: number;
  /** Gap between neighbouring plates along the ring, in plate widths. */
  gap: number;
  /** Ring radius, in plate widths. */
  rho: number;
  /** Distance (in plates) where plates start to fade out, and where they are gone. */
  fadeFrom: number;
  fadeTo: number;
  /** Paper wash over distant plates: growth per plate, and its ceiling. */
  veil: number;
  veilMax: number;
}

/** Same breakpoint as the mobile wireframe and the CSS. */
export const MOBILE_QUERY = '(max-width: 760px)';

export const GEOMETRY: Record<RingMode, RingGeometry> = {
  desk: { a: 0.72, b: 0.1, c: 0.28, cap: 4, gap: 0.07, rho: 3.3, fadeFrom: 1, fadeTo: 2.3, veil: 0.25, veilMax: 0.55 },
  mob: { a: 0.54, b: 0.08, c: 0.46, cap: 4, gap: 0.035, rho: 2.9, fadeFrom: 1.2, fadeTo: 2.3, veil: 0.24, veilMax: 0.5 },
};

/** Smooth bump that lifts the front plate: 1 at u = 0, 0 from u = 1 on. */
const bump = (u: number) => (u < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * u) : 0);
/** Integral of bump from 0 to u. */
const bumpArea = (u: number) => (u < 1 ? u / 2 + Math.sin(Math.PI * u) / (2 * Math.PI) : 0.5);

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Plate scale at distance u (u >= 0). */
export function scaleAt(g: RingGeometry, u: number): number {
  return g.a - g.b * Math.min(u, g.cap) + g.c * bump(u);
}

/** Integral of scaleAt from 0 to u: the summed plate widths between the front and u. */
function scaleArea(g: RingGeometry, u: number): number {
  const m = Math.min(u, g.cap);
  const linear = g.a * u - g.b * (m * m * 0.5 + g.cap * Math.max(0, u - g.cap));
  return linear + g.c * bumpArea(u);
}

/** Wrap a ring position into [-n/2, n/2) so every plate takes the short way round. */
export function wrapK(k: number, n: number): number {
  const m = ((k % n) + n) % n;
  return m >= n / 2 ? m - n : m;
}

export interface PlatePose {
  /** Offset of the plate's foot from the top of the ring, in plate widths. */
  x: number;
  y: number;
  /** Lean along the ring, radians. */
  rot: number;
  s: number;
  o: number;
  veil: number;
  z: number;
}

/** Where a plate at ring position k sits, for a ring of n plates. */
export function pose(g: RingGeometry, k: number, n: number): PlatePose {
  const u = Math.abs(k);
  const sign = k < 0 ? -1 : 1;
  const arc = scaleArea(g, u) + g.gap * u;
  const th = (sign * arc) / g.rho;
  // A small ring can't show as many plates: fade out before they wrap round.
  const fadeTo = Math.min(g.fadeTo, n / 2);
  const fadeFrom = Math.min(g.fadeFrom, fadeTo - 0.6);
  return {
    x: g.rho * Math.sin(th),
    y: g.rho * (1 - Math.cos(th)),
    rot: th,
    s: scaleAt(g, u),
    o: 1 - smoothstep(fadeFrom, fadeTo, u),
    veil: Math.min(g.veilMax, Math.max(0, (u - 0.35) * g.veil)),
    z: Math.round(1000 - u * 100),
  };
}

/**
 * How far (px) the hand must travel sideways to move a plate one step, at ring
 * position k. Used so the plate under the pointer follows it exactly.
 */
export function pxPerStep(g: RingGeometry, k: number, w0: number): number {
  const u = Math.abs(k);
  const th = (scaleArea(g, u) + g.gap * u) / g.rho;
  return w0 * (scaleAt(g, u) + g.gap) * Math.cos(th);
}
