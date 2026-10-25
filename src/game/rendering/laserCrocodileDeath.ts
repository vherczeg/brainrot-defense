export interface LaserDeathSprite {
  once(event: string, handler: () => void): unknown;
  off(event: string, handler: () => void): unknown;
  play(key: string): unknown;
  readonly anims: {
    readonly isPlaying: boolean;
    readonly currentAnim: { readonly key: string } | null;
  };
}

export function playLaserCrocodileDeathOnce(
  sprite: LaserDeathSprite,
  deathKey: string,
  animationExists: boolean,
  hide: () => void,
): () => void {
  if (!animationExists) {
    hide();
    return () => {};
  }
  const event = `animationcomplete-${deathKey}`;
  const handler = () => {
    hide();
    sprite.off(event, handler);
  };
  sprite.once(event, handler);
  if (!(sprite.anims.isPlaying && sprite.anims.currentAnim?.key === deathKey)) {
    sprite.play(deathKey);
  }
  return () => sprite.off(event, handler);
}
