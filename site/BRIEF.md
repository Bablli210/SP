# Build brief: Serious Play website

This is the working brief for everyone building pages. Read it fully before writing code.

## The client and the direction

Serious Play is a brand studio. Their line: "We create brands rooted by serious research and driven by playful imagination." The agreed direction is **work first: show, don't tell**. The website must sell the studio through its work, with minimal copy, captions as facts, and **smooth** interaction (eased, momentum-based, transform/opacity only, following the hand, never bouncy, never janky).

Reference material in this repo (read what your page needs):
- `moodboard/NOTES.md` and `moodboard/index.html`: the art direction (palette, type, six rules).
- `wireframes/*.dc.html` + `wireframes/canvas.json` (`notes` entries describe each page's interactions): the approved wireframes. Match their structure; improve the craft.
- `pitch/the-ring.html`: the working prototype of the home ring (momentum, snap, caption swap, index view with a lerped preview, case expansion). Port its behaviour, not its placeholder art.

## Art direction rules (non-negotiable)
1. Neutrals carry everything: paper, bone, concrete, ink. **One accent per screen** (cobalt by default; a case study uses its project's `accent`).
2. Type roles (classes in `src/styles/global.css`):
   - `.display`: condensed grotesk, uppercase, huge, for page titles and one word per screen.
   - `.serif`: Instrument Serif, for project names, statements and values.
   - `.label`: IBM Plex Mono uppercase, for facts, numbers, captions and timecodes.
   - `.ui`: small uppercase grotesk for navigation and controls.
3. Small text, big imagery. Captions are facts (N°, client, sector, discipline, year), never adjectives.
4. Nothing childish: no rounded toy shapes, no bright multi-colour, no bouncy easing, no emoji.
5. Placeholders: text in `[square brackets]` from `src/data/site.ts` stays bracketed. Never invent real clients, people, awards, numbers or quotes.

## Tech and conventions
- Astro 7 static site in `site/`. TypeScript strict. No new npm dependencies (ask in your report if you truly need one). Lenis is already running site-wide.
- Layout: wrap every page in `src/layouts/Base.astro` (props: `title`, `description`, `theme` 'paper'|'ink', `smooth` (false for pages that own their scroll), `footer`, `cta`, `headerOverlay`, `noindex`, `jsonLd`). The header is fixed, `var(--header-h)` tall; leave room for it.
- Content: use `src/lib/work.ts` (`getProjects`, `getFeatured`, `getLab`, `projectUrl`, `plateName`, `disciplineLabel`, `disciplineList`) and `src/data/site.ts`. Project data shape: `src/content.config.ts`.
- Images: always `src/components/Media.astro` (`src`, `alt`, `ratio`, `sizes`, `priority`, `name`, `class`). Set honest `sizes`. First-screen images get `priority`.
- Shared-element transitions: pass `name={plateName(project)}` to the Media that shows a project's cover **only where that project appears once on the page** (ring plates, work index grid/list, case hero, next-project). Names must be unique per page. The case hero uses the same name so the cover morphs between pages.
- Client scripts: put them in a `<script>` in your component, import `onPage` from `src/scripts/motion.ts`, and do all setup inside `onPage(() => { ... return cleanup })`. **Your setup must return early if its root element is not on the page** (scripts stay loaded across page navigations). Remove every listener and stop every rAF loop in the cleanup.
- Motion: one rAF loop per interaction, lerp toward a target, stop the loop when settled. Animate `transform` and `opacity` only. Easing: `var(--ease)` and `var(--ease-out)`. Honour `prefers-reduced-motion` (use `reducedMotion()` from motion.ts): no inertia, no parallax, instant state changes, everything still usable.
- Styles: scoped `<style>` in your components, using the tokens (`--paper`, `--bone`, `--concrete`, `--ink`, `--graphite`, `--line`, `--cobalt`, `--bg`, `--fg`, `--muted`, `--rule`, `--accent`, `--g`, `--header-h`, `--ease`, `--ease-out`). No hard-coded colours except inside a project's own `accent`.
- Accessibility: one `<h1>` per page; real links and buttons; keyboard paths for every interaction; visible focus; `aria-*` where state changes; alt text from content; contrast AA.
- Responsive 360px to 1920px with no horizontal overflow. Follow the mobile wireframes.

## File ownership
You may only create or edit the files your task names. Everything else is read-only, including `global.css`, `motion.ts`, `Base.astro`, `Header.astro`, `Footer.astro`, `Media.astro`, `work.ts`, `site.ts` and the content. If you need a change in a shared file, say exactly what and why in your report and work around it meanwhile.

## Checking your work
- Start a dev server on your assigned port: `cd /home/user/SP/site && (npx astro dev --port <PORT> --host 127.0.0.1 > /tmp/dev-<PORT>.log 2>&1 &)`. Wait until `curl -s http://127.0.0.1:<PORT>/` answers.
- Screenshot: `NODE_PATH=/opt/node22/lib/node_modules node scripts/snap.cjs http://127.0.0.1:<PORT>/<path>/ <scratch>/<name> [--full] [--reduced]`. It writes desktop and phone PNGs and prints console errors and overflow. Look at the PNGs with the Read tool. Write your own small Playwright script in your scratch folder to test interactions (drag, wheel, keys, clicks, transitions).
- Types: `npx astro check` must report 0 errors in your files.
- Do not run `astro build` (other builders share the folder). Stop your dev server when done: `pkill -f "astro dev --port <PORT>"`.
- Do not commit or push.
