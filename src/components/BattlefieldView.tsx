import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import type { GameController } from '../app/controller';
import { BattleScene, SCENE_HEIGHT, SCENE_WIDTH } from '../game/rendering/scenes/BattleScene';

export function BattlefieldView({ controller }: { controller: GameController }) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      transparent: true,
      backgroundColor: 'rgba(0,0,0,0)',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [new BattleScene(controller)],
      audio: { noAudio: true },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
      fps: {
        target: 60,
        forceSetTimeOut: false,
      },
    });
    return () => {
      game.destroy(true);
    };
  }, [controller]);

  return (
    <div className="battlefield" data-testid="battlefield">
      <div ref={parentRef} className="battlefield__canvas" />
    </div>
  );
}
