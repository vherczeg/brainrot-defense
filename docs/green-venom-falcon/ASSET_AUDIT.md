# Zöld Méreg Sólyom – vizuális audit (M3.3)

## Kiindulás

- Jelenlegi játékasset: `public/assets/units/green-venom-falcon/` és
  `public/assets/effects/green-venom-falcon/`
- Státusz: `generated-concept-placeholder-pending-abel-approval`
- Összehasonlítási alap:
  - `public/assets/units/laser-crocodile/frames/v1-idle/00.png`
  - `public/assets/units/lightning-scorpion/frames/v1-idle/00.png`
  - `docs/green-venom-falcon/contact-sheet.png`
  - `docs/green-venom-falcon/preview.gif`
  - `docs/green-venom-falcon/qa/` képernyőképek

Új vizuális irány referenciák (nem játékassetek):

- `docs/green-venom-falcon/visual-v2/reference-sheet.png`
- `docs/green-venom-falcon/visual-v2/current-vs-direction.png`

## Megállapított hibák

| #   | Hiba                              | Súlyosság | Ok                                                                                                                       |
| --- | --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Bagoly/nyúl sziluett              | blokkoló  | A két felfelé álló, tollszerű forma fülként olvas; a test elölnézetű, gömbölyű.                                          |
| 2   | Nem felismerhető ragadozó madár   | blokkoló  | A csőr kicsi, egyenes, nem horgas; a fej kerek, ragadozómadár-szög nélkül.                                               |
| 3   | Karmok alig láthatók              | blokkoló  | A karmok a 150 px-es játékméretnél összeolvadnak a lábbal és az árnyékkal.                                               |
| 4   | Lapos, vektoros megjelenés        | magas     | Nincs tollrétegzés, anyagszerű árnyalás, peremfény; a Laser Crocodile / Lightning Scorpion festettebb, részletgazdagabb. |
| 5   | Nem D – Mini Fantasy Action szint | magas     | A forma- és fénykezelés nem éri el a meglévő karakterek szintjét.                                                        |
| 6   | Animációs pózok gyengék           | magas     | A karmolás/méreg/spin pózok nem elég karakteresek; a szárnyak nem anatómiai szárnyként mozognak.                         |

## Mi javítható programozottan?

Részben javítható vektoros eszközökkel:

- a sziluett és az arányok (oldalnézet, nem fül-szerű szárnyak);
- a csőr horgas formája és a fej szögletesebb ragadozómadár-kialakítása;
- a karmok mérete és kontrasztja;
- a színpaletta és a zöld méreg hangsúlya;
- pivot, lábmagasság, frame-igazítás;
- animációs pózok durva testtartása.

Ezekre készült a `visual-v2/reference-sheet.png` **silhouette/material referencia**, amely
nem játékasset és nem végleges grafika.

## Mi NEM hozható létre elfogadható szinten procedurális vektorral?

A kért prémium fantasy minőséghez új, illusztrált assetek kellenek:

- festett tollrétegek, finom tollszélek és anyagszerű textúra;
- arcfestés, ragadozómadár-anatómia, kifejező szem/brow és horgas csőr részletei;
- erős fény-árnyék és peremfény;
- nagy felbontású, következetes rajz mind a 8 animáció minden kulcspózán;
- a Laser Crocodile / Lightning Scorpion szintjéhez illeszkedő illusztrációs stílus.

**A jelenlegi vektoros generátor ezt nem tudja megbízhatóan előállítani. Nem állítom, hogy a
v2 referencia végleges grafika.**

## Döntés

- A jelenlegi M3.2 játékassetek **változatlanul** a játékban maradnak, továbbra is
  ideiglenes placeholderként.
- Az új v2 referencia **nem került be** a játékba, és nem nevezzük véglegesnek.
- A végleges assetek specifikációja: `docs/green-venom-falcon/FINAL_ASSET_SPEC.md`.
- A csere csak Ábel jóváhagyása után történhet, a manifest/pivot kompatibilitás megtartásával.
