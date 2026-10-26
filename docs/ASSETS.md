# Assets and licensing

## Current M0 assets

All current game assets are **original placeholders created specifically for this project**. No
third-party character sprites, logos, fonts, music, or sound files are included.

| Asset                                       | Location                                                  | Type                  | Notes                                                                                                      |
| ------------------------------------------- | --------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| Character/enemy portraits                   | `src/components/CreatureAvatar.tsx`                       | Inline SVG + PNG icon | Original shapes for the two heroes; the Green Venom Falcon uses a generated provisional icon               |
| Battlefield creatures, effects, health bars | `src/game/rendering/scenes/BattleScene.ts`                | Phaser Graphics       | Drawn at runtime; no texture files. Green Venom Falcon art is placeholder until its own spritesheet exists |
| UI chrome, icons                            | `src/styles/global.css`, `src/components/Icon.tsx`        | CSS/SVG               | Original                                                                                                   |
| App icon                                    | `public/icons/icon.svg`, `public/icons/icon-maskable.svg` | SVG                   | Original croc emblem                                                                                       |
| Sound effects                               | `src/audio/soundManager.ts`                               | Web Audio oscillators | Synthesized at runtime; no audio files                                                                     |
| Fonts                                       | System font stack                                         | System                | `Trebuchet MS`, `Segoe UI`, `Avenir Next`, `system-ui`                                                     |

## Licensing

The repository code is MIT licensed (see `LICENSE`). The original placeholder artwork, icons, and
synthesized sound definitions in this repository are distributed with the project under the same
MIT license. This does **not** grant rights to any third-party trademarks, characters, or assets
that may appear in inspiration material; none are bundled here.

If future milestones add external assets, each asset must be recorded here with:

- source and author;
- license identifier;
- attribution requirements;
- local file path;
- whether modification/redistribution is allowed.

Do not assume that a future third-party asset is MIT merely because the code is MIT.

## Replacement strategy

The rendering layers address creatures by stable IDs:

- `laser-crocodile`
- `lightning-scorpion`
- `mini-brainrot`
- `armored-slug`
- `shadow-runner`
- `mega-brainrot-gorilla`
- `green-venom-falcon` (generated provisional spritesheets; see `docs/green-venom-falcon/ASSET_LIST.md` and `ASSET_GUIDE.txt`)

A future asset catalog can map these IDs to sprite sheets or individual textures. Domain code,
commands, saves, and combat must not change when art is replaced.

## Screenshots

Screenshots in `docs/screenshots/` were captured from the actual local production build using
Playwright. They contain only original game visuals.
