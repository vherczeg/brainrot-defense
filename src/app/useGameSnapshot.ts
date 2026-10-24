import { useSyncExternalStore } from 'react';
import type { AppSnapshot, GameController } from './controller';

export function useGameSnapshot(controller: GameController): AppSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
