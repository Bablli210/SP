/*
 * Renders the raster icons from public/favicon.svg (the one source of the mark):
 *
 * - public/apple-touch-icon.png: 180 × 180, opaque, full bleed. iOS rounds the
 *   corners itself (and fills transparency with black), so the square stays square.
 * - public/favicon.ico: 16, 32 and 48 px PNGs in one .ico, for browsers and
 *   tools that do not read SVG icons or ask for /favicon.ico directly.
 *
 *   node scripts/make-icons.mjs
 *
 * Run it again whenever favicon.svg changes. Uses sharp, which Astro already installs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(resolve(pub, 'favicon.svg'));

const png = (size, alpha = false) => {
  const img = sharp(svg, { density: Math.ceil((72 * size) / 64) * 2 })
    .resize(size, size)
    .flatten({ background: '#0e0e0e' });
  return (alpha ? img.ensureAlpha() : img).png({ compressionLevel: 9 }).toBuffer();
};

writeFileSync(resolve(pub, 'apple-touch-icon.png'), await png(180));

// ICO container: a 6-byte header, one 16-byte entry per image, then the PNGs.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(s, true))); // 32-bit, as the entries declare
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(sizes[i] % 256, e); // width (0 means 256)
  header.writeUInt8(sizes[i] % 256, e + 1); // height
  header.writeUInt8(0, e + 2); // palette colours
  header.writeUInt8(0, e + 3); // reserved
  header.writeUInt16LE(1, e + 4); // colour planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(img.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
writeFileSync(resolve(pub, 'favicon.ico'), Buffer.concat([header, ...images]));

console.log('wrote public/apple-touch-icon.png and public/favicon.ico');
