import { toHref } from '../shared/router';
import { Icon, Pill, Screen, TopBar } from '../shared/ui';
import { backTarget } from './logic/session';
import './screens.css';

/**
 * Terms of use and Privacy policy share one template (design/canvas/HelpDoc.dc.html). The legal
 * text is a marked placeholder until counsel writes it; no real or made-up legal wording here.
 */
export default function HelpDoc({ page }: { page: 'terms' | 'privacy' }) {
  const name = page === 'terms' ? 'Terms of use' : 'Privacy policy';
  const back = backTarget(['/help', '/settings', '/signup', '/signin'], '/help');
  const backLabel = back === '/help' ? 'Back to support' : back === '/settings' ? 'Back to settings' : back === '/signin' ? 'Back to sign in' : 'Back to sign up';

  return (
    <Screen>
      <TopBar title={name} subtitle="For grown-ups" back={back} backLabel={backLabel} />
      <div className="sc-scroll sc-doc">
        <div className="sc-stack">
          <div role="note" className="sc-callout">
            <span className="sc-body--soft">
              <Icon name="document" size={26} strokeWidth={2.4} />
            </span>
            <span className="sc-callout__text">
              <Pill tone="yellow">Placeholder</Pill>
              <span className="sc-sub">Placeholder text. Replace with the approved {name} before launch.</span>
            </span>
          </div>
          <p className="sc-sub">Last updated [PLACEHOLDER: date]</p>
        </div>

        <article className="sc-article" aria-label={name}>
          {[1, 2, 3, 4].map((n) => (
            <section key={n}>
              <h2>[PLACEHOLDER: section {n} heading]</h2>
              <p>[PLACEHOLDER: approved legal text]</p>
            </section>
          ))}
        </article>

        <p className="sc-auth__new sc-doc__foot">
          Questions about this document?
          <a className="sc-link" href={toHref('/help')}>
            Contact support
          </a>
        </p>
      </div>
    </Screen>
  );
}
