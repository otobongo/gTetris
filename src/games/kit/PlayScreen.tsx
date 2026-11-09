import { useEffect, useRef, type ReactNode } from 'react';
import { toHref } from '../../shared/router';
import { say } from '../../shared/speech';
import { IconButton, LevelCard, PressButton, PuzzleDots, Screen, TopBar, cx } from '../../shared/ui';
import { BACK_TO_GAMES, BACK_TO_HOME, NEXT_PUZZLE, OFFER_LINE, OFFER_NAME, READ_HELP_ALOUD, SWAPPED_LINE, levelName, playLabel } from './copy';
import { HelpRow, type HelpLineStyle } from './HelpRow';
import type { LevelRunApi } from './levelRun';
import './kit.css';

/**
 * Put this attribute on the control that takes focus after Next and after a swap, when it is not the
 * first focusable one in the controls slot (Calculator's 7 key, say), wherever it sits. Without it
 * PlayScreen takes the first focusable control in the controls slot, then the body, then the top.
 */
export const FIRST_CONTROL = 'data-kit-first';

const FOCUSABLE = 'button:not([disabled]):not([aria-disabled="true"]), a[href], [tabindex="0"]';

export interface PlayScreenProps<P> {
  /** What useLevelRun returned. */
  run: LevelRunApi<P>;
  /**
   * The speaker at the top bar's right, while the offer is hidden: its name ("Hear the question") and
   * what it reads. While the offer shows it is "Read the help line aloud" and reads the offer line.
   */
  speaker: { label: string; text: string | (() => string) };
  /** The game's own help line. The offer line and "Here is a different puzzle." take its place when the kit says so. */
  line: string;
  /** prompt (Sorter, Numbers) or help (Mixer, Pattern, Calculator, Builder). */
  lineStyle: HelpLineStyle;
  /** Prompt style: the game's line is a wrong-answer line, in the error colour. */
  wrong?: boolean;
  /** The help row's right cell: Number Line-up's Hint button. */
  hint?: ReactNode;
  /** Blocks above the help row, in the frame's column (Mixer's goal chip, slots, bowl and result; Numbers' goal chip). */
  top?: ReactNode;
  /** Between the help row and the controls slot; it takes the height left over (Sorter's holes, Numbers' towers). */
  children?: ReactNode;
  /**
   * The game's controls (Mixer's pots or swatches, Sorter's tray, Pattern's choices). After a solve,
   * Next puzzle is drawn over them, centred; they stay in place hidden and inert, so the slot keeps its height.
   */
  controls?: ReactNode;
  /** Classes on the controls slot: a game that draws it as a well, or sets its height with --bw-slot-min (Mixer 86px). */
  slotClassName?: string;
  /** Classes on the screen frame. */
  className?: string;
}

/**
 * The kit games' shared play frame (brief 3.1, 7.2, 9.1): the top bar (Back to home, "Level N", the
 * puzzle dots under it, the speaker on the right), the game's top and body, the help row, the controls
 * slot and the level card.
 *
 * The slot holds the game's controls while a puzzle is in play, Next puzzle once it is solved, nothing
 * behind the level card, and the card's Play Level N button once the card is closed with Escape or the
 * scrim (four-puzzle section 10). Focus goes to Next on a solve, to the game's first control after Next
 * (and after a swap, since the offer button it was on is gone), and to Play Level N when the card closes.
 *
 * Everything in `top`, `children` and `controls` is keyed on run.round, so each new puzzle starts from
 * fresh components (ChoiceRow's marks, a game's local state below PlayScreen). The help row is not, so
 * its status region stays and announces each new line.
 */
export function PlayScreen<P>({ run, speaker, line, lineStyle, wrong, hint, top, children, controls, slotClassName, className }: PlayScreenProps<P>) {
  const topRef = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const last = useRef({ round: run.round, phase: run.phase, offer: run.offer, slot: run.slot });

  useEffect(() => {
    const was = last.current;
    last.current = { round: run.round, phase: run.phase, offer: run.offer, slot: run.slot };
    if (run.round !== was.round) {
      const lost = typeof document === 'undefined' || !document.activeElement || document.activeElement === document.body;
      // After Next always; after a swap only when focus went with the offer button.
      if (was.phase === 'solved' || (was.offer && lost)) {
        const places = [slot.current?.querySelector('.bw-play__controls'), body.current, topRef.current];
        const marked = places.map((el) => el?.querySelector<HTMLElement>(`[${FIRST_CONTROL}]`)).find(Boolean);
        (marked ?? places.map((el) => el?.querySelector<HTMLElement>(FOCUSABLE)).find(Boolean))?.focus();
      }
      return;
    }
    if (run.slot !== was.slot && (run.slot === 'next' || run.slot === 'play' || run.slot === 'home')) {
      slot.current?.querySelector<HTMLElement>('.bw-next')?.focus();
    }
  });

  const shown = run.shared === 'offer' ? OFFER_LINE : run.shared === 'swapped' ? SWAPPED_LINE : line;
  const speak = () => say(run.offer ? OFFER_LINE : typeof speaker.text === 'function' ? speaker.text() : speaker.text);

  let swapIn: ReactNode = null;
  if (run.slot === 'next') {
    swapIn = (
      <PressButton variant="green" size="lg" icon="play" iconEnd className="bw-next bw-appear" onClick={run.next}>
        {NEXT_PUZZLE}
      </PressButton>
    );
  } else if (run.slot === 'play' && run.finish && run.finish.next !== null) {
    swapIn = (
      <PressButton variant="green" size="lg" icon="play" iconEnd className="bw-next bw-appear" onClick={run.next}>
        {playLabel(run.finish.next + 1)}
      </PressButton>
    );
  } else if (run.slot === 'home') {
    swapIn = (
      <PressButton variant="green" size="lg" className="bw-next bw-appear" href={toHref('/')}>
        {BACK_TO_GAMES}
      </PressButton>
    );
  }

  const playing = run.slot === 'controls';
  return (
    <Screen className={cx('bw-play', className)} gap={14}>
      <TopBar
        title={levelName(run.level + 1)}
        backLabel={BACK_TO_HOME}
        below={<PuzzleDots solved={run.dots.solved} puzzle={run.dots.at} />}
        action={<IconButton icon="speaker" label={run.offer ? READ_HELP_ALOUD : speaker.label} onClick={speak} />}
      />
      {top !== undefined && (
        <div ref={topRef} className="bw-play__top" key={`top-${run.round}`}>
          {top}
        </div>
      )}
      <HelpRow
        line={shown}
        lineStyle={lineStyle}
        wrong={run.shared === null && wrong}
        hint={hint}
        offer={run.offer ? <IconButton icon="swap" label={OFFER_NAME} variant="green" className="bw-appear" onClick={run.swap} /> : null}
      />
      <div ref={body} className="bw-play__body" key={`body-${run.round}`}>
        {children}
      </div>
      <div ref={slot} className={cx('bw-play__slot', slotClassName)} data-slot={run.slot}>
        <div className="bw-play__controls" key={`controls-${run.round}`} inert={!playing} aria-hidden={!playing || undefined}>
          {controls}
        </div>
        {swapIn}
      </div>
      {run.card && <LevelCard {...run.card} />}
    </Screen>
  );
}
