import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_PLAYER_NAME, gameOf, useActivePlayer, type AgeBand, type Player } from '../../shared/progress';
import { go, replace, toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { letterName, say } from '../../shared/speech';
import { recordStars } from '../../shared/storage';
import { Brick, IconButton, LevelGrid, PressButton, Screen, Stars, TopBar, useLayout } from '../../shared/ui';
import { CHAPTERS, LEVELS, chapterOf, makeRound, type Prompt } from './levels';
import { HINTS_PER_LEVEL, STAR_RULE, starsForSlips } from './logic';
import { innerWidth } from './sizing';
import { FillView, MatchView, SoundView } from './Views';
import './letters.css';

const GAME = 'letters';
const LEVELS_PATH = '/game/letters/levels';

export default function LettersApp({ params }: { params: string[] }) {
  const player = useActivePlayer();
  const reached = gameOf(player, GAME).unlocked;
  const isOpen = (i: number) => i <= reached;
  const n = Number(params[0]);
  const level = Number.isInteger(n) && n >= 1 && n <= LEVELS.length ? n - 1 : -1;
  const open = level >= 0 && isOpen(level);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // A level number that does not exist or is still locked goes back to the level screen, without a history entry.
    if (params.length && !open) replace(LEVELS_PATH);
  }, [params.length, open]);

  if (!params.length) return <LevelList player={player} isOpen={isOpen} />;
  if (!open) return null;
  return <Play key={`${level}:${nonce}`} level={level} player={player} onRestart={() => setNonce((x) => x + 1)} />;
}

/** The game's own level list, opened by /game/letters with no level. The Levels screen replaces it as the way in. */
function LevelList({ player, isOpen }: { player: Player | null; isOpen: (i: number) => boolean }) {
  return (
    <Screen>
      <TopBar title="Letter Builder" subtitle="Letters, sounds and words" back={LEVELS_PATH} backLabel="Back to levels" />
      <div className="lb-list">
        {CHAPTERS.map((c) => (
          <section key={c.title} className="lb-chapter" aria-labelledby={`lb-ch-${c.start}`}>
            <h2 id={`lb-ch-${c.start}`} className="lb-chapter__title">
              {c.title} <small>{c.note}</small>
            </h2>
            <LevelGrid
              count={c.count}
              offset={c.start}
              starsOf={(i) => (player ? (gameOf(player, GAME).stars[i] ?? 0) : 0)}
              unlocked={isOpen}
              onPick={(i) => go(`/game/letters/${i + 1}`)}
            />
          </section>
        ))}
      </div>
    </Screen>
  );
}

/** What to show and say for each prompt. Speech is read aloud only when the child taps a speaker or a picture. */
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

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

/** Avatar, name and progress dots, as on the board. */
function PlayerStrip({ player, total, index, finished, noun }: { player: Player | null; total: number; index: number; finished: boolean; noun: string }) {
  const name = player?.name ?? DEFAULT_PLAYER_NAME;
  return (
    <div className="lb-player">
      <Brick color={player?.color ?? 'blue'} width={34} height={34} radius={12} style={{ fontSize: 18 }}>
        {initialOf(name)}
      </Brick>
      <span className="lb-player__name">{name}</span>
      <div className="lb-dots" role="img" aria-label={`${noun} ${Math.min(index + 1, total)} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`lb-dot${i < index || (i === index && finished) ? ' is-done' : i === index ? ' is-now' : ''}`} />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  title: string;
  stars?: number;
  text: string;
  note?: string;
  children: ReactNode;
}

/** The card over the game, as on the board: a title, one line, and the next step. */
function WinCard({ title, stars, text, note, children }: CardProps) {
  return (
    <div className="lb-overlay">
      <div className="lb-win" role="dialog" aria-modal="true" aria-labelledby="lb-win-title">
        <h2 id="lb-win-title">{title}</h2>
        {stars !== undefined && <Stars value={stars} />}
        <p className="lb-win__text">{text}</p>
        {note && <p className="lb-win__note">{note}</p>}
        <div className="lb-win__actions">{children}</div>
      </div>
    </div>
  );
}

function Play({ level, player, onRestart }: { level: number; player: Player | null; onRestart: () => void }) {
  const band: AgeBand = player?.ageBand ?? '5-6';
  const [seed] = useState(() => (Math.random() * 2 ** 31) | 0);
  const round = useMemo(() => makeRound(level, seed, band), [level, seed, band]);
  const layout = useLayout();
  const [idx, setIdx] = useState(0);
  const [slips, setSlips] = useState(0);
  const [hints, setHints] = useState(HINTS_PER_LEVEL);
  const [result, setResult] = useState<number | null>(null);
  /** True while the card between two spelled words is up. */
  const [between, setBetween] = useState(false);
  const slipsRef = useRef(0);
  const hintRef = useRef<(() => boolean) | null>(null);
  const prompt = round.prompts[idx];
  const chapter = chapterOf(level);
  const { text, speech } = promptText(prompt);
  const spelling = round.def.kind === 'spell';
  const locked = result !== null || between;

  const slip = () => {
    slipsRef.current += 1;
    setSlips(slipsRef.current);
  };

  const done = () => {
    const last = idx + 1 >= round.prompts.length;
    if (!last) {
      if (prompt.kind === 'spell') setBetween(true);
      else setIdx(idx + 1);
      return;
    }
    const stars = starsForSlips(slipsRef.current);
    recordStars(GAME, level, stars);
    sfx.win();
    say(stars === 3 ? 'Super builder!' : 'You did it!');
    setResult(stars);
  };

  const askHint = () => {
    if (hints <= 0 || locked) return;
    if (hintRef.current?.()) {
      setHints(hints - 1);
      slip();
    }
  };

  const hint = (
    <IconButton icon="hint" label="Hint" badge={hints} disabled={hints <= 0 || locked} onClick={askHint} variant="yellow" />
  );
  const viewProps = {
    active: !locked,
    onSlip: slip,
    onDone: done,
    hintRef,
    hint,
    innerW: innerWidth(layout.mode, layout.width),
    instruction: text,
  };
  const hasNext = level + 1 < LEVELS.length;
  const noun = spelling ? 'Word' : 'Part';
  const word = prompt.kind === 'spell' ? prompt.word!.word : '';
  const total = round.prompts.length;

  return (
    <Screen className="lb-screen" gap={14}>
      <TopBar
        title={chapter.title}
        subtitle={`Letter Builder · Level ${level + 1}`}
        back={LEVELS_PATH}
        backLabel="Back to levels"
        action={<IconButton icon="speaker" label={spelling ? 'Say the word' : 'Hear it again'} onClick={() => say(speech)} />}
      />
      <PlayerStrip player={player} total={total} index={idx} finished={between || result !== null} noun={noun} />
      <div className="lb-body" key={idx}>
        {prompt.kind === 'match' ? (
          <MatchView prompt={prompt} {...viewProps} />
        ) : prompt.kind === 'sound' ? (
          <SoundView prompt={prompt} {...viewProps} />
        ) : (
          <FillView prompt={prompt} {...viewProps} />
        )}
      </div>
      {between && (
        <WinCard
          title={`You built ${word.toUpperCase()}!`}
          text={`${word.toUpperCase().split('').join('-')}… ${word}. Ready for the next one?`}
        >
          <PressButton
            variant="green"
            size="lg"
            block
            onClick={() => {
              setBetween(false);
              setIdx(idx + 1);
            }}
          >
            Next word
          </PressButton>
        </WinCard>
      )}
      {result !== null && (
        <WinCard
          title={spelling ? `You built ${total} words!` : result === 3 ? 'Super builder!' : result === 2 ? 'Great building!' : 'You did it!'}
          stars={result}
          text={slips === 0 ? 'No slips at all!' : `${slips} slip${slips === 1 ? '' : 's'}`}
          note={STAR_RULE}
        >
          {hasNext ? (
            <PressButton variant="green" size="lg" block href={toHref(`/game/letters/${level + 2}`)}>
              Next level
            </PressButton>
          ) : (
            <PressButton variant="green" size="lg" block onClick={onRestart}>
              Play again
            </PressButton>
          )}
          <div className="lb-win__row">
            {hasNext && (
              <PressButton variant="purple" size="md" icon="restart" onClick={onRestart}>
                Play again
              </PressButton>
            )}
            <PressButton variant="purple" size="md" href={toHref(LEVELS_PATH)}>
              All levels
            </PressButton>
          </div>
        </WinCard>
      )}
    </Screen>
  );
}
