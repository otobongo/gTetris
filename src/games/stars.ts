/**
 * The one star cap every game uses (decision D2): using a hint, or running out of a counted clock,
 * caps the level at 2 stars. It only ever costs the third star, never more, and both together
 * still cost only that one star.
 */
export const MAX_STARS = 3;
export const CAPPED_STARS = 2;

export interface StarCaps {
  usedHint?: boolean;
  /** Only a counted clock can run out; a relaxed sand timer or no timer never sets this. */
  outOfTime?: boolean;
}

/** Applies the cap to the stars a game's own rule gave. Values outside 0 to 3 are pulled back in. */
export function capStars(stars: number, { usedHint = false, outOfTime = false }: StarCaps = {}): number {
  const s = Number.isFinite(stars) ? Math.min(MAX_STARS, Math.max(0, Math.round(stars))) : 0;
  return usedHint || outOfTime ? Math.min(CAPPED_STARS, s) : s;
}

/**
 * The line a game shows next to its own star rule, naming only the caps that apply to it:
 * capRule({ hint: true }) is "Using a hint caps the level at 2 stars." Empty when neither applies.
 */
export function capRule({ hint = false, clock = false }: { hint?: boolean; clock?: boolean }, noun = 'level'): string {
  const what = hint && clock ? 'Using a hint, or running out of time,' : hint ? 'Using a hint' : clock ? 'Running out of time' : '';
  return what ? `${what} caps the ${noun} at ${CAPPED_STARS} stars.` : '';
}
