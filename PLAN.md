# Serious Play: website concept plan

**Client:** Serious Play (seriousplaystudio.com, @seriousplaystudio)
**Their line:** "We create brands rooted by serious research and driven by playful imagination."
**Stage:** Concept. Moodboard, art direction and three UI directions, ready to pitch.
**Next stage:** Build the chosen direction together.

This file is the working plan behind the pitch site in `pitch/`. The client sees the pitch site. This document is for us: it covers the thinking, the pitch run-sheet, and the roadmap to the real build.

---

## 1. The big idea

The studio's name contains the tension the website should resolve: **Serious** (research, rigour, strategy) and **Play** (imagination, craft, fun). The pitch turns that into one simple device, **the dial**. Every design decision sits somewhere between Serious and Play, and the client's first job is to tell us where the studio sits.

The pitch itself is framed as a **game rulebook**, because a rulebook is literally a serious document about play. Seven rules take the client from brief to decision:

| Rule | Title | What it does |
|---|---|---|
| 1 | The object of the game | Restates the brief and the win conditions |
| 2 | The players | Names the three audiences and what each needs |
| 3 | The board | Moodboard: their 16 references plus our mood tiles and vocabulary |
| 4 | The pieces | Six art direction principles shared by every direction |
| 5 | Three ways to play | Three live prototypes, a comparison and our recommendation |
| 6 | Setup | Timeline, sitemap, case-study template, stack, content checklist |
| 7 | Your move | Three decisions and eight questions |

## 2. Research summary

What we could confirm (the cloud workspace blocked direct access to Instagram and both websites, so this comes from public search results):

- **Serious Play** is a brand studio. Its site at seriousplaystudio.com is currently minimal and carries the line above. Contact: info@seriousplaystudio.com. Public listings name Mahmoud Hassan as a co-founder.
- **Studio Gray Lab** (the client's reference site) is an independent art and creative design studio founded by Pratik Gupta, working with fashion, luxury, music and art brands across North America, the UK, the Middle East and Europe. Services: brand identity and strategy, websites and digital experience, creative direction and campaigns, experimental and generative AI design, editorial and print. The site presents case studies as individual pages (e.g. a techno label identity) and publishes plans and pricing openly.
- **The 14 Instagram references and the recap reel** could not be viewed from the workspace. They have numbered slots on the moodboard (see `pitch/refs/README.md`).

**Action:** review the references together (screenshots or a screen-share) and fill in the "what we take" note for each one. Update the moodboard before the pitch.

## 3. The three directions

All three are working homepage prototypes built on the same placeholder portfolio (`pitch/shared/projects.js`), so the comparison is about the experience and not the content.

### 01 · Field Notes (Serious 70 / Play 30)
- **Concept:** the studio as a research lab; the portfolio as an archive of studies.
- **Look:** cool lab-paper grey `#EEF0EC`, ink `#121412`, graphite `#5F6660`, highlighter `#F4EE5A`, correction blue `#2F49D1`. Archivo (condensed display), Newsreader italic (annotations), DM Mono (metadata).
- **Signature:** a measuring crosshair with millimetre readout; highlighter sweeps across the work index; footnotes that light up margin notes.
- **Best if:** they want to lead with strategy and win larger, research-heavy briefs.
- **Risk:** reserved; relies on strong case-study writing.

### 02 · Lights Off (Serious 50 / Play 50)
- **Concept:** a dark, cinematic studio at night. The cursor is a flashlight; the work waits in the dark.
- **Look:** blackout `#0B0B0C`, soot `#151517`, bone `#ECE7DF`, ash `#8C877F`, warm light `#FFE9C4`. Bodoni Moda (display), Geist (UI), Geist Mono (credits). The work is the only colour.
- **Signature:** flashlight reveal and a physical light switch; the page brightens as you reach the footer ("Lights on").
- **Best if:** they want a fashion or luxury-house first impression, closest to Studio Gray Lab's world.
- **Risk:** dark sites need excellent imagery; the reveal must never hide the work from people who don't play.

### 03 · Playground (Serious 25 / Play 75)
- **Concept:** the studio as a toybox. "Make a mess" throws the homepage into physics; "Tidy up" snaps every piece back into a perfect grid.
- **Look:** chalk `#F3F2EF`, ink `#151515`, tomato `#FF4A3D`, sun `#FFC631`, cobalt `#2D4BFF`, mint `#2FC79A`, bubblegum `#FF8BD1`. Unbounded (display), Figtree (UI).
- **Signature:** Make a mess / Tidy up (Matter.js physics synced to real DOM text).
- **Best if:** they want to be remembered and shared, mostly consumer and culture clients.
- **Risk:** novelty fades on repeat visits; the work index must stay fast and plain.

### Recommendation: the hybrid
- **Home and Work:** Lights Off (flashlight + switch).
- **Case studies:** the Field Notes dossier, opening with the finding.
- **Lab and 404:** the Playground.

This gives a luxury first impression, visible research depth, and a shareable easter egg. It also maps neatly onto the dial: the site as a whole sits at 50/50, with individual pages leaning either way.

## 4. Art direction principles (shared)

1. **Two layers, always.** A serious layer (grid, facts, research) and a play layer (one interaction, one surprise) on every page.
2. **Type does the talking.** Two families, big sizes, few weights.
3. **The work carries the colour.** Neutral interface, loud portfolio.
4. **A strict grid you can break.** 12 columns, 8px rhythm, one grid-break per screen.
5. **Motion with weight.** Ease, settle, respond to the hand. Every effect has a reduced-motion version.
6. **Talk like a smart friend.** Plain words, specific claims, wit once the point is clear.

Vocabulary: rigorous, curious, tactile, witty, precise, generous. Avoid: quirky, zany, corporate, minimal for its own sake.

## 5. Pitch run-sheet (45 minutes)

**Before the meeting**
- Add reference screenshots to `pitch/refs/` and write the "what we take" notes.
- Publish the pitch and test every prototype on a laptop and a phone.
- Send nothing in advance. The dial works best live.

**In the room**

| Time | Beat | What happens |
|---|---|---|
| 0–3 | The box | Open the rulebook cover. Don't explain the dial yet. |
| 3–6 | Calibration | Hand the client the dial: "Before we show you anything, where should Serious Play sit?" Note the number. |
| 6–10 | Rules 1–2 | Confirm the brief and the three players. Ask them to correct anything. |
| 10–16 | Rule 3 | Walk the board. Ask which reference they would keep if they could keep only one. |
| 16–20 | Rule 4 | The six pieces. These hold whatever direction they pick. |
| 20–35 | Rule 5 | Play each prototype live, in dial order. Let the client drive: hand them the mouse or phone. |
| 35–40 | Recommendation | Present the hybrid. Compare with their calibration number from minute 3. |
| 40–45 | Rule 7 | Agree the three decisions or a date for them. Leave the eight questions with them. |

**After the meeting:** share the pitch link. The client can set the dial, replay the prototypes and leave notes directly on the page (claude.ai comments).

## 6. Project plan (10 weeks)

| Week | Phase | Output | Gate |
|---|---|---|---|
| 1 | Discovery | Kickoff workshop, reference review, content audit, goals and KPIs | Brief signed off |
| 2–3 | Concept | This rulebook, direction choice, refined art direction | Direction chosen |
| 3–5 | Design | Sitemap, wireframes, key pages (desktop and mobile), motion prototypes, design system | Designs approved |
| 3–7 | Content (parallel) | Case-study writing, photography, video, copy | |
| 6–9 | Build | Front end, CMS, interactions, content entry | |
| 9–10 | QA and launch | Devices, accessibility, performance, SEO, analytics, handover | Launch approval |

### Sitemap
- **Home** (signature moment)
- **Work** (filters by sector and service)
  - Case study template (8–12 at launch)
- **Studio**: Method (Serious / Play), People, Careers
- **Services**
- **Lab** (experiments; the Playground lives here)
- **Contact**
- Utility: 404 (Playground), Privacy, Press kit

### Case-study template
1. Title and finding
2. The brief
3. The research (interviews, audits, sketches, rejected routes)
4. The idea
5. The work (full-bleed images and video)
6. The result (numbers or quotes where allowed)
7. Credits and next study

### Stack
- **Recommended:** Astro + Sanity CMS + GSAP/Lenis for motion + Matter.js only where physics is needed, hosted on Vercel with preview deployments.
- **Alternative:** Framer or Webflow for a faster, designer-edited build with simpler interactions. The flashlight is achievable there; the physics playground is harder.

### Content checklist
- [ ] 8–12 projects: one finding each, research material, 8–15 images, credits, optional video
- [ ] Studio and team photography (or a planned shoot)
- [ ] Services copy, client list, press
- [ ] Logo files, brand fonts, social handles
- [ ] One decision-maker per gate

### Quality bar
- Reduced-motion and keyboard versions of every interaction
- WCAG 2.2 AA: contrast, focus, alt text, captions
- Lighthouse performance 90+ on key pages on a mid-range phone
- SEO basics: titles, descriptions, social cards, structured data for projects
- Privacy-friendly analytics

## 7. Open questions for the client

1. Which reference matters most, and why (type, colour, motion, layout, attitude)?
2. Who is the client they most want to win next (sector, size, region)?
3. Which projects must be on the site at launch, and is their research material still available?
4. Does the site need a second language? Right-to-left (e.g. Arabic) changes type and layout choices early.
5. Where is the studio based, and should the site say so?
6. Who updates the site after launch, and how often?
7. Is there photography and video of the team and the work?
8. Is there a launch date or event, and a budget range for the build?

## 8. When we come back to build

1. Lock the direction (or hybrid) and the dial position.
2. Replace `pitch/shared/projects.js` placeholders with real projects in a CMS schema (project: title, number, sector, year, services, finding, brief, research blocks, gallery, credits, palette for covers).
3. Scaffold the Astro project, port the chosen prototype's CSS tokens and interactions into components, and build the case-study template.
4. Set up Sanity, preview deployments on Vercel, and analytics.
5. Content entry, QA against the quality bar, launch.
