# Brick Escape design levels (work in progress)

Generator and solver for the Brick Escape boards on the design canvas.

- `gen.cjs` packs every open square with bricks (2x2, 2x3, 2x4, 4x4), places doors (never next to each other), adds obstacles (ice doors that hide their color, color locks that open one at a time, frozen bricks, one-way bricks, stones and shaped trays) and keeps only boards the solver can finish.
- `solve.cjs` is a breadth-first solver where one move is one drag.
- `run.cjs <name>` generates one level into `out-<name>.json`. `assemble.cjs` merges them into `design/canvas/Escape.dc.html`.
- `escape-script.js` is the artboard logic the levels plug into.

Status: all eight levels (1, 5, 9, frozen doors, stone blocks, frozen bricks, one-way bricks, master mix) are generated (see `out*.json`) and merged into `design/canvas/Escape.dc.html`. Level 9 uses a fixed packed layout with six colors (white, black, blue, yellow, green, red); best solution 10 moves. Run the scripts from this folder: `SOLVE_LIMIT=150000 node run.cjs 9` regenerates a level, `node assemble.cjs` re-checks every level with the solver and rebuilds the Escape screen. `slide-tier-cache/` is unrelated: it holds saved progress from the main game's level generator.
