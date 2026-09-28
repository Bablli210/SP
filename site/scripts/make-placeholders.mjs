/*
 * Generates the placeholder imagery the site ships with until the studio's
 * real photography arrives. Every file is a normal JPG at its final path, so
 * replacing a placeholder is a one-for-one file swap.
 *
 * Plates are drawn as SVG in the moodboard's language (still life, type
 * posters, faceless figures, archive sheets, flash-lit macro), rendered in
 * Chromium so the real web fonts are used, then saved with sharp.
 *
 *   NODE_PATH=$(npm root -g) node scripts/make-placeholders.mjs
 *
 * Needs Playwright (Chromium). Set TRUST_SPKI behind a TLS-intercepting proxy
 * only if fonts are fetched remotely (they are read from node_modules here).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontUrl = (p) => pathToFileURL(resolve(root, 'node_modules', p)).href;

/* ---------- seeded random ---------- */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------- plates ---------- */
let uid = 0;
export function plate({ name, accent, kind, seed, W, H, label }) {
  const id = 'p' + uid++;
  const r = rng(hash(seed));
  const m = Math.min(W, H);
  const ac = accent;
  let ground = '', art = '';
  const defs =
    `<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DAD9D4"/><stop offset=".62" stop-color="#C8C7C2"/><stop offset=".62" stop-color="#B7B6B1"/><stop offset="1" stop-color="#E7E6E1"/></linearGradient>` +
    `<radialGradient id="${id}o" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#FCFAF5"/><stop offset=".55" stop-color="#E5DFD2"/><stop offset="1" stop-color="#A39D90"/></radialGradient>` +
    `<filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${hash(seed) % 997}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/></filter>` +
    `<filter id="${id}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${m * 0.03}"/></filter>`;

  if (kind === 'orb') {
    ground = `<rect width="${W}" height="${H}" fill="url(#${id}b)"/>`;
    const cx = W * (0.4 + r() * 0.2), ledge = H * 0.62, rr = m * (0.2 + r() * 0.06);
    art = `<ellipse cx="${cx}" cy="${ledge}" rx="${rr * 1.05}" ry="${rr * 0.14}" fill="#000" opacity=".35" filter="url(#${id}s)"/>` +
      `<circle cx="${cx}" cy="${ledge - rr}" r="${rr}" fill="url(#${id}o)"/>` +
      `<rect x="${W * 0.07}" y="${H * 0.08}" width="${m * 0.11}" height="${m * 0.03}" fill="${ac}"/>`;
  } else if (kind === 'type') {
    const word = name.split(/[\s&.]+/)[0].toUpperCase();
    ground = `<rect width="${W}" height="${H}" fill="#EDECE7"/>`;
    const fs = H * 0.46;
    art = `<text x="${-W * 0.02}" y="${H * 0.97}" font-family="Archivo Variable" font-weight="800" font-size="${fs}" style="font-stretch:62%" transform="scale(1 1.85) translate(0 ${-H * 0.455})" fill="#0E0E0E" letter-spacing="-2">${esc(word)}</text>` +
      `<rect x="${W * 0.06}" y="${H * 0.06}" width="${W * 0.88}" height="${Math.max(2, m * 0.004)}" fill="#0E0E0E"/>` +
      `<circle cx="${W * 0.85}" cy="${H * 0.16}" r="${m * 0.05}" fill="${ac}"/>`;
  } else if (kind === 'figure') {
    ground = `<rect width="${W}" height="${H}" fill="#E9E8E3"/>`;
    const fx = W * (0.44 + r() * 0.12), top = H * 0.2;
    art = `<ellipse cx="${fx}" cy="${top + m * 0.08}" rx="${m * 0.085}" ry="${m * 0.1}" fill="#2A2724"/>` +
      `<path d="M${fx - m * 0.2},${H * 0.98} C${fx - m * 0.22},${H * 0.5} ${fx - m * 0.16},${top + m * 0.2} ${fx},${top + m * 0.19} C${fx + m * 0.16},${top + m * 0.2} ${fx + m * 0.22},${H * 0.5} ${fx + m * 0.2},${H * 0.98} Z" fill="#F7F6F2" stroke="#CFCDC6"/>` +
      `<rect x="${fx - m * 0.03}" y="${top + m * 0.38}" width="${m * 0.06}" height="${m * 0.018}" fill="${ac}"/>` +
      `<ellipse cx="${fx}" cy="${H * 0.985}" rx="${m * 0.3}" ry="${m * 0.03}" fill="#000" opacity=".22" filter="url(#${id}s)"/>`;
  } else if (kind === 'sheet') {
    ground = `<rect width="${W}" height="${H}" fill="#F4F3EF"/>`;
    art = `<rect x="${W * 0.3}" y="${H * 0.2}" width="${W * 0.4}" height="${H * 0.38}" fill="#BEBDB8"/><circle cx="${W * 0.5}" cy="${H * 0.39}" r="${m * 0.1}" fill="url(#${id}o)"/>`;
    for (let k = 0; k < 9; k++) {
      const y = H * 0.66 + k * H * 0.032;
      art += `<rect x="${W * 0.08}" y="${y}" width="${W * 0.84}" height="1.5" fill="#0E0E0E" opacity=".45"/><text x="${W * 0.92}" y="${y - 6}" text-anchor="end" font-family="IBM Plex Mono" font-weight="500" font-size="${m * 0.02}" fill="#0E0E0E">${String(k + 1).padStart(2, '0')}</text>`;
    }
    art += `<text x="${W * 0.08}" y="${H * 0.12}" font-family="Instrument Serif" font-size="${m * 0.07}" fill="${ac}">${esc(name)}</text>`;
  } else if (kind === 'macro') {
    ground = `<rect width="${W}" height="${H}" fill="#141414"/>`;
    const cx = W * (0.46 + r() * 0.1), cy = H * (0.44 + r() * 0.1);
    art = `<ellipse cx="${cx}" cy="${cy}" rx="${m * 0.3}" ry="${m * 0.22}" fill="#EDE6D8" filter="url(#${id}s)" transform="rotate(${-25 + r() * 50} ${cx} ${cy})"/>` +
      `<ellipse cx="${cx - m * 0.05}" cy="${cy - m * 0.05}" rx="${m * 0.12}" ry="${m * 0.08}" fill="#FFFFFF" opacity=".85"/>`;
  } else if (kind === 'wall') {
    // interior / studio space: a wall, a floor and one object
    ground = `<rect width="${W}" height="${H}" fill="#E4E2DC"/><rect y="${H * 0.7}" width="${W}" height="${H * 0.3}" fill="#CBC9C2"/>`;
    art = `<rect x="${W * 0.12}" y="${H * 0.2}" width="${W * 0.26}" height="${H * 0.36}" fill="#F3F2EE" stroke="#BEBDB8"/><rect x="${W * 0.46}" y="${H * 0.28}" width="${W * 0.16}" height="${H * 0.22}" fill="${ac}" opacity=".9"/>` +
      `<rect x="${W * 0.66}" y="${H * 0.46}" width="${W * 0.22}" height="${H * 0.26}" fill="#8F8C84"/><rect x="${W * 0.6}" y="${H * 0.72}" width="${W * 0.34}" height="${H * 0.02}" fill="#000" opacity=".18" filter="url(#${id}s)"/>`;
  }

  const fsL = Math.max(11, m * 0.018);
  const labelSvg = `<text x="${W - m * 0.04}" y="${H - m * 0.04}" text-anchor="end" font-family="IBM Plex Mono" font-weight="500" font-size="${fsL}" letter-spacing="1.5" fill="${kind === 'macro' ? '#F3F2EE' : '#0E0E0E'}" opacity=".55">${esc(label)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${ground}${art}<rect width="${W}" height="${H}" filter="url(#${id}n)"/>${labelSvg}</svg>`;
}

/* ---------- what to make ---------- */
const projects = [
  { slug: 'halwa-house', name: 'Halwa House', no: '014', year: 2025, accent: '#B8412B' },
  { slug: 'kiln-and-co', name: 'Kiln & Co.', no: '013', year: 2025, accent: '#8A6A2E' },
  { slug: 'palm-swim-club', name: 'Palm Swim Club', no: '012', year: 2024, accent: '#2B3BF2' },
  { slug: 'sandbox-museum', name: 'Sandbox Museum', no: '011', year: 2024, accent: '#2E6B3F' },
  { slug: 'parade-records', name: 'Parade Records', no: '010', year: 2024, accent: '#6D2A6B' },
  { slug: 'mood-pharmacy', name: 'Mood Pharmacy', no: '009', year: 2023, accent: '#2B3BF2' },
  { slug: 'tamr-studio', name: 'Tamr Studio', no: '008', year: 2023, accent: '#B8412B' },
  { slug: 'loop-mobility', name: 'Loop Mobility', no: '007', year: 2023, accent: '#2E6B3F' },
];
const kinds = ['orb', 'type', 'figure', 'sheet', 'macro'];
const jobs = [];
projects.forEach((p, i) => {
  const base = { name: p.name, no: p.no, year: p.year, accent: p.accent };
  const L = (n) => `PLACEHOLDER · N°${p.no} · ${n}`;
  jobs.push({ out: `src/assets/work/${p.slug}/cover.jpg`, W: 1600, H: 2000, ...base, kind: kinds[i % 5], seed: p.slug + 'c', label: L('COVER') });
  jobs.push({ out: `src/assets/work/${p.slug}/01.jpg`, W: 2400, H: 1500, ...base, kind: kinds[(i + 1) % 5], seed: p.slug + '1', label: L('01') });
  jobs.push({ out: `src/assets/work/${p.slug}/02.jpg`, W: 1200, H: 1500, ...base, kind: kinds[(i + 2) % 5], seed: p.slug + '2', label: L('02') });
  jobs.push({ out: `src/assets/work/${p.slug}/03.jpg`, W: 1200, H: 1500, ...base, kind: kinds[(i + 3) % 5], seed: p.slug + '3', label: L('03') });
  jobs.push({ out: `src/assets/work/${p.slug}/04.jpg`, W: 1200, H: 1500, ...base, kind: kinds[(i + 4) % 5], seed: p.slug + '4', label: L('04') });
  jobs.push({ out: `src/assets/work/${p.slug}/05.jpg`, W: 2400, H: 1500, ...base, kind: 'wall', seed: p.slug + '5', label: L('05') });
});
const labAspects = [[1200, 1200], [1200, 1500], [1080, 1920], [1200, 1200], [1200, 1500], [1200, 1500], [1200, 1200], [1080, 1920], [1200, 1500], [1200, 1200]];
labAspects.forEach(([W, H], i) => {
  jobs.push({ out: `src/assets/lab/lab-${String(i + 1).padStart(2, '0')}.jpg`, W, H, name: 'Lab ' + (i + 1), no: String(i + 1).padStart(3, '0'), year: 2025, accent: ['#2B3BF2', '#0E0E0E', '#6D2A6B', '#B8412B'][i % 4], kind: ['type', 'orb', 'macro', 'sheet', 'figure'][i % 5], seed: 'lab' + i, label: `PLACEHOLDER · LAB ${String(i + 1).padStart(2, '0')}` });
});
for (let i = 1; i <= 5; i++) jobs.push({ out: `src/assets/studio/method-${i}.jpg`, W: 1200, H: 1600, name: 'Method', no: '00' + i, year: 2025, accent: '#2B3BF2', kind: ['sheet', 'type', 'orb', 'figure', 'wall'][i - 1], seed: 'method' + i, label: `PLACEHOLDER · METHOD 0${i}` });
for (let i = 1; i <= 3; i++) jobs.push({ out: `src/assets/studio/person-${i}.jpg`, W: 1200, H: 1500, name: 'Person', no: '00' + i, year: 2025, accent: '#2B3BF2', kind: 'figure', seed: 'person' + i, label: `PLACEHOLDER · PORTRAIT 0${i}` });
jobs.push({ out: 'src/assets/studio/studio-wide.jpg', W: 2000, H: 1250, name: 'Studio', no: '000', year: 2025, accent: '#2B3BF2', kind: 'wall', seed: 'studio-wide', label: 'PLACEHOLDER · STUDIO' });
jobs.push({ out: 'src/assets/studio/studio-detail.jpg', W: 1200, H: 1500, name: 'Studio', no: '000', year: 2025, accent: '#2B3BF2', kind: 'sheet', seed: 'studio-detail', label: 'PLACEHOLDER · PROCESS' });

/* ---------- render ---------- */
const css = `
@font-face{font-family:'Archivo Variable';src:url(${fontUrl('@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:'Instrument Serif';src:url(${fontUrl('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(${fontUrl('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}) format('woff2')}
html,body{margin:0;background:#fff}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
// Load from a file:// page so the local font files are allowed to load.
const tmp = resolve(root, 'node_modules/.cache/placeholders.html');
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, `<!doctype html><html><head><style>${css}</style></head><body><div id="c"></div><span style="font-family:'Archivo Variable';font-weight:800;font-stretch:62%">A</span><span style="font-family:'Instrument Serif'">A</span><span style="font-family:'IBM Plex Mono';font-weight:500">A</span></body></html>`);
await page.goto(pathToFileURL(tmp).href);
await page.evaluate(() => Promise.all(["800 20px 'Archivo Variable'", "20px 'Instrument Serif'", "500 20px 'IBM Plex Mono'"].map((f) => document.fonts.load(f))));
const ok = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
if (ok < 3) throw new Error('fonts did not load (' + ok + ')');

for (const job of jobs) {
  await page.setViewportSize({ width: job.W, height: job.H });
  await page.evaluate((svg) => { document.getElementById('c').innerHTML = svg; }, plate(job));
  const png = await page.locator('#c svg').screenshot({ type: 'png' });
  const out = resolve(root, job.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await sharp(png).jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer());
  process.stdout.write('.');
}

// Social card
await page.setViewportSize({ width: 1200, height: 630 });
await page.evaluate(() => {
  document.getElementById('c').innerHTML = `<div style="width:1200px;height:630px;background:#F3F2EE;display:flex;flex-direction:column;justify-content:space-between;padding:56px;box-sizing:border-box;color:#0E0E0E">
    <div style="font:500 16px 'IBM Plex Mono';letter-spacing:.08em;text-transform:uppercase">seriousplaystudio.com</div>
    <div style="font:800 190px/.8 'Archivo Variable';font-stretch:62%;text-transform:uppercase">Serious Play</div>
    <div style="font:400 44px/1 'Instrument Serif'">Serious research. Playful imagination.</div></div>`;
});
writeFileSync(resolve(root, 'public/og.jpg'), await sharp(await page.locator('#c > div').screenshot({ type: 'png' })).jpeg({ quality: 86 }).toBuffer());

await browser.close();
console.log(`\nwrote ${jobs.length} placeholders and public/og.jpg`);
