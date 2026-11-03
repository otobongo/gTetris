import { type Cell, type Level, type State, isSolved, occupancy, reachable, withMove } from './engine';

export interface Move {
  block: number;
  /** destination anchor, or null when the brick leaves the board */
  to: Cell | null;
}

export interface Solution {
  moves: Move[];
  explored: number;
}

const key = (s: State) => s.pos.map((p) => (p ? `${p[0]}.${p[1]}` : 'x')).join('|');

/**
 * Breadth-first search where one move = one drag of one brick (to any spot it can reach, or out of a gate).
 * Pruning: if any brick can leave right now we only take that move. Leaving never hurts (it frees space and
 * melts ice), and that brick needs exactly one move to leave either way, so this keeps the answer optimal.
 * Returns null if no solution within `limit` explored states.
 */
export function solve(level: Level, start: State, limit = 250_000): Solution | null {
  if (isSolved(start)) return { moves: [], explored: 0 };
  const startKey = key(start);
  const parent = new Map<string, { prev: string; move: Move } | null>([[startKey, null]]);
  const states = new Map<string, State>([[startKey, start]]);
  let frontier = [startKey];
  let explored = 0;

  while (frontier.length) {
    const next: string[] = [];
    for (const k of frontier) {
      const s = states.get(k)!;
      explored++;
      if (explored > limit) return null;
      const occ = occupancy(level, s);
      const candidates: Move[] = [];
      let exitMove: Move | null = null;
      for (let i = 0; i < level.blocks.length && !exitMove; i++) {
        if (!s.pos[i]) continue;
        const reach = reachable(level, s, i, occ);
        if (reach.exit) exitMove = { block: i, to: null };
        else for (const spot of reach.spots.values()) candidates.push({ block: i, to: spot });
      }
      for (const m of exitMove ? [exitMove] : candidates) {
        const ns = withMove(s, m.block, m.to);
        const nk = key(ns);
        if (parent.has(nk)) continue;
        parent.set(nk, { prev: k, move: m });
        if (isSolved(ns)) {
          const moves: Move[] = [];
          let cur: string = nk;
          for (let p = parent.get(cur); p; p = parent.get(cur)) {
            moves.push(p.move);
            cur = p.prev;
          }
          return { moves: moves.reverse(), explored };
        }
        states.set(nk, ns);
        next.push(nk);
      }
      states.delete(k);
    }
    frontier = next;
  }
  return null;
}
