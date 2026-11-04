/**
 * Brief 2.6 and 12, "Current level": one rule names the level on every screen. For each case the brief lists
 * (a new child, a frontier child, a stored pick of a finished, an open and a locked level, an out-of-range
 * `current`, every level starred, and a finished game that gains a level), Home's pill and card name, the
 * Settings row, the picker's current tile and arrival line, Break's line and the `#/game/<id>` route all
 * name the same level as currentLevel, in all three games, with no puzzle solved and with one.
 */
import { describe, expect, it } from 'vitest';
import { currentLevel } from '../../games/meta';
import { dropLevelStars, escapeLevelStars, lettersLevelStars } from '../../games/run';
import { getGame, type GameEntry } from '../../games/registry';
import { createProgressStore, type KeyValueStorage, type Player, type PuzzleRules } from '../../shared/progress';
import { breakSavedLine, homeCardName, homePill, pickerCopy, planLevels, settingsRowSub, tileLabel } from './levels';
import { gamePath } from './routes';

const NOON = new Date(2026, 10, 5, 12, 0).getTime();

const STARS: Record<string, PuzzleRules['stars']> = { escape: escapeLevelStars, drop: dropLevelStars, letters: lettersLevelStars };

/** The same game with one more level at the end of its last chapter (new Master levels, say). */
function withOneMoreLevel(game: GameEntry): GameEntry {
  const meta = game.meta!;
  const chapters = meta.chapters.map((c, i) => (i === meta.chapters.length - 1 ? { ...c, count: c.count + 1 } : c));
  return { ...game, meta: { levelCount: meta.levelCount + 1, chapters } };
}

interface Case {
  name: string;
  /** Build the child's progress in `game` and return the level currentLevel should give (null: every level done). */
  build: (s: Setup, count: number) => number | null;
  /** Play against a copy of the game with one more level. */
  grown?: boolean;
}

interface Setup {
  star: (from: number, to: number) => void;
  pick: (level: number) => void;
  /** Patch the stored current directly, as a broken or old record would hold it. */
  rawCurrent: (value: number) => void;
}

const FRONTIER = 5;

const CASES: Case[] = [
  { name: 'a new child', build: () => 0 },
  { name: 'a frontier child', build: (s) => (s.star(0, FRONTIER), FRONTIER) },
  { name: 'a stored pick of a finished level (replay)', build: (s) => (s.star(0, FRONTIER), s.pick(1), 1) },
  {
    name: 'a stored pick of an open level past the frontier',
    // FRONTIER has no stars but FRONTIER + 1 has, so FRONTIER + 2 is open without being the frontier.
    build: (s) => (s.star(0, FRONTIER), s.star(FRONTIER + 1, FRONTIER + 2), s.pick(FRONTIER + 2), FRONTIER + 2),
  },
  { name: 'a stored pick of a locked level', build: (s, count) => (s.star(0, FRONTIER), s.pick(count - 1), count - 1) },
  { name: 'an out-of-range current', build: (s, count) => (s.star(0, FRONTIER), s.rawCurrent(count + 4), FRONTIER) },
  { name: 'every level starred', build: (s, count) => (s.star(0, count), null) },
  { name: 'a finished game that gains a level', grown: true, build: (s, count) => (s.star(0, count - 1), count - 1) },
];

function childIn(game: GameEntry, c: Case, solved: 0 | 1): { game: GameEntry; player: Player; expected: number | null } {
  const played = c.grown ? withOneMoreLevel(game) : game;
  const count = played.meta!.levelCount;
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  const store = createProgressStore({ storage, now: () => NOON, newId: () => 'maya', events: null });
  const id = store.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' }).id;
  store.setActivePlayer(id);
  let raw: number | null = null;
  const setup: Setup = {
    star: (from, to) => {
      for (let i = from; i < to; i++) store.recordStars(game.id, i, 2);
    },
    pick: (level) => store.pickLevel(game.id, level, count),
    rawCurrent: (value) => {
      raw = value;
    },
  };
  const expected = c.build(setup, count);
  if (solved && expected !== null) {
    const rules: PuzzleRules = { set: `${game.id}:t`, seed: 1, levelCount: count, stars: STARS[game.id], hintsLeft: game.id === 'letters' ? 3 : undefined };
    store.startRun(game.id, expected, rules);
    store.recordPuzzle(game.id, expected, { puzzle: 0, count: 1, par: 1, three: 9, two: 12, usedHint: false, outOfTime: false }, rules);
  }
  let player = store.getState().players[0];
  if (raw !== null) player = { ...player, games: { ...player.games, [game.id]: { ...player.games[game.id], current: raw } } };
  return { game: played, player, expected };
}

const GAMES = ['escape', 'drop', 'letters'].map((id) => getGame(id)!);

describe.each(GAMES)('$title: every screen names the one current level', (base) => {
  for (const c of CASES) {
    for (const solved of [0, 1] as const) {
      it(`${c.name}, ${solved ? 'one puzzle solved' : 'nothing solved yet'}`, () => {
        const { game, player, expected } = childIn(base, c, solved);
        const meta = game.meta!;
        const progress = player.games[game.id] ?? { unlocked: 0, stars: {}, best: {} };
        const noun = game.noun;
        const lower = noun.toLowerCase();
        expect(currentLevel(meta, progress)).toBe(expected);

        const plan = planLevels(meta, progress, player.ageBand);
        const currentTiles = plan.chapters.flatMap((ch) => ch.tiles).filter((t) => t.state === 'current');
        const picker = pickerCopy(game, player, true);

        if (expected === null) {
          expect(homePill(meta, progress, player.ageBand, noun)).toBe('All done');
          expect(homeCardName(game, player)).toMatch(/ All done\.$/);
          expect(settingsRowSub(game, player)).toBe(`All ${lower}s done`);
          expect(plan.current).toBeNull();
          expect(currentTiles).toEqual([]);
          expect(picker.status(null)).toBe(`Maya has finished every ${lower}.`);
          expect(breakSavedLine(game, player)).toBeNull();
          expect(gamePath(game.id, player)).toBe(`/game/${game.id}`);
          return;
        }

        const n = expected + 1;
        const unit = game.unit(expected);
        const solvedWords = unit === 'word' ? '1 of 4 words built' : '1 of 4 puzzles solved';
        expect(homePill(meta, progress, player.ageBand, noun)).toBe(`${noun} ${n}`);
        expect(homeCardName(game, player)).toBe(`${game.title}. ${game.sub}. ${noun} ${n}${solved ? `, ${solvedWords}` : ''}.`);
        expect(settingsRowSub(game, player)).toBe(solved ? `${noun} ${n}, 1 of 4 ${unit}s` : `${noun} ${n}`);
        expect(plan.current).toBe(expected);
        expect(currentTiles.map((t) => t.index)).toEqual([expected]);
        expect(tileLabel(currentTiles[0], noun, 'Maya')).toBe(`${noun} ${n}, Maya’s current ${lower}`);
        expect(picker.status(null)).toBe(`Maya is on ${noun} ${n}${solved ? `, ${solvedWords}` : ''}.`);
        expect(picker.status(expected)).toBe(picker.status(null));
        expect(breakSavedLine(game, player)).toBe(solved ? `${noun} ${n} is saved with ${solvedWords}.` : null);
        // The route reads the registry's own level count, so the grown copy has no route of its own.
        if (!c.grown) expect(gamePath(game.id, player)).toBe(`/game/${game.id}/${n}`);
      });
    }
  }
});
