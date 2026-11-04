import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ACCOUNTS_ENABLED } from '../shared/account';
import { toHref } from '../shared/router';
import { Icon, Screen, TopBar, cx, useLayout } from '../shared/ui';
import { backTarget } from './logic/session';
import './screens.css';

/** Replace with the approved support address. While it is empty, the hold finishes but opens nothing. */
const SUPPORT_EMAIL = '';
const HOLD_MS = 2000;
const STEP_MS = 100;

/** Answers state only what the screens already do; the account answers follow whether accounts are on. */
function faqs() {
  return [
    { q: 'How do I add a child?', a: 'Open Settings, tap Add a child, then enter a first name and age.' },
    { q: 'Why doesn’t my child need a password?', a: 'Children tap their brick on Who’s playing. Only grown-ups sign in.' },
    ACCOUNTS_ENABLED
      ? { q: 'How do I use Brickwise on another device?', a: 'Sign in with the same family account on each device. Stars, levels and stickers stay in sync.' }
      : { q: 'How do I use Brickwise on another device?', a: 'Not yet. Family accounts are coming soon; until then, progress stays on the device it was made on.' },
    { q: 'What happens when the game timer runs out?', a: 'The game keeps going; your child only misses the speed star. Ages 3 to 4 play with no countdown.' },
    { q: 'How do I change the daily play limit?', a: 'In Settings, under your child’s game timer. When time is up, your child sees a break screen, where you can add time for today.' },
    { q: 'How do I reset progress?', a: 'In Settings, under Progress. A reset can’t be undone.' },
    ACCOUNTS_ENABLED
      ? { q: 'How do I delete my account?', a: 'In Settings, tap Delete my account. This removes every child’s stars, levels and stickers on every device.' }
      : { q: 'How do I delete my account?', a: 'In Settings, tap Delete my account. This removes every child’s stars, levels and stickers from this device.' },
  ];
}

/** Support (design/canvas/Help.dc.html, page=help): contact behind a 2-second hold, questions, legal links. */
export default function Help() {
  const tablet = useLayout().mode === 'tablet';
  const [hold, setHold] = useState(0);
  const [holding, setHolding] = useState(false);
  const [status, setStatus] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const back = backTarget(['/settings', '/signin', '/signup'], '/settings');
  const backLabel = back === '/signin' ? 'Back to sign in' : back === '/signup' ? 'Back to sign up' : 'Back to settings';

  useEffect(() => () => window.clearInterval(timer.current), []);

  const finish = () => {
    window.clearInterval(timer.current);
    setHolding(false);
    setHold(100);
    if (SUPPORT_EMAIL) {
      setStatus('Opening your email app.');
      window.location.href = `mailto:${SUPPORT_EMAIL}`;
    } else {
      setStatus('The support email is not set up yet.');
    }
    timer.current = window.setTimeout(() => setHold(0), 2600);
  };
  const start = () => {
    if (holding) return;
    window.clearInterval(timer.current);
    setHolding(true);
    setHold(0);
    setStatus('');
    let h = 0;
    timer.current = window.setInterval(() => {
      h += (STEP_MS / HOLD_MS) * 100;
      if (h >= 100) finish();
      else setHold(h);
    }, STEP_MS);
  };
  const end = () => {
    if (!holding) return;
    window.clearInterval(timer.current);
    setHolding(false);
    setHold(0);
    setStatus('Keep holding for 2 seconds to open your email app.');
  };
  const isHoldKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  return (
    <Screen padding="standard">
      <TopBar title="Support" subtitle="For grown-ups" back={back} backLabel={backLabel} />
      <div className="sc-scroll sc-help">
        <section className="sc-panel" aria-labelledby="help-contact">
          <div className="sc-stack sc-stack--tight">
            <h2 id="help-contact" className="sc-panel__title">
              Contact support
            </h2>
            <p className="sc-sub">Write to [PLACEHOLDER: support email]. Include your family account email and the device you use.</p>
          </div>
          <button
            type="button"
            className={cx('sc-hold', holding && 'is-holding')}
            aria-label="Press and hold for 2 seconds to open your email app"
            onPointerDown={start}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
            onKeyDown={(e) => {
              if (!isHoldKey(e)) return;
              e.preventDefault();
              if (!e.repeat) start();
            }}
            onKeyUp={(e) => {
              if (!isHoldKey(e)) return;
              e.preventDefault();
              end();
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="sc-hold__layer" aria-hidden="true">
              <Icon name="mail" size={22} strokeWidth={2.4} />
              Hold to email support
            </span>
            <span className="sc-hold__layer sc-hold__layer--fill" aria-hidden="true" style={{ clipPath: `inset(0 ${100 - hold}% 0 0)` }}>
              <Icon name="mail" size={22} strokeWidth={2.4} />
              Hold to email support
            </span>
          </button>
          <div className="sc-stack sc-stack--tight">
            <p role="status" className="sc-hold__status">
              {status}
            </p>
            <p className="sc-helper">Reply time: [PLACEHOLDER: reply time]</p>
          </div>
        </section>

        <section className="sc-stack sc-stack--section" aria-labelledby="help-faq">
          <h2 id="help-faq" className="sc-h2">
            Common questions
          </h2>
          <ul className={cx('sc-faq', tablet && 'sc-faq--tablet')}>
            {faqs().map((f) => (
              <li key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sc-stack sc-stack--section" aria-labelledby="help-legal">
          <h2 id="help-legal" className="sc-h2">
            Legal
          </h2>
          <div className="sc-legalbox">
            <a className="sc-legalrow" href={toHref('/help/terms')}>
              <span>Terms of use</span>
              <Icon name="chevronRight" size={22} strokeWidth={2.6} />
            </a>
            <hr />
            <a className="sc-legalrow" href={toHref('/help/privacy')}>
              <span>Privacy policy</span>
              <Icon name="chevronRight" size={22} strokeWidth={2.6} />
            </a>
          </div>
          <p className="sc-helper">Version [PLACEHOLDER: version number]</p>
        </section>
      </div>
    </Screen>
  );
}
