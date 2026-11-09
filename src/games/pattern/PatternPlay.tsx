/* Pattern Train's Play screen (six-games brief 4.4, 7.6, 8.5, 9): the kit's PlayScreen around the board's own parts.
   The child taps one of three cars to fill the empty car. The tap rules and lines live in play.ts; this file keeps
   which puzzle had a wrong tap and the train that is leaving, and feeds the kit's slip and solve. Sounds: the kit
   plays the slip (sfx.wrong) and the solve (sfx.win); a pick here is always one of the two, so nothing else plays.
   Speech only follows the speaker button. */
import { useState } from 'react';
import { ChoiceRow } from '../kit/ChoiceRow';
import { PlayScreen } from '../kit/PlayScreen';
import { useLevelRun } from '../kit/useLevelRun';
import type { Car } from './cars';
import { PROMPT, PROMPT_SOLVED, SPEAKER_NAME, TRAY_LABEL, choiceName, trainName } from './copy';
import { GAME } from './game';
import { helpLine, judge, spokenFor, trainSlots, type TrainSlot } from './play';
import { Shape, Train } from './Train';
import './pattern.css';

/** The train that was on screen when Next was tapped, kept for the one puzzle that follows. */
interface Leaving {
  round: number;
  slots: TrainSlot[];
}

export function PatternPlay({ level }: { level: number }) {
  const run = useLevelRun(GAME, level);
  const p = run.puzzle;
  const solved = run.phase !== 'play';

  /** The puzzle (round) that had a wrong tap: the wrong line shows for that puzzle only, so a new puzzle starts clean. */
  const [wrongRound, setWrongRound] = useState<number | null>(null);

  // On Next the old train slides out; on a swap or anywhere else nothing moves (brief 7.6). Decided while rendering, so the
  // new puzzle's first frame already knows the old train is leaving and nothing flashes.
  const [was, setWas] = useState({ round: run.round, solved, puzzle: p });
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  if (was.round !== run.round) {
    setWas({ round: run.round, solved, puzzle: p });
    setLeaving(was.solved ? { round: run.round, slots: trainSlots(was.puzzle, true) } : null);
  } else if (was.solved !== solved) {
    setWas({ ...was, solved });
  }
  const ghost = leaving && leaving.round === run.round ? leaving.slots : undefined;

  const onPick = (car: Car) => {
    const verdict = judge(p, car);
    if (verdict.kind === 'right') {
      run.solve();
      return;
    }
    setWrongRound(run.round);
    run.slip(verdict.key);
  };

  const top = (
    <>
      <p className="pat-prompt">{solved ? PROMPT_SOLVED : PROMPT}</p>
      <Train slots={trainSlots(p, solved)} label={trainName(p.cars, solved ? p.answer : null)} ghost={ghost} />
    </>
  );

  const controls = (
    <div className="pat-controls">
      {/* The group below carries the same words as its name, so the visible label stays out of the reading order. */}
      <div className="pat-tray__label" aria-hidden="true">
        {TRAY_LABEL}
      </div>
      <ChoiceRow
        items={p.options}
        name={choiceName}
        isRight={(car) => judge(p, car).kind === 'right'}
        onPick={onPick}
        locked={solved}
        label={TRAY_LABEL}
        className="pat-choices"
        choiceClassName="pat-choice"
      >
        {(car) => <Shape car={car} />}
      </ChoiceRow>
    </div>
  );

  return (
    <PlayScreen
      run={run}
      className="pat"
      speaker={{ label: SPEAKER_NAME, text: () => spokenFor(p, solved) }}
      line={helpLine(p, { solved, wrong: wrongRound === run.round })}
      lineStyle="help"
      top={top}
      controls={controls}
      slotClassName="pat-tray"
    />
  );
}
