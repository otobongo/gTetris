/**
 * The thin hook over the level reducer (six-games brief 3.1): it saves through the progress store
 * (startRun, recordPuzzle, swapPuzzle, spendHint), checks the daily limit with breakBefore on Next,
 * Play Level and New puzzle, runs the 1 s tick only while the reducer says time counts, opens the
 * level card LEVEL_CARD_DELAY_MS after the fourth solve, and plays the kit's two sounds (a slip, a
 * solve). Everything it decides lives in levelRun.ts; this file only wires it to React and the store.
 *
 * When the store has no player to save to, its answers come back empty ('ignored', null) and the
 * reducer carries the level on in memory, as the built games do.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  activePlayer,
  findPlayer,
  progressStore,
  runOf,
  totalStars,
  type ProgressStore,
  type PuzzleRules,
} from '../../shared/progress';
import { go as routerGo, toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { LEVEL_CARD_DELAY_MS, type LevelCardProps } from '../../shared/ui/LevelCard';
import { breakBefore } from '../../screens/logic/session';
import { levelStars, levelTotals } from '../run';
import {
  BACK_TO_GAMES,
  GAME_DONE_TITLE,
  HINT_CAP,
  LEVEL_RULE,
  gameDoneFact,
  levelDoneTitle,
  playLabel,
  slipFact,
} from './copy';
import {
  bandInit,
  dotsOf,
  initLevelRun,
  isTicking,
  levelRunReducer,
  offerShows,
  randomSeed,
  runInit,
  sharedLine,
  slotOf,
  solveResult,
  type BandChange,
  type KitGame,
  type LevelRunAction,
  type LevelRunApi,
  type LevelRunState,
} from './levelRun';
import { levelPath } from './route';

export type { KitGame, LevelRunApi } from './levelRun';

/** One tick of the time signal. */
export const TICK_MS = 1000;
const HOME = '/';

/** Everything the hook reaches outside itself, so tests can pass their own. All optional. */
export interface UseLevelRunOptions {
  /** Defaults to the app's progressStore. */
  store?: ProgressStore;
  /** A new run seed (run-seeded games only). */
  newSeed?: () => number;
  /** The daily-limit check; true when Break took over. Defaults to session.breakBefore on `store`. */
  breakBefore?: (path: string) => boolean;
  /** Navigation for Play Level and the finished card. Defaults to the router's go. */
  go?: (path: string) => void;
}

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/** Plays one level of a kit game. The game's Play screen calls it once; GameApp mounts a new Play per level. */
export function useLevelRun<P>(game: KitGame<P>, level: number, options: UseLevelRunOptions = {}): LevelRunApi<P> {
  const store = options.store ?? progressStore;
  const progress = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  const [state, setState] = useState<LevelRunState>(() => {
    const player = activePlayer(store.getState());
    return initLevelRun({
      game,
      level,
      band: player?.ageBand ?? '5-6',
      stored: runOf(player, game.id, level),
      now: store.now(),
      newSeed: options.newSeed ?? randomSeed,
      visible: pageVisible(),
    });
  });
  /** The latest state, read synchronously, so a second tap in the same frame sees the first one's effect. */
  const ref = useRef(state);
  /** The player this level saves to, set once it opens. */
  const pid = useRef<string | null>(null);

  // One set of actions for the life of the level: they read `ref`, never a stale render.
  const actions = useMemo(() => {
    const dispatch = (a: LevelRunAction) => {
      const next = levelRunReducer(ref.current, a);
      if (next === ref.current) return;
      ref.current = next;
      setState(next);
    };
    const go = options.go ?? routerGo;
    const brk =
      options.breakBefore ?? ((path: string) => breakBefore(path, { player: activePlayer(store.getState()), now: store.now(), go: options.go }));
    const playerId = () => pid.current ?? store.getState().activePlayerId ?? '';
    const hasPlayer = () => findPlayer(store.getState(), playerId()) !== null;
    const here = levelPath(game.id, level);
    const playing = () => ref.current.phase === 'play' && !ref.current.leaving;

    /** A band changed in Settings (or another tab) since the puzzle started: it applies at this boundary (D2). */
    const bandChange = (): BandChange | undefined => {
      const live = findPlayer(store.getState(), playerId())?.ageBand ?? null;
      const init = bandInit(ref.current, live);
      if (!init || !live) return undefined;
      return { band: live, run: hasPlayer() ? store.startRun(game.id, level, init, playerId()) : null, now: store.now() };
    };

    const leaveTo = (next: number | null) => {
      if (next === null) {
        dispatch({ type: 'leave' });
        go(HOME);
        return;
      }
      const to = levelPath(game.id, next);
      if (brk(to)) return;
      dispatch({ type: 'leave' });
      go(to);
    };

    return {
      dispatch,
      open() {
        // Save the run this level continues from (new, or moved to a new set), for the active player.
        pid.current = store.ensureActivePlayer();
        const s = ref.current;
        dispatch({ type: 'stored', run: store.startRun(game.id, level, runInit(s.cfg, s.band, s.run.seed), pid.current) });
      },
      slip(key?: string) {
        if (!playing()) return;
        sfx.wrong();
        dispatch(key === undefined ? { type: 'slip' } : { type: 'slip', key });
      },
      progress: () => dispatch({ type: 'progress' }),
      hold: (on: boolean) => dispatch({ type: 'hold', on }),
      solve() {
        if (!playing()) return;
        const s = ref.current;
        const rules: PuzzleRules = { ...runInit(s.cfg, s.band, s.run.seed), levelCount: s.cfg.levelCount, stars: (r) => levelStars(s.cfg.game, r) };
        const outcome = store.recordPuzzle(game.id, level, solveResult(s), rules, playerId());
        sfx.win();
        dispatch({ type: 'solve', outcome });
      },
      swap() {
        // New puzzle is the stuck offer's button: only while it shows, so a double tap swaps (and saves) once.
        if (!offerShows(ref.current)) return;
        // The daily limit first, as at every puzzle boundary; the swap waits until after Break.
        if (brk(here)) return;
        const saved = hasPlayer() ? store.swapPuzzle(game.id, level, playerId()) : null;
        dispatch({ type: 'swap', run: saved, band: bandChange() });
      },
      next() {
        const s = ref.current;
        if (s.leaving) return;
        if (s.phase === 'solved') {
          if (brk(here)) return;
          dispatch({ type: 'next', band: bandChange() });
          return;
        }
        // Play Level N on the level card, or in the controls slot once the card is closed
        if (s.phase === 'done' && s.finish && s.card !== 'waiting') leaveTo(s.finish.next);
      },
      useHint() {
        const s = ref.current;
        if (!s.cfg.hints || !playing() || s.hintsLeft <= 0) return;
        // The budget is saved at once: a hint used on a puzzle swapped away stays spent (four-puzzle 3.3).
        const left = hasPlayer() ? store.spendHint(game.id, level, playerId()) : null;
        dispatch({ type: 'hint', left });
      },
      closeCard() {
        const s = ref.current;
        if (s.finish?.next === null) {
          dispatch({ type: 'leave' });
          go(HOME);
          return;
        }
        dispatch({ type: 'card', to: 'closed' });
      },
      total: () => totalStars(findPlayer(store.getState(), playerId()), game.id),
    };
    // Fixed for the level: GameApp mounts a new Play (and so a new hook) for every level.
  }, []);

  useEffect(() => {
    actions.open();
  }, [actions]);

  // The time signal: 1 s ticks while the puzzle is in play, the page is visible, no card is open and nothing holds it.
  const ticking = isTicking(state);
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => {
      if (!pageVisible()) return;
      actions.dispatch({ type: 'tick', seconds: TICK_MS / 1000 });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [ticking, actions]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => actions.dispatch({ type: 'visible', on: pageVisible() });
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [actions]);

  // The level card opens LEVEL_CARD_DELAY_MS after the fourth solve.
  useEffect(() => {
    if (state.card !== 'waiting') return;
    const id = window.setTimeout(() => actions.dispatch({ type: 'card', to: 'open' }), LEVEL_CARD_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [state.card, actions]);

  const { cfg, puzzleNo, band, run } = state;
  const puzzle = useMemo(() => game.puzzle(level, puzzleNo, { seed: run.seed, band }), [game, level, puzzleNo, run.seed, band]);

  const card = useMemo((): LevelCardProps | null => {
    const finish = state.finish;
    if (state.card !== 'open' || !finish) return null;
    if (finish.next === null) {
      return {
        title: GAME_DONE_TITLE,
        stars: finish.stars,
        fact: gameDoneFact(cfg.levelCount, actions.total()),
        primary: { label: BACK_TO_GAMES, href: toHref(HOME) },
        onClose: actions.closeCard,
      };
    }
    const totals = levelTotals(finish.results);
    return {
      title: levelDoneTitle(level + 1),
      stars: finish.stars,
      fact: slipFact(totals.count),
      rule: LEVEL_RULE,
      cap: cfg.hints && totals.usedHint ? HINT_CAP : undefined,
      primary: { label: playLabel(finish.next + 1), onClick: actions.next },
      secondary: { label: BACK_TO_GAMES, href: toHref(HOME) },
      onClose: actions.closeCard,
    };
    // progress: the star total is read from the store when the card opens
  }, [state.card, state.finish, cfg, level, actions, progress]);

  return {
    phase: state.phase,
    level,
    puzzleNo,
    puzzle,
    band,
    dots: dotsOf(state),
    offer: offerShows(state),
    shared: sharedLine(state),
    slip: actions.slip,
    progress: actions.progress,
    hold: actions.hold,
    solve: actions.solve,
    swap: actions.swap,
    next: actions.next,
    hint: cfg.hints ? { left: state.hintsLeft, use: actions.useHint } : null,
    card,
    round: state.round,
    finish: state.finish,
    slot: slotOf(state),
  };
}
