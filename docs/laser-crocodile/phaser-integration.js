// Phaser 3 integration example. Copy into the project before importing.
const ANIMATIONS = [
  {
    "key": "lc-v1-idle",
    "url": "/assets/units/laser-crocodile/v1-idle.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 5,
    "repeat": -1,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v1-walk",
    "url": "/assets/units/laser-crocodile/v1-walk.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 9,
    "repeat": -1,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v1-attack",
    "url": "/assets/units/laser-crocodile/v1-attack.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 10,
    "repeat": 0,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v1-hurt",
    "url": "/assets/units/laser-crocodile/v1-hurt.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 10,
    "repeat": 0,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v2-idle",
    "url": "/assets/units/laser-crocodile/v2-idle.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 5,
    "repeat": -1,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v2-walk",
    "url": "/assets/units/laser-crocodile/v2-walk.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 9,
    "repeat": -1,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v2-attack",
    "url": "/assets/units/laser-crocodile/v2-attack.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 10,
    "repeat": 0,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v2-hurt",
    "url": "/assets/units/laser-crocodile/v2-hurt.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 10,
    "repeat": 0,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v3-idle",
    "url": "/assets/units/laser-crocodile/v3-idle.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 5,
    "repeat": -1,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v3-walk",
    "url": "/assets/units/laser-crocodile/v3-walk.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 9,
    "repeat": -1,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v3-attack",
    "url": "/assets/units/laser-crocodile/v3-attack.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 10,
    "repeat": 0,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-v3-hurt",
    "url": "/assets/units/laser-crocodile/v3-hurt.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 10,
    "repeat": 0,
    "origin": [
      0.5,
      0.875
    ]
  },
  {
    "key": "lc-fx-laser-bolt",
    "url": "/assets/effects/laser-crocodile/laser-bolt.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 12,
    "repeat": -1,
    "origin": [
      0.5,
      0.5
    ]
  },
  {
    "key": "lc-fx-muzzle-flash",
    "url": "/assets/effects/laser-crocodile/muzzle-flash.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 16,
    "repeat": 0,
    "origin": [
      0.5,
      0.5
    ]
  },
  {
    "key": "lc-fx-impact",
    "url": "/assets/effects/laser-crocodile/impact.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 14,
    "repeat": 0,
    "origin": [
      0.5,
      0.5
    ]
  },
  {
    "key": "lc-fx-upgrade",
    "url": "/assets/effects/laser-crocodile/upgrade.png",
    "frameWidth": 256,
    "frameHeight": 256,
    "frames": 4,
    "fps": 10,
    "repeat": 0,
    "origin": [
      0.5,
      0.5
    ]
  }
];

export function preloadLaserCrocodile(scene, baseUrl = '/') {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  for (const asset of ANIMATIONS) {
    scene.load.spritesheet(asset.key, base + asset.url.replace(/^\//, ''), {
      frameWidth: asset.frameWidth, frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerLaserCrocodileAnimations(scene) {
  for (const asset of ANIMATIONS) {
    if (scene.anims.exists(asset.key)) continue;
    scene.anims.create({
      key: asset.key,
      frames: scene.anims.generateFrameNumbers(asset.key, { start: 0, end: asset.frames - 1 }),
      frameRate: asset.fps, repeat: asset.repeat,
    });
  }
}

export function laserCrocodileTier(mergeRank) {
  return mergeRank >= 8 ? 'v3' : mergeRank >= 4 ? 'v2' : 'v1';
}

// Keep completion handlers private and remove them when a new action interrupts.
const completionHandlers = new WeakMap();
export function playLaserCrocodileAction(sprite, mergeRank, state, returnTo = 'idle') {
  const states = ['idle', 'walk', 'attack', 'hurt'];
  if (!states.includes(state) || !['idle', 'walk'].includes(returnTo)) {
    throw new Error('Unknown laser crocodile animation state');
  }
  const tier = laserCrocodileTier(mergeRank);
  const key = `lc-${tier}-${state}`;
  if (sprite.anims.isPlaying && sprite.anims.currentAnim?.key === key) return;
  const previous = completionHandlers.get(sprite);
  if (previous) sprite.off(previous.event, previous.handler);
  completionHandlers.delete(sprite);
  if (state === 'attack' || state === 'hurt') {
    const event = 'animationcomplete-' + key;
    const handler = () => {
      completionHandlers.delete(sprite);
      sprite.play(`lc-${tier}-${returnTo}`);
    };
    completionHandlers.set(sprite, { event, handler });
    sprite.once(event, handler);
  }
  sprite.play(key);
}
