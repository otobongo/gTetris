# Brickwise

Three toy-brick games for kids that build strategic thinking, spatial reasoning, and early literacy. Each game starts very simple and gets harder one idea at a time.

| Game | What kids do | What it builds |
| --- | --- | --- |
| **Brick Escape** | Slide each brick out through the door of its color. Bricks block each other, some doors are iced shut until enough bricks leave, and some bricks are frozen in place. | Planning ahead, ordering, "what happens if I move this first?" |
| **Brick Drop** | Turn and stack falling bricks to fill whole rows. Early stages use tiny 1 to 3 cell bricks on a narrow board, later stages add 4 and 5 cell bricks and more speed. | Shapes, rotation, spatial planning |
| **Letter Builder** | Put the alphabet in order, match big and small letters, find first sounds, then spell words from pictures. Letters and words are read aloud. | Letter recognition, phonics, spelling |

Progress (stars, unlocked levels, settings) is saved on the device in `localStorage`. There are no accounts, ads, or network calls apart from loading the font.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, also reachable from a phone on the same Wi-Fi
npm test           # engine, level, and content tests
npm run build      # typecheck + production build into dist/
```

`dist/` is a static site that works from any host or subfolder (hash routing, relative asset paths), so GitHub Pages, Netlify, or Vercel all work as-is.

## Project layout

```
src/
  App.tsx, Hub.tsx         game picker and hash router (#/slide, #/drop, #/letters)
  shared/                  UI kit (buttons, top bar, stars, result card, level grid),
                           WebAudio sound effects, speech, storage, seeded RNG
  styles/global.css        design tokens and the shared .brick look
  games/slide/             Brick Escape: engine, BFS solver, levels, UI
  games/drop/              Brick Drop: engine, pieces, stages, UI
  games/letters/           Letter Builder: word list, level generation, UI
scripts/
  generate-slide-levels.ts Brick Escape level generator
```

## How Brick Escape levels are made

Every level is checked by a solver, so none are impossible and each one has a known fewest-moves score ("Best") that decides the stars.

- The first levels (`src/games/slide/levels.hand.ts`) are hand-made to teach one rule each: matching colors, moving a blocker first, door width, ice doors, frozen bricks.
- The rest come from `npm run levels:generate`. It builds random trays in difficulty tiers (board size and shape, colors, brick shapes, fill, ice), solves each one with breadth-first search, keeps only the ones that need real planning (extra moves beyond one per brick), and writes `src/games/slide/levels.data.ts`. It's seeded, so it gives the same output every run.
- The same solver powers the in-game hint button. Using a hint caps that level at 2 stars.

## Mobile

Web is the first target. Everything is touch-first (pointer events, big targets, no page scroll while playing) and the app ships a web manifest, so it can already be added to a phone's home screen. Native iOS and Android builds are a later step and can wrap this same codebase, for example with Capacitor.
