/*
 * Render the motion pitch to MP4, frame by frame, with the score.
 *
 *   NODE_PATH=$(npm root -g) node film/render.cjs 1920 1080 film/out/serious-play-16x9.mp4 [fps]
 *   node film/render.cjs 1920 1080 out.png --still=37.5   (one frame, for checking)
 *
 * Needs Playwright (Chromium) and ffmpeg (FFMPEG env var or ffmpeg on PATH).
 * Behind a TLS-intercepting proxy, set TRUST_SPKI (see tools/shoot.cjs).
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const [, , Ws, Hs, out, ...rest] = process.argv;
const W = +Ws, H = +Hs;
const still = (rest.find((a) => a.startsWith("--still=")) || "").split("=")[1];
const fps = +(rest.find((a) => /^\d+$/.test(a)) || 30);
const DUR = 72;
const ffmpeg = process.env.FFMPEG || "ffmpeg";

(async () => {
  const args = process.env.TRUST_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.TRUST_SPKI}`] : [];
  const browser = await chromium.launch({ args });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.addInitScript(({ W, H }) => { window.__RENDER = true; window.__W = W; window.__H = H; }, { W, H });
  await page.goto("file://" + path.resolve(__dirname, "index.html"), { waitUntil: "load" });
  await page.evaluate(() => window.__ready);

  if (still !== undefined) {
    for (const t of still.split(",")) {
      await page.evaluate((t) => window.render(t), +t);
      const f = out.replace(/(\.\w+)?$/, `-${t}.png`);
      await page.screenshot({ path: f });
      console.log(f);
    }
    await browser.close();
    return;
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const audio = path.resolve(__dirname, "assets/score.m4a");
  const ff = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-i", audio, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(DUR * fps);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), i / fps);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("wrote", out);
})();
