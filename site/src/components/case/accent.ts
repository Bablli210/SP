/**
 * A project's accent is set by the studio, so it is not always dark enough
 * to carry small text on paper. readableAccent() returns the accent itself
 * when it passes WCAG AA (4.5:1) against paper, or the least ink mixed into it
 * that does, as a CSS value built from the page tokens.
 *
 * PAPER and INK mirror --paper and --ink in global.css; they are only used
 * for the contrast maths here and are never written into a page.
 */
const PAPER = '#f3f2ee';
const INK = '#0e0e0e';

type RGB = [number, number, number];

const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;

const luminance = ([r, g, b]: RGB) => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Same maths as color-mix(in srgb, a (1 - t), b t). */
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t)) as RGB;

export function readableAccent(accent: string, min = 4.5): string {
  const a = toRgb(accent);
  const paper = toRgb(PAPER);
  const ink = toRgb(INK);
  if (contrast(a, paper) >= min) return 'var(--accent)';
  for (let pct = 5; pct <= 100; pct += 5) {
    if (contrast(mix(a, ink, pct / 100), paper) >= min) {
      return `color-mix(in srgb, var(--accent) ${100 - pct}%, var(--ink))`;
    }
  }
  return 'var(--ink)';
}
