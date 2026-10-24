import { createContext, useContext, type ReactNode } from 'react';
import type { GameController } from './controller';

const ControllerContext = createContext<GameController | null>(null);

export function ControllerProvider({
  controller,
  children,
}: {
  controller: GameController;
  children: ReactNode;
}) {
  return <ControllerContext.Provider value={controller}>{children}</ControllerContext.Provider>;
}

export function useGameController(): GameController {
  const controller = useContext(ControllerContext);
  if (!controller) throw new Error('GameController context is missing');
  return controller;
}
