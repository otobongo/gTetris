# Brief: six more games on the four-puzzle levels

Color Mixer, Shape Sorter, Number Line-up (batch 1); Pattern Train, Brick Calculator, Picture Builder (batch 2).

Status: **approved by the user on 2026-11-06, with the recommended answer to every open question (11.1). Batch 1 may start.**
Surface: the web app (`src/`) and its design canvas (`design/canvas/*.dc.html`), phone 390x844 and tablet 834x1194 (inner frame 596x853 at zoom 1.4). One brief, built in two batches of three games (your choice).

**Guide pack** (load once, before starting, one pass, no review afterwards). No nativefit (web app).
- Canvas agents A1 and A2: unslop web cards `guide/layout.md`, `typography.md`, `color.md`, `interaction.md`, `imagery.md`, `copy.md`.
- Kit agent K: `guide/layout.md`, `typography.md`, `color.md`, `interaction.md`, `copy.md`, `code.md`, since K also writes the play frame, the help row, the choice row, the finished state and the shared lines.
- Game agents (M, S, N in batch 1; P, C, B in batch 2): `guide/layout.md`, `typography.md`, `color.md`, `interaction.md`, `copy.md`, `code.md`. Agents S and B also load `imagery.md` (new shapes, pictures).
- Screens agent F: `guide/copy.md` and `guide/code.md`.
- Test, test-review and security agents load no cards.
- Open a rule in `references/` by its ID only when a card line is not enough.

The look comes from `src/styles/tokens.css` and the existing boards. Section 7 lists every value this work needs, by token name, so nobody re-derives them.

**Carried over and not reopened:** the four-puzzle brief's fixed decisions 1 to 5, its sections 2 to 5 (child flow, stuck flow, stars over 4 puzzles), and the user decisions in its 11.1 and 11.2 (D1 to D7). In short: every level holds 6 puzzles on one idea at one difficulty and 4 solved finish it; children never see a level grid; a stuck child gets a different puzzle for free; picking and resetting levels is for grown-ups in Settings; up to 3 stars per level, a hint caps at 2; Break opens at the next puzzle boundary; speech plays only after a tap.

**Decided in this brief** (reasons in the sections named):
1. Batch 1 is Color Mixer, Shape Sorter and Number Line-up. Batch 2 is Pattern Train, Brick Calculator and Picture Builder (2).
2. One shared game kit is built first, in batch 1, and all six games use it. The three built games keep their own code (3.1).
3. Each game gets as many chapters as it already has stickers (3, 3, 2, 3, 2, 3), so the sticker book does not change (3.4).
4. None of the six games has a clock or a sand timer. Only Number Line-up has a hint, 3 per level (4).
5. All six use Letter Builder's star rule on slips: 3 stars at 1 slip or none, 2 stars at 4 or fewer (3.2).
6. Every puzzle is made by code from a small hand-written level table and checked by Vitest. Picture Builder's pictures are the exception: they are hand-drawn and you review them (4.6).
7. No stored shape changes and no migration (6).
8. Sounds follow Letter Builder (tap, good, wrong, win through the Sounds switch), and every level keeps one difficulty: Pattern Level 12 mixes only the two four-car patterns (3.1, 4.4).

---

## 1. Goal, users, done

**Goal:** the six Coming soon games become playable on the same level system as Brick Escape, Brick Drop and Letter Builder.
**Users:** children 3 to 10. Ages 3 to 4 cannot read, so every game works from shapes, colours, the dots, the big green button and the speaker. Grown-ups use Settings: the Age row, the level picker, reset one game.

| | Batch 1 | Batch 2 |
|---|---|---|
| Games | Color Mixer, Shape Sorter, Number Line-up | Pattern Train, Brick Calculator, Picture Builder |
| Levels x puzzles | 9 x 6, 9 x 6, 12 x 6 | 12 x 6, 12 x 6, 12 x 6 (from 42 pictures) |
| Shared work | the kit, `run.ts`, tokens, test lists (3) | two icons, nothing else shared |

**A batch is done when, for its three games:**
- A Home tap opens the current level at its next unsolved puzzle. The pill reads "Level N" and Coming soon is gone from those cards.
- Every level holds 6 puzzles that pass the content checks in 4; 4 solved finish the level, record its stars, open the next level, and the level card starts it in one tap. After the last level the child sees the finished card, and on a later visit the finished state.
- The stuck offer follows the `STUCK` rows in 3.3, costs nothing and never runs dry.
- Home, Settings (Progress rows, picker, reset one game) and Break name the same current level, and the sticker book names the game's chapters. All of them read the registry, so this follows once a game has `meta`.
- The canvas boards in section 5 for that batch render at 390x844 and 834x1194 with no clipped text, and the app matches them.
- All tests pass and the real counts are reported; the journeys in 10.4 run; no colour, radius or font size outside section 7; copy matches section 8; no em or en dashes.
- Batch 1 also: the kit is in place and tested; Today's discovery follows open question 2.
- Batch 2 also: no Coming soon card is left on Home; `ComingSoon.tsx` stays and is tested with a stub game (3.5).

## 2. Batches

1. **Shared pieces first, each with two users.** The drag helper is built for Shape Sorter (a piece onto its hole) and Number Line-up (a tower onto a tower) at the same time. A shared piece shaped by two games at once gets a better API than one shaped by a single game. The choice row starts with Color Mixer's Guess form and Pattern Train reuses it.
2. **Every kit path runs in a real game in batch 1:** run-seeded content (Mixer, Numbers), fixed content (Sorter), content that depends on the age band with `keepSolved` (Numbers Levels 9 to 12), the 3-hint budget (Numbers), drag (Sorter, Numbers), taps only (Mixer). The one exception is `hold`, which only Picture Builder calls; its reducer tests land with the kit in batch 1. Batch 2 adds game bodies. Its only possible kit edit is a new pair in `colorPairs.ts`, if A2's colour check finds one (9.4).
3. **Number Line-up before Brick Calculator.** Both change their numbers by age band. Number Line-up is the first game after Letter Builder to use that run pattern, so Brick Calculator only copies a pattern that already works. The two games share no code beyond the kit.
4. **Drag shared with Brick Escape.** Escape's `slide/drag.ts` is brick engine logic and stays where it is. The pointer handling in `SlideGame.tsx` (pointer capture, the tablet zoom, a lost pointer never counting) is the pattern the kit's helper copies. Picture Builder's paint strokes in batch 2 reuse the helper's pointer parts, which K exports in batch 1 (3.1), so Builder needs no kit change.
5. **Today's discovery links to Color Mixer.** Home's discovery card opens `#/game/mixer`, which shows Coming soon today. Mixer in batch 1 removes the most visible dead end.
6. **Risk.** Batch 1 has no hand-drawn content: every puzzle is generated and checked by tests. Batch 2 holds the riskiest content (39 new Picture Builder pictures that need your eyes) next to the smallest game (Pattern Train), and Builder's contact sheet goes on the canvas before its code (5.3).

## 3. Shared work, done once in batch 1

### 3.1 The game kit (`src/games/kit/`)
Today each built game rebuilds the same lifecycle (`SlideGame.tsx` 853 lines, `drop/Play.tsx` 729, `LettersApp.tsx` 422). The six new games share one kit instead.

| File | Job |
|---|---|
| `levelRun.ts` | Pure reducer for one level: start, puzzle on screen, band frozen per puzzle (D2), slips, the stuck signals through `stuckStep` and `STUCK`, solve, swap, next, the hint budget, level done. No React and no DOM, so Vitest runs it in node. |
| `useLevelRun.ts` | Thin hook over the reducer: `progressStore.startRun`, `recordPuzzle`, `swapPuzzle`, `spendHint`; `breakBefore(path)` on Next, Play Level and New puzzle; the 1 s tick only while the page is visible, no card is open and the game has not called `hold(true)`; `LEVEL_CARD_DELAY_MS`. When `recordPuzzle` returns `ignored` (no active player), the level goes on in memory and nothing is saved, as the built games do. |
| `route.ts` | `routeFor(gameId, params, current, levelCount)`: Escape's `routeFor` in `slide/puzzles.ts`, made generic. |
| `GameApp.tsx` | The route guard each game's App uses. It decides once per route change, as `SlideApp.tsx` does, and renders Play with `key={level}` or the finished state. |
| `PlayScreen.tsx` | The shared frame: `TopBar` (back "Back to home", title "Level N", `PuzzleDots` below it, speaker on the right), the game's body, the help row, the controls slot that becomes **Next puzzle**, and `LevelCard`. Focus moves to Next on a solve and to the game's first control after Next. When the level card is closed with Escape or the scrim, the controls slot shows the same **Play Level N** button and focus goes there (four-puzzle section 10). |
| `Finished.tsx` | The finished state (four-puzzle 2.5 and D6): top bar with the game's title, the game's empty play area behind the scrim, `LevelCard` with the star total, the grown-up note and **Back to games**. |
| `HelpRow.tsx` | Letter Builder's help row made shared: grid 54 / 1fr / 54, offer cell on the left, hint cell on the right, the line in the middle with `role="status"`. Markup order is line, hint, offer, so the offer is last to tab to. Two line styles (7.2). |
| `ChoiceRow.tsx` | Behaviour for a row of 2 to 4 answer buttons: wrong (dim, then back), right (ring), locked after the solve (`aria-disabled`). Each game draws its own tile inside. Used by Mixer's Guess form and Pattern Train. |
| `dragToTarget.ts`, `useDragToTarget.ts` | Pure threshold and hit-test math, plus the pointer hook: 8 px threshold, pointer capture, offsets divided by the tablet zoom, release over a target, return on a miss, `pointercancel` drops the drag, and the click that follows a drag is ignored through a flag that the next `pointerdown` clears (the Sorter and Numbers boards clear it on the next click, which can swallow a real tap). Tap an item, then a target, does the same thing. `dragToTarget.ts` also exports the pointer parts on their own (capture, the point with the zoom taken out, the element under it), which Picture Builder's paint strokes use in batch 2. |
| `copy.ts` | The shared lines in 8.1 and `slipFact(n)`. |
| `colorPairs.ts` | The colour pairs that colour puzzles never put together (9.4). Named apart from Mixer's content file `mixer/colors.ts`. |
| `kit.css` | `bw-helprow`, `bw-choice`, `bw-drag` classes, token values only (7.2). |

The API the games build against is fixed here, so game agents can start before the kit lands:
```ts
interface KitGame<P> {
  id: RunGame; meta: GameMeta; title: string;
  set: (band: AgeBand) => string;   // 'mixer:1', or 'numbers:1:5-6' when content depends on the band
  seed: 'run' | 'fixed';             // 'run': a new random seed per run, stored in it; 'fixed': 0
  keepSolved?: boolean;              // numbers and math: a band change keeps solved puzzles
  hints?: boolean;                   // numbers only: 3 per level through spendHint
  puzzle: (level: number, n: number, ctx: { seed: number; band: AgeBand }) => P;
}
interface LevelRunApi<P> {
  phase: 'play' | 'solved' | 'done'; level: number; puzzleNo: number; puzzle: P;
  band: AgeBand;                     // frozen for the puzzle on screen
  dots: { solved: number; at: number };
  offer: boolean;
  shared: 'offer' | 'swapped' | null; // which shared line the help row shows instead of the game's own
  slip(key?: string): void;          // always feeds the stuck count; a key seen before on this puzzle adds no star slip
  progress(): void;                  // resets the time signal
  hold(on: boolean): void;           // no time counts while on: Picture Builder's first look and each Peek
  solve(): void;                     // PuzzleResult { count: slips, usedHint, outOfTime: false }; ignored unless phase is 'play'
  swap(): void; next(): void;        // each ignored outside its phase, so a double tap acts once
  hint: { left: number; use(): void } | null;
  card: LevelCardProps | null;
}
```

**Slips, one rule for the six games.** A slip is a wrong answer. Every wrong answer counts toward the stuck offer. For stars, giving the same wrong answer again on the same puzzle is not a new slip: the game passes a key (the pair, the hole, the car) and the reducer counts each key once. Number Line-up passes no key, because every backward swap moves the row further from done.

**Sounds, as Letter Builder plays them.** Through `sfx` in `src/shared/sound.ts`, which follows the Sounds switch: `sfx.tap` on a pick, `sfx.good` on a right move that does not solve, `sfx.wrong` on a slip, `sfx.win` on a solve. Nothing else plays. The six boards have no sound, so this follows the built games.

**Built games stay as they are.** Brick Escape, Brick Drop and Letter Builder keep their own lifecycle. Moving them onto the kit would be a separate refactor with its own tests, and nothing here needs it.

### 3.2 `src/games/run.ts`
One edit in batch 1 covers all six games, so batch 2 never touches the file.
- `RunGame` gains `'mixer' | 'sorter' | 'numbers' | 'pattern' | 'math' | 'builder'`.
- Set helpers, version 1: `mixerSet()`, `sorterSet()`, `patternSet()`, `builderSet()` give `'<id>:1'`; `numbersSet(band)` and `mathSet(band)` give `'<id>:1:<band>'`.
- `STUCK` rows from 3.3.
- `LEVEL_STAR_RULES` entries `{ three: 1, two: 4 }` for all six, and one `slipLevelStars(game)` (what `lettersLevelStars` does, through `capStars`) behind all six `LEVEL_STARS` entries.

### 3.3 Stuck table (`STUCK`)
Count limit, then seconds. The count signal is slips (3.1); the time signal is seconds with no progress, counted only while the puzzle is on screen, the page is visible and no card is open (four-puzzle 3.1).

| Game | Progress that resets the time signal | 3 to 4 | 5 to 6 | 7 to 8 | 9 to 10 |
|---|---|---|---|---|---|
| Color Mixer | a paint of the goal's pair placed (Make it); none before the answer in Finish and Guess | 3, 30 s | 3, 40 s | 4, 50 s | 4, 60 s |
| Shape Sorter | a right placement | 3, 30 s | 3, 40 s | 4, 50 s | 4, 60 s |
| Number Line-up | a forward swap | 3, 45 s | 3, 60 s | 4, 75 s | 4, 90 s |
| Pattern Train | none before the answer | 3, 30 s | 3, 40 s | 4, 50 s | 4, 60 s |
| Brick Calculator | any key press | 2, 45 s | 2, 45 s | 3, 60 s | 3, 60 s |
| Picture Builder | a new right brick | 3, 30 s | 3, 40 s | 4, 50 s | 4, 60 s |

Mixer, Sorter, Pattern and Builder copy Letter Builder's row, the closest game (one tap per try). Number Line-up gets longer: one swap is two taps and a choice among six towers. Brick Calculator counts typed answers, a slower and more deliberate try than a tap, so its count is lower and its seconds longer. None of these numbers comes from play data; they live in this one table so tuning is one edit.

### 3.4 Registry, App and the places that list three games
- **Registry** (`registry.ts`): each batch passes its three games' `meta` in place of `null`. `noun` stays `'Level'` and `unit` stays `'puzzle'` for all six, so the unions, `PuzzleDots` and `screens/logic/levels.ts` need no change.
- **App** (`App.tsx`): one `GAME_SCREENS` line and one import per game.
- **Chapters match the stickers** in `screens/logic/stickers.ts`: Mixer 3, Sorter 3, Numbers 2, Pattern 3, Calculator 2, Builder 3. Children meet chapters only through stickers (there is no level grid), so matching keeps the "of 40" total and the sticker art as they are, and `screens.test.ts` already checks that every sticker of a playable game maps to a real chapter.
- **Today's discovery** on Home: open question 2.
- **Settings timer panel:** add "Only Brick Escape and Brick Drop use this timer." under its text, since 7 of the 9 games are untimed.
- **Settings Progress panel** grows to 6 rows after batch 1 and 9 after batch 2, in Home order with no grouping. It already scrolls.
- **Tests that list the three games by hand** are changed in batch 1 so batch 2 only adds ids (10.3).

### 3.5 Coming soon
In batch 1, `math` (built in batch 2) replaces `mixer` as the "not built" example in tests. After batch 2 every registered game is playable. `ComingSoon.tsx` and its `App.tsx` branch stay for the next game; their tests render `ComingSoon` with a stub entry, and the route tests that meant "not playable" check an unknown game id instead. Each changed test is named in the PR body.

### 3.6 New tokens and icons
- `tokens.css` (agent K): `--bw-display: #121034` (Calculator display), `--bw-panel-top: #4a3ca8` (Sorter holes panel, top), `--bw-bowl: #e9e4ff` (Mixer bowl, top), `--bw-on-pink: #241a63` (label on pink keys), `--bw-z-drag: 20` (a dragged piece). The first three are read from the boards; `--bw-on-pink` fixes a contrast failure (9.3); 20 is the boards' drag z-index.
- `Icon.tsx` (agent B, batch 2): `eye` and `eraser`, copied from the SVG in `Builder.dc.html`.
- Mixer's paint and result colours are content, kept in `src/games/mixer/colors.ts` with the board's hex values, the way Letter Builder keeps its picture art in `Pictures.tsx` (7.3). Snapping them to the brick tokens would turn red plus white into the hot `--brick-pink`, which does not read as a lighter red.

## 4. Per game

Each game owns `src/games/<id>/` with `meta.ts`, its content module, `copy.ts`, its App (on `GameApp`), its Play screen (on `PlayScreen`) and one CSS file with its own prefix. Copy lines are in section 8, values in section 7, accessibility in section 9.

### 4.1 Color Mixer (`mixer`, batch 1, prefix `mix-`)

**The child** taps paint pots; there is no drag. One puzzle is one goal colour or one question, in one of three forms:

| Form | On screen | The child | Right when |
|---|---|---|---|
| Finish the mix | goal chip; paint 1 already in its slot, fixed | taps the paint that makes the goal | the pair makes the goal |
| Guess the mix | both paints already in the slots | taps one of 3 colours, each named | the colour is what the pair makes |
| Make it | goal chip; both slots empty | taps two paints | the pair makes the goal, in either order |

**Content: 9 levels x 6 = 54 puzzles, 3 chapters of 3.**

| Chapter (picker note) | Level | Form | Shelf | Results in play |
|---|---|---|---|---|
| Mix two paints (red, yellow and blue) | 1 | Finish | red, yellow, blue | orange, green, purple, each twice (once per given paint) |
| | 2 | Guess | none | the same 3, each twice (slots swapped); the 3 choices are the 3 results |
| | 3 | Make it | red, yellow, blue | the same 3, each twice |
| Make it lighter (add white) | 4 | Finish | red, yellow, blue, white | pink, sky blue, cream, each twice (white given, or the colour given) |
| | 5 | Guess | none | the same 3, each twice; 3 choices from the 6 results |
| | 6 | Make it | all 4 | the same 3, each twice |
| All six colors (every mix) | 7 | Finish | all 4 | all 6, once each |
| | 8 | Guess | none | all 6, once each; 3 choices from the 6 |
| | 9 | Make it | all 4 | all 6, once each |

- The board's 4 paints and 6 recipes stay as they are: every unordered pair of the 4 paints, each a different colour. Nothing new is invented.
- **Levels 2, 3, 5 and 6 hold 3 questions, each twice.** A pool of 3 results gives only 3 different Guess questions and 3 different Make it goals, so each twin differs only in slot order and choice order (Guess) or shelf order (Make it). Levels 1 and 4 have 6 different puzzles (each result with either paint given), Levels 7 to 9 have 6 results. The twins follow your rule for Letter Builder Level 1 (four-puzzle 11.1, decision 11): the 3 questions alternate in the queue, so a swap brings a different question, and a child may meet one question twice while solving 4.
- The Finish shelf leaves out the given paint. Guess wrong choices share a paint with the pair when one exists.
- `makePuzzles(level, seed)` in `puzzles.ts` builds a level's 6 puzzles from this table and the run's seed, so a resumed level shows the same puzzles and a grown-up's replay shows them in a new order with new choices.
- **Difficulty** grows by form (finish, then guess, then make from nothing), by pool (3 mixes, 3 tints, all 6) and by shelf (3 paints, then 4). A level's 6 puzzles share form, shelf and choice count.
- **Age bands:** the same puzzles for every band (set `mixer:1`); the band changes only the stuck limits. Names under every swatch and the speaker carry ages 3 to 4.

**The board's own counters and modes:**

| On the board | In the level system | Why |
|---|---|---|
| Sub "Found {n} of 6" | 4 dots under "Level N" | one progress display in every game |
| Discover and Challenge buttons | removed (open question 1) | children do not pick modes |
| Endless goal loop, 2200 ms auto-advance | the level's 6 puzzles and **Next puzzle** | nothing hurries the child; it also removes the board's bug where a tap during the wait gets wiped |
| "Empty the bowl", top right | the speaker; tapping a filled slot empties that slot | the speaker sits top right in all six games |
| "My color book" and its 6 slots | removed (open question 1) | a second progress book would need new stored data |
| Mode buttons about 42 px tall | gone with the modes | kid controls are 54 px or taller |

**Stuck, hint, timer, stars.** Slip: a new wrong pair (Finish, Make it) or a new wrong colour (Guess). The same paint twice is no slip. Offer in the help row's left cell. No hint: in Finish and Guess one wrong tap leaves at most 2 answers, and the result text teaches every wrong pair. No clock. Stars by slips (3.2).

**Speech.** The speaker ("Hear the question") reads the chip, and after a mix the result text. A pot tap says nothing.

**Screen, top to bottom:** top bar; chip; two slots with "+"; bowl; result block (name, then text); help row; controls (the shelf for Finish and Make it, 3 named swatches for Guess).
- *play:* empty slots dashed; result name "Pick two paints" (or the form's line). The bowl shows the mix with two paints in, the one paint's colour with one, and is empty with none. **In Guess the bowl stays empty until the right colour is tapped**, since the mix would show the answer.
- *slip:* Finish and Make it: the bowl and result block show what the pair made; the help line says it is not the goal yet. Guess: the tapped swatch dims and comes back (`ChoiceRow`), the bowl stays empty and the result block keeps "Pick a color".
- *solved:* the dot fills, the help line states the result, the shelf or swatches give way to **Next puzzle** in the same space.
- *stuck:* the offer button in the help row's left cell and the offer line.
- *levelDone, gameDone:* the shared card; the finished state shows the empty bowl and slots.

**Edge cases:** a tap on a given slot (Finish's paint 1, both Guess slots) or on an empty slot does nothing; in Finish a tap on another pot replaces paint 2; in Make it a third tap starts a new pair with that paint; a swap while a wrong mix shows clears the bowl; White and Cream keep the board's inset shading so they show on the dark ground; Guess wrong then right is one slip; a double tap on the right answer solves once.

**Content checks** (Vitest, every level over 200 seeds): 6 recipes, one per unordered pair, all results different; every puzzle has exactly one right answer (Finish: one right paint on its shelf; Make it: one right pair; Guess: the right colour once among 3 different choices); 6 puzzles per level; on Levels 1, 4 and 7 to 9 no two puzzles are equal (form, goal, given paint); on Levels 2, 3, 5 and 6 each result appears exactly twice, the twins differ in slot order and choice order (Guess) or shelf order (Make it), and no two neighbours in the starting queue share a result, first and last included; in Guess the bowl shows nothing before the right answer; every paint and colour belongs to the level's shelf and pool; same seed, same puzzles; a walk over every tap order reaches the solve and never gets stuck.

### 4.2 Shape Sorter (`sorter`, batch 1, prefix `sort-`)

**The child** drags a piece from the tray onto its hole, or taps a piece and then a hole (the board has both). A piece fits only its own hole: the same shape, and on colour levels the same colour. One puzzle is one board, sorted completely.

**Content: 9 levels x 6 = 54 puzzles, 3 chapters of 3.**

| Chapter (picker note) | Level | Pieces | Puzzle 1 |
|---|---|---|---|
| Shapes (one color) | 1 | 2 shapes, yellow | board level 1 |
| | 2 | 3 shapes, yellow | board level 2 |
| | 3 | 5 shapes, one from each shape family, yellow | board level 3 |
| Shape and color (both must match) | 4 | 4: 2 shapes x 2 colours | board level 4 |
| | 5 | 6: 3 shapes, each in 2 of 3 colours | board level 5, with its green pieces made yellow (9.4) |
| | 6 | 6: 2 shapes x 3 colours | new |
| Big boards (eight pieces) | 7 | 8: 4 shapes x 2 colours | new |
| | 8 | 8: 3 shapes x 3 colours, one left out | new |
| | 9 | 8: two look-alike pairs x 2 colours | new |

- **Shapes grow from 5 to 8:** rectangle, diamond and pentagon join circle, square, triangle, star and hexagon, drawn with `clip-path` like the others (7.4). Shape families: square, rectangle and diamond are one family; pentagon and hexagon another; circle, triangle and star stand alone. Levels 1 to 8 take at most one shape per family, which gives Level 3 exactly six shape sets; with today's 5 shapes Level 3 would have one set, its puzzles would differ only in layout, and a swap would bring the same puzzle back. Level 9 takes two shapes from the square family plus pentagon and hexagon.
- **Colours:** the board's six, yellow, red, blue, green, pink and purple, through the `--brick-*` tokens. Shape levels use yellow only; colour levels draw their colours from the six under the avoid list (9.4).
- **8 pieces at most:** 8 pieces take 3 rows of holes and 2 rows in the tray; a ninth piece adds a third tray row, 34 px more than a 390x844 phone holds.
- `puzzle(level, n)` in `puzzles.ts` is a pure function of the level and puzzle number (like Brick Drop's starter stacks): set `sorter:1`, seed 0.
- **Difficulty:** piece count (2 to 8), shape count, whether colour matters, colour count, how alike the shapes look.
- **Age bands:** the same puzzles for every band; the band changes only the stuck limits.

**The board's own counters and modes:**

| On the board | In the level system | Why |
|---|---|---|
| Sub "Level {n} of 5 · {name}" | dots under "Level N" | one progress display; the five level names go, and the picker shows the chapter titles in this section |
| "Start over", top right | the speaker | a sort cannot fail and placed pieces are never lost |
| "Next level" and "Play again" in the tray | **Next puzzle**, then the level card and the finished card | the shared flow |
| "All sorted!" | help line "Every shape is home." | calm, literal lines |
| Nothing saved, a reload starts at level 1 | the run store, saved after each solved puzzle | shared rule |
| Placed pieces leave the tray and the rest shift | a placed piece leaves a faint ghost in its slot, as in Letter Builder | nothing moves under a finger |
| Prompt line above the holes | the help row, prompt style | it holds the offer cell |
| Fact bar as wide as its text | full width, badge with an accessible name | layout; the star's 5 counts points |

**Stuck, hint, timer, stars.** Slip: a new wrong placement (a piece dropped or tapped onto another piece's hole). A drop off every hole, onto a filled hole, or a tap on a hole with nothing picked is no slip. Offer in the help row's left cell. No hint: the wrong line already names what matched. No clock. Stars by slips.

**Speech.** The speaker ("Hear the help line") reads the help line, then the fact. On a right placement the game says the piece's name ("red circle"), as the board does: it follows the child's own move, as D4 allows in Letter Builder. Nothing else plays by itself.

**Screen, top to bottom:** top bar; help row; holes panel (3 columns); fact bar; tray well.
- *play;* *picked* (piece lifted, "Now tap the {red circle} hole."); *dragging* ("Drop the {red circle} in its hole."); *wrong* (the hole shakes with a red ring, the line names what matched); *solved* (every hole filled, "Every shape is home.", **Next puzzle** centred in the tray well); *stuck;* *levelDone;* *gameDone* (empty holes panel and tray).
- **Note (2026-11-13):** the order is the same, but the holes panel and fact bar now sit just above the tray well, with the spare height between the help row and the holes, and "a drop off every hole" in the slip rule above means a release more than 24 px from every hole's edge. See the outcome under 7.4.

**Edge cases:** a drag cut off by the system puts the piece back with no slip; the tap after a drag always works (3.1); tapping a second piece moves the pick; a wrong placement sends the piece back and clears the pick; the wrong line stays until the next pick, drag or placement; filled holes are not focusable; the last placement solves at once; after a placement focus goes to the next tray piece; on tablet, drag offsets are divided by the zoom.

**Content checks** (all 54): the level's piece count, unique ids, one hole each; the six share piece, shape and colour counts; on colour levels every piece has a shape-mate and a colour-mate, so neither alone solves it; the family rule; no two puzzles share a piece set or a hole order; no piece starts over its own hole; puzzle 1 of Levels 1 to 5 equals the board's set; the colour pairs in 9.4; placing every piece in its hole in any order finishes, and a wrong hole changes only the slip count; every shape has a name, a fact and a badge name; same input, same board.

### 4.3 Number Line-up (`numbers`, batch 1, prefix `num-`)

**The child** puts six number towers in order by swapping two at a time: drag one tower onto another, or tap two towers (the board has both). Right when the row is in the level's order.

**Content: 12 levels x 6 = 72 puzzles, 2 chapters.**

| Chapter (picker note) | Level | Numbers | Order | Fewest swaps |
|---|---|---|---|---|
| Stairs (1 to 6, up and down) | 1 to 4 | 1 to 6, height equals value | smallest first | 2, 3, 4, 5 |
| | 5 to 8 | 1 to 6 | biggest first | 2, 3, 4, 5 |
| Bigger numbers (read the numbers) | 9 | by band | smallest first | 3 |
| | 10 | by band | biggest first | 4 |
| | 11 | by band, counting by steps at ages 7 to 10 | smallest first | 5 |
| | 12 | by band, counting by steps at ages 7 to 10 | biggest first | 5 |

Bigger numbers, 6 different ones per puzzle:

| 3 to 4 | 5 to 6 | 7 to 8 | 9 to 10 |
|---|---|---|---|
| 1 to 10 | 1 to 20 | 1 to 100; Levels 11 and 12 count by 5s or 10s (15, 20, 25, 30, 35, 40) | 1 to 999; Levels 11 and 12 count by 5s, 10s or 100s |

These ranges, like the fewest-swaps column, are starting values: no board sets them. They live in one table in `puzzles.ts`, so tuning is one edit.

- **Bigger-number towers are one brick high** (the number face only), so the child must read the numbers. The goal strip shows the stair shape without numbers, and tower colours follow the seed, never the order. The canvas adds this as the `big` state (5.2).
- "Missing numbers (2, 4, _, 8)", named in the board's footer note, is a different mechanic with no board. It is not in this build.
- `makePuzzles(level, seed, band)` in `puzzles.ts`, set `numbers:1:<band>` with `keepSolved`, as Letter Builder does. After a band change the unsolved puzzles come from the new band's numbers with the same seed, so a solved order could come back once in that level. That is accepted, so `PuzzleResult` stays unchanged (6).
- **Difficulty:** order direction, then fewest swaps (6 minus the number of cycles), then bigger numbers. A level's 6 puzzles share the number rule, direction and fewest swaps, and their inversion counts differ by 2 at most.
- **Age bands:** Levels 1 to 8 are the same for every band; Levels 9 to 12 use the band's numbers.

**The board's own counters and modes:**

| On the board | In the level system | Why |
|---|---|---|
| Sub "Level 3 of 15" | dots under "Level N" | one progress display |
| "Smallest first" and "Biggest first" | removed; the level sets the order and the goal strip shows it | one idea per level, and the toggle could undo a solved row |
| "Mix them up", top right | removed; the speaker takes the slot | it always set the same order, so it was neither a restart nor a new puzzle |
| "Show me how" (a 17 s demo that cannot be stopped) | the **Hint**: one step of the same demo, 3 per level | the demo blocks play for 17 s, and green is kept for Next and New puzzle |
| Footer note "Later levels: ..." | removed | it is a roadmap note for reviewers |
| Solved glow, bouncy motion, a solved row that can be undone | marks all filled, dot, solved line, Next; towers lock | shared solved state and motion rules |
| Spoken order on a solve | the speaker only | speech after a tap |

**Stuck, hint, timer, stars.** Slip: a swap that raises the inversion count (moves the row further from done); every one counts. A child who swaps neighbours into place makes none. Offer in the help row's left cell, Hint in its right cell (Letter Builder's yellow Hint with its badge). The hint puts the board's arrow and a ring on the tower that belongs in the first wrong spot and a ring on the tower standing there, with the line "{4} belongs in the {second} spot. Swap them."; it stays until the next swap. 3 hints per level (`hintsLeft`), spent at once. A hint used on a puzzle that is then solved caps the level at 2 stars; one used on a puzzle later swapped away stays spent and does not cap (four-puzzle 3.3). No clock. Stars by slips, with the hint cap.

**Speech.** The speaker ("Hear the help line") reads the goal and the help line, and once solved the solved line with its numbers.

**Screen, top to bottom:** top bar; goal strip; help row (prompt style, Hint on the right); tower well with the six right-spot marks; footer slot (the legend during play, **Next puzzle** after the solve).
- *play;* *picked* (tower lifted, "Now tap where it should go."); *hint* (arrow and rings, hint line); *solved* (every mark filled, "Stairs going up: 1, 2, 3, 4, 5, 6."); *stuck;* *levelDone* (with the cap line when a hint counted); *gameDone* (empty well).

**Edge cases:** tapping the picked tower puts it down; a swap that sorts the row solves at once and locks the towers; Hint clears a pick; Hint is disabled at 0 left, during a card and after the solve; Hint and offer can show together; a drag released over empty space goes back; a new tap cuts a swap animation short; three-digit numbers fit the 48 px face.

**Content checks** (every level x band over 200 seeds): each puzzle is a permutation of its numbers and not already in order; all 6 need the level's fewest swaps, checked against a breadth-first search over all 720 orders for Levels 1 to 8; inversion counts within 2; the 6 differ as orders (and as number sets on 9 to 12); numbers stay inside the band's range and 3 digits; counting levels form one even step; following the hint step to the end solves in exactly the fewest swaps and every step lowers the inversion count; same seed, same puzzles.

### 4.4 Pattern Train (`pattern`, batch 2, prefix `pat-`)

**The child** taps one of three cars to fill the empty car at the end of the train; there is no drag. Right when the car is the next one in the pattern.

**Content: 12 levels x 6 = 72 puzzles, 3 chapters (3, 6, 3).**

| Chapter (picker note) | Level | Pattern | What changes | Cars shown |
|---|---|---|---|---|
| Two-car patterns (AB) | 1 | AB | shape and colour | 4 |
| | 2 | AB | colour only | 4 |
| | 3 | AB | shape only | 4 |
| Three-car patterns (ABC, AAB, ABB) | 4 | ABC | shape and colour | 5 |
| | 5 | ABC | colour only | 5 |
| | 6 | ABC | shape only | 5 |
| | 7 | AAB | shape and colour | 5 |
| | 8 | ABB | shape and colour | 5 |
| | 9 | AAB or ABB | colour only | 5 |
| Longer patterns (four cars) | 10 | ABCD | shape and colour | 5 |
| | 11 | AABB | shape and colour | 5 |
| | 12 | ABCD or AABB | shape and colour | 5 |

- **Cars:** the board's 4 shapes (circle, square, triangle, star) in its 5 colours (red, blue, yellow, green, pink): 20 cars and no new art.
- **5 cars at most** plus the empty one: at the board's 0.78 zoom a sixth car does not fit 358 px.
- **Wrong options:** at least one other car of the pattern (for ABCD, the car before the empty one), the rest from the pattern or from outside it. On colour-only levels every option has the answer's shape; on shape-only levels, its colour.
- **One reading only:** the smallest repeat length that fits the shown cars must equal the pattern's length and predict the answer, so a train like red, red, red is never made.
- `makePuzzles(level, seed)` in `puzzles.ts`, set `pattern:1`, run seed. The board's 4 rounds are test fixtures for the trains: given their cars, the generator makes the same trains and answers for Levels 1, 4 and 5. Round 4 (red, blue and pink circles) puts red next to pink on a colour-only level, which the avoid list forbids (9.4), so the Level 5 fixture uses a yellow circle in its place, as Sorter Level 5's green pieces become yellow. The board's `level` lever (1, 4, 7, 10) does not show Level 5, so the board needs no change for it. Its options become the red, blue and yellow circles: the rule above leaves out the board's blue square, and green and pink cannot join red there.
- **Difficulty:** pattern length (2, 3, 4), repeats (AAB), then what changes (both, then one), then a mix of the same length. Level 12 mixes the two four-car patterns of Levels 10 and 11, as Level 9 mixes AAB and ABB, so each level stays at one difficulty (four-puzzle fixed decision 1). A Level 12 that mixed every pattern would put AB and ABCD in one level.
- **Age bands:** the same puzzles for every band; the band changes only the stuck limits.

**The board's own counters and modes:**

| On the board | In the level system | Why |
|---|---|---|
| Round dots in their own row, 30x10, named "Round {n} of 4" | the shared dots under "Level N" | one progress display; the old to-do dot measured 1.4:1 |
| Sub with the round name | removed | the dots take the sub's place |
| Rounds loop forever | 6 puzzles per level and the level card | levels end |
| Auto-advance at 1800 ms | **Next puzzle**; the train leaves when Next is tapped | nothing hurries the child |
| Choices still tappable after the solve | locked; the tray gives way to Next | shared solved state |
| Empty top right | the speaker | ages 3 to 4 hear the pattern |
| "All aboard!" and "Choo choo!" | literal lines (open question 4) | the only exclamation is "You finished every level!" |

**Stuck, hint, timer, stars.** Slip: a new wrong car. Offer in the help row's left cell. No hint, no clock. Stars by slips: tapping at random averages about 4 slips over 4 puzzles, so a guesser lands at 2 stars and a child who reads the pattern at 3.

**Speech.** The speaker ("Hear the pattern") reads "Red circle, blue square, red circle, blue square. What comes next?". A choice tap says nothing.

**Screen, top to bottom:** top bar; prompt line; train on its rail; help row (help style, two lines high from the start); choice tray.
- *play;* *wrong* (the tapped car dims and tilts for 500 ms, "Say the pattern out loud and try again."); *solved* (the empty car filled with a ring, prompt "Pattern complete.", help "{Yellow triangle} comes next.", **Next puzzle** in the tray); *stuck;* *levelDone;* *gameDone* (the locomotive on an empty rail).

**Edge cases:** a double tap on the right car solves once; a repeated wrong car costs one slip; the next puzzle's cars take taps at once (the train motion never blocks input).

**Content checks** (every level over 200 seeds): the answer is the next car; one reading only; exactly one right option, all options different, wrong options differ in the level's attribute; the 6 puzzles differ and use at least 3 car sets; the right option sits in each of the 3 places at least once per level; 5 cars at most; same seed, same puzzles; the board's trains come out of the generator.

### 4.5 Brick Calculator (`math`, batch 2, prefix `calc-`)

**The child** counts the bricks, types the answer on the keypad and presses =. One puzzle is one fixed sum shown as bricks and as "3 + 4 = ?". A right answer solves it; a wrong one is a slip, the entry clears and the answer is never shown.

**Content: 12 levels x 6 = 72 puzzles, 2 chapters.**

| Chapter (picker note) | Levels | Sums |
|---|---|---|
| Adding (plus) | 1 to 4 | plus only |
| Taking away (then plus and minus) | 5 to 8 | minus only, answer 1 or more |
| | 9 to 12 | plus and minus, about half each; answer 0 allowed |

Each level has `top` (largest total for plus, largest start for minus) and `maxB` (largest second number). In each group of 4 levels `maxB` is 2, 3, 5, then `top - 1` (never more than `top - 1`), and `top` is 60, 75, 90, then 100 % of the band's ceiling, rounded up and never under 5.

| Band | Ceiling: adding / taking away / both |
|---|---|
| 3 to 4 | 5 / 5 / 6 |
| 5 to 6 | 8 / 10 / 10 |
| 7 to 8 | 10 / 15 / 20 |
| 9 to 10 | 15 / 20 / 20 |

- The ceilings and the `top` and `maxB` steps are starting values: the board is a free calculator and sets none of them. They live in one table in `puzzles.ts`.
- At ages 3 to 4 these rules give Levels 3 and 4 the same numbers (`top` 5, `maxB` 4), and the same for Levels 7 and 8 (5, 4) and Levels 11 and 12 (6, 5). Each of those levels still has 6 different sums; the pair just does not get harder.
- Answers are 20 or less (the two ten-frames hold 20 bricks); both numbers in a sum are 1 or more; no pair twice in a level; no twin pair (3 + 4 and 4 + 3) unless the pool is short; no two equal answers in a row; plus and minus take turns in mixed levels.
- Ages 3 to 4 meet some sums again on later levels, because their pools are small, but never twice in one level. You accepted the same for Letter Builder's small word pools (11.1, decision 7).
- `makePuzzles(level, seed, band)` in `puzzles.ts`, set `math:1:<band>` with `keepSolved`. After a band change a solved sum could come back once in that level, as in Number Line-up.
- **Difficulty:** operation, then `maxB`, then `top`; all 6 puzzles of a level share all three.
- **Age bands:** the same 12 levels; the band sets the numbers and the stuck limits.

**The board's own counters and modes:**

| On the board | In the level system | Why |
|---|---|---|
| Free calculator: the child types both numbers and the sign | a fixed sum; the child types only the answer (open question 1) | there must be a right answer to solve, slip and score |
| Plus, minus, `10` and `?` keys | removed | the sum is given; answers are typed digit by digit |
| `?` surprise problem | removed; the offer sits in the help row | children do not skip; a swap comes from the stuck offer |
| Chaining the result into a new sum | removed | it broke the 20-brick limit |
| Title "Brick Calculator", sub "Add and take away" | "Level N" and the dots | the name stays on Home |
| "Say it" speaker, silent until = | reads the sum at any time | ages 3 to 4 cannot read it |
| Note line inside the display, in `#8e85d6` | the help row, on the ground | a live region, and `--bw-decor` is never text |

**New keypad:** 4 columns x 4 rows of 60 px, gap 10: `7 8 9 C` / `4 5 6 =` / `1 2 3 =` / `0 0 0 =`, where 0 spans three columns and = spans three rows. 12 keys.

**Stuck, hint, timer, stars.** Slip: a new wrong answer sent with =. Any key press resets the time signal. Offer in the help row's left cell. No hint (the bricks are the help), no clock. Stars by slips.

**Speech.** The speaker ("Hear the sum") reads "3 plus 4. How many?" and, once solved, "3 plus 4 makes 7.". A right = says that sentence too, and a digit tap says the number now typed ("15"), both straight after the child's tap. A slip says nothing.

**Screen, top to bottom:** top bar; display; help row (help style); bricks panel (two ten-frames and the caption); keypad.
- *play* ("?" where the answer goes); *typed* (digits in white); *slip* ("Not quite. Count the bricks again.", entry cleared); *solved* (answer in yellow, "Count them: 7", **Next puzzle** where the keypad was); *stuck;* *levelDone;* *gameDone* (display "?", empty frames).

**Edge cases:** = with nothing typed does nothing; a third digit is ignored and the line says "Press = to check, or C to clear."; "07" counts as 7; 0 is a right answer from Level 9; the physical keyboard works (digits, Enter for =, Backspace or Escape for C); keys do nothing after the solve and while a card is open, so Escape closes the card there and Enter on the focused Next button only presses Next; a second = after a right answer does nothing; on minus sums the last `b` blue bricks fade, as on the board.

**Content checks** (every level x band over 200 seeds): 6 valid puzzles by the rules above and no repeats in a level; each level and band has a pool of at least 6 pairs (fail) and the test lists any under 8; all 6 share operation, `top` and `maxB`; answers 0 to 20, typeable in 2 digits; the bricks drawn match the sum; same seed, same puzzles.

### 4.6 Picture Builder (`builder`, batch 2, prefix `pb-`)

**The child** picks a colour and taps or drags over squares to build the picture. In memory levels the picture shows first, then hides behind Peek. Right when every square matches, and a square that is empty in the picture stays empty. The check runs after every brick; there is no confirm button.

**Content: 12 levels x 6 = 72 puzzles from 42 pictures, 3 chapters (5, 4, 3).**

| Chapter (picker note) | Level | Mode | Grid | Colours | Pictures | Filled squares |
|---|---|---|---|---|---|---|
| Copy it (the picture stays) | 1 | copy | 3x3 | 2 | set A, 6 new | 5 to 7 |
| | 2 | copy | 3x3 | 3 | set B, 6 new | 6 to 8 |
| | 3 | copy | 4x4 | 2 | set C: the board's tree + 5 new | 9 to 11 |
| | 4 | copy | 4x4 | 3 | set D: the board's house + 5 new | 12 to 15 |
| | 5 | copy | 4x4 | 4 | set E: the board's boat + 5 new | 10 to 13 |
| From memory (look, then build) | 6 | memory | 3x3 | 2 | set A | as Level 1 |
| | 7 | memory | 3x3 | 3 | set B | as Level 2 |
| | 8 | memory | 4x4 | 3 | set D | as Level 4 |
| | 9 | memory | 4x4 | 4 | set E | as Level 5 |
| Big pictures (5 by 5) | 10 | copy | 5x5 | 3 | set F, 6 new | 15 to 20 |
| | 11 | copy | 5x5 | 4 | set G, 6 new | 15 to 20 |
| | 12 | memory | 5x5 | 4 | set G | as Level 11 |

- **Memory levels reuse the copy levels' pictures** in a new order (puzzle n shows picture (n + 3) mod 6). That is the board's own idea ("Try it from memory next"): 39 new pictures plus the board's 3 (open question 5).
- **Hand-drawn,** as strings in `pictures.ts` (the board's house is `.RR./RRRR/YYBY/YYBY`), each with a name of 12 characters or fewer. The sticker mosaics in `src/screens/logic/stickers.ts` are 5x5 strings in the same brick style; the ones drawn only in Builder's 6 colours can be adapted for sets F and G (several use purple, pink or teal, which Builder does not have). The filled-square ranges are starting values: those of Levels 3 to 5 bracket the board's tree, house and boat, and no board sets the others. A program can check size, colours and fill; only a person can say a picture looks like a fish. The canvas therefore gets a contact sheet, `BuilderPictures` (5.3), and you approve it before the Builder code starts.
- **Grids stop at 5x5** (62 px squares); 6x6 squares would be 51 px, under the 54 px floor. The board keeps its 334 px width at every grid size, so the layout does not change.
- **Colours:** the board's 6 (red, yellow, green, blue, orange, white) plus the eraser.
- Set `builder:1`, seed 0. **Difficulty:** grid size, colour count, then memory.
- **Age bands:** the same pictures for every band. The band sets the look times (the board has 4 s and 2 s; the other values are starting points):

| | 3 to 4 | 5 to 6 | 7 to 8 | 9 to 10 |
|---|---|---|---|---|
| First look, memory levels | 6 s | 5 s | 4 s | 3 s |
| Each Peek | 3 s | 2 s | 2 s | 2 s |

**The board's own counters and modes:**

| On the board | In the level system | Why |
|---|---|---|
| "Copy it" and "From memory" buttons | set by the level | children do not pick modes |
| A win card per picture; "Next picture" loops 3 pictures | dot, solved line, **Next puzzle** in the palette's place; the level card after puzzle 4 | the shared flow; nothing covers the board |
| Match bar and "{n} of 16 squares match" in both modes | bar and "{5} of {10} bricks right" in copy levels only, counting the picture's bricks | in memory levels the bar let a child find the picture by trial; empty squares made an empty board look 13 to 38 % right |
| "Clear my board", top right | removed; the speaker takes the slot | the eraser does the same, and the slot is the speaker's in all six games |
| Painting allowed while the picture shows | the board locks during the first look and each Peek | otherwise memory levels are copy levels |
| Palette of 44 px buttons in one row | 54 px buttons in two rows (4, then 3) | kid controls are 54 px or taller; 7 x 54 px does not fit 358 px |
| Cells with no click handler | Enter or Space paints | keyboard play (9.2) |

**Stuck, hint, timer, stars.** Slip: a brick that does not match its square (a colour on a square that must stay empty counts too), at most one per stroke (pointer down to pointer up, or one key press). Erasing never slips; the same wrong colour on the same square again is no new slip. Offer in the help row's left cell. Peek is free, unlimited, never a slip and never stored. No time counts toward the offer while the picture shows (the game calls `hold(true)` for the first look and each Peek). No hint, no clock. Stars by slips.

**Speech.** The speaker ("Hear the help line") reads the title line and the help line. A square tap says nothing.

**Screen, top to bottom:** top bar; model row (model panel on the left; title line and, in copy levels, the match bar on the right); help row (help style); board (3x3, 4x4 or 5x5 in the same 334 px); palette.
- *copy play;* *look* (memory: picture showing, board locked, "Look closely."); *hidden* (memory: Peek over the model panel, "Build it from memory."); *peek;* *wrong* (copy: "One brick is not quite right."); *solved* ("You built the {house}.", **Next puzzle** in the palette's place); *stuck;* *levelDone;* *gameDone* (empty board).

**Edge cases:** painting a square with its own colour is skipped; the eraser on an empty square does nothing; a stroke with several wrong bricks is one slip; leaving during the first look clears its timer; a look the page was hidden for starts again when the page shows; a new puzzle (Next or a swap) starts with its own first look; a click after a pointer down never paints twice; the last right brick solves at once.

**Content checks** (42 pictures, 72 slots): grid size and colour count equal the level's; only the 6 board colours; filled squares inside the level's range; no blank or one-colour picture; no two pictures in a level equal after mirroring or renaming colours; names unique per level, letters and spaces only, 12 characters or fewer; puzzle 1 of Levels 3, 4 and 5 equals the board's tree, house and boat; memory levels hold their copy level's pictures; a simulated child who paints every square in random order, after some wrong strokes, solves on the last right brick and never before.

## 5. Canvas boards

### 5.1 Rules for every game board
- The main board (`Mixer`, `Sorter`, `Numbers`, `Pattern`, `Math`, `Builder`) gains the levers `puzzle` (1 to 4) and `moment` (values per game below), "Level N" with the dots under it, the speaker top right, the help row, **Next puzzle** in the controls slot, and the shared level card and finished state with the four-puzzle section 8 values. Back links stay on `Hub` and `HubTablet`.
- Each `*Tablet` wrapper declares the same levers and passes them through `dc-import`, as `EscapeTablet` does.
- New state boards are thin wrappers of about 600 bytes, like `LettersSolved`. Titles follow the existing ones: "Color Mixer: puzzle solved (phone)", "Shape Sorter: level done (tablet)".
- Every board shows the copy from section 8; no lorem or placeholder lines.

### 5.2 Batch 1 (agent A1)

| Board | Change |
|---|---|
| `Mixer` | Levers `form` (finish, guess, make), `puzzle`, `moment` (play, slip, solved, stuck, levelDone, gameDone). Remove the mode buttons, "Found n of 6", "Empty the bowl" and the colour book. Add the help row, the Guess swatches, Next in the shelf's space. Bowl fade at 350 ms. Slot labels in `--bw-text-2`. |
| `Sorter` | Levers `level` (1, 3, 5, 7, 9), `puzzle`, `moment` (play, picked, wrong, solved, stuck, levelDone, gameDone). Remove "Start over", the "of 5" sub and the tray's done block. Add the three new shapes, the help row, tray ghosts, the full-width fact bar. Level 5's green pieces become yellow. Spring-back without overshoot. |
| `Numbers` | Levers `level` (up, down, big), `puzzle`, `moment` (play, picked, hint, solved, stuck, levelDone, gameDone). Remove the order buttons, "Mix them up", "Show me how", the footer note and the solved glow. Add the help row with Hint on the right, the footer slot, filled-or-ringed marks, dark numerals on yellow, orange and green faces, and the `big` state (one-brick towers, numbers up to 999, a stair-shaped goal without numbers). |
| `MixerTablet`, `SorterTablet`, `NumbersTablet` | declare and pass the new levers |
| New, phone | `MixerGuess` (guess, play), `MixerMake` (make, slip), `MixerSolved`, `MixerStuck`, `MixerDone`; `SorterColors` (level 5, wrong), `SorterBig` (level 7, play: proves 8 pieces fit), `SorterSolved`, `SorterStuck`, `SorterDone`; `NumbersBig` (big, play), `NumbersHint`, `NumbersSolved`, `NumbersStuck`, `NumbersDone` |
| New, tablet | `MixerDoneTablet`, `SorterDoneTablet`, `NumbersDoneTablet` |
| `Levels` | the `game` lever gains `mixer`, `sorter`, `numbers`, with their chapters (4.1 to 4.3) and sample stars |
| New `LevelsMixer`, `LevelsSorter`, `LevelsNumbers` | thin wrappers like `LevelsDrop` |
| `Grownups` | Progress panel: 6 game rows in Home order, each linking to its picker board; the timer panel gains the 8.8 line under its text (`GrownupsTablet` follows, as it imports the board) |
| `Hub` | Color Mixer's sample pill "3 of 6" becomes "Level 2", and its card name's "3 of 6." becomes "Level 2."; the discovery card follows open question 2 (`HubTablet` follows) |

`canvas.json`, batch 1:
- Note `row9`: x 0, y 12500, kind `title1`, text "9. Six games, batch 1: solved, stuck and level done", `maxW` 9712. Its boards sit at y 12800: the 15 phone boards in the order of the table at x 0 to 6580 in steps of 470, then the 3 tablet boards at x 7050, 7964 and 8878. Append them to `order`, all `is_interactive: true`.
- `LevelsMixer`, `LevelsSorter`, `LevelsNumbers` in row 6 at y 8000, x 5562, 6032 and 6502; note `row5` gets `maxW` 6892.

### 5.3 Batch 2 (agent A2)

| Board | Change |
|---|---|
| `Pattern` | Levers `level` (1, 4, 7, 10), `puzzle`, `moment` (play, wrong, solved, stuck, levelDone, gameDone). The dots move under the title; remove the round sub and the loop; add the help row at two lines high, the speaker, the train motion on Next. |
| `Math` | Levers `level` (add, take, both), `puzzle`, `moment` (play, typed, slip, solved, stuck, levelDone, gameDone). The new keypad, the help row, the dark C label, the display on `--bw-display`, the focus ring and pressed state from missing-screens section 2. |
| `Builder` | Levers `level` (1, 4, 8, 11), `puzzle`, `moment` (play, look, hidden, peek, wrong, solved, stuck, levelDone, gameDone). Remove the mode buttons, "Clear my board" and the win card; add the 54 px palette in two rows, the help row, the 3x3, 4x4 and 5x5 grids, the match bar in copy levels only. |
| `PatternTablet`, `MathTablet`, `BuilderTablet` | declare and pass the new levers |
| New, phone | `PatternLong` (level 10, play: proves 5 cars fit), `PatternSolved`, `PatternStuck`, `PatternDone`; `MathTake` (take, typed), `MathSlip`, `MathSolved`, `MathStuck`, `MathDone`; `BuilderMemory` (level 8, hidden), `BuilderBig` (level 11, play), `BuilderSolved`, `BuilderStuck`, `BuilderDone` |
| New, tablet | `PatternDoneTablet`, `MathDoneTablet`, `BuilderDoneTablet` |
| New `BuilderPictures` | contact sheet, 834x1194: all 42 pictures from `pictures.ts`, each with its name and levels, 6 columns. You approve it before Builder code starts. |
| `Levels` | the `game` lever gains `pattern`, `math`, `builder` |
| New `LevelsPattern`, `LevelsMath`, `LevelsBuilder` | thin wrappers |
| `Grownups` | 9 game rows |

`canvas.json`, batch 2:
- Note `row10`: x 0, y 14100, kind `title1`, text "10. Six games, batch 2: solved, stuck and level done", `maxW` 10156. Boards at y 14400: the 14 phone boards at x 0 to 6110 in steps of 470, then the 3 tablet boards and `BuilderPictures` at x 6580, 7494, 8408 and 9322.
- `LevelsPattern`, `LevelsMath`, `LevelsBuilder` in row 6 at x 6972, 7442 and 7912; note `row5` gets `maxW` 8302.

## 6. Data model and progress

- **No change** to `GameProgress`, `LevelRun` or `PuzzleResult`, no new storage key, `SCHEMA_VERSION` stays, no migration. The six games' runs are new game ids under each child's `games`, checked by today's `sanitize`, which keys games by string id.
- Every result stores slips in `count`, plus `usedHint` and `outOfTime` (always false); `par`, `three`, `two`, `score` and `word` stay unused.

| Game | Set | Seed | Run extras |
|---|---|---|---|
| Color Mixer | `mixer:1` | run | none |
| Shape Sorter | `sorter:1` | 0 | none |
| Number Line-up | `numbers:1:<band>` | run | `hintsLeft` (3 at the start) |
| Pattern Train | `pattern:1` | run | none |
| Brick Calculator | `math:1:<band>` | run | none |
| Picture Builder | `builder:1` | 0 | none; peeks are not stored |

- `src/games/<id>/meta.ts` gives `levelCount` and the chapters (titles and picker notes from section 4). `registry.test.ts` checks that chapters cover every level with no gaps and no emoji.
- Raise a game's set version whenever its puzzle rules change, so stored runs restart at puzzle 1 (four-puzzle 6.2).
- A tab still on the old build keeps only `unlocked`, `stars` and `best` for every game, as today.

## 7. Values builders must not re-derive

Board sizes, radii and layout widths are px in each game's CSS file, as `slide.css` and `letters.css` keep theirs. Colours and motion are tokens. Type sizes use the `--bw-fs-*` token where one matches (13 `--bw-fs-helper`, 14 `--bw-fs-label`, 15 `--bw-fs-sub`, 16 `--bw-fs-body`, 18 `--bw-fs-panel`, 20 `--bw-fs-section`, 22 `--bw-fs-tile`, 24 `--bw-fs-title`, 32 `--bw-fs-display`) and the px value below otherwise. Shadows are written as below: tokens for colours, black or white at an alpha for depth, as `letters.css` writes them.

### 7.1 Shared, unchanged from the four-puzzle brief, section 8
Dots, Next button (58 px tall in all six games, min width 220), offer button (54x54, `--bw-r-md`), swap icon, level card, motion and reduced motion.

### 7.2 Kit
| Item | Value |
|---|---|
| Help row | grid `var(--bw-target-kid) minmax(0, 1fr) var(--bw-target-kid)`, gap `--bw-sp-4`, min height 54 px; line centred, `text-wrap: balance` |
| Help line, prompt style (Sorter, Numbers) | 18 px weight 800, line height 1.3, `--bw-text`; a wrong line in `--bw-error-text`; 44 characters at most, so it stays within 2 lines at 390 px |
| Help line, help style (Mixer, Pattern, Calculator, Builder) | `--bw-fs-body` weight 700, line height 1.25, `--bw-text-2`; 54 characters at most |
| Choice row | wrong: opacity 0.5, translateX -6 px, rotate -5 deg for 500 ms, then back over `--bw-base`; right: `--bw-ring` and translateY -6 px; locked: `aria-disabled`, no lift |
| Drag | threshold 8 px (x plus y travel); dragged item `z-index: var(--bw-z-drag)`, no transition while dragging; a miss returns over `--bw-base` with `--bw-ease`, no overshoot |
| Speaker | `IconButton` with icon `speaker`, 54x54, top bar right, in all six games |
| Hint (Numbers) | Letter Builder's Hint button and badge, as built in `letters.css` |
| Controls slot | keeps its height when **Next puzzle** replaces the controls; Next is centred in it |
| Tray ghost | opacity 0.2, scale 0.85 (Letter Builder's `.lb-ghost`) |

### 7.3 Color Mixer
| Item | Value |
|---|---|
| Paints (content data) | red `#f03a3a`, yellow `#ffc21a`, blue `#2f8cff`, white `#f6f3ff` |
| Results (content data) | orange `#ff8a1f`, green `#2fb84a`, purple `#8f4ae0`, pink `#ff8fb0`, sky blue `#8cc8ff`, cream `#ffe9a6` |
| Goal chip | `--bw-panel`, radius 16, padding `8px 16px`, gap 10; 30 px colour circle with a `0 0 0 3px var(--bw-text)` ring; 18 px weight 800 |
| Slots | 64 px circles, "+" between them 34/800 `--bw-text-2`; empty `3px dashed var(--bw-purple-top)` with its label 13/800 `--bw-text-2`; filled: the colour with `inset 0 -5px 0 rgb(0 0 0 / 0.18)` |
| Bowl | 230x170; body 120 px tall, radius `0 0 115px 115px`, `linear-gradient(180deg, var(--bw-bowl), var(--brick-white-dark))`, shadow `0 8px 0 var(--bw-decor)`; rim `6px solid var(--brick-white)`; liquid `inset 0 -6px 0 rgb(0 0 0 / 0.15)`, colour change over `--bw-slow` with `--bw-ease`; liquid colour: the mix with two paints in, the one paint with one, `--brick-white-light` when empty (and in Guess until the right answer) |
| Result block | min height 64; name 28/800/1.1 `--bw-text`; text 16/700 `--bw-text-2` |
| Pots and Guess swatches | 70 wide; 64x64 swatch, radius `18px 18px 22px 22px`, `inset 0 -8px 0 rgb(0 0 0 / 0.18), inset 0 4px 0 rgb(255 255 255 / 0.35), 0 5px 0 rgb(0 0 0 / 0.3)`; name below 15/800; row gap 12 |

### 7.4 Shape Sorter
| Item | Value |
|---|---|
| Holes panel | padding 18, radius 30, `linear-gradient(180deg, var(--bw-panel-top), var(--bw-panel))`, shadow `inset 0 0 0 4px var(--bw-purple-top), 0 8px 0 var(--bw-purple-edge)`; 3 columns, gap 14 |
| Hole | 92x92, radius 22, `rgb(0 0 0 / 0.12)`; 70x70 shape sunk in with `inset 0 10px 14px rgb(0 0 0 / 0.55), inset 0 -2px 0 rgb(255 255 255 / 0.25)`; filled `0 0 0 3px rgb(255 255 255 / 0.6)` |
| Wrong hole | `--bw-error-border` at 35 % as fill, `0 0 0 4px var(--bw-error-border)`; shake -9, 9, -6, 6, -3, 0 px at 60 ms a step |
| Piece | 64x76 with a 58x58 shape; at rest tilted -8 and 8 deg in turn; picked translateY -12 px and scale 1.12; dragging scale 1.18 |
| Tray well | `--bw-well`, radius 28, padding `18px 10px`, gap 8, `inset 0 4px 10px rgb(0 0 0 / 0.45)`; 4 pieces a row on phone |
| Fact bar | full width, `--bw-panel`, radius 18, min height 56, padding `6px 16px`, gap 10; badge 40x40, radius 12, `--bw-accent` with `--bw-on-yellow` 22/800; fact 16/700/1.2 |
| Colours | `--brick-*` tokens only (the board's hex values equal them) |
| Shapes | the board's five; new: rectangle `inset(22% 0 round 6px)`, diamond `polygon(50% 0, 90% 50%, 50% 100%, 10% 50%)`, pentagon `polygon(50% 2%, 98% 38%, 80% 96%, 20% 96%, 2% 38%)` |

**Outcome (2026-11-13):** after play-testing, the drag from the tray to a hole was too far for a child, so the holes panel and the fact bar moved down to sit just above the tray well (`margin-top: auto` on the holes panel), and the spare height now sits between the help row and the holes. On Level 1 the drag from a piece to a hole went from about 800 px to about 350 px on the iPad (290 to 417 screen px, which is 207 to 298 px in the zoomed frame) and from about 530 px to about 225 px on a phone (207 to 252 px). A piece let go within 24 px of a hole's edge (the frame's px, so 33.6 screen px on the iPad) now counts as dropped on that hole, nearest hole first; a release inside a hole still wins, and a near drop on the wrong hole is a wrong placement, like an exact one. Filled holes count as holes here, so a release on a filled hole, or nearer to it than to any open one, still goes back with no slip (4.2). The tap path is unchanged, and every other game keeps exact drops (the kit's `reach`, 0 by default). The finished state keeps the fact bar's height empty, so the holes panel stays where it is in play.

### 7.5 Number Line-up
| Item | Value |
|---|---|
| Goal strip | `--bw-panel`, radius 18, padding `8px 14px`, gap 12; "GOAL" 14/800 `--bw-text-2`; bars 14 wide, radius 3, gap 3, heights 9 to 34 px (4 + 5n), in each number's colour, or `--bw-decor` for bigger numbers; goal text 15/800/1.2 |
| Tower well | `--bw-well`, radius 28, padding `16px 8px 12px`, `inset 0 4px 10px rgb(0 0 0 / 0.45)`; 6 columns, gap 6 (towers about 52 px wide) |
| Tower | number face 48x40, radius 12, numeral 26/800 with `text-shadow: 0 2px 0 rgb(0 0 0 / 0.3)`; stud bricks 40x22, radius 6, gap 2, through the `Brick` look; picked translateY -10 px; dragging scale 1.06 (the board's value); a swap moves both towers over `--bw-base` with `--bw-ease`; each tower button fills its column's full height, so a one-brick tower is still a 54 px target |
| Number colours | 1 green, 2 yellow, 3 red, 4 blue, 5 purple, 6 orange (`--brick-*`); bigger numbers take these six in the seed's order |
| Numeral ink | `--bw-text` on red and purple; `--bw-on-yellow` on yellow and orange; `--bw-on-green` on green; `--bw-purple-edge` (#241a63) on blue (9.3) |
| Marks | 8 px tall pills, gap 6; right spot filled `--brick-green-light`; wrong spot `--bw-well` with a 2px inset ring of `--bw-decor`; legend 13/700 `--bw-text-2` |
| Hint | arrow 34x34, path `M12 21l-6-8h4V3h4v10h4z`, fill `--brick-yellow-light`, stroke `--bw-yellow-edge` 1.5, round joins, above the tower; rings `--bw-ring` |
| Footer slot | 58 px |

### 7.6 Pattern Train
| Item | Value |
|---|---|
| Train | row at zoom 0.78; locomotive 70x86, body `linear-gradient(180deg, var(--brick-red-light), var(--brick-red))`, window `--brick-blue-light`, smoke stack and wheels `--brick-black`; cars 56x86, gap 4, body 56x46, radius 10, `--brick-white` with `inset 0 -5px 0 var(--brick-white-dark)`, shape 30x30 |
| Empty car | `3px dashed var(--bw-accent)` over the accent at 8 %; once filled, `0 0 0 3px var(--bw-accent)` |
| Rail | 6 px, radius 3, dashes of `--bw-decor`, 18 px on and 8 px off |
| Prompt line | 20/800 `--bw-text`, centred |
| Choice tray | `--bw-well`, padding `18px 12px`, radius 28, `inset 0 4px 10px rgb(0 0 0 / 0.45)`; label 15/800 `--bw-text-2`; choices 92x92, radius 22, gap 14, raised purple, shape 46x46 |
| Train motion on Next | the old train slides out to the right over `--bw-base` with `--bw-ease`, then the new one fades in over 150 ms: 350 ms in all, under the 400 ms limit for an authored moment (missing-screens section 2), and taps never wait for it |
| Help row | two lines high from the start (it holds the offer line) |

### 7.7 Brick Calculator
| Item | Value |
|---|---|
| Display | `--bw-display`, radius 22, padding `10px 18px`, `inset 0 4px 10px rgb(0 0 0 / 0.6), 0 0 0 4px var(--bw-purple-bottom)` |
| Equation | 46/800/1.1, tabular numerals, gap 10: first number `--brick-blue-light`, sign and = `--bw-text-2` (minus is U+2212, as on the board), second number `--brick-orange-light`; answer place "?" `--bw-text-2`, typed digits `--bw-text`, right answer `--brick-yellow-light` |
| Bricks panel | `--bw-panel`, radius 22, padding 12, gap 8; two ten-frames of 5 columns, gap 5, padding 6, radius 14, `--bw-well`; cells 30 px tall, radius 7; first number in the `--brick-blue` family, second in `--brick-orange`; taken away: opacity 0.25, scale 0.8, rotate -8 deg over `--bw-slow`; empty cell `2px dashed var(--bw-purple-bottom)`; caption 14/800 `--bw-text-2`, "Count them" in `--brick-yellow-light` |
| Keypad | 4 columns, rows 60 px, gap 10, radius 18, labels 30/800; digits raised purple with `--bw-on-purple`; = raised green with `--bw-on-green`; C `--brick-pink-light` to `--brick-pink`, edge `--brick-pink-dark`, label `--bw-on-pink`; press: down `--bw-press-shift`, shadow to `--bw-raise-pressed` over `--bw-fast` with `--bw-ease` |

### 7.8 Picture Builder
| Item | Value |
|---|---|
| Board | surface padding 10, radius 24, `--bw-well`, `inset 0 4px 10px rgb(0 0 0 / 0.45), 0 0 0 4px var(--bw-purple-bottom)`; grid 334 px wide, gap 6; squares 107 px (3x3), 79 px (4x4), 62 px (5x5), radius 14; filled: brick face with studs; empty `rgb(255 255 255 / 0.05)` with `inset 0 0 0 2px rgb(255 255 255 / 0.08)`; a square changes over `--bw-fast` |
| Model panel | `--bw-panel`, padding 8, radius 18; grid 128 px wide, gap 2, bricks without studs; empty `rgb(255 255 255 / 0.06)`; Peek cover raised purple, radius 18, `eye` icon 26 px stroke 2.4, "Peek" 15/800 |
| Title line | 22/800/1.15 `--bw-text` |
| Match bar | 10 px, `--bw-r-pill`, track `--bw-ground-bottom`, fill `--brick-green-light`, width over `--bw-slow`; text 14/800 `--brick-green-light` |
| Palette | 54x54, radius `--bw-r-md`, gap 8; rows of 4 then 3: red, yellow, green, blue / orange, white, eraser; selected `outline: 4px solid var(--bw-text)`, offset 2 px, translateY -3 px; eraser `--bw-panel` with the `eraser` icon 22 px in `--bw-text-2` |
| Look times | 4.6 table, kept in one `LOOK_SECONDS` table |

### 7.9 Counts
| | Mixer | Sorter | Numbers | Pattern | Calculator | Builder |
|---|---|---|---|---|---|---|
| Levels x puzzles | 9 x 6 | 9 x 6 | 12 x 6 | 12 x 6 | 12 x 6 | 12 x 6 |
| Chapters (levels each) | 3 (3, 3, 3) | 3 (3, 3, 3) | 2 (8, 4) | 3 (3, 6, 3) | 2 (4, 8) | 3 (5, 4, 3) |
| Stars in the game | 27 | 27 | 36 | 36 | 36 | 36 |
| Star rule | 1 and 4 slips | same | same, plus the hint cap | same | same | same |
| Hints | none | none | 3 per level | none | none | none |

## 8. Copy

Child-facing lines are short, calm and literal. The one exclamation stays "You finished every level!". Colour and shape names inside a sentence are lower case ("sky blue", "red circle"); a name that starts a line is capitalised ("Yellow triangle comes next."). Braces mark values. Rendered copy uses the curly apostrophe (’), as `help.ts` does.

### 8.1 Shared, all six games
| Where | Copy |
|---|---|
| Title | "Level {3}" |
| Dots, accessible name | "Puzzle {3} of 4. {2} solved." Level done: "4 of 4 solved." |
| Next button | "Next puzzle" |
| Offer | line "This one is tricky. Want a different puzzle?"; button name "New puzzle" |
| After a swap | "Here is a different puzzle." |
| Speaker while the offer shows | name "Read the help line aloud"; it reads the offer line |
| Level card title | "You finished Level {3}" |
| Level card fact | "4 puzzles, no slips." / "4 puzzles, 1 slip." / "4 puzzles, {3} slips." |
| Level card rule | "3 stars: 1 slip or none. 2 stars: 4 slips or fewer." |
| Level card cap, Number Line-up only, when it applied | "Using a hint caps the level at 2 stars." |
| Level card buttons | "Play Level {4}" and "Back to games" |
| Game finished | "You finished every level!" then "{9} levels, {24} of {27} stars." On a later visit also "A grown-up can pick a level to play again." Button "Back to games" |
| Home card name, Settings row, picker, Break | the four-puzzle 9.1 lines with "Level" and "puzzles"; they come from the registry |

### 8.2 Color Mixer
| Where | Copy |
|---|---|
| Goal chip (Finish, Make it) | "Can you make {green}?", with the colour circle before the name |
| Question chip (Guess) | "What do {red} and {yellow} make?" |
| Result name, nothing mixed yet | Finish "Pick one more paint"; Make it "Pick two paints"; Guess "Pick a color" |
| Result name after a mix | "Orange", "Green", "Purple", "Pink", "Sky blue", "Cream"; the same paint twice shows that paint's name |
| Result text | "Red and yellow make orange, like a sunset." / "Blue and yellow make green, like grass and leaves." / "Red and blue make purple, like grapes." / "White makes red lighter. Now it is pink." / "White makes blue lighter, like the sky." / "White makes yellow soft, like butter." / same paint twice: "Same and same stays the same. Try two different paints." |
| Help, start | Finish "Tap the paint that makes {green}." / Make it "Tap two paints to mix them." / Guess "Tap the color they make." |
| Help, slip | Finish "Not {green} yet. Try another paint." / Make it "Not {green} yet. Try another pair." / Guess "Not that one. Look at the two paints again." |
| Help, solved | Finish and Make it "You made {green}." / Guess "They make {orange}." |
| Empty slot | "paint 1", "paint 2" |
| Speaker | "Hear the question" |

### 8.3 Shape Sorter
| Where | Copy |
|---|---|
| Help, start | shape levels "Drag each shape into its hole." / colour levels "Match the shape and the color." |
| Help, picked | "Now tap the {red circle} hole." |
| Help, dragging | "Drop the {red circle} in its hole." |
| Help, wrong | shape levels "That hole is for the {square}." / colour levels, same shape: "Same shape, but this hole is {red}." / same colour: "Same color, but this hole is a {square}." / neither the same: "That hole is for the {blue square}." |
| Help, solved | "Every shape is home." |
| Fact bar, before the first placement | shape levels "Every shape has a home. Look at the corners." / colour levels "Look closely: each hole has a color too." |
| Facts | circle "A circle is round. It has no corners." / square "A square has 4 sides, all the same length." / triangle "A triangle has 3 sides and 3 corners." / star "A star has 5 points." / hexagon "A hexagon has 6 sides, like a honeycomb cell." / rectangle "A rectangle has 4 sides. Two are long, two are short." / diamond "A diamond has 4 sides of the same length." / pentagon "A pentagon has 5 sides and 5 corners." |
| Badge names | circle "no corners", star "5 points", triangle "3 sides", hexagon "6 sides", pentagon "5 sides", square, rectangle and diamond "4 sides" |
| Spoken on a right placement | the piece's name: "circle" / "red circle" |
| Speaker | "Hear the help line" |

### 8.4 Number Line-up
| Where | Copy |
|---|---|
| Goal text | up "Line up 1 to 6, smallest first, so the towers make stairs going up." / down "Line up 6 to 1, biggest first, so the stairs go down." / bigger numbers "Line up the numbers, smallest first." and "Line up the numbers, biggest first." |
| Help, start | "Drag or tap two towers to swap them." |
| Help, picked | "Now tap where it should go." |
| Hint | "{4} belongs in the {second} spot. Swap them." (spots: first to sixth) |
| Help, solved | "Stairs going up: 1, 2, 3, 4, 5, 6." / "Stairs going down: 6, 5, 4, 3, 2, 1." / bigger numbers "In order: {15, 20, 25, 30, 35, 40}." |
| Legend | "A filled green line means that tower is in the right spot." |
| Hint button name | "Hint, {2} left" |
| Speaker | "Hear the help line" |

### 8.5 Pattern Train
| Where | Copy |
|---|---|
| Prompt | "Look at the train. What is the pattern?" / solved "Pattern complete." |
| Tray label | "Which car comes next?" |
| Help, start | "Say the cars out loud, then pick the next one." |
| Help, wrong | "Say the pattern out loud and try again." |
| Help, solved | "{Yellow triangle} comes next." |
| Speaker | "Hear the pattern"; it reads "{Red circle, blue square, red circle, blue square}. What comes next?" |

### 8.6 Brick Calculator
| Where | Copy |
|---|---|
| Help, start | "Count the bricks. Type the answer, then press =." |
| Help, slip | "Not quite. Count the bricks again." |
| Help, a third digit | "Press = to check, or C to clear." |
| Help, solved | "{3} plus {4} makes {7}." / "{7} take away {3} makes {4}." |
| Panel caption | "Each row holds 5. Two rows make 10." and, once solved, "Count them: {7}" |
| Speaker | "Hear the sum"; it reads "{3} plus {4}. How many?" / "{7} take away {3}. How many?", then the solved line |
| Key names | digits by their numeral; "Clear"; "Equals" |

### 8.7 Picture Builder
| Where | Copy |
|---|---|
| Title line | copy "Build the {house}." / memory, while looking "Look closely." / memory, hidden "Build it from memory." |
| Help, start | copy "Pick a color, then tap or drag over the squares." / memory, looking "Remember the colors and where they go." / memory, hidden "Tap Peek if you need another look." |
| Help, wrong bricks (copy levels) | "One brick is not quite right." / "{3} bricks are not quite right." |
| Help, solved | copy "You built the {house}." / memory "You built the {house} from memory." |
| Match text (copy levels) | "{5} of {10} bricks right" |
| Peek | label "Peek"; name "Peek at the picture" |
| Speaker | "Hear the help line" |

### 8.8 Around the games
| Where | Copy |
|---|---|
| Home, Today's discovery (open question 2, A) | the kicker "Today's discovery" stays; "What do red and blue make?" becomes "Mix two colors to make a new one" (Mixer's registry sub); "+1 sticker" goes |
| Settings, timer panel | add "Only Brick Escape and Brick Drop use this timer." |
| Hub board | Color Mixer's sample pill "Level 2" |
| Grownups board rows | the shared row lines, for example "Color Mixer for Maya: Level 3, 2 of 4 puzzles. Pick a level" |

### 8.9 Lines that go
- Color Mixer: "Found {n} of 6", "Discover", "Challenge", "Empty the bowl", "My color book", the book's "?", "What new color will you discover?", "Now pick one more", "You made {goal}!", and the "!" in "Now it is pink!" and "Try two different paints!".
- Shape Sorter: "Level {n} of 5 · {name}" and the level names "Two shapes", "Three shapes", "Five shapes", "Shape and color" and "Mix it up" (the chapter "Shape and color" keeps that title in the picker), "Start over", "Oops! That hole is for a {name}.", "Right shape! But this hole is {color}. Find the {color} {shape} hole.", "Right color! But this hole is a {shape}.", "Match the shape AND the color.", "Drop the {name} in its hole!", "You sorted every shape!", "All sorted!", "Next level", "Play again", "Count them!", "no corners at all!".
- Number Line-up: "Level 3 of 15", "Mix them up", "Smallest first", "Biggest first", "Show me how", "Watch: I look for the smallest tower first." (and "biggest"), "Drag {n} onto the {spot} tower to swap them.", "Perfect! {order}. Like stairs!", "Done! Each tower is one brick taller, like stairs.", "A green line means that tower is in the right spot.", "Later levels: missing numbers (2, 4, _, 8) and counting by 5s and 10s."
- Pattern Train: the round names, "Round {n} of 4", "All aboard! The pattern is complete.", "Tip: say it out loud, like ...", "Hmm, say the pattern out loud and try again.", "Choo choo! Next train coming..."
- Brick Calculator: the play-screen title and sub, "Say it", "Pick a number up to 10", "Numbers up to 10 for now", "Try taking away a smaller number", "Count the bricks, then press =", and the key names "plus", "take away", "ten", "surprise problem".
- Picture Builder: "Look, then build it" (Home keeps "Look, then build the picture"), "Clear my board", "Copy it", "From memory", "Build the {name}" without its full stop, "Build it from memory!", "Look closely...", "One brick is not quite right. Look again!", "{n} of 16 squares match", "You built a {name}!", "Every brick in the right spot. Try it from memory next!", "From memory with no peeks. Amazing!", "From memory with {n} peeks. Great remembering!", "Next picture", and the square names "Square {n}, {colour}" (9.2 names squares by row and column).

## 9. Accessibility

### 9.1 All six games
- **Dots:** one `role="img"` with the 8.1 name; not a live region.
- **Help line:** `role="status"` in the kit's help row, so slips, the offer, a swap and the solved line are announced.
- **Focus:** on a solve, to **Next puzzle**; after Next, to the game's first control (Mixer: first pot or swatch; Sorter: first tray piece; Numbers: first tower; Pattern: first choice; Calculator: the 7 key; Builder: the top-left square). The offer button never takes focus and comes last in its row's tab order.
- **Level card and finished state:** the shared dialog (four-puzzle section 10).
- **Targets:** every kid control is 54 px or taller: pots 70 wide, pieces 64x76, holes 92, towers the full column high, choices 92, keys 60, squares 62 to 107, palette 54.
- **Colour is never the only signal:** names under swatches (Mixer), names in piece labels (Sorter), filled or ringed marks (Numbers), shapes and names (Pattern), digits (Calculator), names in square labels (Builder); colour-only puzzles in 9.4.
- **Keyboard:** every game plays without a pointer (9.2).
- **Reduced motion:** every motion becomes a 150 ms opacity crossfade; shakes, tilts, lifts and slides go, while rings, dims and lines stay.
- **Speech:** through `say()`, which follows the Voice setting. Nothing plays on load, on a level card or at a level's end. The only speech without the speaker button follows the child's own move: Sorter names a placed piece, Calculator says the typed number and the solved sum.

### 9.2 Per game
- **Color Mixer:** pots "Red paint" with `aria-pressed` while in a slot; slots "Paint 1: red", "Paint 1: empty", "Paint 1: red, given"; the bowl `role="img"` "Bowl: orange" or "Bowl: empty"; the result block `aria-live="polite"`; Guess swatches named by colour.
- **Shape Sorter:** tray `role="group"` "Shapes to place", holes `role="group"` "Holes"; pieces named "circle" or "red circle" with `aria-pressed`; holes "red circle hole"; a filled hole becomes an image "Filled red circle hole", out of the tab order; keyboard: Tab to a piece, Enter or Space picks it, Tab to a hole, Enter places it; after a placement focus moves to the next piece; the badge has its name from 8.3 and the "?" badge is hidden from assistive tech.
- **Number Line-up:** towers "Tower of 4, spot 2 of 6, in the right spot" or "not in the right spot", with `aria-pressed` when picked; the marks are hidden from assistive tech (the tower names carry them); Enter or Space on two towers swaps them.
- **Pattern Train:** the train is one `role="img"`, "Train: red circle, blue square, red circle, blue square, empty car." (the answer replaces "empty car" once solved); cars and locomotive hidden; choices named by car.
- **Brick Calculator:** the equation `role="img"` "3 plus 4 equals what?", then "3 plus 4 equals 7"; the ten-frames `role="img"` "3 blue bricks and 4 orange bricks" or "7 blue bricks, 3 taken away"; physical keys: digits, Enter for =, Backspace or Escape for C; the focus ring from missing-screens section 2 (3px `--bw-accent`, offset 2px).
- **Picture Builder:** squares "Row 2, column 3, red" or "Row 2, column 3, empty", one tab stop with arrow keys moving between squares and Enter or Space painting with the selected colour; palette buttons named by colour and "Eraser" with `aria-pressed`; the model panel `role="img"` "Picture of a house. Row 1: empty, red, red, empty. Row 2: ..." and, when hidden, "Picture hidden. Tap Peek to look again."; the match bar `role="progressbar"` with "5 of 10 bricks right" in copy levels; a Peek announces "Picture shown." once.

### 9.3 Contrast fixes (computed, WCAG ratios)
- **Number Line-up numerals** (26/800, large text, 3:1 needed): white on yellow `#ffc21a` 1.6:1, on orange `#ff7a1a` 2.6:1 and on green `#1fb53c` 2.7:1 fail. With `--bw-on-yellow` on yellow 6.7:1 and on orange 4.1:1, and `--bw-on-green` on green 5.1:1, they pass. White stays on red 3.9:1, blue 3.3:1 and purple 4.3:1.
- **Brick Calculator C key:** white on `--brick-pink` 2.8:1 fails; `--bw-on-pink` measures 5.4:1 there and 8.0:1 on `--brick-pink-light`.
- These ratios are against each face's base colour, which sits under the numeral in the middle of the face gradient. The light top corner of a blue face falls to about 2.4:1 with white, so A1 checks the numerals on the rendered `Numbers` board with a contrast picker before showing it, and moves any face that fails to dark ink.
- Outcome (2026-11-09): white on the blue face gradient comes to about 2.9:1 at the top of the numeral, under 3:1, so blue moved to dark ink, `--bw-purple-edge` #241a63, about 4.5:1 on the blue base. The `Numbers` board and the game both use it.
- **Number Line-up marks:** filled `--brick-green-light` on `--bw-well` 9.7:1; the `--bw-decor` ring 5.1:1.
- The Calculator's note line (`#8e85d6` on `#121034`) and Mixer's slot labels (`#8e85d6`) move to `--bw-text-2`, since `--bw-decor` is never text. Pattern's old to-do dot (1.4:1) gives way to the shared dots.

### 9.4 Colour-only puzzles
- Generated colour puzzles (Sorter Levels 4 to 9, Pattern Levels 2, 5 and 9) never pair red with green, blue with purple, or red with pink in one puzzle. Sorter Level 5's board set changes its green pieces to yellow for this.
- **Outcome (2026-11-09):** A2's check found blue (`#2f8cff`) and green (`#1fb53c`) merge under tritanopia (OKLab distance 5.7, closer than red with pink at 9.4), so P's slot added blue with green to `colorPairs.ts`. Sorter's generated boards for Levels 4 to 9 changed with it, so `SORTER_SET_VERSION` went to 2 (stored Sorter runs restart at puzzle 1) and the Sorter board's sample sets swap blue for pink where they met green. Orange with pink (3.6) and green with orange (7.2) are close too, but no generated colour puzzle uses orange.
- Before showing the canvas, agent A1 (A2 for Pattern) checks each colour board in Chrome DevTools' vision deficiency emulation (protanopia, deuteranopia, tritanopia) and reports any pair that merges. The avoid list lives in `src/games/kit/colorPairs.ts`, which the generators read; K writes it in batch 1, and in batch 2 agent P adds any new pair A2 reports (the only batch 2 edit to the kit, listed in P's files in 12.3).
- Color Mixer and Picture Builder are about colour itself, so names carry it (open question 3).

## 10. Tests

Test work runs on its own agent (Opus 5.5 at xhigh), separate from the agents that write the code. New behaviour gets the normal case, edge cases (empty, missing, boundaries) and error paths; nothing existing is weakened, skipped or deleted.

### 10.1 Kit (batch 1)
- **Reducer:** a new run starts at puzzle 1 and a stored one resumes at its next unsolved puzzle; the band is frozen for the puzzle on screen and the new band applies from the next one; `slip(key)` adds to the stuck count every time and to the star count once per key; every game and band's `STUCK` row at the limit and one below; the time signal resets on progress, a swap and a puzzle start, and stops while the page is hidden or a card is open; the offer hides on progress and shows again only on a fresh event (four-puzzle 3.2); a swap moves the puzzle to the end of the queue and leaves the dots alone; a swapped puzzle's slips and hints never count; the fourth solve finishes the level with `slipLevelStars`; the hint budget counts down, stays spent after a swap and caps only on a solved puzzle; `keepSolved` keeps solved puzzles on a band change; `solve`, `swap` and `next` act once when called twice (a double tap records one result); `hold(true)` stops the time signal and `hold(false)` lets it run on; an `ignored` outcome (no active player) keeps the level going in memory and saves nothing; a level card closed with Escape leaves **Play Level N** in the controls slot.
- **Hook and screens:** `breakBefore` runs on Next, Play Level and New puzzle, so Break opens at a puzzle boundary and resumes at the next unsolved puzzle; `routeFor` sends `#/game/<id>` to the current level or the finished state and any other level number back to `#/game/<id>`; server-rendered `PlayScreen`, `HelpRow` (offer last in tab order), `ChoiceRow` (wrong, right, locked) and `Finished` (star total, note, one button).
- **Drag math:** the 8 px threshold; offsets divided by the zoom; the target under the release; a miss returns; `pointercancel` drops the drag with no slip; the after-drag flag clears on the next `pointerdown`, so the next tap counts.
- **Star rule:** slips 1, 2, 4 and 5 over 4 puzzles; the hint cap from any one of the four; a replay keeps the higher stars.
- A second Opus 5.5 xhigh agent reviews these tests and adds missed cases (your rule for large-tier code).

### 10.2 Per game
Each game gets unit tests for its rules plus the content checks listed at the end of its section in 4:
- **Mixer:** a recipe is found in either paint order; the same paint twice is no slip; a repeated wrong pair counts once for stars; a tap on a given slot or an empty slot does nothing; a filled-slot tap empties it; in Guess the bowl stays empty until the right answer; twins never sit next to each other in the starting queue.
- **Sorter:** the match rule on shape and colour levels; which wrong line shows; misses and filled holes are no slip; ghosts keep tray places; the family rule.
- **Numbers:** inversions and cycles; a backward swap is a slip and a forward one resets time; the hint step and its line; band pools and counting runs; a band change on Level 9 keeps solved puzzles.
- **Pattern:** the one-reading rule; the wrong-option rule per level kind; answer positions spread across the level; Level 12 holds only four-car patterns; no colour-only puzzle breaks the avoid list, the Level 5 fixture included.
- **Calculator:** entry rules (two digits, "07", = with nothing typed, 0 from Level 9 only); the answer check; pool sizes per level and band; keys do nothing after the solve or while a card is open; a second = solves once.
- **Builder:** the match count counts only bricks; one slip per stroke; a repeated wrong colour on a square counts once; erasing never slips; the board locks during a look; look times per band; no time counts toward the offer during a look.
- **Error paths, every game:** `puzzle` with a level or puzzle number out of range throws, and a corrupt stored run is dropped by `sanitize` and restarts at puzzle 1, as today.
- **Copy:** a test asserts every line in each `copy.ts` is within its help-row limit (44 or 54 characters with the longest names filled in) and holds no em dash, no en dash and no exclamation mark except "You finished every level!".

### 10.3 Shared tests that change (batch 1, named in the PR body)
These encode "three playable games". The changes update the expected lists; none is deleted or skipped.
- `src/games/registry.test.ts:8`: playable ids become the six, then the nine; the title changes with them.
- `src/games/run.test.ts:90,99`: the `STUCK` loops cover every `RunGame`.
- `src/games/unlock.shared.test.ts:21`: add each new game's App, and Letter Builder, which is typed there but missing today.
- `src/screens/logic/currentAgreement.test.ts:18,88`: the `STARS` map and `GAMES` list gain the new games.
- `src/screens/logic/routes.test.ts`, `screensRender.test.ts`, `progressLines.test.ts`, `levels.edges.test.ts`, `screens.test.ts`: the "not built" example moves from `mixer` to `math` in batch 1, then to a stub or an unknown id in batch 2 (3.5); Home hrefs and picker links include the new games.
- `e2e/routes.spec.ts:42` (`#/settings/levels/mixer/maya` as "not playable"): `math` in batch 1; in batch 2 that entry goes, since the same list already holds `#/settings/levels/chess/maya` for an unknown game id.

### 10.4 Journeys (Playwright)
One file per game, `e2e/<id>.spec.ts`. Each game gets a "solve like a child" helper in `e2e/app.ts` that reads the puzzle from the accessible names in 9.2 and acts through buttons, keys and real pointer drags only, never app code at run time, as the file's header requires (its "buttons, links and keys" gains "and pointer drags" for Sorter and Numbers).

| Game | Journey 1, phone and tablet | Journey 2, phone only (`@phone-only`) |
|---|---|---|
| Color Mixer | a new child plays Level 1 through into Level 2 | wrong pairs show their result, count as slips on the card, bring the offer at 3 for ages 3 to 4, and a swap brings a different puzzle (on Level 1 two puzzles can share a goal with a different paint given) |
| Shape Sorter | Level 1 through into Level 2 by dragging | a wrong hole names what matched, the tap path works, leaving mid-level resumes at the next unsolved puzzle |
| Number Line-up | Level 1 through into Level 2 by taps | a hint counts down the badge and puts the cap line on the card; an age change on Level 9 keeps solved puzzles |
| Pattern Train | Level 1 through into Level 2 | the last level: finished card, then the finished state, where the Escape key goes Home |
| Brick Calculator | Level 1 through into Level 2 with the physical keyboard | a wrong answer slips and clears; Break between puzzles, then resume after a grown-up adds time |
| Picture Builder | Level 1 through into Level 2 | a memory level: the look locks the board, Peek shows the picture, the bar is hidden, one wrong stroke is one slip |

Also: `fixes.spec.ts`'s finished-state totals case gains each new game; batch 1 adds one Break journey on Color Mixer (Break opens at Next once the limit is used up, then the child resumes at the next unsolved puzzle after a grown-up adds time), because the kit's `breakBefore` lands in batch 1 and Calculator's Break journey comes only in batch 2; and one grown-up picker journey per batch (Color Mixer, Picture Builder) sets a level and the child plays it. `playwright.config.ts`: the tablet project gets `grepInvert: /@phone-only/`.

### 10.5 CI
- No new job, step or schedule. The content checks are pure and run in `npm test` in a few seconds, so they run on every commit and every CI run.
- The journeys stay in the existing step that runs only on pull requests into `claude/kids-brick-games` and by hand. Draft PRs skip CI.
- After the first ready run of each batch, set the job's `timeout-minutes` to about twice the measured run, rounded up (today 15), as your CI rule says.
- Canvas-only commits skip CI (`paths-ignore: design/**`).

### 10.6 Gates
The commit gate on every commit, never `--no-verify`. Before a PR is marked ready: `npm test`, `npm run typecheck`, `npm run build` and `npm run test:e2e`, with the real counts reported. `npm run test:solver` runs only if `src/games/slide/` changes, which this work does not plan.

## 11. Open questions (recommendation first)

1. **Free play in Color Mixer and Brick Calculator.** Mixer's Discover mode and colour book, and the whole Calculator board, have no right answer: no puzzle, no slips, no stars.
   - **A (Recommended):** every screen is a puzzle (4.1, 4.5). Discover, the colour book and free typing go, and nothing new is stored.
   - B: keep free play as a corner reached from each game's finished state, after the last level: no stars, the colour book not saved.
   - C: keep the Discover and calculator modes on the play screen. Children would then choose what to play, which goes against the four-puzzle rule that the level decides that (fixed decisions 2 and 4).
2. **Today's discovery on Home.** The card says "What do red and blue make?" and "+1 sticker" and opens Color Mixer. Nothing in the app awards the 12 discovery stickers (x1 to x12). Once Mixer is built, a tap opens the child's current level, which asks its own question (for example "Can you make cream?"), not red and blue.
   - **A (Recommended):** keep the card as the way into Color Mixer, drop "+1 sticker", and swap the question for Mixer's Home sub, "Mix two colors to make a new one", so the card promises nothing the level does not show. No new data.
   - B: keep the card and its question as they are, drop "+1 sticker", and accept that the level that opens asks something else.
   - C: build real discoveries now: one Guess-the-mix question a day, opened from the card, that awards the next discovery sticker. Adds a route, a stored field per child (and with it a security review), tests and a board.
   - D: hide the card until discoveries are designed.
3. **A second cue for colour.** Sorter's colour levels and Pattern's colour-only levels ask children to tell colours apart; Picture Builder copies colours.
   - **A (Recommended):** avoid confusable pairs in generated puzzles and check boards in a colour-vision emulator (9.4), and carry colour names in labels and speech. The brick art stays as it is.
   - B: add a small mark per colour (a dot, stripe or ring) on pieces, cars and bricks in the six games. Changes the brick look.
   - C: a Settings switch, "Show color marks", off by default, with B's marks behind it.
4. **Pattern Train's train lines.** The board says "All aboard! The pattern is complete." and "Choo choo! Next train coming...". D4 kept "Choo choo!" for Letter Builder only.
   - **A (Recommended):** literal lines, "Pattern complete." and "{Yellow triangle} comes next."
   - B: extend D4: "All aboard!" as the solved prompt line, with no other exclamation.
5. **How many pictures Picture Builder needs.** 12 levels need 72 puzzle slots.
   - **A (Recommended):** 42 pictures; memory levels reuse the copy levels' pictures in a new order, so 39 new pictures to draw and review.
   - B: 72 different pictures (69 new); memory levels show pictures the child has not copied.

### 11.1 Decisions (user, 2026-11-06)
1. Free play: **A**. Every screen is a puzzle; Discover, the colour book and free typing go.
2. Today's discovery: **A**. The card stays as the way into Color Mixer, "+1 sticker" goes, and the question becomes "Mix two colors to make a new one".
3. Colour cue: **A**. Avoid confusable pairs, check in a colour-vision emulator, carry colour names in labels and speech. No marks on the bricks.
4. Pattern Train lines: **A**. "Pattern complete." and "{Yellow triangle} comes next."
5. Picture Builder: **A**. 42 pictures, 39 new to draw and review; memory levels reuse the copy levels' pictures.
6. Brief approved; batch 1 starts.

## 12. Work plan

### 12.1 Branches and PRs
- **Batch 1** works on `feat/six-games`, branched from `feat/app-from-canvas` at `7b5b5c6`. Draft PR #2 (`feat/app-from-canvas`) stacks on draft PR #1, which targets `claude/kids-brick-games`. Batch 1's draft PR targets `feat/app-from-canvas` while those are open, so it shows only this work, and moves down the stack as they merge. CI runs the journeys only on PRs into `claude/kids-brick-games`, so until the PR reaches it the journeys run locally (10.6). It is marked ready when everything in 10.6 passes.
- **Batch 2** works on `feat/six-games-2`, branched from batch 1's last commit, with its own draft PR handled the same way.
- Each agent works in its own worktree on a short branch (for example `feat/six-games-mixer`); files never overlap, and the main session merges each into the batch branch when its item passes. Agents commit and push after every item or two, with titles and bodies by your git rules. Nothing merges into `claude/kids-brick-games` or `main` without your OK.
- Long-running agents append "HH:MM label: step" lines to `scratchpad/six-games/progress.log`, and the main session relays milestones.
- The main session checks the 5-hour and weekly limits before each batch's canvas and code stages and sizes each run to what is left.

### 12.2 Batch 1
1. **From approval, in parallel:** A1 builds the canvas (5.2). K builds the kit's logic: `levelRun.ts`, `useLevelRun.ts`, `route.ts`, `GameApp.tsx`, `dragToTarget.ts`, `useDragToTarget.ts`, `copy.ts`, `colorPairs.ts`, then `run.ts` and the tokens; the reducer and the drag math come first. M, S and N write their `meta.ts` and pure content modules (no UI yet). T1 first moves the "not built" example from `mixer` to `math` in the shared tests (10.3), which passes before and after the registry change, then writes each kit test file and content check once the module it covers has landed (see the commit rule below).
2. **Gate:** the screens start when the canvas is built, you have seen it, the check you ask for (if any) is done with its fixes in, and the kit's logic has landed with T1's kit tests passing.
3. **Screens:** K first lands the kit's visual parts against the boards: `PlayScreen.tsx`, `Finished.tsx`, `HelpRow.tsx`, `ChoiceRow.tsx`, `kit.css`. M, S and N build their Play screens on them; F wires the registry, `App.tsx`, Home and the Settings timer line; T1 writes the game tests and journeys alongside; R reviews the kit tests.
4. **Before ready:** Sec runs the security review; its critical and high findings go back to the agent that owns the file and are fixed before the PR is marked ready, and anything left open is listed for you; all gates in 10.6.

**Commit rule for tests.** The commit gate runs the tests on every commit that touches code and blocks a failing test, a skip or an only marker. So T1 never commits a test for code that is not in its branch yet: it merges the batch branch into its own, writes the test, and commits once it passes. One change cannot be split: `registry.test.ts:8` expects exactly three playable games, so F updates that one list in the same commit that passes the three `meta` into `registry.ts`, names it in the commit body, and T1 checks it afterwards. Every other shared test in 10.3 still passes across that commit, because T1 has already moved the "not built" example to `math`.

| Agent | Owns | Size and model (your routing table) |
|---|---|---|
| A1 Canvas | `design/canvas/*` for batch 1, `canvas.json` | Large: design, Opus 5.5 at high |
| K Kit | `src/games/kit/*`, `src/games/run.ts`, new tokens in `src/styles/tokens.css` | Large: code, Opus 5.5 at high |
| M Mixer | `src/games/mixer/*` | Medium, Sonnet 5.5 at high |
| S Sorter | `src/games/sorter/*` | Medium, Sonnet 5.5 at high |
| N Numbers | `src/games/numbers/*` | Medium, Opus 5.5 at high (hint, band numbers, drag) |
| F Screens | `src/App.tsx`, `src/games/registry.ts`, `src/screens/Home.tsx`, `src/screens/Settings.tsx`, `src/screens/screens.css` (the unused `.sc-discovery__reward` goes), and the one list in `registry.test.ts:8` (commit rule above) | Small, Sonnet 5.5 at medium |
| T1 Tests | every other `*.test.ts`, `e2e/*`, `playwright.config.ts` | Testing, Opus 5.5 at xhigh |
| R Test review | reviews T1's kit tests and adds missed cases in its own `src/games/kit/*.review.test.ts` files, as `src/shared/progress/review.fixes.test.ts` does, so R and T1 never edit one file | Opus 5.5 at xhigh |
| Sec Security | the kit's store calls and the runs the three games write | Security review, Opus 5.5 at xhigh |

Your security rule asks for a full review on large-tier code, and the kit is large-tier code that writes progress for three new games, so batch 1 gets one short review. Batch 2 adds no stored data and no large-tier code, so it needs none, unless open question 2 goes to B.

### 12.3 Batch 2
1. **From batch 1's last commit (12.1), once batch 1's PR is marked ready and you give the go-ahead, in parallel:** B draws the 39 pictures into `pictures.ts` first; A2 builds the canvas (5.3), with `BuilderPictures` drawn from that file once B's first pass lands; P and C write their content modules; T2 first moves the "not built" example from `math` to a stub entry or an unknown game id (3.5), which passes before and after the registry change, then writes the content checks as each module lands.
2. **Gate:** as batch 1, plus your approval of `BuilderPictures`. **Outcome (2026-11-09):** you approved all 42 pictures as drawn and chose no design check on the batch 2 boards. B changes any picture you reject before the gate closes, and A2 redraws the sheet from the changed file.
3. **Screens:** P, C and B build their games; F2 adds the registry and `App.tsx` lines and, in the same commit, the nine ids in `registry.test.ts:8`; T2 writes the game tests and journeys alongside, under the same commit rule as T1.

| Agent | Owns | Size and model |
|---|---|---|
| A2 Canvas | `design/canvas/*` for batch 2, `canvas.json` | Large: design, Opus 5.5 at high |
| P Pattern | `src/games/pattern/*`, and new pairs only in `src/games/kit/colorPairs.ts` (9.4) | Medium, Sonnet 5.5 at high |
| C Calculator | `src/games/math/*` | Medium, Sonnet 5.5 at high |
| B Builder | `src/games/builder/*`, `eye` and `eraser` in `src/shared/ui/Icon.tsx` | Medium, Opus 5.5 at high (paint strokes, keyboard grid, 42 pictures) |
| F2 Screens | `src/App.tsx`, `src/games/registry.ts`, and the one list in `registry.test.ts:8` | Trivial, Sonnet 5.5 at low |
| T2 Tests | as T1 | Testing, Opus 5.5 at xhigh |

### 12.4 Rough size (estimates only; nothing here was measured)
| Stage | Wall time | Tokens |
|---|---|---|
| Batch 1: A1 canvas | 2 to 3 hours | 1.5M to 3M |
| Batch 1: K kit | 2 to 3 hours | 1M to 2M |
| Batch 1: M, S, N content and screens, in parallel | 2 to 4 hours | 1M to 2M each |
| Batch 1: F | under 1 hour | 0.2M to 0.4M |
| Batch 1: T1 and R, overlapping | 2 to 4 hours | 2M to 3.5M |
| Batch 1: Sec | about 1 hour | 0.5M to 1M |
| **Batch 1 total** | **about 8 to 12 hours over one or two days** | **about 8M to 16M** |
| Batch 2: A2, P, C, B, F2, T2 | about 7 to 11 hours, plus your picture review | about 7M to 13M |

### 12.5 Risks
**Batch 1**
1. The kit's API shifting while three games build on it. The API is fixed in 3.1, the reducer lands with T1's tests passing before any game screen starts, and the game agents begin with pure content.
2. Drag on the tablet zoom and on touch. Escape's lost-pointer and zoom handling is the model, and Sorter's first journey runs at tablet size.
3. The first band-dependent game after Letter Builder (Number Line-up Levels 9 to 12). Journey 2 covers an age change mid-level.
4. Open question 2 has to be answered before A1 draws the Hub card and F changes Home.
5. Shared tests that list three games: intended updates, named one by one in the PR body, ordered by the commit rule in 12.2 so the commit gate never blocks them.
6. CI time: measured on the first ready run, then the timeout is set from it.
7. Color Mixer's twin questions on Levels 2, 3, 5 and 6 (4.1). If children notice the repeat, moving Make it to the all-six chapter only (7 levels) removes the Make it twins; the Guess twins would stay.
8. Number Line-up's numeral contrast on the face gradients: checked on the rendered board (9.3).

**Batch 2**
1. Whether the pictures read as what they are named: the contact-sheet gate.
2. Keyboard painting and the click-plus-pointer double paint in Picture Builder.
3. Picture Builder's phone height: the board's own numbers add up to about 820 of 844 px with the help row and the two palette rows. `BuilderBig` proves the 5x5 level fits before the code starts.
4. Pattern trains with two readings: the generator's one-reading check.
5. The Calculator keypad replaces the board's free calculator (open question 1), and ages 3 to 4 type a digit.
6. CI time again, with three more journey files.
