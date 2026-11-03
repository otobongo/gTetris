# Brick Escape design levels (work in progress)

Generator and solver for the Brick Escape boards on the design canvas.

- `gen.cjs` packs every open square with bricks (2x2, 2x3, 2x4, 4x4), places doors (never next to each other), adds obstacles (ice doors that hide their color, color locks that open one at a time, frozen bricks, one-way bricks, stones and shaped trays) and keeps only boards the solver can finish.
- `solve.cjs` is a breadth-first solver where one move is one drag.
- `run.cjs <name>` generates one level into `out-<name>.json`. `assemble.cjs` merges them into `design/canvas/Escape.dc.html`.
- `escape-script.js` is the artboard logic the levels plug into.

Status: levels 1, 5, frozen doors, stone blocks, frozen bricks and one-way bricks are generated. Level 9 and the master mix were still generating when this was saved, so `design/canvas/Escape.dc.html` is mid-update until `assemble.cjs` runs.
