# Zöld Méreg Sólyom – végleges asset specifikáció (illusztrátornak)

Státusz: **JÓVÁHAGYÁSRA VÁRÓ SPECIFIKÁCIÓ**, nem elkészült végleges grafika.
Ábel karakterkoncepcióját nem lehet megváltoztatni; ez a spec a minőségi megvalósítást írja le.

## Cél

A 20. hullám főellensége legyen ugyanabban a D – Mini Fantasy Action minőségben, mint a
Laser Crocodile és a Lightning Scorpion. A jelenlegi vektoros placeholder nem elfogadható
végleges grafikaként.

Referenciák:

- `docs/green-venom-falcon/visual-v2/reference-sheet.png` – sziluett/anyag irány, nem végleges
- `docs/green-venom-falcon/visual-v2/current-vs-direction.png` – jelenlegi vs. kívánt irány
- `public/assets/units/laser-crocodile/frames/v1-idle/00.png` – minőségi viszonyítás
- `public/assets/units/lightning-scorpion/frames/v1-idle/00.png` – minőségi viszonyítás

## Kötelező karakterjegyek

- Barna, rétegezett tollazat; világosbarna mellkas, sötétbarna szárny/tollhegyek.
- Nagy, anatómiailag felismerhető szárnyak. **Tilos** a felfelé álló, fülként olvasható
  tollforma.
- Hangos, horgas ragadozómadár-csőr, sötét szarvval/éllel; alatta sötét malar stripe.
- Mérges, sárga szem, erős szemöldökgerenda, ragadozómadár-fej.
- **Óriási fekete karmok**: 3 elülső + 1 hátsó karom lábonként, 150 px megjelenítésnél is
  jól elkülönülő, vastag, fekete sziluett.
- élénk toxikus zöld méreg a csőrnél, a karmokon és a mellkasi résen; nem gore, gyerekbarát.
- Páncélszerű tolllemezek, arany/zöld peremekkel; festett fény-árnyék, peremfény.
- Félelmetes, de gyerekbarát; nem valósághű véres ábrázolás.

## Technikai követelmények

- Frame: **256 × 256 px**, RGBA, átlátszó háttér (a master lehet 512×512 vagy 1024×1024,
  de az integrált strip 256-os frame-ekből áll).
- Formátum: vízszintes spritesheet, frame-ek balról jobbra, külön PNG frame-ek is átadhatók.
- Origin: **0.5, 0.88**; lábtalp-vonal minden frame-ben azonos (y = 224 a 256-os frame-ben).
- Középpont: x = 128; frame-enként max. ±2 px eltérés, ugrálás nélkül.
- Nézési irány: balra.
- Ajánlott megjelenítési szélesség: 190 px (játékban 150 px-re skálázva).
- A frame-ek nem lehetnek duplikáltak; minden kulcspóz külön rajz.
- A karmok, csőr, szárnyhegyek nem lóghatnak ki a 256-os frame-ből.

## Animációk (8 állapot)

| Állapot      | Frame | FPS | Lejátszás | Póz-követelmény                                                                                  |
| ------------ | ----: | --: | --------- | ------------------------------------------------------------------------------------------------ |
| `idle`       |     4 |   5 | loop      | lélegzés, szárny finom összehúzódása, fej mikromozgása; stabil láb                               |
| `fly`        |     4 |  10 | loop      | valódi szárnycsapás, testemelkedés, lábak behúzva; nem fülként mozgó szárny                      |
| `claw`       |     6 |  12 | once      | 1–2. felkészülés, 3–4. kitörés, 5. karmok találkozása, 6. visszahúzás; karmok külön olvashatók   |
| `poison`     |     6 |  10 | once      | 1–2. csőr kinyílik, 3–4. zöld méreg kilövell a csőr elülső végéből, 5. méregnyál, 6. visszazárás |
| `spin`       |     6 |  12 | loop      | teljes sebességű forgás, ép zöld szárnypajzs, szárnyak test köré zárva; sebezhetetlen állapot    |
| `spin-break` |     6 |   6 | loop      | láthatóan felezett sebesség, pajzs tört/szilánkos, szárnyak nyitottak; sebezhető állapot         |
| `hurt`       |     4 |  12 | once      | hátralökődés, összeszűkülő szem, tollrezgés; nem esik szét a sziluett                            |
| `death`      |     8 |   8 | once      | 1–3. találat, 4–6. oldalra dőlés, 7–8. földön fekvés/tollak; látványos, de gyerekbarát           |

## Effektek (7 típus)

| Effekt              | Frame | FPS | Lejátszás | Követelmény                                            |
| ------------------- | ----: | --: | --------- | ------------------------------------------------------ |
| `poison-projectile` |     4 |  12 | once      | fényes zöld méreglövedék, sötét háttéren is olvasható  |
| `poison-muzzle`     |     4 |  12 | once      | a csőr elülső végénél jelenik meg                      |
| `poison-impact`     |     4 |  14 | once      | zöld fröccsenés, nem gore                              |
| `spin-aura`         |     6 |  12 | loop      | forgó zöld pajzsgyűrű, egyértelműen „védett” állapot   |
| `spin-break`        |     6 |  12 | once      | pajzsszilánkok, sebzésirány, egyértelmű „tört” állapot |
| `earthquake`        |     6 |  12 | once      | földhullám + por, a 2 mp-es fagyasztás alatt látszik   |
| `defeat`            |     8 |   8 | once      | tollrobbanás + zöld energia, ünneplő, nem véres        |

## Paletta

- Toll highlight: `#e0ad6a`
- Toll közép: `#a86a34`
- Mély árnyék: `#4a2a12`
- Sötét szárny/tollhegy: `#2a1608`
- Fekete karom/csőr: `#070707`
- Méreg zöld: `#7dff5a`
- Méreg sötét: `#1c7a2e`
- Szem sárga: `#ffd23f`
- Csőr/cere arany: `#d9a441`
- Peremfény: hideg zöld (`#b6ff7a`) a bal felső fény irányából.

## Átadás

- 8 karakter-strip + 7 effekt-strip PNG-ben, a manifest meglévő kulcsaival.
- Opcionális: külön frame-ek, PSD/Krita/Aseprite master.
- A manifest `artStatus` csak Ábel jóváhagyása után változhat véglegesre.
- Integráció után a pivot/origin és a frame-szám nem változhat, hogy a játékkód ne törjön.

## Elfogadási kritériumok

1. 64 px-es sziluettnél felismerhető ragadozómadár; nem bagoly/nyúl.
2. 150 px-en a csőr, a szem és a fekete karmok külön olvashatók.
3. A szárnyak anatómiai szárnyként, nem fülként olvashatók.
4. A spin és spin-break állapot ránézésre megkülönböztethető.
5. A karmolás és méregköpés a megfelelő frame-ekben egyértelmű.
6. A minőség legalább a Laser Crocodile / Lightning Scorpion szintje.
7. Ábel jóváhagyása a contact sheet és a játékbeli screenshotok alapján.
