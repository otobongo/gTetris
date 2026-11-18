/**
 * The kit half of a puzzle draft (decision 13): a game that sets `keepDraft` (Picture Builder only)
 * keeps the star slips of the puzzle on screen for the session, so leaving and coming back can never
 * shed a slip. The game keeps its own half (Picture Builder's board) under the same key prefix.
 *
 * Pure helpers over an injected storage (the hook passes window.sessionStorage). Every access is
 * wrapped: private browsing can throw, and then nothing is kept and the game plays as it always did.
 */

/** The part of Storage a draft needs. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The slips of one puzzle: the star slips counted and the wrong keys already given. */
export interface SlipDraft {
  slips: number;
  wrongKeys: string[];
}

/** Which puzzle a draft belongs to. `level` is 0-based, `puzzleNo` is the puzzle on screen (0 to 5). */
export interface DraftPlace {
  playerId: string;
  game: string;
  level: number;
  set: string;
  seed: number;
  puzzleNo: number;
}

/** `bw:draft:{player}:{game}:{level}:{set}:{seed}:{puzzle}:slips` */
export const draftKey = (p: DraftPlace): string => `bw:draft:${p.playerId}:${p.game}:${p.level}:${p.set}:${p.seed}:${p.puzzleNo}:slips`;

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** The draft under `key`, or null when there is none, it is not ours, or the storage cannot be read. */
export function loadDraft(storage: DraftStorage | null, key: string): SlipDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const d: unknown = JSON.parse(raw);
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return null;
    const { v, slips, wrongKeys } = d as Record<string, unknown>;
    if (v !== 1 || !isCount(slips) || !Array.isArray(wrongKeys) || !wrongKeys.every((k) => typeof k === 'string')) return null;
    const keys = [...new Set(wrongKeys as string[])];
    // every wrong key was a star slip once, so fewer slips than keys is not a draft we wrote
    if (slips < keys.length) return null;
    return { slips, wrongKeys: keys };
  } catch {
    return null;
  }
}

export function saveDraft(storage: DraftStorage | null, key: string, d: SlipDraft): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ v: 1, slips: d.slips, wrongKeys: d.wrongKeys }));
  } catch {
    // full or blocked: the draft is simply not kept
  }
}

export function clearDraft(storage: DraftStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // blocked: nothing was kept either
  }
}

/** window.sessionStorage, or null where there is none or reaching it throws. */
export function sessionDrafts(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : (window.sessionStorage ?? null);
  } catch {
    return null;
  }
}
