/* Pure answer checking for Letter Builder. The UI keeps these states in React and only renders them. */
import { capRule, capStars } from '../stars';
import type { FillPrompt, MatchPrompt, SoundPrompt, Tile } from './levels';

/* ---------- Stars ---------- */

/** Slips are wrong taps. A hint is not a slip: it caps the level at 2 stars (the shared rule, games/stars.ts). */
export const STAR_RULE = `3 stars: 0 to 1 slips · 2 stars: 2 to 4 · 1 star: 5 or more. ${capRule({ hint: true })}`;

export function starsForSlips(slips: number): number {
  if (slips <= 1) return 3;
  if (slips <= 4) return 2;
  return 1;
}

/** Stars for a finished level: the slip rule, then the shared hint cap, so a hint costs only the third star. */
export function lettersStars(slips: number, usedHint: boolean): number {
  return capStars(starsForSlips(slips), { usedHint });
}

export const HINTS_PER_LEVEL = 3;

/* ---------- Fill (train, missing letters, spelling) ---------- */

export interface FillState {
  /** tile id placed in each cell; null = empty. Given cells stay null and are drawn from prompt.cells. */
  placed: (string | null)[];
}

export const newFill = (p: FillPrompt): FillState => ({ placed: p.cells.map(() => null) });

/** Index of the cell the next brick goes into, or -1 when the row is complete. */
export function nextCell(p: FillPrompt, s: FillState): number {
  return p.cells.findIndex((_, i) => !p.given[i] && s.placed[i] === null);
}

export const fillDone = (p: FillPrompt, s: FillState) => nextCell(p, s) === -1;

export function usedIds(s: FillState): Set<string> {
  return new Set(s.placed.filter((x): x is string => x !== null));
}

export type TapResult = 'correct' | 'wrong' | 'ignored';

/** Try a tray brick. Only the right letter for the next cell snaps in; any brick with that letter counts. */
export function tapFill(p: FillPrompt, s: FillState, tileId: string): { state: FillState; result: TapResult } {
  const at = nextCell(p, s);
  const tile = p.tray.find((t) => t.id === tileId);
  if (at < 0 || !tile || usedIds(s).has(tileId)) return { state: s, result: 'ignored' };
  if (tile.ch !== p.cells[at]) return { state: s, result: 'wrong' };
  const placed = s.placed.slice();
  placed[at] = tileId;
  return { state: { placed }, result: 'correct' };
}

/** Keyboard: find a free tray brick showing this letter (case-insensitive), preferring the correct one. */
export function tileForKey(p: FillPrompt, s: FillState, key: string): string | null {
  const used = usedIds(s);
  const free = p.tray.filter((t) => !used.has(t.id) && t.ch.toUpperCase() === key.toUpperCase());
  return free[0]?.id ?? null;
}

/** Hint: a free brick that fits the next cell. */
export function hintFill(p: FillPrompt, s: FillState): string | null {
  const at = nextCell(p, s);
  if (at < 0) return null;
  const used = usedIds(s);
  return p.tray.find((t) => !used.has(t.id) && t.ch === p.cells[at])?.id ?? null;
}

/* ---------- Match (upper with lower case) ---------- */

export interface MatchState {
  /** uppercase letters already paired */
  matched: string[];
  selected: { side: 'upper' | 'lower'; id: string } | null;
}

export const newMatch = (): MatchState => ({ matched: [], selected: null });

export const matchDone = (p: MatchPrompt, s: MatchState) => s.matched.length === p.letters.length;

function tileOf(p: MatchPrompt, side: 'upper' | 'lower', id: string): Tile | undefined {
  return (side === 'upper' ? p.upper : p.lower).find((t) => t.id === id);
}

export type MatchResult = 'select' | 'pair' | 'wrong' | 'ignored';

export function tapMatch(
  p: MatchPrompt,
  s: MatchState,
  side: 'upper' | 'lower',
  id: string,
): { state: MatchState; result: MatchResult; other?: string } {
  const tile = tileOf(p, side, id);
  if (!tile || s.matched.includes(tile.ch.toUpperCase())) return { state: s, result: 'ignored' };
  const sel = s.selected;
  if (!sel || sel.side === side) return { state: { ...s, selected: { side, id } }, result: 'select' };
  const other = tileOf(p, sel.side, sel.id)!;
  if (other.ch.toUpperCase() === tile.ch.toUpperCase()) {
    return { state: { matched: [...s.matched, tile.ch.toUpperCase()], selected: null }, result: 'pair', other: sel.id };
  }
  return { state: { ...s, selected: null }, result: 'wrong', other: sel.id };
}

/** Hint: the partner of the selected brick, or else both bricks of the first unpaired letter. */
export function hintMatch(p: MatchPrompt, s: MatchState): string[] {
  if (s.selected) {
    const t = tileOf(p, s.selected.side, s.selected.id)!;
    const list = s.selected.side === 'upper' ? p.lower : p.upper;
    const partner = list.find((x) => x.ch.toUpperCase() === t.ch.toUpperCase());
    return partner ? [partner.id] : [];
  }
  const letter = p.upper.find((t) => !s.matched.includes(t.ch))?.ch;
  if (!letter) return [];
  return [p.upper.find((t) => t.ch === letter)!.id, p.lower.find((t) => t.ch === letter.toLowerCase())!.id];
}

/* ---------- First sounds ---------- */

export const checkSound = (p: SoundPrompt, ch: string) => ch.toUpperCase() === p.answer.toUpperCase();

export const hintSound = (p: SoundPrompt) => p.options.find((t) => t.ch === p.answer)?.id ?? null;
