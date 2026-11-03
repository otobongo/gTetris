# Brick Escape design levels (work in progress)

Generator and solver for the Brick Escape boards on the design canvas.

- `gen.cjs` packs every open square with bricks (2x2, 2x3, 2x4, 4x4), places doors (never next to each other; with `corners: true`, used for every board except Level 9 and the master mix, each door starts at a corner of the board), adds obstacles (ice doors that hide their color, color locks that open one at a time, stones and shaped trays; frozen and one-way bricks are still supported by the code but no level uses them, since they were too complex for young children) and keeps only boards the solver can finish.
- `solve.cjs` is a breadth-first solver where one move is one drag.
- `run.cjs <name>` generates one level into `out-<name>.json`. `assemble.cjs` merges them into `design/canvas/Escape.dc.html`.
- `escape-script.js` is the artboard logic the levels plug into.

Status: all six levels (1, 5, 9, frozen doors, stone blocks, master mix) are generated (see `out*.json`) and merged into `design/canvas/Escape.dc.html`. Level 9 uses a fixed packed layout with six colors (white, black, blue, yellow, green, red); best solution 10 moves. Run the scripts from this folder: `SOLVE_LIMIT=150000 node run.cjs 9` regenerates a level, `node assemble.cjs` re-checks every level with the solver and rebuilds the Escape screen. `slide-tier-cache/` is unrelated: it holds saved progress from the main game's level generator.

Locked doors use the neutral ice look: an iced door hides its color until it melts, with a small swatch showing which color unlocks it, and the line under the board says what melts it ("An icy door melts when every green brick is out"). This is a deliberate choice (decided 2026-11-03). It replaces the earlier striped, own-color door with a padlock badge that the live canvas still shows, so publishing this screen changes that look on purpose.
