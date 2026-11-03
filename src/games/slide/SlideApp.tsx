import { go } from '../../shared/router';
import { starsFor, totalStars, useProgress } from '../../shared/storage';
import { LevelGrid, TopBar } from '../../shared/ui';
import { CHAPTERS, LEVELS } from './levels';
import SlideGame from './SlideGame';
import './slide.css';

const unlocked = (i: number) => i === 0 || starsFor('slide', i - 1) > 0;

export default function SlideApp({ params }: { params: string[] }) {
  useProgress(); // re-render when stars change
  const n = Number(params[0]);
  if (Number.isInteger(n) && n >= 1 && n <= LEVELS.length && unlocked(n - 1)) return <SlideGame index={n - 1} />;
  if (params.length) go('/slide');

  return (
    <div className="screen">
      <TopBar title="Brick Escape" subtitle={`⭐ ${totalStars('slide')} of ${LEVELS.length * 3}`} />
      <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
        Slide every brick out through its own color door. Fewer moves earn more stars.
      </p>
      {CHAPTERS.filter((ch) => ch.from < LEVELS.length).map((ch) => {
        const to = Math.min(ch.to, LEVELS.length);
        return (
          <section key={ch.title} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="section-title">
              {ch.title} <small>{ch.note}</small>
            </h2>
            <LevelGrid
              count={to - ch.from}
              offset={ch.from}
              starsOf={(i) => starsFor('slide', i)}
              unlocked={unlocked}
              onPick={(i) => go(`/slide/${i + 1}`)}
            />
          </section>
        );
      })}
    </div>
  );
}
