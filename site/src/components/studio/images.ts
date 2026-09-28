/**
 * Studio imagery, resolved at build time from src/assets/studio.
 * src/data/site.ts lists method and people images as paths relative to
 * src/assets (e.g. "studio/method-1.jpg"); this turns them into image metadata.
 */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<ImageMetadata>('../../assets/studio/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
});

export function studioImage(path: string): ImageMetadata {
  const img = files[`../../assets/${path}`];
  if (!img) throw new Error(`Studio image not found: src/assets/${path}`);
  return img;
}
