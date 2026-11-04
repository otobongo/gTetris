/* Word pictures from the Letters board (design/canvas/Letters.dc.html), drawn as SVG.
   Words the board does not draw use their emoji from data.ts. */
import type { ReactNode } from 'react';

const ART: Record<string, { viewBox: string; art: ReactNode }> = {
  sun: {
    viewBox: '0 0 100 100',
    art: (
      <>
        <g stroke="#ffc21a" strokeWidth="7" strokeLinecap="round"><path d="M50 6v12M50 82v12M6 50h12M82 50h12M19 19l8 8M73 73l8 8M81 19l-8 8M27 73l-8 8"></path></g>
        <circle cx="50" cy="50" r="24" fill="#ffc21a"></circle><circle cx="50" cy="50" r="24" fill="none" stroke="#d48a00" strokeWidth="3"></circle>
        <circle cx="42" cy="46" r="3.5" fill="#5a3500"></circle><circle cx="58" cy="46" r="3.5" fill="#5a3500"></circle>
        <path d="M41 57c5 5 13 5 18 0" fill="none" stroke="#5a3500" strokeWidth="3.5" strokeLinecap="round"></path>
      </>
    ),
  },
  bus: {
    viewBox: '0 0 120 90',
    art: (
      <>
        <rect x="8" y="12" width="104" height="56" rx="12" fill="#ffc21a" stroke="#d48a00" strokeWidth="3"></rect>
        <rect x="18" y="22" width="20" height="18" rx="4" fill="#7cc0ff"></rect><rect x="44" y="22" width="20" height="18" rx="4" fill="#7cc0ff"></rect><rect x="70" y="22" width="20" height="18" rx="4" fill="#7cc0ff"></rect>
        <rect x="95" y="22" width="10" height="36" rx="3" fill="#7cc0ff"></rect>
        <rect x="8" y="48" width="104" height="6" fill="#d48a00"></rect>
        <circle cx="32" cy="70" r="11" fill="#2e2e38"></circle><circle cx="32" cy="70" r="4" fill="#b9b3c9"></circle>
        <circle cx="88" cy="70" r="11" fill="#2e2e38"></circle><circle cx="88" cy="70" r="4" fill="#b9b3c9"></circle>
      </>
    ),
  },
  box: {
    viewBox: '0 0 100 94',
    art: (
      <>
        <path d="M10 30l40-18 40 18-40 18z" fill="#e0a45e"></path>
        <path d="M10 30v40l40 18V48z" fill="#c4802f"></path>
        <path d="M90 30v40L50 88V48z" fill="#a8681f"></path>
        <path d="M30 21l40 18v14" fill="none" stroke="#f1eef7" strokeWidth="6"></path>
      </>
    ),
  },
  cat: {
    viewBox: '0 0 100 94',
    art: (
      <>
        <path d="M22 42L17 10l23 15z" fill="#ffab5e" stroke="#c4500a" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M78 42l5-32-23 15z" fill="#ffab5e" stroke="#c4500a" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M23 20l2 12 8-5z" fill="#ff9fd4"></path><path d="M77 20l-2 12-8-5z" fill="#ff9fd4"></path>
        <ellipse cx="50" cy="54" rx="34" ry="30" fill="#ffab5e" stroke="#c4500a" strokeWidth="3"></ellipse>
        <path d="M43 26v8M50 25v10M57 26v8" fill="none" stroke="#ff7a1a" strokeWidth="3.5" strokeLinecap="round"></path>
        <circle cx="37" cy="51" r="5" fill="#2e2e38"></circle><circle cx="63" cy="51" r="5" fill="#2e2e38"></circle>
        <circle cx="38.5" cy="49.5" r="1.6" fill="#ffffff"></circle><circle cx="64.5" cy="49.5" r="1.6" fill="#ffffff"></circle>
        <path d="M45 61h10l-5 5z" fill="#c72f84"></path>
        <path d="M50 66c-2 4-7 5-10 2M50 66c2 4 7 5 10 2" fill="none" stroke="#c4500a" strokeWidth="2.5" strokeLinecap="round"></path>
        <path d="M30 63H13M30 68l-15 4M70 63h17M70 68l15 4" fill="none" stroke="#c4500a" strokeWidth="2.2" strokeLinecap="round"></path>
      </>
    ),
  },
  duck: {
    viewBox: '0 0 120 90',
    art: (
      <>
        <path d="M98 52l14-14-1 22z" fill="#ffc21a" stroke="#d48a00" strokeWidth="3" strokeLinejoin="round"></path>
        <ellipse cx="62" cy="58" rx="40" ry="22" fill="#ffc21a" stroke="#d48a00" strokeWidth="3"></ellipse>
        <path d="M52 54c8 11 26 11 32 0-10 4-22 4-32 0z" fill="#ffe266" stroke="#d48a00" strokeWidth="3" strokeLinejoin="round"></path>
        <circle cx="34" cy="30" r="17" fill="#ffc21a" stroke="#d48a00" strokeWidth="3"></circle>
        <path d="M19 29c-8 0-13 3-13 5.5s5 4.5 14 3z" fill="#ff7a1a" stroke="#c4500a" strokeWidth="3" strokeLinejoin="round"></path>
        <circle cx="32" cy="25" r="3.5" fill="#2e2e38"></circle><circle cx="33" cy="24" r="1.2" fill="#ffffff"></circle>
        <path d="M10 84q10-6 20 0t20 0 20 0 20 0 20 0" fill="none" stroke="#7cc0ff" strokeWidth="4" strokeLinecap="round"></path>
      </>
    ),
  },
  penguin: {
    viewBox: '0 0 100 100',
    art: (
      <>
        <path d="M33 88h13l-1 6H31zM54 88h13l2 6H55z" fill="#ff7a1a" stroke="#c4500a" strokeWidth="2.5" strokeLinejoin="round"></path>
        <path d="M26 46c-11 9-14 21-12 30 7-3 11-10 13-18z" fill="#2e2e38" stroke="#17171d" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M74 46c11 9 14 21 12 30-7-3-11-10-13-18z" fill="#2e2e38" stroke="#17171d" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M50 8c16 0 26 14 26 34v26c0 14-12 22-26 22S24 82 24 68V42C24 22 34 8 50 8z" fill="#2e2e38" stroke="#17171d" strokeWidth="3"></path>
        <path d="M50 32c10 0 16 9 16 21v13c0 10-7 16-16 16s-16-6-16-16V53c0-12 6-21 16-21z" fill="#f1eef7"></path>
        <circle cx="42" cy="24" r="4.5" fill="#ffffff"></circle><circle cx="58" cy="24" r="4.5" fill="#ffffff"></circle>
        <circle cx="43" cy="24.5" r="2.4" fill="#2e2e38"></circle><circle cx="57" cy="24.5" r="2.4" fill="#2e2e38"></circle>
        <path d="M44 31h12l-6 7z" fill="#ffc21a" stroke="#d48a00" strokeWidth="2" strokeLinejoin="round"></path>
      </>
    ),
  },
  fish: {
    viewBox: '0 0 120 90',
    art: (
      <>
        <path d="M42 24c6-12 22-14 30-2" fill="#ffab5e" stroke="#c4500a" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M86 45l26-21v42z" fill="#ff7a1a" stroke="#c4500a" strokeWidth="3" strokeLinejoin="round"></path>
        <ellipse cx="52" cy="45" rx="40" ry="26" fill="#ff7a1a" stroke="#c4500a" strokeWidth="3"></ellipse>
        <path d="M46 27c-5 12-5 24 0 36" fill="none" stroke="#c4500a" strokeWidth="3" strokeLinecap="round"></path>
        <circle cx="30" cy="40" r="5.5" fill="#ffffff"></circle><circle cx="29" cy="40" r="3" fill="#2e2e38"></circle>
        <path d="M15 50c3 2.5 6 2.5 9 0" fill="none" stroke="#c4500a" strokeWidth="3" strokeLinecap="round"></path>
      </>
    ),
  },
  frog: {
    viewBox: '0 0 100 94',
    art: (
      <>
        <circle cx="31" cy="30" r="14" fill="#1fb53c" stroke="#0f7a26" strokeWidth="3"></circle>
        <circle cx="69" cy="30" r="14" fill="#1fb53c" stroke="#0f7a26" strokeWidth="3"></circle>
        <ellipse cx="50" cy="60" rx="40" ry="28" fill="#1fb53c" stroke="#0f7a26" strokeWidth="3"></ellipse>
        <ellipse cx="50" cy="72" rx="22" ry="11" fill="#5fe06e"></ellipse>
        <circle cx="31" cy="29" r="8" fill="#ffffff"></circle><circle cx="69" cy="29" r="8" fill="#ffffff"></circle>
        <circle cx="32" cy="30" r="4" fill="#2e2e38"></circle><circle cx="68" cy="30" r="4" fill="#2e2e38"></circle>
        <path d="M32 52c10 9 26 9 36 0" fill="none" stroke="#0f7a26" strokeWidth="3.5" strokeLinecap="round"></path>
      </>
    ),
  },
  house: {
    viewBox: '0 0 100 94',
    art: (
      <>
        <rect x="66" y="18" width="10" height="20" fill="#b51f27"></rect>
        <rect x="20" y="44" width="60" height="42" rx="3" fill="#ffe266" stroke="#d48a00" strokeWidth="3"></rect>
        <path d="M10 47L50 13l40 34z" fill="#f03a3a" stroke="#b51f27" strokeWidth="3" strokeLinejoin="round"></path>
        <rect x="27" y="56" width="13" height="13" rx="2" fill="#7cc0ff"></rect><rect x="60" y="56" width="13" height="13" rx="2" fill="#7cc0ff"></rect>
        <rect x="43" y="62" width="14" height="24" rx="3" fill="#c4802f"></rect>
      </>
    ),
  },
  rocket: {
    viewBox: '0 0 100 100',
    art: (
      <>
        <path d="M42 78q8 20 16 0z" fill="#ffc21a"></path><path d="M46 78q4 11 8 0z" fill="#ff7a1a"></path>
        <path d="M36 54L20 80l16-5z" fill="#f03a3a" stroke="#b51f27" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M64 54l16 26-16-5z" fill="#f03a3a" stroke="#b51f27" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M50 8c14 12 18 34 16 70H34C32 42 36 20 50 8z" fill="#f1eef7"></path>
        <path d="M50 8c6 5 10 11 12 19H38c2-8 6-14 12-19z" fill="#f03a3a"></path>
        <path d="M50 8c14 12 18 34 16 70H34C32 42 36 20 50 8z" fill="none" stroke="#b9b3c9" strokeWidth="3" strokeLinejoin="round"></path>
        <circle cx="50" cy="46" r="9" fill="#7cc0ff" stroke="#2f8cff" strokeWidth="3"></circle>
      </>
    ),
  },
  rainbow: {
    viewBox: '0 0 120 90',
    art: (
      <>
        <g fill="none" strokeWidth="8">
        <path d="M14 70a46 46 0 0 1 92 0" stroke="#f03a3a"></path>
        <path d="M22 70a38 38 0 0 1 76 0" stroke="#ffc21a"></path>
        <path d="M30 70a30 30 0 0 1 60 0" stroke="#1fb53c"></path>
        <path d="M38 70a22 22 0 0 1 44 0" stroke="#2f8cff"></path>
        <path d="M46 70a14 14 0 0 1 28 0" stroke="#9b4dff"></path>
        </g>
        <g fill="#f1eef7">
        <circle cx="10" cy="74" r="9"></circle><circle cx="21" cy="68" r="11"></circle><circle cx="31" cy="76" r="8"></circle><rect x="6" y="74" width="28" height="10" rx="5"></rect>
        <circle cx="110" cy="74" r="9"></circle><circle cx="99" cy="68" r="11"></circle><circle cx="89" cy="76" r="8"></circle><rect x="86" y="74" width="28" height="10" rx="5"></rect>
        </g>
      </>
    ),
  },
  umbrella: {
    viewBox: '0 0 100 100',
    art: (
      <>
        <path d="M50 46v38a8 8 0 0 1-16 0" fill="none" stroke="#ffc21a" strokeWidth="6" strokeLinecap="round"></path>
        <path d="M8 50A42 40 0 0 1 92 50q-7-8-14 0q-7-8-14 0q-7-8-14 0q-7-8-14 0q-7-8-14 0q-7-8-14 0z" fill="#f03a3a" stroke="#b51f27" strokeWidth="3" strokeLinejoin="round"></path>
        <path d="M50 10q-14 16-14 40M50 10q14 16 14 40M50 10v40" fill="none" stroke="#b51f27" strokeWidth="3" strokeLinecap="round"></path>
        <circle cx="50" cy="8" r="3.5" fill="#b51f27"></circle>
      </>
    ),
  },
};

/** Words drawn as SVG; every other word shows its emoji. */
export const DRAWN_WORDS: readonly string[] = Object.keys(ART);

/** The picture for a word: the board's drawing when there is one, otherwise the emoji. Decorative; the button around it carries the name. */
export function WordPicture({ word, emoji }: { word: string; emoji: string }) {
  const drawing = ART[word.toLowerCase()];
  if (!drawing) {
    return (
      <span className="lb-emoji" aria-hidden="true">
        {emoji}
      </span>
    );
  }
  return (
    <svg className="lb-art" viewBox={drawing.viewBox} aria-hidden="true">
      {drawing.art}
    </svg>
  );
}
