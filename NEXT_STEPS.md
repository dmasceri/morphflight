# MORPHFLIGHT — progress & next steps (v0.6.0)

Snapshot of where the prototype stands and what's next. The single-file game is still
`src/main.js`; all tuning lives in the `CFG` block at the top.

## Aesthetic (note: README is STALE here)
The README still says "ancient stone, not neon." That was **reversed** — the game is now
**neon polygonal vectors** on a black void: solid bodies + fat neon-blue edge lines
(`three/examples/jsm/lines` Line2). Orb = blue octagon, disks = green, enemies = pink
wireframe. Update README when convenient.

## Environments (swap with number keys; `P` = flythrough, no combat)
- **[1] forest** — octagonal neon columns (in-lane collidable + wide framing).
- **[2] stalactite** — black spikes (blue edge) from ceiling/floor + black floor/ceiling
  with a dense blue scrolling grid.
- **[3] channel** — vertical slot: two tall side walls + scrolling wall grids + inward teeth.
- **[4] cave** — DONE. Tunnel of constant irregular polygon sections (4–6 sides) joined by
  short morph transitions that draw "node vectors"; black pyramids seated flush on the walls.
  Roundness knob = `CAVE_IRREG` (higher = jaggeder); `CAVE_MIN_EDGE`/`CAVE_MAX_ANGLE` are
  loose guardrails (tightening them makes walls ROUNDER — counterintuitive).
- **[5] asteroid** — SKETCH only. Tumbling low-poly rocks (icosa/dodeca/octa) drifting past.
  Needs art pass: clustering/lanes, size distribution, maybe a debris/parallax layer.

Architecture: per-env `THREE.Group`s; only the active `env` updates/renders. All fat-line
materials registered in `edgeMats[]` for resize.

## Camera (all CFG-driven)
Pitch tilts with vertical input + eases to neutral; idle/edge recenter via camera POSITION
(level horizon); `CAM_MAX_OFFSET` caps how far the orb rides off-centre. Knobs: `CAM_*`.

## Known gaps / next steps (rough priority)
1. **Collision** — cave, channel teeth, and asteroids are VISUAL ONLY (no player collision /
   no bolt-vs-geometry). Forest columns + stalactites collide. Wire up the rest.
2. **Asteroid void** — promote sketch to real env (see above).
3. **Combat depth** — enemies are easily dodged in open envs. Levers discussed: wider/denser
   waves (done a bit via `WAVE_AIM`), consequence for ignoring, and the big one:
4. **Scaling layer** — Vampire-Survivors-style matched-kill chain → weapon upgrades. Not started.
5. **Modularize** `src/main.js` into modules (README task 1) — still single-file. If/when done,
   preserve the Xbox-trigger axis detection in `readPad` (pad reports triggers on axes[3]/[4]).
6. **Audio**, field surface detail, per-env tuning passes.

## Running it
`npm run dev` (Node was installed via winget; if `node` isn't on a shell's PATH, the Vite
binary is at `node_modules/vite/bin/vite.js`). Screenshots of the live WebGL canvas time out
in the headless preview — verify visually in a real browser.
