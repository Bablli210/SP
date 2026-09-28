# Serious Play: website

The new Serious Play website and everything that led to it: the concept pitch (moodboard, art direction, three live UI directions and the plan, presented as a game rulebook), wireframes, a motion pitch, and the production site in `site/`.

Published pitch (private until shared from its Share menu): https://claude.ai/artifact/MjrfnuU6QSTJbQyhuqipwL

## What's here

| Path | What it is |
|---|---|
| `pitch/index.html` | **The rulebook.** The client-facing pitch: the Serious/Play dial, brief, audiences, moodboard, art direction, the three directions, recommendation, plan and questions. |
| `pitch/field-notes.html` | Direction 01: research-lab archive (Serious 70 / Play 30) |
| `pitch/lights-off.html` | Direction 02: cinematic dark studio with a flashlight cursor (50 / 50) |
| `pitch/playground.html` | Direction 03: physics toybox with Make a mess / Tidy up (25 / 75) |
| `pitch/shared/projects.js` | Shared placeholder portfolio and generated project covers used by all three directions |
| `pitch/refs/` | Drop reference screenshots here (see its README for file names) |
| `pitch/shots/` | Screenshots of each direction used on the rulebook page |
| `PLAN.md` | The working plan: research, directions, pitch run-sheet, 10-week project plan, open questions, build roadmap |
| `tools/shoot.cjs` | Screenshot helper (Playwright) for desktop and phone captures |
| `moodboard/` | The moodboard and art direction notes (`NOTES.md`), built from the client's references |
| `wireframes/` | Sitemap and wireframes for every page, desktop and phone |
| `film/` | The motion pitch: a scripted film with an original score (`render.cjs` records it to video) |
| `site/` | **The real website.** Astro static site; see `site/README.md` to run it, swap in real work and launch |

## Viewing locally

Everything is static HTML. Open `pitch/index.html` in a browser, or serve the folder:

```sh
npx serve pitch
```

Fonts load from Google Fonts and Matter.js (Playground) from cdnjs, so you need an internet connection.

## Updating the moodboard

1. Save a screenshot for each Instagram reference into `pitch/refs/` using the names in `pitch/refs/README.md`.
2. Reload the rulebook: the tiles pick the images up automatically.
3. Add a one-line "what we take" note per tile.

## Regenerating direction screenshots

```sh
NODE_PATH=$(npm root -g) node tools/shoot.cjs pitch/lights-off.html pitch/shots/lights-off --jpeg
```

## Notes

- Projects in the prototypes are placeholders with generated covers. Swap in real case studies for the final build.
- Instagram references belong to their owners and are linked, not copied.
