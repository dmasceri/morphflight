# MORPHFLIGHT — progress & next steps (v0.7.0)

Single-file game is still `src/main.js`; all tuning lives in the `CFG` block at the top.

## Aesthetic (note: README is STALE here)
Neon polygonal vectors on a black void. **Consistent scheme (this version): every environment body is
BLACK fill + bright neon edge** — the edge carries the colour. Forest keeps a collidable-(bright)-vs-
framing-(dim) edge cue. Don't reintroduce coloured fills without asking.

## Environments (number keys; `P` = flythrough, no combat)
- **[1] forest** — octagonal neon columns (in-lane collidable + wide framing).
- **[2] stalactite** — black spikes (blue edge) from ceiling/floor + black floor/ceiling with blue grids.
- **[3] channel** — vertical slot: side walls + scrolling grids + inward collidable teeth, plus
  non-collidable FRAMING teeth seeded into the top/bottom margins so the slot feels infinitely tall.
- **[4] cave** — morphing irregular-polygon tunnel + wall pyramids ("bumps").
- **[5] asteroid** — conjoined-cube "tech debris" masses in drifting clumps; size-tiered geometry,
  big boulders, min-floored lateral drift, far debris/parallax field. Rocks bounce off each other
  (elastic) and off the player.

## Collision & boundary contract
Player-vs-environment collision is wired for every env. **Contract: the env's outer shell is a SAFE
stop; only obstacles damage.**
- Safe boundaries: forest/asteroid lane; channel side walls (x-clamp); stalactite floor/ceiling (you
  can fly right up to them); cave tunnel wall (pushback toward centre, no damage).
- Damaging obstacles: columns, channel teeth, stalactites/stalagmites, cave bumps, asteroids.
- Shared `playerHit()` with `HIT_CD` i-frames (cave/asteroid/bumps); forest/stalactite keep their
  inline path. Knobs: `PLAYER_R`, `HIT_CD`, `CAVE_PUSH`, `AST_HIT_FACTOR`, `PLAYER_BUMP`.
- **Bolts still pass through everything** (no bolt-vs-geometry) — deferred pending the
  environmental-destruction design (see below).

## Player shapes
Orb = bright octagon + lighter halo, spins. Disks = three stacked octagons (bright core + lighter
±`DISK_GAP` layers) spinning in-plane, mirroring the orb. Knobs: `DISK_R`, `DISK_GAP`.

## Next steps (rough priority)
1. **Channel wall recessions — REDO (immediate next task).** The stylized nested-square frames were
   tried and removed: an opaque wall occludes any geometry genuinely behind it, so they couldn't read
   as real recesses. Next session: recess the ACTUAL wall-grid squares with real depth — likely a
   hole-punched wall (`THREE.Shape` cutouts, or a per-cell grid of wall panels) with darker/recessed
   panels set back behind the openings. Goal: square voids with genuine depth + a touch of colour.
2. **Environmental destruction design** — decide what's destructible per env (consistent, meaningful,
   fun), plus an env weapon with a cooldown and/or "materials" farming via destruction →
   upgrades/charges/smart-bombs. Then wire bolt-vs-geometry.
3. **Combat depth / scaling layer** (matched-kill chain → weapon upgrades) — not started.
4. **Modularize** `src/main.js` (still single-file). Preserve the Xbox-trigger axis detection in
   `readPad` (triggers report on axes[3]/[4]).
5. **Audio**, per-env tuning passes.

## Running it
`npm run dev`. Screenshots of the live WebGL canvas time out in the headless preview — verify visually
in a real browser. (requestAnimationFrame also throttles when the tab is backgrounded, so
mode/collision only advance while the preview is foregrounded.)
