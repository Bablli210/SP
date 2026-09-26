/*
 * Serious Play — shared concept data.
 *
 * Every direction prototype reads from this one file so the three concepts
 * show the same studio and the same work. Projects are PLACEHOLDERS: the
 * names are fictional and the covers are generated. Swap in real case
 * studies (and real imagery) when the final build starts.
 *
 * Exposes window.SP:
 *   SP.studio            studio facts and copy
 *   SP.services          service list (to confirm with the client)
 *   SP.method            the five-step process
 *   SP.projects          placeholder case studies
 *   SP.cover(p, opts)    returns an inline <svg> string for a project cover
 *                        opts: { ratio: "portrait" | "landscape" | "square",
 *                                font: CSS font-family for display text,
 *                                mono: CSS font-family for small labels,
 *                                variant: 0..3 (alternate layout) }
 */
(function () {
  "use strict";

  var studio = {
    name: "Serious Play",
    // Their own line, from seriousplaystudio.com
    thesis: "We create brands rooted by serious research and driven by playful imagination.",
    short: "Serious research. Playful imagination.",
    email: "info@seriousplaystudio.com",
    instagram: "@seriousplaystudio",
    site: "seriousplaystudio.com"
  };

  // To confirm with the client: this list is our assumption of their offer.
  var services = [
    { name: "Research & Strategy", note: "Audits, interviews, positioning, brand platforms" },
    { name: "Brand Identity", note: "Logos, systems, typography, colour, guidelines" },
    { name: "Naming & Voice", note: "Names, taglines, tone of voice, messaging" },
    { name: "Packaging", note: "Structure, surface, retail presence" },
    { name: "Digital", note: "Websites, social systems, product UI" },
    { name: "Campaigns & Motion", note: "Launch concepts, content, animation" }
  ];

  var method = [
    { step: "Observe", serious: "Field research, audits, interviews", play: "Collect everything, judge nothing" },
    { step: "Question", serious: "Find the tension worth solving", play: "Ask the silly question out loud" },
    { step: "Play", serious: "Structured exploration sprints", play: "Make fifty wrong things quickly" },
    { step: "Test", serious: "Put ideas in front of real people", play: "Keep what makes people lean in" },
    { step: "Launch", serious: "Systems, guidelines, rollout", play: "Leave room for the brand to keep playing" }
  ];

  // Placeholder portfolio. Palettes are chosen so covers read as a varied body of work.
  var projects = [
    {
      id: "halwa-house", no: "014", name: "Halwa House", sector: "Food & Beverage", year: 2025,
      services: ["Strategy", "Identity", "Packaging"],
      summary: "A century-old sweets recipe, repackaged for a generation that gifts on impulse.",
      finding: "72% of purchases were gifts, yet the packaging was designed for the pantry.",
      palette: { bg: "#F2B8C6", fg: "#3A0D1A", accent: "#E4412B" }, motif: "arch", mark: "HH"
    },
    {
      id: "kiln", no: "013", name: "Kiln & Co.", sector: "Craft & Retail", year: 2025,
      services: ["Naming", "Identity", "Digital"],
      summary: "A ceramics studio that wanted to sell the process as much as the pots.",
      finding: "Customers stayed 4x longer on videos of firing than on product shots.",
      palette: { bg: "#2C2A26", fg: "#F1E7D8", accent: "#D9772B" }, motif: "sun", mark: "K"
    },
    {
      id: "palm-swim", no: "012", name: "Palm Swim Club", sector: "Hospitality", year: 2024,
      services: ["Identity", "Campaign", "Motion"],
      summary: "A members' pool club that needed to feel like a summer you remember.",
      finding: "Members described the club by sound first: splashes, music, ice.",
      palette: { bg: "#1F5BFF", fg: "#F5F1E6", accent: "#FFD23F" }, motif: "wave", mark: "PSC"
    },
    {
      id: "sandbox", no: "011", name: "Sandbox Museum", sector: "Culture", year: 2024,
      services: ["Research", "Identity", "Wayfinding"],
      summary: "A children's museum where adults are also allowed to play.",
      finding: "Parents were the ones taking photos, so we designed for them too.",
      palette: { bg: "#FFD23F", fg: "#141414", accent: "#1F5BFF" }, motif: "grid", mark: "S"
    },
    {
      id: "parade", no: "010", name: "Parade Records", sector: "Music", year: 2024,
      services: ["Identity", "Art Direction"],
      summary: "An independent label whose identity changes with every release.",
      finding: "Fans collected the sleeves more than the vinyl.",
      palette: { bg: "#141414", fg: "#F5F1E6", accent: "#FF5CA8" }, motif: "stripe", mark: "PR"
    },
    {
      id: "mood-pharmacy", no: "009", name: "Mood Pharmacy", sector: "Wellness", year: 2023,
      services: ["Strategy", "Naming", "Packaging"],
      summary: "Skincare with clinical claims and a sense of humour about them.",
      finding: "Buyers trusted the science, but remembered the jokes.",
      palette: { bg: "#DDE8E0", fg: "#10302A", accent: "#FF6A3D" }, motif: "dots", mark: "Rx"
    },
    {
      id: "tamr", no: "008", name: "Tamr Studio", sector: "Gifting", year: 2023,
      services: ["Identity", "Packaging", "Digital"],
      summary: "Dates, reframed from a seasonal staple to a design object.",
      finding: "The box was kept long after the dates were eaten.",
      palette: { bg: "#5A2A1B", fg: "#F6D9A8", accent: "#F6D9A8" }, motif: "blob", mark: "T"
    },
    {
      id: "loop", no: "007", name: "Loop Mobility", sector: "Technology", year: 2023,
      services: ["Research", "Identity", "Product UI"],
      summary: "A bike-share app that made the city feel smaller and friendlier.",
      finding: "Riders planned trips by landmarks, never by street names.",
      palette: { bg: "#F5F1E6", fg: "#141414", accent: "#12A150" }, motif: "monogram", mark: "L"
    }
  ];

  // ---------- seeded random ----------
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function r1(n) { return Math.round(n * 10) / 10; }

  // Smooth closed blob through points (Catmull-Rom to Bezier)
  function blobPath(cx, cy, radius, rand, points, wobble) {
    var pts = [];
    for (var i = 0; i < points; i++) {
      var a = (i / points) * Math.PI * 2;
      var r = radius * (1 - wobble / 2 + rand() * wobble);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    var d = "M" + r1(pts[0][0]) + "," + r1(pts[0][1]);
    for (var j = 0; j < points; j++) {
      var p0 = pts[(j - 1 + points) % points], p1 = pts[j], p2 = pts[(j + 1) % points], p3 = pts[(j + 2) % points];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + r1(c1x) + "," + r1(c1y) + " " + r1(c2x) + "," + r1(c2y) + " " + r1(p2[0]) + "," + r1(p2[1]);
    }
    return d + "Z";
  }

  var RATIOS = { portrait: [800, 1000], landscape: [1200, 750], square: [900, 900] };

  function cover(p, opts) {
    opts = opts || {};
    var size = RATIOS[opts.ratio] || RATIOS.portrait;
    var W = size[0], H = size[1];
    var font = opts.font || "Georgia, serif";
    var mono = opts.mono || "ui-monospace, Menlo, monospace";
    var variant = opts.variant || 0;
    var rand = rng(hash(p.id + ":" + variant));
    var bg = p.palette.bg, fg = p.palette.fg, ac = p.palette.accent;
    var m = Math.min(W, H);
    var art = "";

    switch (p.motif) {
      case "arch": {
        var aw = m * 0.56, ah = H * 0.62, ax = (W - aw) / 2, ay = H * 0.16;
        art += '<path d="M' + ax + "," + (ay + ah) + " V" + (ay + aw / 2) + " A" + aw / 2 + "," + aw / 2 + " 0 0 1 " + (ax + aw) + "," + (ay + aw / 2) + " V" + (ay + ah) + ' Z" fill="' + ac + '"/>';
        var iw = aw * 0.58, ix = (W - iw) / 2, iy = ay + aw * 0.28;
        art += '<path d="M' + ix + "," + (ay + ah) + " V" + (iy + iw / 2) + " A" + iw / 2 + "," + iw / 2 + " 0 0 1 " + (ix + iw) + "," + (iy + iw / 2) + " V" + (ay + ah) + ' Z" fill="' + bg + '"/>';
        art += '<text x="' + W / 2 + '" y="' + (iy + iw * 0.78) + '" text-anchor="middle" font-family="' + esc(font) + '" font-size="' + r1(iw * 0.42) + '" font-style="italic" fill="' + fg + '">' + esc(p.mark) + "</text>";
        break;
      }
      case "sun": {
        var cx = W / 2, cy = H * 0.5, rings = 7;
        for (var i = rings; i > 0; i--) {
          art += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r1((m * 0.42 * i) / rings) + '" fill="' + (i % 2 ? ac : bg) + '"/>';
        }
        art += '<text x="' + cx + '" y="' + r1(cy + m * 0.07) + '" text-anchor="middle" font-family="' + esc(font) + '" font-size="' + r1(m * 0.2) + '" fill="' + fg + '">' + esc(p.mark) + "</text>";
        break;
      }
      case "wave": {
        var lines = 14, amp = m * 0.035;
        for (var l = 0; l < lines; l++) {
          var y = H * 0.18 + (l * H * 0.62) / lines, d = "M0," + r1(y), phase = rand() * Math.PI;
          for (var x = 0; x <= W; x += 20) d += " L" + x + "," + r1(y + Math.sin(x / (W / 5) + phase + l * 0.4) * amp);
          art += '<path d="' + d + '" fill="none" stroke="' + (l % 3 === 0 ? ac : fg) + '" stroke-width="' + r1(m * 0.012) + '" stroke-linecap="round" opacity="' + (l % 3 === 0 ? 1 : 0.9) + '"/>';
        }
        art += '<rect x="' + r1(W * 0.08) + '" y="' + r1(H * 0.07) + '" width="' + r1(m * 0.34) + '" height="' + r1(m * 0.13) + '" rx="' + r1(m * 0.065) + '" fill="' + ac + '"/>';
        art += '<text x="' + r1(W * 0.08 + m * 0.17) + '" y="' + r1(H * 0.07 + m * 0.088) + '" text-anchor="middle" font-family="' + esc(font) + '" font-size="' + r1(m * 0.06) + '" font-weight="700" fill="' + bg + '">' + esc(p.mark) + "</text>";
        break;
      }
      case "grid": {
        var cols = 4, cell = W / cols, rows = Math.ceil(H / cell);
        for (var gy = 0; gy < rows; gy++) {
          for (var gx = 0; gx < cols; gx++) {
            var px = gx * cell, py = gy * cell, t = Math.floor(rand() * 5), rot = Math.floor(rand() * 4) * 90;
            var cxg = px + cell / 2, cyg = py + cell / 2, col = rand() > 0.7 ? ac : fg;
            if (t === 0) art += '<circle cx="' + cxg + '" cy="' + cyg + '" r="' + r1(cell * 0.38) + '" fill="' + col + '"/>';
            else if (t === 1) art += '<path d="M' + px + "," + py + " h" + cell + " A" + cell + "," + cell + " 0 0 1 " + px + "," + (py + cell) + ' Z" fill="' + col + '" transform="rotate(' + rot + " " + cxg + " " + cyg + ')"/>';
            else if (t === 2) art += '<path d="M' + px + "," + (py + cell) + " L" + (px + cell) + "," + py + " V" + (py + cell) + ' Z" fill="' + col + '" transform="rotate(' + rot + " " + cxg + " " + cyg + ')"/>';
            else if (t === 3) art += '<rect x="' + r1(px + cell * 0.2) + '" y="' + r1(py + cell * 0.2) + '" width="' + r1(cell * 0.6) + '" height="' + r1(cell * 0.6) + '" fill="' + col + '"/>';
          }
        }
        break;
      }
      case "stripe": {
        var n = 9, sw = W / n;
        for (var s = 0; s < n; s++) {
          if (s % 2 === 0) art += '<rect x="' + r1(s * sw) + '" y="0" width="' + r1(sw) + '" height="' + H + '" fill="' + (s === 4 ? ac : fg) + '" opacity="' + (s === 4 ? 1 : 0.08) + '"/>';
        }
        art += '<text x="' + W / 2 + '" y="' + r1(H * 0.58) + '" text-anchor="middle" font-family="' + esc(font) + '" font-size="' + r1(m * 0.42) + '" font-weight="800" letter-spacing="-8" fill="' + fg + '">' + esc(p.mark) + "</text>";
        art += '<circle cx="' + r1(W * 0.78) + '" cy="' + r1(H * 0.22) + '" r="' + r1(m * 0.07) + '" fill="' + ac + '"/>';
        break;
      }
      case "dots": {
        var step = m / 11;
        for (var dy = step; dy < H; dy += step) {
          for (var dx = step / 2; dx < W; dx += step) {
            var dist = Math.hypot(dx - W * 0.62, dy - H * 0.42) / m;
            var rr = Math.max(0, step * 0.46 * (1 - dist * 1.1));
            if (rr > 1) art += '<circle cx="' + r1(dx) + '" cy="' + r1(dy) + '" r="' + r1(rr) + '" fill="' + ac + '"/>';
          }
        }
        art += '<text x="' + r1(W * 0.08) + '" y="' + r1(H * 0.86) + '" font-family="' + esc(font) + '" font-size="' + r1(m * 0.26) + '" font-weight="700" fill="' + fg + '">' + esc(p.mark) + "</text>";
        break;
      }
      case "blob": {
        art += '<path d="' + blobPath(W / 2, H * 0.48, m * 0.36, rand, 9, 0.35) + '" fill="' + ac + '"/>';
        art += '<path d="' + blobPath(W / 2, H * 0.48, m * 0.18, rand, 7, 0.4) + '" fill="' + bg + '"/>';
        art += '<text x="' + W / 2 + '" y="' + r1(H * 0.48 + m * 0.06) + '" text-anchor="middle" font-family="' + esc(font) + '" font-size="' + r1(m * 0.16) + '" font-style="italic" fill="' + ac + '">' + esc(p.mark) + "</text>";
        break;
      }
      default: { // monogram
        art += '<text x="' + r1(-m * 0.04) + '" y="' + r1(H * 0.92) + '" font-family="' + esc(font) + '" font-size="' + r1(H * 1.05) + '" font-weight="800" fill="' + fg + '">' + esc(p.mark) + "</text>";
        art += '<circle cx="' + r1(W * 0.74) + '" cy="' + r1(H * 0.3) + '" r="' + r1(m * 0.14) + '" fill="' + ac + '"/>';
      }
    }

    var pad = m * 0.055, fs = m * 0.028;
    var label =
      '<text x="' + r1(pad) + '" y="' + r1(pad + fs) + '" font-family="' + esc(mono) + '" font-size="' + r1(fs) + '" letter-spacing="1.5" fill="' + fg + '">' + esc(p.name.toUpperCase()) + "</text>" +
      '<text x="' + r1(W - pad) + '" y="' + r1(pad + fs) + '" text-anchor="end" font-family="' + esc(mono) + '" font-size="' + r1(fs) + '" letter-spacing="1.5" fill="' + fg + '">N°' + esc(p.no) + "</text>";

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(p.name) + ' cover (placeholder artwork)">' +
      '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>' + art + label + "</svg>";
  }

  window.SP = { studio: studio, services: services, method: method, projects: projects, cover: cover, rng: rng, hash: hash };
})();
