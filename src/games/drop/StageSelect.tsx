import { go } from '../../shared/router';
import { starsFor, totalStars, useProgress } from '../../shared/storage';
import { LevelGrid, TopBar } from '../../shared/ui';
import { STAGES, isUnlocked } from './stages';

const GROUPS = [
  { title: 'Small bricks', note: '1 to 3 squares', from: 0, to: 4 },
  { title: 'Four-square bricks', note: 'bigger board', from: 4, to: 9 },
  { title: 'Big bricks', note: 'up to 5 squares', from: 9, to: STAGES.length },
];

export default function StageSelect() {
  useProgress(); // re-render when stars change
  const stars = totalStars('drop');
  return (
    <div className="screen drop-select">
      <TopBar title="Brick Drop" subtitle={`${stars} of ${STAGES.length * 3} stars`} />
      <p className="drop-select__hint muted">
        Turn and slide the falling bricks. Fill a whole row from side to side to clear it!
      </p>
      {GROUPS.map((g) => (
        <section key={g.title} className="drop-select__group">
          <h2 className="section-title">
            {g.title} <small>{g.note}</small>
          </h2>
          <LevelGrid
            count={g.to - g.from}
            offset={g.from}
            starsOf={(i) => starsFor('drop', i)}
            unlocked={isUnlocked}
            onPick={(i) => go(`/drop/${i + 1}`)}
            label={(i) => (
              <>
                <span>{i + 1}</span>
                <span className="drop-select__goal">
                  {STAGES[i].speedy ? 'speedy' : `${STAGES[i].goalRows} rows`}
                </span>
              </>
            )}
          />
        </section>
      ))}
    </div>
  );
}
