# Zöld Méreg Sólyom – assetlista (M3.2)

Státusz: **generált koncepció / ideiglenes placeholder, Ábel jóváhagyása szükséges.**
Nem végleges karaktergrafika. A végleges assetek ugyanezeket az útvonalakat és frame-számokat
használhatják, így a csere a rendering layerben marad.

## Közös specifikáció

- Frame méret: **256 × 256 px**, RGBA, átlátszó háttér.
- Formátum: vízszintes spritesheet, frame-ek balról jobbra.
- Origin: egység **0.5, 0.88**; effektek **0.5, 0.5**.
- Ajánlott megjelenítési szélesség: 190 px (a játékban 150 px-re skálázva).
- Nézési irány: balra.
- Stílus: **D – Mini fantasy akció**, gyermekbarát, de félelmetes.
- Vizuális referencia: barna tollazat, nagy erőteljes szárnyak, hatalmas fekete karmok,
  zöld méregnyál és zöld pajzsaura, sárga szemek, sötét csőr.
- Paletta: barna `#8b5a2b`, sötétbarna `#4a2a12`, világosbarna `#c08a4a`,
  fekete karom `#070707`, méregzöld `#7dff5a` / `#2f9b3c`, szem `#ffe45c`.

## Karakteranimációk

| Fájl                                                            |    Méret | Frame | FPS | Lejátszás | Tartalom                                |
| --------------------------------------------------------------- | -------: | ----: | --: | --------- | --------------------------------------- |
| `public/assets/units/green-venom-falcon/idle.png`               | 1024×256 |     4 |   5 | loop      | lélegzés, finom szárnymozgás            |
| `public/assets/units/green-venom-falcon/fly.png`                | 1024×256 |     4 |  10 | loop      | repülés, szárnycsapkodás                |
| `public/assets/units/green-venom-falcon/claw.png`               | 1536×256 |     6 |  12 | once      | karmolás, kinyúló fekete karmok         |
| `public/assets/units/green-venom-falcon/poison.png`             | 1536×256 |     6 |  10 | once      | méregköpés a csőrből                    |
| `public/assets/units/green-venom-falcon/spin.png`               | 1536×256 |     6 |  12 | loop      | teljes sebességű forgás, ép pajzs       |
| `public/assets/units/green-venom-falcon/spin-break.png`         | 1536×256 |     6 |   6 | loop      | felezett sebességű forgás, tört pajzs   |
| `public/assets/units/green-venom-falcon/hurt.png`               | 1024×256 |     4 |  12 | once      | sérülés, vörös visszajelzés             |
| `public/assets/units/green-venom-falcon/death.png`              | 2048×256 |     8 |   8 | once      | oldalra dőlő, tollakat hullató legyőzés |
| `public/assets/units/green-venom-falcon/green-venom-falcon.png` |  256×256 |     1 |   – | statikus  | portré / static fallback                |
| `public/assets/icons/green-venom-falcon.png`                    |  256×256 |     1 |   – | statikus  | wave preview / avatar ikon              |

## Effektanimációk

| Fájl                                                             |    Méret | Frame | FPS | Lejátszás | Tartalom                                  |
| ---------------------------------------------------------------- | -------: | ----: | --: | --------- | ----------------------------------------- |
| `public/assets/effects/green-venom-falcon/poison-projectile.png` | 1024×256 |     4 |  12 | once      | zöld méreglövedék                         |
| `public/assets/effects/green-venom-falcon/poison-muzzle.png`     | 1024×256 |     4 |  12 | once      | méregköpés a csőrnél                      |
| `public/assets/effects/green-venom-falcon/poison-impact.png`     | 1024×256 |     4 |  14 | once      | zöld becsapódás                           |
| `public/assets/effects/green-venom-falcon/spin-aura.png`         | 1536×256 |     6 |  12 | loop      | forgó zöld pajzsaura                      |
| `public/assets/effects/green-venom-falcon/spin-break.png`        | 1536×256 |     6 |  12 | once      | pajzstörés, zöld szilánkok                |
| `public/assets/effects/green-venom-falcon/earthquake.png`        | 1536×256 |     6 |  12 | once      | földrengés-hullám a 2 mp-es fagyasztáshoz |
| `public/assets/effects/green-venom-falcon/defeat.png`            | 2048×256 |     8 |   8 | once      | boss legyőzés, tollak + zöld robbanás     |

## Manifest és generálás

- Manifest: `public/assets/units/green-venom-falcon/manifest.json`
- Generátor: `scripts/build-green-venom-falcon-sprites.mjs`
- Generált asset-jelentés: `docs/green-venom-falcon/generated-assets.json`
- Contact sheet: `docs/green-venom-falcon/contact-sheet.png`

## Mi kell Ábel jóváhagyásához / véglegesítéshez?

1. Ábel nézze meg a contact sheetet és a 20. hullám QA képernyőképeit.
2. Erősítse meg a színeket, a szárnyak méretét, a karmok formáját és a fej/arányokat.
3. Ha a jelenlegi generált irány megfelel, a `manifest.json` `artStatus` mezője
   véglegesre vált, és a képek végleges assetként dokumentálhatók.
4. Ha nem, a végleges festett/AI-assetek ugyanezeken az útvonalakon, 256×256-os
   frame-ekkel és a fenti frame-számokkal cserélhetők. A játéklogikához nem kell nyúlni.
