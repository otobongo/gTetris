import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_PLAYER_NAME,
  HINTS_PER_RUN,
  findPlayer,
  gameOf,
  progressStore,
  runOf,
  starsFor,
  totalStars,
  useActivePlayer,
  type AgeBand,
  type LevelRun,
  type Player,
  type PuzzleOutcome,
  type PuzzleResult,
  type PuzzleRules,
} from '../../shared/progress';
import { resolveRun } from '../../shared/progress/model';
import { go, replace, toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { letterName, say } from '../../shared/speech';
import { Brick, IconButton, LEVEL_CARD_DELAY_MS, LevelCard, PressButton, PuzzleDots, Screen, useLayout } from '../../shared/ui';
import { breakBefore } from '../../screens/logic/session';
import { currentLevel } from '../meta';
import { STUCK, STUCK_START, lettersLevelStars, lettersSet, levelTotals, puzzleOnScreen, rotateQueue, stuckStep, type StuckEvent } from '../run';
import { capRule } from '../stars';
import {
  BACK_TO_GAMES,
  GAME_DONE_NOTE,
  GAME_DONE_TITLE,
  gameDoneFact,
  levelFact,
  levelTitle,
  nextLabel,
  offerLine,
  offerName,
  playLabel,
  swapLine,
} from './copy';
import { LEVELS, isSpelling, makePuzzles, type Prompt } from './levels';
import { LEVEL_RULE } from './logic';
import { meta } from './meta';
import { innerWidth } from './sizing';
import { FillView, MatchView, SoundView } from './Views';
import './letters.css';

const GAME = 'letters';
const HOME = '/';
const levelPath = (level: number) => `/game/letters/${level + 1}`;

/**
 * Letter Builder. `#/game/letters` opens the child's current level (games/meta.ts currentLevel), or
 * the finished state when every level has stars. `#/game/letters/<n>` plays only the current level;
 * any other n goes back to `#/game/letters`. Children never see a level grid (brief 2.1, 7.4).
 */
export default function LettersApp({ params }: { params: string[] }) {
  const player = useActivePlayer();
  const current = currentLevel(meta, gameOf(player, GAME));
  const key = params.join('/');
  const n = params.length ? Number(params[0]) : NaN;
  const asked = Number.isInteger(n) && n >= 1 && n <= LEVELS.length ? n - 1 : -1;
  // Which level may play is decided when the route changes, never while a level is on screen: its
  // fourth solve moves `current` on, and the level card must stay up over the finished level.
  const [entry, setEntry] = useState(() => ({ key, ok: asked >= 0 && asked === current }));
  let ok = entry.ok;
  if (entry.key !== key) {
    ok = asked >= 0 && asked === current;
    setEntry({ key, ok });
  }
  const target = !params.length ? (current === null ? null : levelPath(current)) : ok ? null : '/game/letters';

  useEffect(() => {
    if (target) replace(target);
  }, [target]);

  if (target) return null;
  if (!params.length) return <Finished player={player} />;
  return <Play key={asked} level={asked} player={player} />;
}

/** Avatar and name, as on the board. Puzzle progress lives in the dots under the title. */
function PlayerStrip({ player }: { player: Player | null }) {
  const name = player?.name ?? DEFAULT_PLAYER_NAME;
  return (
    <div className="lb-player">
      <Brick color={player?.color ?? 'blue'} width={34} height={34} radius={12} style={{ fontSize: 18 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Brick>
      <span className="lb-player__name">{name}</span>
    </div>
  );
}

/**
 * The game's top bar: back to Home, the title, then the dots in place of the subtitle (brief 7.1).
 * The shared TopBar puts its subtitle in a paragraph, which cannot hold the dots' block.
 */
function GameBar({ title, dots, action }: { title: string; dots?: ReactNode; action?: ReactNode }) {
  return (
    <header className="bw-topbar">
      <IconButton icon="back" label="Back to home" href={toHref(HOME)} />
      <div className="bw-topbar__title">
        <h1>{title}</h1>
        {dots}
      </div>
      {action ?? <span aria-hidden="true" />}
    </header>
  );
}

/** What to show and say for each puzzle. Speech is read aloud only when the child taps a speaker or a picture. */
function promptText(p: Prompt): { text: string; speech: string } {
  switch (p.kind) {
    case 'train': {
      const a = p.cells[0];
      const b = p.cells[p.cells.length - 1];
      return { text: `Tap ${a} to ${b} in order.`, speech: `Tap the letters in order, from ${letterName(a)} to ${letterName(b)}.` };
    }
    case 'missing':
      return { text: 'Find the missing letters.', speech: 'Which letters are missing? Fill the gaps.' };
    case 'match':
      return { text: 'Match big and small letters.', speech: 'Match each big letter with its small letter.' };
    case 'sound':
      return { text: 'What does it start with?', speech: `${p.word.word}. What letter does ${p.word.word} start with?` };
    case 'spell':
      return { text: 'Tap the letters to build the word.', speech: p.word!.word };
  }
}

/** A fresh run seed: it fixes the level's runs, letters, pictures, word order and trays. */
const newSeed = () => (Math.random() * 2 ** 31) | 0;

/** Where the puzzle on screen stands. */
type Moment = 'play' | 'solved' | 'levelDone';

type Finish = Extract<PuzzleOutcome, { kind: 'finished' }>;

function Play({ level, player }: { level: number; player: Player | null }) {
  const layout = useLayout();
  // The band at the level's start: a band changed later applies from the next visit (2.3).
  const [band] = useState<AgeBand>(() => player?.ageBand ?? '5-6');
  const spelling = isSpelling(level);
  const set = lettersSet(band);
  const [run, setRun] = useState<LevelRun>(() => {
    const stored = runOf(player, GAME, level);
    // keepSolved: a band change keeps the solved puzzles and refills the rest with the new band's words.
    return resolveRun(stored, { set, seed: stored?.seed ?? newSeed(), hintsLeft: HINTS_PER_RUN, keepSolved: true }, progressStore.now());
  });
  // Words already built when the level opened, so the puzzles never repeat one after a band change.
  const [built] = useState(() => run.solved.map((r) => ({ puzzle: r.puzzle, word: r.word })));
  const puzzles = useMemo(() => makePuzzles(level, run.seed, band, built, player?.id ?? ''), [level, run.seed, band, built, player?.id]);

  const [moment, setMoment] = useState<Moment>('play');
  const [finish, setFinish] = useState<Finish | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  /** Remounts the puzzle view on Next and on a swap. */
  const [nonce, setNonce] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [hintsLeft, setHintsLeft] = useState(run.hintsLeft ?? HINTS_PER_RUN);
  const [stuck, setStuck] = useState(STUCK_START);
  const slipsRef = useRef(0);
  const usedHintRef = useRef(false);
  const hintRef = useRef<(() => boolean) | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  /** Where focus goes after the next render: the tray's first tile (after Next or a swap) or the slot's button. */
  const focusNext = useRef<'tray' | 'slot' | null>(null);
  const timer = useRef<number>(0);

  const limit = STUCK.letters[band];
  /** The puzzle on screen. It stays put after a solve, while the run's queue already points at the next one. */
  const [puzzle, setPuzzle] = useState(() => puzzleOnScreen(run));
  const prompt = puzzles[puzzle];
  const { text, speech } = promptText(prompt);
  const playing = moment === 'play';
  const offer = playing && stuck.offer;
  const levelCount = LEVELS.length;
  const playerId = () => player?.id ?? progressStore.ensureActivePlayer();
  const stuckOn = (e: StuckEvent) => setStuck((s) => stuckStep(s, e, limit));

  // Save the run when the level opens (new, or moved to the new band's set). Nothing else is saved mid-puzzle.
  useEffect(() => {
    if (player) progressStore.startRun(GAME, level, { set, seed: run.seed, hintsLeft: HINTS_PER_RUN, keepSolved: true }, player.id);
    // Once, when the level opens.
  }, []);

  // The time signal: seconds with no right tap, only while the puzzle is on screen, the page is visible and no card is open (3.1).
  useEffect(() => {
    if (!playing || cardOpen || limit.seconds === null) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      stuckOn({ type: 'tick', seconds: 1 });
    }, 1000);
    return () => window.clearInterval(id);
    // stuckOn only reads `limit`, which is fixed for the level.
  }, [playing, cardOpen, limit.seconds]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const to = focusNext.current;
    if (!to) return;
    focusNext.current = null;
    const el = to === 'slot' ? slotRef.current?.querySelector<HTMLElement>('a, button') : bodyRef.current?.querySelector<HTMLElement>('.lb-tray button');
    el?.focus();
  });

  /** Back to a puzzle's first position: its slips, hint and stuck counts start again. */
  const freshPuzzle = (event: 'start' | 'swap', from: LevelRun) => {
    setPuzzle(puzzleOnScreen(from));
    slipsRef.current = 0;
    usedHintRef.current = false;
    stuckOn({ type: event });
    setSwapped(event === 'swap');
    setNonce((x) => x + 1);
    setMoment('play');
    focusNext.current = 'tray';
  };

  const rules: PuzzleRules = { set, seed: run.seed, hintsLeft: HINTS_PER_RUN, keepSolved: true, levelCount, stars: lettersLevelStars };

  const solved = () => {
    const result: PuzzleResult = { puzzle, count: slipsRef.current, usedHint: usedHintRef.current, outOfTime: false };
    if (prompt.kind === 'spell' && prompt.word) result.word = prompt.word.word;
    let outcome = progressStore.recordPuzzle(GAME, level, result, rules, playerId());
    if (outcome.kind === 'ignored') {
      // The store refused the result (never expected): keep playing on this screen, so a solve is never lost to the child.
      const results = [...run.solved, result];
      outcome =
        results.length >= 4
          ? { kind: 'finished', level, stars: lettersLevelStars(results), results, next: level + 1 < levelCount ? level + 1 : null }
          : { kind: 'saved', run: { ...run, queue: run.queue.filter((x) => x !== puzzle), solved: results } };
    }
    if (outcome.kind === 'saved') {
      setRun(outcome.run);
      setMoment('solved');
      focusNext.current = 'slot';
      return;
    }
    if (outcome.kind !== 'finished') return;
    setFinish(outcome);
    setMoment('levelDone');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      sfx.win();
      setCardOpen(true);
    }, LEVEL_CARD_DELAY_MS);
  };

  const next = () => {
    if (breakBefore(levelPath(level))) return;
    freshPuzzle('start', run);
  };

  const swap = () => {
    const saved = (player ? progressStore.swapPuzzle(GAME, level, player.id) : null) ?? { ...run, queue: rotateQueue(run.queue) };
    setRun(saved);
    freshPuzzle('swap', saved);
  };

  const askHint = () => {
    if (hintsLeft <= 0 || !playing) return;
    if (!hintRef.current?.()) return;
    // The level's 3 hints are a budget, saved at once: a hint used on a puzzle swapped away stays spent (3.3).
    const left = player ? progressStore.spendHint(GAME, level, player.id) : null;
    setHintsLeft(left ?? Math.max(0, hintsLeft - 1));
    usedHintRef.current = true;
  };

  const playNextLevel = (to: number) => {
    if (breakBefore(levelPath(to))) return;
    go(levelPath(to));
  };

  const closeCard = () => {
    setCardOpen(false);
    if (finish?.next === null) {
      go(HOME);
      return;
    }
    // The tray well then holds the same Play button, and focus goes there (brief 10).
    focusNext.current = 'slot';
  };

  const hint = (
    <IconButton icon="hint" label="Hint" badge={hintsLeft} disabled={hintsLeft <= 0 || !playing} onClick={askHint} variant="yellow" />
  );

  let slot: ReactNode = null;
  if (moment === 'solved') {
    slot = (
      <PressButton variant="green" size="lg" icon="play" iconEnd className="lb-next bw-appear" onClick={next}>
        {nextLabel(spelling)}
      </PressButton>
    );
  } else if (moment === 'levelDone' && finish && !cardOpen) {
    slot =
      finish.next === null ? (
        <PressButton variant="green" size="lg" className="lb-next bw-appear" href={toHref(HOME)}>
          {BACK_TO_GAMES}
        </PressButton>
      ) : (
        <PressButton variant="green" size="lg" icon="play" iconEnd className="lb-next bw-appear" onClick={() => playNextLevel(finish.next!)}>
          {playLabel(finish.next + 1)}
        </PressButton>
      );
  } else if (moment === 'levelDone') {
    // Behind the card the well stays as it was at the last solve, with no controls.
    slot = <span className="lb-next-space" aria-hidden="true" />;
  }

  const viewProps = {
    active: playing,
    onSlip: () => {
      slipsRef.current += 1;
      setSwapped(false);
      stuckOn({ type: 'fail' });
    },
    onProgress: () => {
      setSwapped(false);
      stuckOn({ type: 'progress' });
    },
    onDone: solved,
    hintRef,
    hint,
    innerW: innerWidth(layout.mode, layout.width),
    instruction: swapped ? swapLine(spelling) : text,
    helpOverride: offer ? offerLine(spelling) : null,
    offer: offer ? <IconButton icon="swap" label={offerName(spelling)} variant="green" className="bw-appear" onClick={swap} /> : null,
    slot: slot ? <div ref={slotRef} className="lb-slot-wrap">{slot}</div> : undefined,
  };

  const solvedNow = moment !== 'play';
  const doneCount = moment === 'levelDone' ? 4 : run.solved.length;
  const dots = <PuzzleDots solved={doneCount} puzzle={solvedNow ? Math.max(1, doneCount) : undefined} noun={spelling ? 'word' : 'puzzle'} />;

  const card = (() => {
    if (!cardOpen || !finish) return null;
    if (finish.next === null) {
      const total = totalStars(findPlayer(progressStore.getState(), player?.id ?? progressStore.getState().activePlayerId ?? ''), GAME);
      return (
        <LevelCard
          title={GAME_DONE_TITLE}
          stars={finish.stars}
          fact={gameDoneFact(levelCount, total)}
          primary={{ label: BACK_TO_GAMES, href: toHref(HOME) }}
          onClose={closeCard}
        />
      );
    }
    const totals = levelTotals(finish.results);
    return (
      <LevelCard
        title={levelTitle(level + 1)}
        stars={finish.stars}
        fact={levelFact(spelling, totals.count)}
        rule={LEVEL_RULE}
        cap={totals.usedHint ? capRule({ hint: true }) : undefined}
        primary={{ label: playLabel(finish.next + 1), onClick: () => playNextLevel(finish.next!) }}
        secondary={{ label: BACK_TO_GAMES, href: toHref(HOME) }}
        onClose={closeCard}
      />
    );
  })();

  return (
    <Screen className="lb-screen" gap={14}>
      <GameBar
        title={`Level ${level + 1}`}
        dots={dots}
        action={
          offer ? (
            // While the offer shows, the speaker reads the offer line (brief 10).
            <IconButton icon="speaker" label="Read the help line aloud" onClick={() => say(offerLine(spelling))} />
          ) : (
            <IconButton icon="speaker" label={spelling ? 'Say the word' : 'Hear it again'} onClick={() => say(speech)} />
          )
        }
      />
      <PlayerStrip player={player} />
      <div className="lb-body" key={`${puzzle}:${nonce}`} ref={bodyRef}>
        {prompt.kind === 'match' ? (
          <MatchView prompt={prompt} {...viewProps} />
        ) : prompt.kind === 'sound' ? (
          <SoundView prompt={prompt} {...viewProps} />
        ) : (
          <FillView prompt={prompt} {...viewProps} />
        )}
      </div>
      {card}
    </Screen>
  );
}

/**
 * The finished state (brief 2.5): every level has stars. The top bar names the game, the empty tray
 * well sits behind the scrim, and the card's one button, the Escape key and the scrim all go Home.
 */
function Finished({ player }: { player: Player | null }) {
  const last = LEVELS.length - 1;
  return (
    <Screen className="lb-screen" gap={14}>
      <GameBar title="Letter Builder" />
      <div className="lb-body lb-body--finished">
        <div className="lb-view">
          <div className="lb-top" />
          <div className="lb-well lb-well--empty" aria-hidden="true" />
        </div>
      </div>
      <LevelCard
        title={GAME_DONE_TITLE}
        stars={starsFor(player, GAME, last)}
        fact={gameDoneFact(LEVELS.length, totalStars(player, GAME))}
        note={GAME_DONE_NOTE}
        primary={{ label: BACK_TO_GAMES, href: toHref(HOME) }}
        onClose={() => go(HOME)}
      />
    </Screen>
  );
}
