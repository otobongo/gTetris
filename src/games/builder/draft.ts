/**
 * Picture Builder's board draft (decision 13, the board half): the half-built board of the puzzle on screen is kept
 * for the session, so a Back tap or a reload never loses it. The kit keeps that puzzle's star slips under the same
 * key prefix (`keepDraft` in game.ts), so leaving never sheds a slip either. This half never writes slips.
 *
 * Pure helpers over an injected storage (the Play screen passes window.sessionStorage: per tab, kept across a
 * reload, gone with the tab). Every access is wrapped: private browsing can throw, and then nothing is kept and the
 * game plays as it always did.
 */
import type { BoardMemory, Cell } from './board';
import { BUILDER_COLORS } from './pictures';

/** The part of Storage a draft needs. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Which puzzle a board belongs to. `level` is 0-based; `puzzleNo` is the picture on screen (0 to 5). */
export interface BoardPlace {
  playerId: string;
  level: number;
  set: string;
  puzzleNo: number;
}

/** `bw:draft:{player}:builder:{level}:{set}:0:{puzzle}:board`; the seed is always 0 (the pictures are fixed). */
export const boardKey = (p: BoardPlace): string => `bw:draft:${p.playerId}:builder:${p.level}:${p.set}:0:${p.puzzleNo}:board`;

const isCell = (c: unknown): c is Cell => c === null || (typeof c === 'string' && (BUILDER_COLORS as readonly string[]).includes(c));

/** A wrong brick's slip key ("5:red") on a board of `squares` squares. */
function isSlipKey(k: unknown, squares: number): k is string {
  if (typeof k !== 'string') return false;
  const [at, color, ...rest] = k.split(':');
  return rest.length === 0 && /^\d+$/.test(at) && Number(at) < squares && isCell(color) && color !== null;
}

/** The valid slip keys of a stored list, each once. Anything else in it is left out. */
const slipKeys = (list: unknown, squares: number): string[] =>
  Array.isArray(list) ? [...new Set(list.filter((k): k is string => isSlipKey(k, squares)))] : [];

/** The draft under `key` for an n by n puzzle, or null when there is none, it is not ours, or it cannot be read. */
function readDraft(storage: DraftStorage | null, key: string, size: number): (BoardMemory & { cells: Cell[] }) | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const d: unknown = JSON.parse(raw);
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return null;
    const { v, size: n, cells, seen, given } = d as Record<string, unknown>;
    if (v !== 1 || n !== size || !Array.isArray(cells) || cells.length !== size * size || !cells.every(isCell)) return null;
    return { cells: cells.slice(), seen: slipKeys(seen, size * size), given: slipKeys(given, size * size) };
  } catch {
    return null;
  }
}

/** The board kept under `key` for an n by n puzzle, or null when there is none, it is not ours, or it cannot be read. */
export const loadBoard = (storage: DraftStorage | null, key: string, size: number): Cell[] | null =>
  readDraft(storage, key, size)?.cells ?? null;

/** What the board under `key` remembers; nothing when it kept no memory or there is no usable draft. */
export function loadMemory(storage: DraftStorage | null, key: string, size: number): BoardMemory {
  const d = readDraft(storage, key, size);
  return { seen: d?.seen ?? [], given: d?.given ?? [] };
}

/**
 * Keep the board and what it remembers. A board with nothing on it and nothing to remember is not kept, so its draft
 * goes; an erased board that still remembers a wrong brick stays, or laying that brick again would count as new.
 */
export function saveBoard(storage: DraftStorage | null, key: string, size: number, cells: readonly Cell[], memory?: BoardMemory): void {
  if (!storage) return;
  const remembers = (memory?.seen.length ?? 0) > 0;
  if (!remembers && cells.every((c) => c === null)) return clearBoard(storage, key);
  try {
    storage.setItem(key, JSON.stringify(remembers ? { v: 1, size, cells, seen: memory?.seen, given: memory?.given } : { v: 1, size, cells }));
  } catch {
    // full or blocked: the board is simply not kept
  }
}

export function clearBoard(storage: DraftStorage | null, key: string): void {
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
