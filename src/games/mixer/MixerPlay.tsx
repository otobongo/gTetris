/* Color Mixer's Play screen (six-games brief 4.1, 7.3, 9): the kit's PlayScreen around the board's own
   parts. The tap rules live in play.ts; this file keeps the two slots in local state (one set per
   puzzle), feeds the kit's slip, progress and solve, and draws the result. Sounds follow Letter Builder:
   the kit plays the slip and the solve, this file plays tap and good. Speech only follows the speaker. */
import { useRef, useState } from 'react';
import { sfx } from '../../shared/sound';
import { ChoiceRow } from '../kit/ChoiceRow';
import { PlayScreen } from '../kit/PlayScreen';
import { useLevelRun } from '../kit/useLevelRun';
import { Bowl, Slot, Swatch, paintStyle } from './Board';
import { colorInfo, colorWord, recipeFor, type PaintId, type ResultId } from './colors';
import {
  EMPTY_SLOT_LABEL,
  SPEAKER_NAME,
  bowlName,
  chip as chipOf,
  potName,
  slotName,
  swatchName,
} from './copy';
import { GAME } from './game';
import { isGiven, isPicked, shelfOf, speechOf, startState, tapChoice, tapPaint, tapSlot, viewOf, type MixState } from './play';
import './mixer.css';

/** The state of the slots for one round (one puzzle on screen); a new round starts from the puzzle's own start. */
interface Held {
  round: number;
  state: MixState;
}

export function MixerPlay({ level }: { level: number }) {
  const run = useLevelRun(GAME, level);
  const p = run.puzzle;
  const [held, setHeld] = useState<Held>(() => ({ round: run.round, state: startState(p) }));
  /** The latest state, read in handlers, so a second tap in the same frame sees the first one. */
  const latest = useRef(held);

  const state = held.round === run.round ? held.state : startState(p);
  const view = viewOf(p, state);
  const chip = chipOf(p);
  const playing = run.phase === 'play';

  const current = (): MixState => (latest.current.round === run.round ? latest.current.state : startState(p));
  const commit = (next: MixState) => {
    latest.current = { round: run.round, state: next };
    setHeld(latest.current);
  };

  const onPaint = (paint: PaintId) => {
    if (!playing) return;
    const cur = current();
    // In Finish a tap on the pot that is already in slot 2 changes nothing, so it is not asked twice.
    if (p.form === 'finish' && cur.slots[1] === paint) return;
    const step = tapPaint(p, cur, paint);
    if (step.state === cur) return;
    commit(step.state);
    if (step.outcome.kind === 'solved') return void run.solve();
    if (step.outcome.kind === 'slip') return void run.slip(step.outcome.key);
    // Make it: a paint of the goal's pair going in is progress, so the time signal starts over.
    const [a, b] = step.state.slots;
    if (p.form === 'make' && recipeFor(p.goal).pair.includes(paint) && a !== b) {
      run.progress();
      sfx.good();
    } else {
      sfx.tap();
    }
  };

  const onSlot = (slot: 0 | 1) => {
    if (!playing) return;
    const cur = current();
    const next = tapSlot(p, cur, slot);
    if (next === cur) return;
    commit(next);
    sfx.tap();
  };

  const onChoice = (color: ResultId) => {
    const step = tapChoice(p, current(), color);
    commit(step.state);
    if (step.outcome.kind === 'solved') run.solve();
    else if (step.outcome.kind === 'slip') run.slip(step.outcome.key);
  };

  const slotProps = (i: 0 | 1) => {
    const paint = state.slots[i];
    const given = isGiven(p, i);
    return {
      paint,
      label: EMPTY_SLOT_LABEL[i],
      name: slotName(i, paint, given),
      active: playing && !given && paint !== null,
      onTap: () => onSlot(i),
    };
  };

  const top = (
    <>
      <div className="mix-chip">
        {chip.circle ? (
          <>
            <span className="mix-chip__text">{chip.text.slice(0, chip.text.length - colorWord(chip.circle).length - 2)}</span>
            <span className="mix-chip__dot" style={paintStyle(chip.circle)} aria-hidden="true" />
            <span className="mix-chip__text">{colorWord(chip.circle)}?</span>
          </>
        ) : (
          <span className="mix-chip__text">{chip.text}</span>
        )}
      </div>
      <div className="mix-slots">
        <Slot {...slotProps(0)} />
        <span className="mix-plus" aria-hidden="true">+</span>
        <Slot {...slotProps(1)} />
      </div>
      <Bowl color={view.bowl} name={bowlName(view.bowl)} />
      <div className="mix-result" aria-live="polite">
        <div className="mix-result__name">{view.name}</div>
        <div className="mix-result__text">{view.text}</div>
      </div>
    </>
  );

  const controls =
    p.form === 'guess' ? (
      <ChoiceRow
        items={p.choices}
        name={(c) => swatchName(c)}
        isRight={(c) => c === p.answer}
        onPick={(c) => onChoice(c)}
        locked={!playing}
        label="Colors"
        className="mix-shelf"
        choiceClassName="mix-pot"
      >
        {(c) => <PotFace color={c} name={swatchName(c)} />}
      </ChoiceRow>
    ) : (
      <div className="mix-shelf" role="group" aria-label="Paints">
        {shelfOf(p).map((paint) => (
          <button
            key={paint}
            type="button"
            className="mix-pot"
            aria-label={potName(paint)}
            aria-pressed={isPicked(p, state, paint)}
            onClick={() => onPaint(paint)}
          >
            <PotFace color={paint} name={colorInfo(paint).name} />
          </button>
        ))}
      </div>
    );

  return (
    <PlayScreen
      run={run}
      className="mix-screen"
      speaker={{ label: SPEAKER_NAME, text: () => speechOf(chip.text, view) }}
      line={view.help}
      lineStyle="help"
      top={top}
      controls={controls}
      slotClassName="mix-controls"
    />
  );
}

function PotFace({ color, name }: { color: PaintId | ResultId; name: string }) {
  return (
    <>
      <Swatch color={color} />
      <span className="mix-pot__name">{name}</span>
    </>
  );
}
