import { go } from './shared/router';
import { sfx } from './shared/sound';
import { setSetting, totalStars, useProgress } from './shared/storage';
import { Icon } from './shared/ui';
import './hub.css';

interface GameCard {
  id: string;
  name: string;
  tagline: string;
  skill: string;
  art: { color: string; x: number; y: number; w: number; h: number }[];
}

const GAMES: GameCard[] = [
  {
    id: 'slide',
    name: 'Brick Escape',
    tagline: 'Slide each brick out through the door of its color.',
    skill: 'Planning ahead',
    art: [
      { color: 'red', x: 0, y: 0, w: 2, h: 1 },
      { color: 'yellow', x: 2, y: 0, w: 1, h: 2 },
      { color: 'green', x: 0, y: 1, w: 1, h: 1 },
      { color: 'blue', x: 1, y: 1, w: 1, h: 1 },
    ],
  },
  {
    id: 'drop',
    name: 'Brick Drop',
    tagline: 'Turn and stack falling bricks to fill whole rows.',
    skill: 'Shapes and space',
    art: [
      { color: 'purple', x: 0, y: 1, w: 3, h: 1 },
      { color: 'purple', x: 1, y: 0, w: 1, h: 1 },
      { color: 'teal', x: 2, y: 0, w: 1, h: 1 },
    ],
  },
  {
    id: 'letters',
    name: 'Letter Builder',
    tagline: 'Put the alphabet in order, then build real words.',
    skill: 'Letters and spelling',
    art: [
      { color: 'orange', x: 0, y: 0, w: 1, h: 1 },
      { color: 'pink', x: 1, y: 0, w: 1, h: 1 },
      { color: 'blue', x: 2, y: 0, w: 1, h: 1 },
    ],
  },
];

function CardArt({ art, id }: { art: GameCard['art']; id: string }) {
  const unit = 28;
  const letters = ['A', 'B', 'C'];
  return (
    <div className="hub-art" style={{ width: unit * 3, height: unit * 2 }}>
      {art.flatMap((b, i) =>
        Array.from({ length: b.w * b.h }, (_, k) => {
          const x = b.x + (k % b.w);
          const y = b.y + Math.floor(k / b.w);
          return (
            <div
              key={`${i}-${k}`}
              className={`brick${id === 'letters' ? '' : ' brick--studs'}`}
              data-color={b.color}
              style={{ position: 'absolute', left: x * unit, top: y * unit + (id === 'letters' ? unit / 2 : 0), width: unit - 2, height: unit - 2 }}
            >
              {id === 'letters' && <span className="hub-art__letter">{letters[i]}</span>}
            </div>
          );
        }),
      )}
    </div>
  );
}

export default function Hub() {
  const progress = useProgress();
  return (
    <div className="screen hub">
      <header className="hub__header">
        <div className="hub__logo" aria-hidden="true">
          {['red', 'yellow', 'green', 'blue'].map((c) => (
            <span key={c} className="brick brick--studs" data-color={c} />
          ))}
        </div>
        <h1>Brickwise</h1>
        <p className="muted">Think it through. Every level gets a little trickier.</p>
      </header>

      <nav className="hub__games" aria-label="Games">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className="hub-card"
            onClick={() => {
              sfx.tap();
              go(`/${g.id}`);
            }}
          >
            <CardArt art={g.art} id={g.id} />
            <span className="hub-card__body">
              <span className="hub-card__name">{g.name}</span>
              <span className="hub-card__tag">{g.tagline}</span>
              <span className="hub-card__meta">
                <span className="hub-card__skill">{g.skill}</span>
                <span className="hub-card__stars">⭐ {totalStars(g.id)}</span>
              </span>
            </span>
            <span className="hub-card__go" aria-hidden="true">
              <Icon name="play" size={22} />
            </span>
          </button>
        ))}
      </nav>

      <footer className="hub__settings">
        <button
          className="btn btn--small"
          onClick={() => setSetting('sound', !progress.settings.sound)}
          aria-pressed={progress.settings.sound}
        >
          <Icon name={progress.settings.sound ? 'sound' : 'mute'} size={18} /> Sounds {progress.settings.sound ? 'on' : 'off'}
        </button>
        <button
          className="btn btn--small"
          onClick={() => setSetting('voice', !progress.settings.voice)}
          aria-pressed={progress.settings.voice}
        >
          <Icon name="speaker" size={18} /> Voice {progress.settings.voice ? 'on' : 'off'}
        </button>
      </footer>
    </div>
  );
}
