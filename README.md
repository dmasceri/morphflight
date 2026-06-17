# MORPHFLIGHT

An on-rails cave flyer with a **morph/orient weapon** as its core verb. You auto-fly
forward through a vast stone hall; you dodge and aim with the stick, and you **reshape
your weapon's spread** (orb / horizontal disk / vertical disk) to match the enemy
formation in front of you. Matched mode melts the formation and builds a chain.

This repo is the playable vertical slice from the prototyping phase. It runs; it's not
balanced. The point of the slice was to lock the *decisions*, which it has.

---

## Run it

```bash
npm install
npm run dev
```

Vite opens it in your browser. **The controller works here** (it was blocked in the
prototyping iframe). Plug in an Xbox pad and the HUD bottom-right shows it connected.

## Controls

- **Move / aim:** WASD or left stick. Movement also leans your weapon's aim where you head.
- **Morph (momentary, release = orb):**
  - horizontal disk → hold **RT** / **E** / **left-mouse**
  - vertical disk → hold **LT** / **Q** / **right-mouse**
- **Charge (limited):** **A/B** or **Space/F** — nova that clears enemies and pillars.

---

## Design decisions already locked (don't relitigate without reason)

- **Genre:** on-rails shooter (Star Fox lineage) crossed with R-Type weapon ideas and a
  Vampire-Survivors-style scaling layer.
- **Core verb:** the morph. Stick aims; triggers reshape the spread. Two layers on purpose —
  that's the skill ceiling that separates this from a passive auto-shooter.
- **Match bonus:** mode that matches a formation (`orb→swarm`, `disk-H→row`, `disk-V→stack`)
  does big damage + `PERFECT` + chain. Mismatch chips.
- **Field:** a few massive **round stone pillars** in-lane to weave through (dodge L/R),
  plus many non-collidable **framing pillars** spread to the edges for a cavernous hall.
  No horizontal beams. Pillars eat bolts (massive stone); charge obliterates them.
  Pillars will later get surface detail (spalling, shearing) and jagged stalactites/mites.
- **Weapon feel:** laser-pulse bolts, tight forward orb spread whose centroid leans toward
  travel, ~6–7 shots/sec.
- **Aesthetic:** ancient technology, not neon. Weathered grey stone, deep-red embers, warm
  near-black void. Mode colors: bronze (orb), blood-red (disk-H), verdigris (disk-V).
- **Camera:** wide-angle (90° FOV) for scale.

## Knobs you'll reach for first

All in the `CFG` block at the top of `src/main.js`:
`FOV`, `FOG`, `SPEED`, `FIRE_INT`, `ORB_BIAS`, `NUM_COLLIDABLE`, **`NUM_AESTHETIC`**
(the side-column count — bumped to 30 here), `AES_X_MIN` / `AES_X_RANGE` (how far the
side pillars spread), pillar sizes, lane bounds, depth.

---

## Next tasks (rough priority)

1. **Modularize** `src/main.js` into `config.js`, `scene.js`, `player.js`, `weapons.js`,
   `enemies.js`, `field.js`, `input.js`, `hud.js`. Keep behavior identical; verify it runs.
   Then `git init` and commit this as the baseline.
2. **Morph-dependent charge:** orb → radial nova (current), disk → an axis-lance that punches
   a lane of pillars + enemies along the held orientation. Unifies the panic button with the verb.
3. **Left/right dash** on the bumpers (LB/RB) for quickly clearing in-lane pillars.
4. **Scaling layer:** matched-kill chain feeds a Vampire-Survivors-style level-up that upgrades
   the weapon (fire rate, bolt count, pierce, an orbiting option).
5. **Field detail:** pillar textures + spalling/shearing, jagged stalactites/stalagmites.
6. **Audio:** placeholder industrial/darksynth loop + bolt/charge/impact SFX.

---

## Kickoff prompt for Claude Code

> This is MORPHFLIGHT, an on-rails morph-weapon cave shooter. `src/main.js` is a working
> single-file prototype. First, confirm `npm install && npm run dev` runs and the game
> plays. Then split `main.js` into modules (config, scene, player, weapons, enemies, field,
> input, hud) with identical behavior, and `git init` + commit as the baseline. Read
> README.md for the locked design decisions — preserve them. After the split, my first
> change is: more framing columns spread wider to the sides (and I want to keep tuning the
> cavernous feel). Don't touch the core morph verb or the ancient-stone aesthetic.
