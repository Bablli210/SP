/*
 * Screenshot a concept page at desktop and phone width.
 *
 *   node tools/shoot.cjs pitch/playground.html out/playground [--full] [--jpeg] [--wait=1500]
 *
 * Writes <out>-desktop.png (1440x900) and <out>-mobile.png (390x844).
 * --jpeg writes viewport-only .jpg files instead (used for pitch/shots/).
 * If a local node_modules folder with gsap / matter-js is found (LIBS env var or
 * ./node_modules), requests to cdnjs for those libraries are served from disk,
 * which lets the script run on machines without CDN access.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const [, , page, out, ...flags] = process.argv;
if (!page || !out) {
  console.error("usage: node tools/shoot.cjs <page.html> <outPrefix> [--full] [--wait=ms]");
  process.exit(1);
}
const full = flags.includes("--full");
const jpeg = flags.includes("--jpeg");
const waitFlag = flags.find((f) => f.startsWith("--wait="));
const wait = waitFlag ? Number(waitFlag.split("=")[1]) : 1500;
const libs = process.env.LIBS || path.resolve("node_modules");

const localMap = [
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/matter-js\/[^/]+\/(.+)$/, (m) => path.join(libs, "matter-js/build", m[1])],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/[^/]+\/(.+)$/, (m) => path.join(libs, "gsap/dist", m[1])],
];

(async () => {
  // Behind a TLS-intercepting proxy, pass its CA key hash so web fonts load:
  // TRUST_SPKI=$(openssl x509 -in ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64)
  const args = process.env.TRUST_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.TRUST_SPKI}`] : [];
  const browser = await chromium.launch({ args });
  const url = "file://" + path.resolve(page);
  const sizes = [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ];
  for (const [name, vp] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log(`[${name}] page error:`, e.message));
    p.on("console", (m) => { if (m.type() === "error") console.log(`[${name}] console:`, m.text()); });
    await p.route(/cdnjs\.cloudflare\.com/, async (route) => {
      const u = route.request().url();
      for (const [re, fn] of localMap) {
        const m = u.match(re);
        if (m && fs.existsSync(fn(m))) return route.fulfill({ path: fn(m), contentType: "application/javascript" });
      }
      return route.continue();
    });
    await p.goto(url, { waitUntil: "load" });
    // Rulebook screenshots show the site without the concept navigation pill
    if (jpeg) await p.addStyleTag({ content: ".sp-concept{display:none!important}" });
    await p.waitForTimeout(wait);
    const file = `${out}-${name}.${jpeg ? "jpg" : "png"}`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await p.screenshot(jpeg ? { path: file, type: "jpeg", quality: 82 } : { path: file, fullPage: full });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${file}  horizontal overflow: ${overflow}px`);
    await ctx.close();
  }
  await browser.close();
})();
