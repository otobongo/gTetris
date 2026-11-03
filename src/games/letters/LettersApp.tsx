import { useEffect, useMemo, useRef, useState } from 'react';
import { go } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { letterName, say } from '../../shared/speech';
import { recordStars, starsFor, useProgress } from '../../shared/storage';
import { IconButton, LevelGrid, ResultCard, TopBar } from '../../shared/ui';
import { CHAPTERS, LEVELS, chapterOf, makeRound, type Prompt } from './levels';
import { HINTS_PER_LEVEL, STAR_RULE, starsForSlips } from './logic';
import { FillView, MatchView, SoundView } from './Views';
import './letters.css';

const GAME = 'letters';

const unlocked = (i: number) => i === 0 || starsFor(GAME, i - 1) >= 1;

export default function LettersApp({ params }: { params: string[] }) {
  useProgress(); // re-render when stars change
  const n = Number(params[0]);
  const level = Number.isInteger(n) && n >= 1 && n <= LEVELS.length ? n - 1 : -1;
  const open = level >= 0 && unlocked(level);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (params.length && !open) go('/letters');
  }, [params.length, open]);

  if (!open) return <LevelSelect />;
  return <Play key={`${level}:${nonce}`} level={level} onRestart={() => setNonce((x) => x + 1)} />;
}

function LevelSelect() {
  return (
    <div className="screen lb-select">
      <TopBar title="Letter Builder" subtitle="Letters, sounds and words" />
      {CHAPTERS.map((c) => (
        <section key={c.title} className="lb-chapter">
          <h2 className="section-title">
            <span aria-hidden="true">{c.emoji}</span> {c.title} <small>{c.blurb}</small>
          </h2>
          <LevelGrid
            count={c.count}
            offset={c.start}
            starsOf={(i) => starsFor(GAME, i)}
            unlocked={unlocked}
            onPick={(i) => go(`/letters/${i + 1}`)}
          />
        </section>
      ))}
    </div>
  );
}

/** What to show and say for each prompt. Speech is what a pre-reader actually relies on. */
function promptText(p: Prompt): { text: string; speech: string } {
  switch (p.kind) {
    case 'train': {
      const a = p.cells[0];
      const b = p.cells[p.cells.length - 1];
      return { text: `Tap ${a} to ${b} in order`, speech: `Tap the letters in order, from ${letterName(a)} to ${letterName(b)}.` };
    }
    case 'missing':
      return { text: 'Find the missing letters', speech: 'Which letters are missing? Fill the gaps.' };
    case 'match':
      return { text: 'Match big and small letters', speech: 'Match each big letter with its small letter.' };
    case 'sound':
      return { text: 'What does it start with?', speech: `${p.word.word}. What letter does ${p.word.word} start with?` };
    case 'spell':
      return { text: 'Build the word', speech: `Spell ${p.word!.word}.` };
  }
}

function Play({ level, onRestart }: { level: number; onRestart: () => void }) {
  const [seed] = useState(() => (Math.random() * 2 ** 31) | 0);
  const round = useMemo(() => makeRound(level, seed), [level, seed]);
  const [idx, setIdx] = useState(0);
  const [slips, setSlips] = useState(0);
  const [hints, setHints] = useState(HINTS_PER_LEVEL);
  const [result, setResult] = useState<number | null>(null);
  const slipsRef = useRef(0);
  const hintRef = useRef<(() => boolean) | null>(null);
  const prompt = round.prompts[idx];
  const chapter = chapterOf(level);
  const { text, speech } = promptText(prompt);

  useEffect(() => {
    const t = window.setTimeout(() => say(speech), 300);
    return () => window.clearTimeout(t);
  }, [speech, idx]);

  const slip = () => {
    slipsRef.current += 1;
    setSlips(slipsRef.current);
  };

  const done = () => {
    if (idx + 1 < round.prompts.length) {
      setIdx(idx + 1);
      return;
    }
    const stars = starsForSlips(slipsRef.current);
    recordStars(GAME, level, stars);
    sfx.win();
    say(stars === 3 ? 'Super builder!' : 'You did it!');
    setResult(stars);
  };

  const askHint = () => {
    if (hints <= 0 || result !== null) return;
    if (hintRef.current?.()) {
      setHints(hints - 1);
      slip();
    }
  };

  const viewProps = { active: result === null, onSlip: slip, onDone: done, hintRef };
  const hasNext = level + 1 < LEVELS.length;

  return (
    <div className="screen lb-play">
      <TopBar
        title={round.def.name}
        subtitle={`${chapter.emoji} ${chapter.title} · Level ${level + 1}`}
        back="/letters"
        right={<IconButton icon="hint" label="Hint" badge={hints} disabled={hints <= 0 || result !== null} onClick={askHint} variant="warm" />}
      />
      <div className="lb-bar">
        <IconButton icon="speaker" label="Hear it again" onClick={() => say(speech)} />
        <p className="lb-instruction">{text}</p>
        <div className="lb-pips" aria-label={`Part ${idx + 1} of ${round.prompts.length}`}>
          {round.prompts.map((_, i) => (
            <span key={i} className={`lb-pip${i < idx ? ' is-done' : i === idx ? ' is-now' : ''}`} />
          ))}
        </div>
      </div>
      <div className="lb-body" key={idx}>
        {prompt.kind === 'match' ? (
          <MatchView prompt={prompt} {...viewProps} />
        ) : prompt.kind === 'sound' ? (
          <SoundView prompt={prompt} {...viewProps} />
        ) : (
          <FillView prompt={prompt} {...viewProps} />
        )}
      </div>
      {result !== null && (
        <ResultCard
          title={result === 3 ? 'Super builder!' : result === 2 ? 'Great building!' : 'You did it!'}
          stars={result}
          message={
            <>
              {slips === 0 ? 'No slips at all!' : `${slips} slip${slips === 1 ? '' : 's'}`}
              <span className="lb-rule">{STAR_RULE}</span>
            </>
          }
        >
          <IconButton icon="home" label="All levels" onClick={() => go('/letters')} />
          <IconButton icon="restart" label="Play again" onClick={onRestart} />
          {hasNext && (
            <button className="btn btn--go" onClick={() => (sfx.tap(), go(`/letters/${level + 2}`))}>
              Next level
            </button>
          )}
        </ResultCard>
      )}
    </div>
  );
}
