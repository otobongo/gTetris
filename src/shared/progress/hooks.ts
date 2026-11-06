import { useSyncExternalStore } from 'react';
import { activePlayer } from './model';
import { progressStore } from './store';
import type { Player, ProgressState, Settings } from './types';

const subscribe = (cb: () => void) => progressStore.subscribe(cb);

/** The whole progress state; re-renders on every change. */
export function useProgressState(): ProgressState {
  return useSyncExternalStore(subscribe, progressStore.getState, progressStore.getState);
}

/** The child who is playing now, or null before anyone is set up. */
export function useActivePlayer(): Player | null {
  return activePlayer(useProgressState());
}

/** Family settings: sound, music, voice, alerts. */
export function useSettings(): Settings {
  return useProgressState().settings;
}
