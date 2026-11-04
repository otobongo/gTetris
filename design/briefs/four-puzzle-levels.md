# Brief: four-puzzle levels (Brick Escape, Brick Drop, Letter Builder)

Status: **draft 2, waiting for approval. Nothing gets built until it is approved.** Draft 2 answers the 29 review points; section 11 holds every open question with a recommendation.
Surface: the web app (`src/`) and its design canvas (`design/canvas/*.dc.html`), phone 390x844 and tablet 834x1194 (inner frame 596x853 at zoom 1.4).

**Guide pack** (load once, before starting, one pass, no review afterwards). No nativefit (web app).
- Canvas builder (agent A): unslop web cards `guide/layout.md`, `interaction.md`, `copy.md`, `typography.md`, `color.md`, plus `imagery.md` for the three new word pictures.
- Front-end code agents C (Escape), D (Drop), E (Letters) and F (Screens): the same five cards plus `guide/code.md`. Agent E also loads `imagery.md` for the pictures in `Pictures.tsx`.
- The core agent B, the generator run, the tests and the security review load no cards (B's `PuzzleDots` and `LevelCard` follow the values in section 8 exactly, so it loads `guide/code.md` only).

The look comes from `src/styles/tokens.css` and the existing boards. Section 8 lists every value this work needs, by token name, so nobody re-derives them.

**Fixed decisions (user, final, not reopened here):**
1. Every level of the three games holds at least 4 puzzles on one idea at one difficulty. 4 solved finish the level and open the next.
2. Children never see a level grid. A Home tap opens the current level at the next unsolved puzzle; finishing a level goes straight into the next.
3. A stuck child is offered a different puzzle of the same difficulty, and still needs 4 solved. About 6 puzzles per level.
4. Replaying or picking a level, and a reset per game, are for grown-ups: Settings, behind the grown-up check.
5. Stars stay per level, up to 3, worked out over the 4 puzzles. A hint or a run-out clock caps at 2; the ages 3 to 4 sand timer never costs a star.

Standing rules kept as they are: age bands only; the random two-digit sum check; Brick Escape's door rules and obstacles; Brick Drop's four controls and 15 s per row; Letter Builder's one tile per letter, word length by age band and hint button; speech only after a tap; accounts off.

---

## 1. Goal, users, done

**Goal:** a child practises one idea four times before the game moves on, never chooses from a grid, and is never left stuck on one puzzle.
**Users:** children 3 to 10. Ages 3 to 4 cannot read, so progress, the next step and the stuck offer must work from dots, colour, shape and the big green button alone. Grown-ups use Settings.
**Platform:** phone and tablet web app. Every new moment has a phone board on the canvas, every level card also has a tablet board, and every tablet wrapper passes the same levers through, so any moment can be shown at tablet size (7.5).

**Done when:**
- A Home tap on Brick Escape, Brick Drop or Letter Builder opens the current level (2.6) at its next unsolved puzzle. No child-facing screen shows a level grid; old level routes redirect (7.4).
- Every level ships 6 puzzles: Brick Escape 31 levels and 186 solver-checked boards, Brick Drop 12 stages and 72 puzzles (starter stacks, if open question 1 goes as recommended), Letter Builder 24 levels with 6 puzzles per run.
- 4 solved puzzles finish the level, record its stars by section 5 and open the next level; the level card starts it in one tap.
- The stuck offer fires by the rules in 3.1 and 3.2, costs nothing and never runs dry.
- Home, Settings, the picker and Break all name the same current level, from one function.
- Settings shows each game's level and puzzle progress per child, opens the grown-up level picker and resets one game.
- Levels finished before this change stay finished with their stars; an in-progress level starts at puzzle 1.
- The canvas matches 7.5; all tests pass and the real counts are reported; no colour, gradient, radius or font size outside section 8; copy matches section 9 and has no em or en dashes.

## 2. The child flow

### 2.1 From Home to the next level
1. The child taps a game card on Home. The app opens `#/game/<id>`, which replaces itself with `#/game/<id>/<n>` for the child's current level (2.6). Brick Drop already does this.
2. The level opens at its next unsolved puzzle. Four dots under the title show where the child is. Brick Drop first shows its stage intro sheet (2.2); the other two games start at once.
3. **Puzzle solved.** The game's success sound and animation run as today; the praise lines listed in 9.2 go. Then the current dot fills yellow, the help line states the result, and the controls row turns into one green **Next puzzle** button (spelling levels: **Next word**). Nothing covers the board. Focus moves to the button.
4. **Next puzzle** checks the daily limit (2.4), then loads the next puzzle on the same screen. The route does not change. In Brick Drop the new stack is drawn and the first brick waits (4.2).
5. **Fourth solve.** The last dot fills; 600 ms later the **level card** opens over the board: "You finished Level 9", the level's stars, the totals and the star rule, primary **Play Level 10**, secondary **Back to games**. This is the only card in the flow and the only tap between two levels (open question 10).
6. **Play Level 10** checks the daily limit, then opens `#/game/<id>/10` at puzzle 1. No intro sheet follows in any game: Brick Drop's first brick waits for the first press (4.2), and the help line names the new brick when the stage adds one.

### 2.2 Leaving mid-level and coming back
- Back in the top bar goes Home, as today. Solved puzzles stay solved. The unfinished puzzle is dropped with its moves, slips, hints and stuck counts; next time the same puzzle starts again from its first position. A Letter Builder hint used on it stays spent (3.3).
- Closing the app works the same way. Progress is saved after each solved puzzle and each swap, never mid-puzzle.
- Brick Drop shows its intro sheet whenever a stage is entered from Home (a first visit or a resume), because it carries the stage's goal and star rule. Its Start button leads to the waiting first brick.

### 2.3 Age band changed by a grown-up
- Brick Escape and Brick Drop: the boards do not depend on age. The new band's clock, sand timer and stuck limits apply from the next puzzle; the puzzle on screen keeps its clock.
- Letter Builder: spelling words depend on age. Solved puzzles stay solved and still count; the unsolved ones get the new band's words (4.3, 6.2).

### 2.4 Break time mid-level
- The daily limit is checked on every screen change, as `App.tsx` does now, and on every **Next puzzle** and **Play Level** tap. A puzzle in progress is never cut off (open question 2).
- When the limit is used up, that tap opens Break instead of the next puzzle, with the level's route as the resume path. After a grown-up adds time, the child lands on the next unsolved puzzle.
- Break's mid-level line becomes "Level 9 is saved with 2 of 4 puzzles solved." (Brick Drop says "Stage"; spelling levels say "words built"). It shows only when the current level has at least one solved puzzle, and names the level from 2.6.
- A Brick Drop stage can take longer than one day's limit at ages 3 to 6 (4.2). That is fine: progress is saved per puzzle.

### 2.5 The last level of a game
- After the last level's fourth puzzle, the card reads "You finished every level!" (Brick Drop: "every stage") with that level's stars, "31 levels, 78 of 93 stars." and one button, **Back to games**.
- Home's pill reads "All done". A later tap opens `#/game/<id>`, which stays on that route and shows the **finished state**: the game's top bar with the game name as its title, no dots, Back to Home; behind the scrim, the game's empty play area (Escape: the empty tray well; Drop: the empty board; Letters: the empty tray well), with no controls. Over it the finished card adds "A grown-up can pick a level to play again." (open question 3). Its one button, the Escape key and a tap on the scrim all go Home.
- New levels reopen a finished game by themselves: a finished game stores no `current`, and 2.6 then picks the first level with no stars, which is the first new one. This covers Brick Escape's open-ended Master chapter.

### 2.6 The current level: one rule for every screen
`currentLevel(meta, game)` in `src/games/meta.ts` replaces `firstOpenLevel` and the `current` that `planLevels` works out:
1. If `game.current` is an integer from 0 to `levelCount - 1`, that level.
2. Otherwise the first level with no stars (it is always open, since the level before it has stars). Today's age 9 to 10 chapter openings do not change it.
3. Otherwise null: every level is finished.

Every reader uses it: the `#/game/<id>` redirect, Home's pill and card name, the Settings row sub, the picker's current tile and arrival status, Break's mid-level line, and Brick Drop's `currentStage`. Example: frontier Level 10, a grown-up sets Level 20; Home says "Level 20" and a tap opens 20; finishing it sets Level 21.

## 3. The stuck flow

### 3.1 Trigger
A puzzle is stuck when either of its signals reaches the limit for the child's age band.

| Game | Signal | 3 to 4 | 5 to 6 | 7 to 8 | 9 to 10 |
|---|---|---|---|---|---|
| Brick Escape | Failed tries (see below) | 2 | 2 | 3 | 3 |
| Brick Escape | Seconds with no brick leaving the board | 60 | 90 | 120 | 150 |
| Brick Drop | Failed tries: the stack reaches the top | 2 | 2 | 3 | 3 |
| Brick Drop | Seconds | not used: bricks keep falling, so a stuck round ends by itself | | | |
| Letter Builder | Wrong taps on this puzzle | 3 | 3 | 4 | 4 |
| Letter Builder | Seconds with no right tap | 30 | 40 | 50 | 60 |

- **Escape's failed tries:** +1 for each Restart, and +1 once per try when the move counter since the last Restart (or the puzzle start) reaches 3 times Best. Moves are the counter as shown; Undo takes a move back, as today, so an undone move counts for neither this signal nor E (section 5).
- **Count signals** (failed tries, wrong taps) reset to 0 only when a puzzle starts and after a swap. Progress does not reset them.
- **Time signals** reset to 0 when a puzzle starts, after a swap and on progress (a brick leaves, a right tap). Time counts only while the puzzle is on screen, the page is visible and no card or sheet is open.
- The limits live in one table, `STUCK` in `src/games/run.ts`, so tuning after watching children play is one edit.

### 3.2 How the offer shows
- **Brick Escape:** a green icon button with the swap icon, named "New puzzle", appears at the right end of the tools row. The row spans the screen width with Undo and Hint centred as now, so they never move under a finger. The help line changes to "This one is tricky. Want a different puzzle?" The row keeps its height, so the board does not resize.
- **Letter Builder:** the same green button ("New word" on spelling levels) fills the help row's empty left slot, opposite the Hint button. The help line changes to the offer line.
- **Brick Drop:** the over sheet that opens when the stack reaches the top adds "This one is tricky. You can try a different puzzle." and makes **New puzzle** its primary button, **Try again** secondary.
- **Showing, hiding, showing again (Escape and Letter Builder):** the offer shows when a signal reaches its limit. It hides on the next progress. It shows again only on a fresh event: the next increase of a count signal that is already at or over its limit (another Restart, another wrong tap), or the time signal reaching its limit again from 0. Once the offer is up, it stays up until progress or a swap.
- The offer never takes focus or blocks play. Nothing is read aloud unless the child taps a speaker.

### 3.3 What it costs, and how spares run out
- A swap is free. The puzzle the child left does not count: its moves, slips, hints and clock are dropped from the stars (open question 6).
- **Hints on a swapped puzzle:** Letter Builder's 3 hints per level are a budget, so a hint used on a puzzle later swapped away stays spent (the badge never counts back up) but does not cap the stars. Brick Escape's hints have no budget; a hint on a swapped board is simply forgotten.
- Each level's 6 puzzles sit in a queue that holds every unsolved puzzle. A swap moves `queue[0]` to the end and starts the new `queue[0]`; the dots do not change ("puzzle 3 of 4" stays). The help line says "Here is a different puzzle." once.
- Because the queue only rotates, a swap after all 6 have been seen brings back the puzzle swapped away longest ago. With 4 to solve out of 6, there are always at least 2 others to swap to, so the offer never runs out.

## 4. Per game

### 4.1 Brick Escape
- **One puzzle:** one board. **Levels:** 31 in 6 chapters, unchanged, because progress is keyed by level index.
- **Puzzles per level:** 6. Puzzle 1 is today's board for that level (the anchor), so the canvas teaching boards stay first in Levels 1, 5, 9, 14, 20 and 31. Puzzles 2 to 6 are new and copy the anchor's tip.
- **Same difficulty:** each board matches the anchor's board size, tray shape (rotated or mirrored is fine), number of colours, number of icy doors, number of colour locks, stones or none, brick sizes, advanced-door flag and clock base; its Best is within 1 of the anchor's, and its brick count within 1. All six therefore share the anchor's `describe()` subtitle.
- **Variety:** no two boards in a level are equal under the 8 rotations and mirrors with colours renamed; no two share a door layout (sides and positions); each uses a different colour set. The generator keeps the 5 boards that differ most from the anchor and from each other (first in door layout, then in brick layout) from a pool of up to 12 accepted candidates.
- **Rules kept:** every open square packed; one door per colour, exactly as long as its bricks, at a corner unless the level is advanced (Levels 9 and 26 to 31, as `designProblems` allows today; open question 12), never next to another door; obstacles are icy doors, colour locks, stones and shaped trays only; no frozen or one-way bricks. Every board passes `validate`, `designProblems` and the solver, and its par is the solver's best.

| Chapter | Levels | Board | Anchor Best | Clock base |
|---|---|---|---|---|
| Getting started | 1 to 8 | 4x4 (1 to 4), 6x6 (5 to 8) | 4, 4, 4, 6, 10, 7, 8, 11 | 30 s, 45 s |
| Think first | 9 to 13 | 8x8 canvas board (9), 6x6 | 10, 10, 10, 12, 14 | 60 s, 45 s |
| Icy doors | 14 to 19 | 6x6 | 12, 11, 11, 12, 13, 16 | 45 s |
| Stone blocks | 20 to 25 | 8x8 canvas board (20), 6x6 | 18, 13, 14, 15, 15, 18 | 60 s, 45 s |
| Big bricks | 26 to 30 | 8x8 | 15, 15, 16, 19, 22 | 60 s |
| Master | 31 | 8x8 canvas board | 14 | 75 s |

**Generator plan (`scripts/generate-slide-levels.ts`):**
- One job per level instead of per tier. A job reads its anchor from `levels.data.ts` (today's single board on the first run, `puzzles[0]` after that, never regenerated) or from the canvas JSON for Levels 1, 5, 9, 14, 20 and 31. It builds candidates with exactly the anchor's signature (colour count, lock counts, sizes and tray fixed), so only solvability and the par window filter them.
- **Old caches:** the only tier caches are in another worktree. Before the first run, agent C copies `.claude/worktrees/wf_f1224b26-27c-2/scripts/.slide-cache/tier-*.json` (six files: big, ice, six, start, stones, think) into this worktree's `scripts/.slide-cache/`. A job imports every cached board that matches its anchor's signature and par window into its pool. If the files are gone, the run works without them.
- **Cache and resume:** `scripts/.slide-cache/level-<n>.json` (`runs`, `tries`, `pool`) is saved after every accepted board. A resumed run uses a new seed, as today. The folder is already gitignored.
- **Commands:** `npm run levels:generate` fills every level whose pool is short of 12 (30 minutes per level, 60 for Levels 9 and 31); a level stops early at 12. `-- --level 27` runs one level; `-- --minutes 10` changes the budget; `-- --combine` writes `levels.data.ts` from the cache only.
- **Workers:** `availableParallelism() - 1` processes (7 on this 8-core M1 Pro), 8x8 levels first. One progress line per level per minute goes to stderr and to `scripts/.slide-cache/progress.log` ("HH:MM level 27: pool 7 of 12, 412 tries").
- **Combine** picks the 5 most different from each pool and refuses to write unless every level has 6 boards that pass every check; it names the short levels. **Fallbacks for a short level, in this order,** each followed by a rerun of that level only:
  1. Widen its par window from Best plus or minus 1 to plus or minus 2.
  2. Relax variety for that level: colour sets may repeat, and two boards may share a door layout when their brick layouts differ.
  3. Hand-made boards: agent C draws the missing boards in `levels.hand.ts`, and they pass the same checks as generated ones.
  Every fallback used is listed in the PR body by level.
- **Output:** `LEVEL_DATA` becomes 31 levels of `{ id, puzzles: { spec, par, order }[] }`. `id` is the first 12 hex characters of a SHA-256 of that level's puzzles, so regenerating one level restarts only that level's runs, and adding Master levels restarts none. About 85 KB of JSON before compression (today's 31 boards take 14 KB).
- **Time estimate.** Basis: a full run of today's generator on this Mac on 4 November filled the 4x4 and 6x6 tier pools (30 to 50 boards each) in 12 s or less, and the 8x8 pool (50 boards, Best 15 to 22) in 15 min 43 s, about 19 s per accepted board. A level now keeps only boards inside its par window, so on 8x8 expect 1 in 5 to 1 in 10 to land in it: about 1.5 to 3 minutes per pool board. The 23 levels on 4x4 and 6x6 take under 15 minutes together. Each of the 8 levels on 8x8 (9, 20, 26 to 31) needs 12 pool boards, so 20 to 40 minutes, and will often run to its budget. With 7 workers the first full run takes **about 60 to 90 minutes**: seven 8x8 levels in the first wave, then the eighth beside the small levels. Levels 9 and 31 have the most unusual anchors (six colours with a lock chain; stones, ice and a colour lock together) and may use their whole 60 minutes and still need a fallback. A level that ends its budget with at least 5 boards in its pool combines from what it has. A rerun only fills what is missing.
- It needs nothing from the canvas, so it runs in the background right after approval.

### 4.2 Brick Drop
- **One puzzle (recommended, open question 1):** one round on the stage's board, with the stage's bricks, speed and lock delay as today, a per-puzzle goal (below), starting on a **starter stack**: pre-built rows with brick-shaped holes, as the Drop board already shows. Each puzzle has its own fixed brick order.
- **Puzzles per level:** 6. **Levels:** 12 stages in 3 chapters, unchanged.
- **Per-puzzle goal rows (open question 9):** the stage's goal rows on Stages 1 to 5 (3, 4, 5, 6, 6), half of them rounded up from Stage 6 on (4, 4, 5, 5, 5, 6, 8). Rows of the starter stack count when they clear.
- **Starter stack:** 2 rows on Stages 1 to 3, 3 rows from Stage 4. Fill those rows, then cut 2 holes (Stages 1 to 3) or 3 holes (from Stage 4).
  - Each hole is the exact shape of one brick from the stage's set, in some turn.
  - A brick can drop straight in: in every column, each stack cell above a hole cell belongs to the same hole.
  - No hole touches another hole along a side.
  - Every stack row has at least one hole cell, so no row starts complete.
  - At least one hole has the shape of a brick the stage adds (`newPieces`). Stages 8 (Plan Ahead) and 9 (Speedy) add none, because they reuse Stage 7's set, so they use Stage 7's new bricks (Zig or Zag).
  - All 6 stacks of a stage cut the same number of cells, so their star counts are equal. Stack cells use the brick palette by column.
- **Same difficulty:** the stage's rules, plus equal stack height, hole count and cut cells.
- **Variety:** different hole shapes and places, and a different brick order. Every hole's brick comes in the puzzle's first bag (the existing 7-bag randomizer).
- **Generation:** a pure function in `src/games/drop/starters.ts`, seeded with 1000 x stage + puzzle, run at play time; a test checks all 72.
- **The first brick waits.** Whenever a puzzle starts (after Next puzzle, Play Stage, Try again, New puzzle or the intro sheet's Start), the stack is drawn and the first brick hangs at the top. Nothing falls and the clock does not run until the child presses any of the four controls or taps the board; that first press also does its own action. The help line reads "Press any button to start." When the stage adds a brick, the line after it names it: "New brick: {Zig}."
- **Length.** Each puzzle's clock is its goal rows x 15 s x the age factor (sand timer: x 2). With the goal rows above, the longest is Stage 12: 8 rows, so 4 min per puzzle at ages 3 to 6 and 3 min at ages 7 to 8; four puzzles allow 16 and 12 minutes, inside the 20-minute default limit. With the stage's full goal rows instead, Stages 8 to 10 would allow 5 min per puzzle (20 per stage) and Stage 12 7.5 min (30 per stage) at ages 3 to 6, so a stage would always span two days on the default limit. The clock is an allowance, not a cutoff: running out caps the stars and never ends the round.
- **Removed:** "Play again" on the clear sheet and "Stages" on the over sheet.

### 4.3 Letter Builder
- **One puzzle:** one prompt (a train, a board of pairs, a picture, a word). **Levels:** 24 in 4 chapters, unchanged.
- **Puzzles per level:** 6, built by `makePuzzles(level, seed, band, solvedWords)`. The run's `seed` fixes everything random about the level (which runs, letters and pictures, gaps and decoys, tray order), so a resumed level shows the same puzzles.

| Kind (levels) | One puzzle | Fixed for every puzzle of the level | Variety |
|---|---|---|---|
| Train (1 to 6) | Tap a run of letters in order | Run length: the longest piece today's `chunkSizes(span, 7)` gives, so 5 for A to J and A to O, and 7 for A to Z, a to m and n to z; case; Level 1's guide | Runs start at different letters; the first runs cover the whole span (A to Z: A to G, H to N, O to U, T to Z) |
| Train, Level 1 only (A to E) | Runs of 4 (open question 11) | Run length 4, upper case, guide on | Puzzles alternate A to D and B to E, each with its own tray order, so a swap brings the other run |
| Missing letters (7) | Fill the gaps in a run of 6 | 2 gaps and 1 decoy on every puzzle (today later prompts hide 3; that ramp goes) | Different runs and gaps |
| Big and small (8 to 11) | Match every pair | Pair count (3, 4, 6, 8) and letter pool | Different letters |
| First sounds (12 to 15) | Pick the first letter of the picture | Choices (3 or 4), word pool, case | 6 different words |
| Spell it (16 to 24) | Build one word | Word length by age band, tier, guide on or off | 6 different words, never repeated inside a level |

**Spelling words:**
- **Which words:** for each player, age band and tier there is one shuffled order of that tier's pool (`spellWords(band, tier)`), seeded by player id, band and tier, not by the run. The spelling levels on a tier take 6 words each, in level order: the first level on the tier takes places 1 to 6, the second 7 to 12, the third 13 to 18, wrapping round the pool. Every pool has at least 8 words, so a level never holds a word twice. The run seed only orders the level's 6 words and shuffles each tray.
- **Repeats:** a word comes back only after the tier's whole pool has been used. Three pools are smaller than their levels need (open question 7).
- **Replay:** a grown-up's pick of a spelling level gives the same 6 words for that player and band, in a new order with new trays (a new run seed).
- **Band change mid-level:** the run keeps `solved` and its puzzle numbers. Each unsolved puzzle number gets the new band's word for that place, skipping every word already built in this run (`PuzzleResult.word`) and taking the next places in the new order instead. This matters for ages 7 to 8 and 9 to 10, whose pools are the same 44 words.
- Hints stay at 3 per level; the badge counts down over the whole level (3.3).
- Letter Builder has no clock in the app, so time does not touch its stars.

## 5. Stars over 4 puzzles

Only the 4 solved puzzles count; a puzzle swapped away never counts. Each game works out a base of 1 to 3 from the level's totals, then the shared cap in `src/games/stars.ts` applies to the level: **a hint used, or a counted clock run out, in any of the 4 caps the level at 2.** The relaxed sand timer (always on for ages 3 to 4) and the Off mode never cap. A replay keeps the higher of the old and new stars, as `recordStars` does now.

| Game | Total over the 4 solved | 3 stars | 2 stars | 1 star | Caps |
|---|---|---|---|---|---|
| Brick Escape | Extra moves E: the moves used minus the four Bests | E ≤ 4 | E ≤ 12 | E > 12 | hint, counted clock |
| Brick Drop | Bricks used B, against each puzzle's 3-star and 2-star counts T3 and T2 | B ≤ sum of T3 | B ≤ sum of T2 | more | counted clock |
| Letter Builder | Slips S (wrong taps) | S ≤ 1 | S ≤ 4 | S ≥ 5 | hint |

- **Brick Escape** keeps today's 2-star allowance (3 extra moves per board, so 12 over four) and allows 1 extra move per board for 3 stars, because four perfect boards in a row is far harder than one. Moves are the counter at the solve, after any Undo.
- **Brick Drop**, per puzzle, with G = the puzzle's goal rows (4.2), A = the average cells per brick of the stage's set, C = columns and K = the filled cells of the starter stack: `ideal = (G x C - K) / A`, `T3 = ceil(ideal + 2.5 x C / A)`, `T2 = ceil(ideal + 6 x C / A)`. With no stack and the stage's full goal rows this is today's `starRule` exactly.
- **Brick Drop score:** each puzzle's score is stored with its result; the level's score is the sum of the 4, and `best` keeps the highest level score, as it keeps the highest stage score today.
- **Letter Builder** keeps today's slip rule, now over exactly 4 puzzles instead of 3 to 6 prompts.
- Each puzzle result stores the numbers its rule and card need (6.1), so stars never depend on looking puzzles up again.

## 6. Data model and migration (`src/shared/progress`)

### 6.1 Shapes
`GameProgress` gains two optional fields; nothing else moves.

```ts
interface GameProgress {
  unlocked: number;                    // as today
  stars: Record<number, number>;       // as today: 1 to 3 per finished level
  best: Record<number, number>;        // as today (Brick Drop: the highest level score)
  /** Level a Home tap opens (0-based), when set by a finish or a grown-up pick. Absent: work it out (2.6). */
  current?: number;
  /** Puzzle progress for levels started and not finished, keyed by 0-based level. */
  runs?: Record<number, LevelRun>;
}

interface LevelRun {
  /** Which puzzle set: 'escape:<level id>', 'drop:1', 'letters:1:<age band>'. */
  set: string;
  /** Seed the puzzles are built from (Letter Builder); 0 for fixed sets. */
  seed: number;
  /** Every unsolved puzzle number (0 to 5), in the order they come; queue[0] is on screen. A swap moves it to the end. */
  queue: number[];
  /** Counted puzzles, in the order solved: 0 to 3 stored, because the fourth finishes the level in the same write. */
  solved: PuzzleResult[];
  /** Letter Builder hints left in this level (3 at the start). */
  hintsLeft?: number;
  updatedAt: number;
}

interface PuzzleResult {
  puzzle: number;
  /** Escape: moves. Drop: bricks used. Letter Builder: slips. */
  count: number;
  /** Escape: Best. Drop: T3 and T2 (section 5). */
  par?: number;
  three?: number;
  two?: number;
  /** Drop: this puzzle's score. */
  score?: number;
  /** Letter Builder spelling: the word built, so a band change leaves it out (4.3). */
  word?: string;
  usedHint: boolean;
  outOfTime: boolean;
}
```

Draft 1's `swapped` list is gone: the queue order already holds which spare comes next.

### 6.2 Rules
- **Solving** a puzzle appends its result, takes it out of `queue` and saves. The fourth result finishes the level in the same write: the game works out the stars (section 5), `recordStars` keeps the higher count and opens the next level as today, the run is deleted, and `current` becomes the first level after it with no stars, wrapping round to the first level with no stars; when every level has stars, `current` is deleted and 2.6 returns null.
- **Set changes:** a run whose `set` no longer matches the game's set for that level restarts at puzzle 1. Letter Builder's band change (2.3, 4.3) is the exception: it keeps `solved`, re-fills the unsolved numbers and updates `set`. Brick Drop and Letter Builder raise their set number whenever their puzzle rules change; a Brick Escape level's `id` changes by itself when its boards do.
- **Grown-up pick:** `current` becomes the picked level and `unlocked` rises to it if needed. An existing run for that level continues; otherwise a new run starts at puzzle 1. Finishing it sets `current` by the rule above, so a replay of Level 3 returns the child to their frontier and a jump to Level 20 continues at 21.
- **Reset one game:** that game's `unlocked`, `stars`, `best`, `current` and `runs` go back to empty. Stickers stay (open question 5).
- **Validation** (`sanitize`, which knows no level counts):
  - Level keys go through `parseLevelKey`; no stored key reaches an object prototype (`isSafeKey`).
  - `current`: an integer from 0 to 999. The range check against `levelCount` happens in `currentLevel` (2.6), which ignores a value out of range; the next finish or pick overwrites it.
  - `set`: a string of at most 64 characters. `seed`: a non-negative integer.
  - `queue` and `solved`: puzzle numbers are integers 0 to 5; together `queue` and the `solved` puzzles hold each of 0 to 5 exactly once, so they never share a puzzle and `queue` is never empty. `solved` holds 0 to 3 results.
  - Each result: finite non-negative numbers, real booleans, `word` (when present) 1 to 16 letters A to Z.
  - `hintsLeft`: an integer 0 to 3.
  - A run that breaks any rule is dropped (that level starts at puzzle 1).
- **Store actions** (`progressStore`): `startRun`, `recordPuzzle` (which finishes the level on the fourth result), `swapPuzzle`, `pickLevel`, `resetGame`. The store stays game-agnostic: each game passes in its set, seed and stars.

### 6.3 Migration
- No new storage key. `brickwise:v2` records load through `sanitize`, which leaves `current` and `runs` absent. `SCHEMA_VERSION` becomes 3 to mark the new shape.
- Finished levels keep their stars and stay finished, and `unlocked` is untouched. Nothing in-progress is stored today, so every unfinished level starts at puzzle 1, which is the rule. A migrated child who finished every level gets null from 2.6 and sees the finished state.
- A tab still on the old build keeps only `unlocked`, `stars` and `best` (`cleanGame` in `model.ts`), so its next write drops `runs` and `current`. That loses puzzle counts and a grown-up's pick (the child goes back to the first level with no stars), never stars. Accounts are off, so there is no sync merge to change; `updatedAt` on each run is there for when there is.

## 7. Screens and canvas boards

### 7.1 Game screens (all three, phone and tablet)
**Progress dots.**
- Place: the top bar's centre block, under the title, in place of the subtitle. The game name and level name leave the play screen.
- Titles: "Level 9" (Escape) and "Stage 4" (Drop) stay; Letter Builder's title changes from the chapter name to "Level 17", so all three match Home's pill.
- Always four dots; spares never show. States: solved (filled yellow), current (light blue and wider), to do (well colour with a ring). After a swap the current dot stays where it is. Values in section 8.
- Letter Builder's player strip keeps the avatar and name and loses its dots.

**Puzzle solved:** the Next button takes the controls' place: Escape's tools row, Drop's pad, Letter Builder's tray well (the button centred inside it). The board stays visible.

**Stuck offer:** 3.2.

**Level card:** one shared component, `LevelCard` (2.1 step 5, 2.5). It replaces Escape's win card (no Replay), Drop's clear sheet (no Play again), and Letter Builder's word card and level card (no Play again, no All levels). The finished state (2.5) uses the same component with one button.

**Other changes.**
- Escape: Restart is named "Restart puzzle"; the clock caption reads "Maya: each puzzle gets 45s x 1.5 = 1:08"; stars are recorded only at level end; the "Brilliant!" and "Great job!" prefixes leave the help line.
- Drop: the intro sheet opens when a stage is entered from Home, with the per-puzzle goal and the level's star rule; the over sheet's title becomes "Out of room" and "Stages" becomes "Back to games"; the first brick waits (4.2).
- Letter Builder: the card between words goes, and the kinds that auto-advanced now end with Next like the rest. The help lines "Well done!" and "Great! What comes next?" become the kind's solved line and "What comes next?". Nothing is spoken at the end of a level: today's automatic "Super builder!" and "You did it!" (`LettersApp.tsx`) go, because speech plays only after a tap.

### 7.2 Home
- Every playable card links to `#/game/<id>` (registry `route`). Today's discovery links to `#/game/mixer`, which shows Coming soon as now.
- The pill keeps today's copy, from 2.6: "Level 9", "Stage 4", "All done", "Coming soon". Mini dots in the pill would push "Letter Builder" and its pill past the 258px a phone card row has, so puzzle progress goes in the card's accessible name only.

### 7.3 Settings and the grown-up level picker
- **Progress panel**, for the selected child: above today's two reset buttons, one 52px row per playable game with the game name, a sub line ("Level 9, 2 of 4 puzzles", section 9 for every variant) and a chevron. Each row links to the picker; rows are divided like Support's legal rows.
- **Picker** at `#/settings/levels/<game>/<playerId>` (route in 7.4), behind the grown-up check and counted as a grown-up page, so the pass carries over from Settings. It is the Levels board: back to Settings, the game as title, sub "Maya · 17 of 93 stars", no speaker button, an intro line, a status line, then the chapters and tiles (done, current, open, locked) in 5 columns on phone and 8 on tablet for every age. Tapping a tile selects it (yellow ring) and fills the status line (section 9 covers a level with a run, the current level, finished, open and locked). Locked tiles can be picked (open question 4). The footer button reads "Play Level 5" when that child is the active player (it saves the pick and opens the game) or "Set Level 5 for Leo" otherwise (it saves, returns to Settings and shows a toast). Brick Drop says "Stage" throughout.
- **Reset one game:** a flat panel at the end of the picker's scroll area, with an outline-danger button, then the existing confirm dialog and toast.
- Settings keeps "Reset Maya's progress" and "Reset every child's progress" as they are. Support gets one new question (section 9).

### 7.4 Routes
- **Picker route:** `parseRoute` reads `settings/levels/<game>/<playerId>` as a new route `{ name: 'levelPicker', game, playerId }` (today `settings` is a simple route and rejects extra segments). `pathFor` writes it back. `levelPicker` joins `GROWN_UP_ROUTES` and `CHECKED_ROUTES` in `screens/logic/session.ts` and stays out of `isPlayRoute`, so Break never blocks a grown-up there. An unknown game or player id replaces itself with `#/settings`.
- **Levels routes:** `#/game/<id>/levels` replaces itself with `#/game/<id>`. `#/game/<id>/<n>` plays only the child's current level (2.6); any other n replaces itself with `#/game/<id>`.
- **Legacy paths:** `legacyRedirect` now sends `#/slide`, `#/drop` and `#/letters` to `/game/<id>` (not `/levels`), and `#/slide/<n>`, `#/drop/<n>`, `#/letters/<n>` to `/game/<id>/<n>`, which then applies the rule above. Each old path takes one replace, never two.
- The games' own fallback level lists (SlideApp's list, LettersApp's `LevelList`) are deleted.
- `src/screens/Levels.tsx` becomes the picker; its rules in `screens/logic/levels.ts` stay, take their current level from 2.6 and gain the selection state.
- The sticker book's "Play Brick Escape" follows the registry route, so it opens the game.

### 7.5 Canvas boards

| Board | Change |
|---|---|
| `Escape` (its tablet and variant wrappers follow) | Back to `Hub` / `HubTablet`, "Back to home". Subtitle becomes the dots, with a `puzzle` lever 1 to 4. Restart label. Win card removed. New `moment` lever: `play`; `solved` (board empty, dot filled, "Solved in 6 moves.", Next puzzle in the tools row); `stuck` (offer line, New puzzle pinned right); `levelDone` (level card); `gameDone` (finished state, 2.5) |
| `Drop` | Subtitle becomes the dots, `puzzle` lever 1 to 4. `moment`: `intro`, `ready` (first brick waiting, "Press any button to start."), `play`, `solved` (pad becomes Next puzzle), `over` ("Out of room"), `stuck` (sheet with New puzzle first), `levelDone`, `gameDone`. Its pre-built stack stays: it is the starter stack |
| `Letters` | Back to `Hub`. Titles follow the spelling levels in `levels.ts`: "Level 16", "Level 17", "Level 24" (today's samples say Level 3, an alphabet train, and Level 32, which does not exist). Subtitle becomes the dots, `puzzle` lever 1 to 4; the strip keeps avatar and name. Four words per stage: add CAT, DUCK and PENGUIN, drawn in the board's own SVG style. `moment`: `play`, `solved` (tray well holds Next word), `stuck`, `levelDone`, `gameDone`. Word card removed |
| `EscapeTablet`, `DropTablet`, `LettersTablet` | Declare the same `puzzle` and `moment` levers and pass them through `dc-import`, so every moment shows at tablet size |
| `Hub` | Brick Escape card links to `Escape`, Letter Builder to `Letters` (tablet: `EscapeTablet`, `LettersTablet`). Sample accessible names with puzzle progress |
| `Grownups` | Progress panel game rows: Brick Escape links to `Levels`, Letter Builder to `LevelsLetters`, Brick Drop to the new `LevelsDrop`. `GrownupsTablet` needs no lever: the panel is part of the default state |
| `Levels`, `LevelsLetters`, `LevelsTablet` | Become the picker (7.3): back to `Grownups`, sub, intro line, status line, no speaker, selection ring, picker footer, reset panel. New `state` lever: `default`, `picked`, `confirmReset`, `resetDone`, which `LevelsLetters`, `LevelsDrop` and `LevelsTablet` pass through. Drop's sample chapter split becomes 3, 6, 3 to match `stages.ts` |
| New `LevelsDrop` | Thin wrapper like `LevelsLetters`: `dc-import name="Levels" game="drop"`, titled "Level picker for grown-ups: Brick Drop (phone)" |
| `Break` | The `when=midLevel` line (section 9). `BreakTablet` already passes `when="midLevel"`, so it needs no lever |
| `Signup`, `Main` | Drop the speed bonus no star rule gives: Signup's ages 9 to 10 line becomes "Ages 9 to 10: a challenge timer with the tightest times." and Main's challenge timer text becomes "Tighter times than the standard timer." |
| New, row 8 | Thin wrappers, phone: `EscapeSolved`, `EscapeStuck`, `EscapeDone`, `EscapeGameDone`, `DropReady`, `DropSolved`, `DropStuck`, `DropDone`, `LettersSolved`, `LettersStuck`, `LettersDone`. Tablet: `EscapeDoneTablet`, `DropDoneTablet`, `LettersDoneTablet` |

`canvas.json`:
- Move `Levels`, `LevelsLetters` and `LevelsTablet` to row 6 (y 8000) and add `LevelsDrop`: x 3238 (`Levels`), 3708 (`LevelsLetters`), 4178 (`LevelsDrop`), 4648 (`LevelsTablet`), titled "Level picker for grown-ups: Brick Escape (phone)", "Level picker for grown-ups: Letter Builder (phone)", "Level picker for grown-ups: Brick Drop (phone)" and "Level picker for grown-ups (tablet)". Note `row2` gets `maxW` 4072. Note `row5` (the Settings row) reads "6. Settings, sign in, help and the level picker" with `maxW` 5482.
- Add note `row8` at x 0, y 10900, `maxW` 7832, kind `title1`: "8. Four-puzzle levels: solved, stuck and level done". Its boards sit at y 11200: the 11 phone boards at x 0, 470, 940 and on in steps of 470 to 4700; the 3 tablet boards at x 5170, 6084 and 6998. Append them to `order`, all `is_interactive: true`.

## 8. Values builders must not re-derive

Sizes of controls and layout widths are px with no token; everything else is a token.

| Item | Value |
|---|---|
| Dots | 4; 22x10px, current dot 32x10px; radius `--bw-r-pill`; gap `--bw-sp-2` (6px); `--bw-sp-1` (4px) under the title; row centred |
| Dot colours | solved `--bw-accent`; current `--brick-blue-light`; to do `--bw-well` with a 2px inset ring of `--bw-decor` |
| Next button | green raised: `--bw-green-top` to `--bw-green-bottom`, shadow `0 5px 0 var(--bw-green-edge)`; label `--bw-on-green` at `--bw-fs-btn-lg` weight 800; play icon 22px at the end; radius `--bw-r-md`; min width 220px; height of the slot it fills: 58px Escape, 62px Drop, 58px Letters |
| Offer button | same green; icon only, swap icon 26px. Escape: it takes the `.esc-tool` class, so it is 58x58 with that class's 18px radius, like Undo and Hint (no new value). Letters: 54x54, `--bw-r-md`, like Hint |
| Swap icon | 24 viewBox, `stroke="currentColor"`, stroke 2.6, round caps and joins: `M4 8h12M13 5l3 3-3 3` and `M20 16H8M11 13l-3 3 3 3` |
| Level card | scrim `--bw-scrim`; max width 330px; padding `--bw-sp-10` `--bw-sp-9` `--bw-sp-9`; radius `--bw-r-xl`; raised purple gradient; shadow `--bw-card-shadow`; title `--bw-fs-display`, `--bw-fw-display`, `--bw-lh-display`; stars 48px, gap `--bw-sp-1`, margin `--bw-sp-4` 0; fact line `--bw-fs-body` weight 700, `--bw-lh-body`; rule and cap lines `--bw-fs-label` weight 700; all text `--bw-text`; buttons stacked `--bw-sp-6` below the text, gap `--bw-sp-4`: primary green `lg` block, secondary `--bw-secondary` `md` block |
| Drop sheet when stuck | New puzzle (green), Try again (`--bw-secondary`), then "Back to games" as a text link |
| Settings game rows | 52px min height; name `--bw-fs-sub` weight 800; sub `--bw-fs-helper` weight 700, `--bw-text-2`; chevron 20px, stroke 2.8; 2px `--bw-well` divider |
| Picker | the Levels board's values; picked tile `--bw-ring`; 5 columns phone, 8 tablet |
| Motion | dot fill: an inner fill scales on x from 0 to 1, origin left, `--bw-slow` with `--bw-ease`; current-dot width: `--bw-base`, `--bw-ease`; Next and offer buttons: opacity in over 150ms; level card: opacity and scale 0.96 to 1 over `--bw-base` with `--bw-ease`, 600ms after the last dot. Nothing else moves, nothing loops, no confetti |
| Reduced motion | every item above becomes a 150ms opacity crossfade, with no width or scale change |

## 9. Copy

Child-facing lines are short, calm and literal. The one exclamation is "You finished every level!" (or "every stage"), for finishing a whole game. Use the curly apostrophe (’) in rendered copy, as `help.ts` does. Braces mark values. Brick Drop says "Stage" wherever the others say "Level"; spelling levels say "word" and "built" where the others say "puzzle" and "solved".

### 9.1 Lines

| Where | Copy |
|---|---|
| Dots, accessible name | "Puzzle 3 of 4. 2 solved." Spelling: "Word 3 of 4. 2 built." Level done: "4 of 4 solved." / "4 of 4 built." |
| Solved line | Escape "Solved in {6} moves." Drop "Cleared with {14} bricks." Train "{A} to {E}, all in order." Missing letters "Every gap is filled." Pairs "Every pair matched." First sounds "{Fish} starts with {F}." Spelling "You built {SUN}." |
| Letter Builder help, mid-train | "What comes next?" |
| Next button | "Next puzzle"; spelling "Next word" |
| Offer | Line "This one is tricky. Want a different puzzle?" (spelling: "This word is tricky. Want a different one?"). Button name "New puzzle" / "New word". Drop sheet line "This one is tricky. You can try a different puzzle." |
| After a swap | "Here is a different puzzle." / "Here is a different word." |
| Drop, first brick waiting | "Press any button to start." When the stage adds a brick: "New brick: {Zig}." |
| Drop over sheet | Title "Out of room". Line "The bricks reached the top. You cleared {2} of {6} rows." Buttons "Try again", "Back to games"; when stuck "New puzzle", "Try again" and the link "Back to games" |
| Drop intro | "Clear {6} rows in each puzzle. Solve 4 to finish the stage." and "3 stars: {4 x T3} bricks or fewer over the 4 puzzles." plus today's clock cap line when the clock counts |
| Level card title | "You finished Level {9}" / "You finished Stage {4}" |
| Level card fact | Escape "4 puzzles in {31} moves." Drop "4 puzzles with {58} bricks. Score {4820}." Letter Builder, by noun and slips: "4 puzzles, no slips." / "4 puzzles, 1 slip." / "4 puzzles, {3} slips." / "4 words, no slips." / "4 words, 1 slip." / "4 words, {3} slips." |
| Level card rule | Escape "3 stars: {sum of Best + 4} moves or fewer. 2 stars: {sum of Best + 12} or fewer." Drop "3 stars: {sum of T3} bricks or fewer. 2 stars: {sum of T2} or fewer." Letter Builder "3 stars: 1 slip or none. 2 stars: 4 slips or fewer." |
| Level card cap | Only when it applied: today's `capRule` text ("Using a hint caps the level at 2 stars.", "Running out of time caps the level at 2 stars.", or both; Drop says "stage") |
| Level card buttons | "Play Level {10}" / "Play Stage {5}" and "Back to games" |
| Game finished | "You finished every level!" (Drop: "You finished every stage!"). Escape "31 levels, {78} of 93 stars." Drop "12 stages, {30} of 36 stars." Letter Builder "24 levels, {60} of 72 stars." On the later visit (2.5) also "A grown-up can pick a level to play again." Button "Back to games" |
| Escape | Restart: "Restart puzzle". Clock caption: "{Maya}: each puzzle gets {45}s x {1.5} = {1:08}" |
| Break, mid-level | "Level {9} is saved with {2} of 4 puzzles solved." / "Stage {4} is saved with {2} of 4 puzzles solved." / "Level {17} is saved with {2} of 4 words built." |
| Home card name | "{Brick Escape}. {Slide bricks out their doors}. Level {9}, {2} of 4 puzzles solved." Drop "... Stage {4}, {2} of 4 puzzles solved." Spelling "... Level {17}, {2} of 4 words built." The puzzle part only above 0. Finished: "... All done." |
| Settings game row sub | "Level {9}, {2} of 4 puzzles" / "Stage {4}, {2} of 4 puzzles" / "Level {17}, {2} of 4 words" / no puzzles solved: "Level {1}" / "Stage {1}" / finished: "All levels done" / "All stages done" |
| Settings game row name | "{Brick Escape} for {Maya}: {sub}. Pick a level" (Drop: "Pick a stage") |
| Picker sub and intro | Sub "{Maya} · {17} of {93} stars". Intro "Pick the level {Maya} plays next. Earned stars stay." (Drop: "stage") |
| Picker status on arrival, or the current level picked | "{Maya} is on Level {9}, {2} of 4 puzzles solved." With none solved: "{Maya} is on Level {9}." Finished game: "{Maya} has finished every level." (Drop: "Stage", "every stage"; spelling: "words built") |
| Picker status after a pick | Has a run: "Level {7} picked. {Maya} goes on from puzzle {3}." (spelling: "word {3}"). Finished, no run: "Level {5} picked. {Maya} plays it again from puzzle 1." Open, never played: "Level {13} picked. {Maya} hasn’t played it yet." Locked: "Level {14} picked. {Maya} hasn’t reached it yet." Drop says "Stage" |
| Picker button and toast | "Play Level {5}" or "Set Level {5} for {Leo}"; toast "{Leo} plays Level {5} next in {Brick Escape}." Drop: "Play Stage {5}", "Set Stage {5} for {Leo}", "{Leo} plays Stage {5} next in Brick Drop." |
| Reset one game | Heading "Start {Brick Escape} over". Helper "{Maya}’s levels and stars in {Brick Escape} go back to Level 1 on this device. Stickers stay in the sticker book." (Drop: "stages", "Stage 1"). Button "Reset {Brick Escape} for {Maya}". Confirm title "Reset {Brick Escape} for {Maya}?", body "Levels and stars in {Brick Escape} go back to Level 1 on this device. Stickers stay. This can’t be undone.", buttons "Keep it" and "Reset {Brick Escape}". Toast "{Brick Escape} starts again at Level 1 for {Maya}." (Drop: "Stage 1") |
| Support | Q "How does my child replay a level?" A "In Settings, under Progress, tap the game and pick the level. Children can’t pick levels themselves." |
| Signup, Main (canvas) | 7.5 |

### 9.2 Lines that go
- Escape: "Brilliant!" and "Great job!" (`SlideGame.tsx`, the help line prefix and the win card title).
- Letter Builder: "Well done!" and "Great! What comes next?" (`Views.tsx`); the spoken "Super builder!" and "You did it!" (`LettersApp.tsx`); the level card titles "Super builder!", "Great building!", "You did it!" and "You built {n} words!".
- Brick Drop: "Stage clear!", "Master Builder!" and "You finished every stage. Amazing planning!" (`Play.tsx`, replaced by the level card and the finished card); "Nice try!" (the over sheet title, now "Out of room").

## 10. Accessibility
- **Dots:** one element with `role="img"` and the name from section 9. It is not a live region: the result is announced by each game's help line, which already is (`esc-help` is `aria-live="polite"`, `lb-help` and `drop-say` are `role="status"`).
- **Focus:** when a puzzle is solved, focus moves to Next, because the controls it replaced are gone. After Next it goes to the first brick (Escape), the board (Drop) or the first tray tile (Letters). The offer button never takes focus and sits last in its row's tab order.
- **Level card:** `role="dialog"` with `aria-modal`, labelled by its title and described by the fact line; focus starts on the primary button and stays inside. Escape or the scrim closes it, the controls slot then shows the same Play button, and focus goes there.
- **Finished state** (2.5): the same dialog with one button; focus starts on it; the Escape key and the scrim go Home, like the button, because there is nothing behind the card to return to.
- **Picker:** tiles are buttons with `aria-pressed` on the picked one, `aria-current="step"` on the child's current level (2.6), and the status line is `role="status"`.
- **Targets:** every new kid control is 54px or taller; Settings rows 52px; picker tiles about 65px.
- **Colour is never the only signal:** dots differ by fill or ring and by width; the offer has an icon and an accessible name, and the help line says it in words; stars carry "2 of 3 stars".
- **Contrast (computed):** to-do ring `#8e85d6` on the top bar ground `#33278a` 3.6:1; solved `#ffc21a` 7.2:1; current `#7cc0ff` 6.0:1. Solved and current are only 1.2:1 apart, which is why the current dot is wider. Today's Letters to-do dot (`#1a1246` on `#30257a`, 1.4:1) gives way to the ring. Level card text is white, 7.3:1 on `#5444b8`; the win cards' lilac `#c9c2ff` lines measure 4.4:1 there and fail at 14 and 16px. Stars `#ffb21f` on `#5444b8` 4.0:1.
- **Reduced motion:** section 8.
- **Speech:** nothing plays by itself, and the automatic level-end speech in Letter Builder goes (9.2). Letter Builder's speaker reads the offer line while the offer shows.

## 11. Open questions (each with a recommendation)
1. **What is one Brick Drop puzzle?** *Recommended:* a round that starts on a starter stack with brick-shaped holes (4.2), as the Drop board already shows, so each puzzle practises the stage's new brick. *Alternative:* a plain round on an empty board with its own brick order: less to build, but the rounds feel alike.
2. **The daily limit runs out in the middle of a puzzle.** *Recommended:* the child finishes that puzzle and Break opens on the next tap (2.4). This is what the app does today, since it checks the limit when the screen changes. *Alternative:* decision 3 of the missing-screens brief as written: stop at once and save the board exactly, which needs a saved mid-puzzle state in each game.
3. **After the last level.** *Recommended:* the finished state with "Back to games" and "A grown-up can pick a level to play again." (2.5). *Alternative:* a Home tap replays the last level.
4. **Which levels a grown-up can pick.** *Recommended:* any level, locked ones too; picking one opens it. With no grid for children, decision 7 (ages 9 to 10 start every chapter's first level open) changes nothing a child sees, which is why Signup's ages 9 to 10 line drops "harder levels unlocked sooner" along with the speed bonus. *Alternative:* open levels only, and keep that line.
5. **Does a per-game reset take that game's stickers?** *Recommended:* no, they stay in the book. *Alternative:* remove the stickers of that game's chapters, as the full reset does.
6. **Does taking a different puzzle cost anything?** *Recommended:* no; the puzzle left behind does not count, though a Letter Builder hint used on it stays spent (3.3). *Alternative:* it caps the level at 2 stars, like a hint.
7. **Small spelling pools.** Three tier pools hold fewer words than their spelling levels use (6 per level): ages 3 to 4 have 9 words on their second tier for 18 places; ages 7 to 8 and 9 to 10 have 14 seven-letter words (second tier) for 18 places and 8 eight-letter words (third tier) for 12. Those levels repeat a word across levels, never inside one. *Recommended:* ship with the repeats. *Alternative:* first add 17 words, each with a drawn picture: 9 three-letter words for ages 3 to 4, 4 seven-letter and 4 eight-letter words for ages 7 to 10.
8. **Journey tests.** The project has Vitest only. *Recommended:* run the main journeys as Vitest integration tests through the store and server-rendered screens, with no new framework. *Alternative:* add Playwright for real browser journeys (your testing rule asks for your OK first).
9. **How long is one Brick Drop puzzle?** With the stage's full goal rows, four puzzles allow 20 minutes on Stages 8 to 10 and 30 on Stage 12 at ages 3 to 6, past the 20-minute default limit. *Recommended:* half the goal rows, rounded up, from Stage 6 on (4.2), so no stage allows more than 16 minutes. *Alternative:* keep the full goal rows and let long stages span two days.
10. **The level card between levels.** Decision 2 says finishing goes straight into the next level; the card asks for one tap (Play Level 10) and offers Back to games. *Recommended:* keep the one-tap card: the child sees the level's stars, and an automatic timer hurries slow readers. Brick Drop adds no intro sheet after it (2.1). *Alternative:* the card moves on by itself after 4 seconds, with Back to games still on it.
11. **Letter Builder Level 1 (A to E).** A to E holds only one run of 5, so six puzzles would differ only in tray order, and a swap would not be a different puzzle. *Recommended:* runs of 4 on Level 1, alternating A to D and B to E (4.3). *Alternative:* keep A to E six times and accept that a swap only reshuffles the tray.
12. **Doors away from corners.** The standing rule says doors sit at corners, but today's engine lets advanced levels (9 and 26 to 31) put a door mid-edge, and their anchor boards already do. *Recommended:* keep the exception for those levels, so their new boards match their anchors. *Alternative:* corners only, which means redrawing seven anchors, including the Level 9 and 31 canvas boards.

## 12. Work plan

Branch `feat/four-puzzle-levels`, cut from `feat/app-from-canvas` at `8be12ac` or later. The Brick Escape drag work (`SlideGame.tsx`, `engine.ts`, `slide.css`, `drag.ts`, `drag.test.ts`) is already committed in `8be12ac` and pushed, so agent C starts from it. Agents commit and push after every item or two; one draft PR, marked ready when everything below passes; nothing merges to `main`.

**Stage A: canvas first.** One design agent (Large: design, Opus at high). Files: `design/canvas/*.dc.html` and `canvas.json` only. Guide pack as in the header. Done when every board and lever in 7.5 renders at 390x844 and 834x1194 with no clipped text and the values match section 8. The main session then shows the boards as built and asks whether you want a check.

**In parallel from approval: the Brick Escape generator run** (agent C, step 1: copy the old caches, then run). It runs 60 to 90 minutes unattended and needs nothing from the canvas.

**Gate:** Stages B and C start only after the canvas is built, you have seen it, and the check you asked for (if any) is done and its fixes are in.

**Stage B: shared contracts.** Agent B lands these before Stage C starts: the progress shapes, validation and store actions; `src/games/run.ts` (queue, swap, `STUCK` table, star totals); `currentLevel` in `src/games/meta.ts`, replacing `firstOpenLevel`; star helpers in `src/games/stars.ts`; the shared `PuzzleDots` and `LevelCard` components and the swap icon; `breakBefore(path)` in `screens/logic/session.ts`, which the games call on Next and Play.

**Stage C: games and screens in parallel**, each agent on its own files:

| Agent | Owns | Size, per your routing table |
|---|---|---|
| B Core | `src/shared/progress/*`, `src/games/meta.ts`, `src/games/stars.ts`, `src/games/run.ts`, `src/shared/ui/*`, `src/shared/storage.ts`; `breakBefore` in `session.ts` during Stage B only | Large: code (data), Opus at high |
| C Escape | `scripts/generate-slide-levels.ts`, `src/games/slide/*` | Large: code, Opus at high |
| D Drop | `src/games/drop/*`, new `starters.ts` | Large: code, Opus at high |
| E Letters | `src/games/letters/*`, including the three new pictures in `Pictures.tsx` | Medium, Sonnet or Opus at high |
| F Screens | `src/App.tsx`, `src/shared/router.ts`, `src/games/registry.ts`, `src/screens/*` (Home, Levels as the picker, Settings, Break, Help copy, `logic/levels.ts`, `logic/session.ts`, `screens.css`) | Medium, Sonnet or Opus at high |
| T Tests | every `*.test.ts`, the new `vitest.solver.config.ts` and the CI step below | Testing (Opus at xhigh), plus a second reviewer agent (large-tier code) |
| S Security | the full review of `sanitize`, the new stored fields and the picker route | Security review (Opus at xhigh) |

**Rough size per stage** (estimates, not measurements):

| Stage | Wall time | Tokens |
|---|---|---|
| A canvas (1 agent) | 2 to 3 hours | 1.5M to 3M |
| Generator run (agent C, mostly waiting) | 60 to 90 minutes | about 0.3M |
| B contracts (1 agent) | 1 to 2 hours | 0.8M to 1.5M |
| C games and screens (4 agents in parallel) | 2 to 4 hours | 1M to 2M each, 4M to 8M in all |
| T tests and the second reviewer | 2 to 4 hours, overlapping C | 2M to 3.5M |
| S security review | about 1 hour | 0.5M to 1M |
| Total | about 8 to 12 hours of work over a day or two | about 9M to 17M |

The main session checks the 5-hour and weekly limits before Stage A and before Stage C, and sizes each run to what is left.

**Tests (agent T):**
- **Run logic:** queue order; a swap moves the current puzzle to the end and leaves the dots alone; spares recycle oldest first after all 6 are seen; the fourth solve finishes the level; swapped puzzles never count; the `STUCK` table for every game and band, at the limit and one below; count signals reset only at puzzle start and on a swap, time signals also on progress; Escape's 3 times Best try counts once per try and an Undo takes a move back; the offer hides on progress and shows again only on a fresh event (3.2); time stops while hidden or behind a card.
- **Stars:** boundaries E = 4, 5, 12, 13; B at the sum of T3 and one over, at the sum of T2 and one over; S = 1, 2, 4, 5; a cap from any one of the 4; a hint on a swapped puzzle ignored for stars and still spent from Letter Builder's 3; the sand timer and Off never cap; a replay keeps the higher stars; Drop's level score is the sum of 4 and `best` keeps the highest.
- **Current level:** `currentLevel` for a new child, a frontier child, a stored pick (finished, open, locked), an out-of-range `current`, every level starred (null), and a finished game that gains a level. Home's pill, Home's card name, the Settings sub, the picker's current tile and Break's line all agree in each case.
- **Store and migration:** loading a real v2 record keeps stars, `best` and `unlocked`, with no runs; a v2 record with every level starred loads as finished; `sanitize` on broken runs (duplicate or out-of-range queue numbers, `queue` and `solved` sharing a puzzle, a puzzle missing from both, more than 3 results, `hintsLeft` of 4 or -1, negative or NaN numbers, a bad `word`, prototype keys, an oversized `set`); `current` after a finish, a replay pick, a jump pick and the last level; reset one game leaves the other games and the stickers alone; a Letter Builder band change keeps `solved` and never repeats a built word; a changed level `id` restarts that level's run and no other.
- **Brick Escape data, fast check** (in `npm test`, so it runs at every commit and every CI run): 31 levels of 6 boards; each passes `validate` and `designProblems`; stored pars sit inside the par window; the six share the anchor's signature; no two are equal under symmetry; each level's `id` matches its hash; puzzle 1 is today's board and the canvas boards keep their places. This takes a few seconds.
- **Brick Escape data, full solver check** (`npm run test:solver`, its own Vitest config over `*.solver.ts` files, one file per chapter so they run in parallel): every stored par equals the solver's best. About 90 s on this Mac and a guessed 3 to 5 minutes on a 2-core runner, so it stays out of `npm test` and the commit gate. It runs locally whenever `levels.data.ts` changes, before the PR is marked ready, and in CI as a step in the existing `checks` job only on pull requests into `claude/kids-brick-games` and on `workflow_dispatch`, with the job's `timeout-minutes` raised from 6 to 12. No new job, no schedule.
- **Brick Drop starters:** all 72 follow the stack rules, cut equal cells per stage, include a new-brick hole (Stage 7's bricks on Stages 8 and 9), and clear when each hole's brick is dropped into it; fixed seeds give the same stacks and bags; T3 and T2 with and without a stack, with the per-puzzle goal rows; the first brick waits and the clock stays still until the first press.
- **Letter Builder:** 6 puzzles per level with the same parameters and different content; Level 1 alternates its two runs; missing letters always 2 gaps; spelling words inside the band's lengths; no word twice inside a level; levels on a tier take consecutive places in the tier order and use the whole pool before repeating; a replay gets the same 6 words in a new order; no speech plays without a tap.
- **Screens and routes:** `#/game/<id>/levels`, `#/slide`, `#/drop`, `#/letters` and `#/slide/<n>` redirect in one replace; `/game/<id>/<n>` for any level other than the current one redirects; `#/settings/levels/<game>/<playerId>` parses, needs the grown-up check, is never blocked by Break, and an unknown game or player goes to Settings; Break opens at a puzzle boundary and resumes on the next unsolved puzzle; Home pills and names; Break's mid-level line; the finished state's button, Escape key and scrim all go Home.
- **Journeys** (Vitest, open question 8): a new child goes from Level 1 into Level 2; leaves mid-level and resumes; gets stuck, swaps and finishes; meets Break between puzzles and resumes after extra time; a grown-up picks Level 3, the child finishes it and returns to the frontier; a grown-up jumps to Level 20 and every screen names it; the band changes mid-level in Letter Builder; the child finishes the last level.
- Existing tests that encode the old child flow (Home opens Levels, tiles open levels, Replay, Play again, the missing-letters ramp, 3 to 6 prompts per Letter Builder level, the old praise lines, `firstOpenLevel` replaying the last level) are updated to these decisions and listed one by one in the PR body. None is deleted or skipped quietly.

**Gates:** the commit gate on every commit, never `--no-verify`; `npm test`, `npm run test:solver`, `npm run typecheck` and `npm run build` before the PR is marked ready, with the real counts reported.
