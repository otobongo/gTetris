/* Brick Calculator's play screen (brief 4.5, 7.7, 9.2): the kit's PlayScreen around the board's own
   parts. The child counts the bricks, types the answer on the keypad and presses =. The key rules live
   in entry.ts; this file keeps the typed entry in local state (one per puzzle), feeds the kit's
   progress, slip and solve, and draws the display, the ten-frames and the keypad.

   Sounds follow Letter Builder: the kit plays the slip and the solve, this file plays the tap on a digit
   or C. Speech follows the child's own move: a digit says the number now typed, a right = says the
   solved sum, a slip says nothing; the speaker reads the sum on request. */
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../shared/sound';
import { say } from '../../shared/speech';
import { PlayScreen } from '../kit/PlayScreen';
import { useLevelRun } from '../kit/useLevelRun';
import { FULL_LINE, SLIP_LINE, SPEAKER_NAME, START_LINE, solvedLine, spokenEntry, spokenSolved, spokenText } from './copy';
import { START_STATE, entryValue, helpAfter, keyboardKey, pressKey, type HelpKind, type KeyFocus, type KeyId, type KeypadState } from './entry';
import { MATH } from './game';
import { BricksPanel, Display, Keypad } from './parts';
import { frameCells } from './puzzles';
import './calc.css';

/** What the keypad holds for one puzzle on screen (one `round`). */
interface Held {
  round: number;
  keypad: KeypadState;
  help: HelpKind;
}

const fresh = (round: number): Held => ({ round, keypad: START_STATE, help: 'start' });

/** Where focus is when a key goes down: the keypad (`.calc-keys`), another button or link, or neither. */
const focusOf = (target: EventTarget | null): KeyFocus => {
  if (!(target instanceof Element)) return 'none';
  if (target.closest('.calc-keys')) return 'keypad';
  return target.closest('button, a') ? 'control' : 'none';
};

export function Play({ level }: { level: number }) {
  const run = useLevelRun(MATH, level);
  const p = run.puzzle;
  const playing = run.phase === 'play';
  const solved = !playing;
  // Keys do nothing after the solve and while a level card is open (4.5): Escape then closes the card.
  const locked = !playing || run.card !== null;

  const [held, setHeld] = useState<Held>(() => fresh(run.round));
  /** The latest state, read in handlers, so a second press in the same frame sees the first one. */
  const latest = useRef(held);
  const current = (): Held => (latest.current.round === run.round ? latest.current : fresh(run.round));
  const shown = held.round === run.round ? held : fresh(run.round);

  const press = (key: KeyId) => {
    const cur = current();
    const step = pressKey(cur.keypad, key, p.answer, locked);
    if (step.event === 'locked') return;
    latest.current = { round: run.round, keypad: step.state, help: helpAfter(cur.help, step.event) };
    setHeld(latest.current);
    // Any key press resets the time signal. It comes before slip(), since progress() hides the offer
    // and a slip may be the thing that brings it up.
    run.progress();
    switch (step.event) {
      case 'digit': {
        sfx.tap();
        const value = entryValue(step.state.entry);
        if (value !== null) say(spokenEntry(value));
        break;
      }
      case 'clear':
        sfx.tap();
        break;
      case 'right':
        run.solve();
        say(spokenSolved(p));
        break;
      case 'wrong':
        // A repeated wrong answer feeds the stuck count but adds no star slip (3.1).
        run.slip(String(step.sent));
        break;
    }
  };

  // The physical keyboard: digits, Enter for = (also with a keypad key focused), Backspace or Escape for C;
  // Space still presses a focused key for tab users, since the browser keeps it. The handler is registered
  // once and reads the latest press and lock, so it never acts on an old puzzle.
  const live = useRef({ press, locked });
  live.current = { press, locked };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      // Enter on a keypad key is =; on another focused button or link it presses that control.
      const key = keyboardKey(e, focusOf(e.target));
      if (key === null || live.current.locked) return;
      // preventDefault also stops Enter clicking the focused keypad key.
      e.preventDefault();
      live.current.press(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const line = solved ? solvedLine(p) : shown.help === 'slip' ? SLIP_LINE : shown.help === 'full' ? FULL_LINE : START_LINE;

  return (
    <PlayScreen
      run={run}
      className="calc-screen"
      slotClassName="calc-controls"
      speaker={{ label: SPEAKER_NAME, text: () => spokenText(p, solved) }}
      line={line}
      lineStyle="help"
      top={<Display puzzle={p} entry={shown.keypad.entry} solved={solved} />}
      controls={<Keypad onPress={press} />}
    >
      <BricksPanel puzzle={p} cells={frameCells(p)} solved={solved} />
    </PlayScreen>
  );
}
