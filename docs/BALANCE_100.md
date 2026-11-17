# M4 – A 100 hullámos kampány egyensúlya

Ez a mérföldkő a 20 hullámos kampányt teljes, 100 hullámos **Káosz Invázió** kampánnyá
bővíti: 10 fejezet, 10 kötelező főellenség, 5 meglepetés-főellenség, hullámhatások
(módosítók), 4 nehézségi szint, seregfejlesztések és 12 új szörnytípus.

A teljes kiegyensúlyozás adatvezérelt, automatizált kampányszimulációkkal történt:
`npm run balance` (880 futás) és `npm run simulate` (11 stratégia, részletes napló).

## Nehézségi szintek

| Mód      | Ellenség HP | Ellenség támadás | Vigaszdíj vereségért |
| -------- | ----------: | ---------------: | -------------------: |
| Könnyű   |        ×0.8 |             ×0.8 |                 70 g |
| Normál   |        ×1.0 |             ×1.0 |                 50 g |
| Nehéz    |        ×1.4 |             ×1.2 |                 30 g |
| Végtelen |        ×1.7 |            ×1.35 |                 20 g |

A győzelmi jutalmak és a TP minden módban azonosak.

## Automatizált kampánytesztek (880 futás)

11 játékosstratégia (kezdő, gyerek, krokodil-, skorpió-, rinó-, bagoly-fókusz,
optimalizált, replay-farmerek, M0.1 mentés, maximális rang) × 20 seed × 4 nehézség.

A szimulátor a valódi parancsokat (vásárlás, egyesítés, eladás, fejlesztés, harci jutalmak,
vigaszdíj, replay-farmolás) használja; a játékosok elakadáskor korábbi hullámokat farmolnak.

| Mód      | Teljesített | Arány |
| -------- | ----------: | ----: |
| Könnyű   |     198/220 |   90% |
| Normál   |     193/220 |   88% |
| Nehéz    |     138/220 |   63% |
| Végtelen |      58/220 |   26% |

**Normál mód:** 11-ből 10 stratégia mind a 100 hullámot teljesíti. A tiszta
bagoly-támogató sereg (szándékosan gyenge összeállítás a páncélos hullámok ellen)
a 79–95. hullámig jut, gazdasági elakadás nélkül. A kezdő stratégia átlagosan ~40
vereséggel teljesíti a teljes kampányt; a bossok (10, 30, 50, 100) a legnehezebb pontok.

**Végtelen mód:** szándékosan elitista – a 10. hullám gorillája már valódi próba
(40+ próbálkozás gyenge sereggel), a teljes végigjátszás csak erős játékkal megy.

## Bossok mérése

A főellenségek a szimulációkban következetesen nehezebbek a környező hullámoknál,
de mind legyőzhetők a megfelelően fejlett sereggel:

- **10. Mega Brainrot Gorilla** – változatlan M3.4-értékek.
- **20. Zöld Méreg Sólyom** – változatlan M3.4-értékek (Ábel koncepciója).
- **30. Páncél Kolosszus** – páncélos tank, dührohammal; 0–20 vereség a stratégiától függően.
- **40. Villám Garuda** – láncvillám + bénítás; átlag 2 vereség.
- **50. Méreg Király Krokodil** – méreg + idézés; Nehéz módban a specialisták fő fala.
- **60. Árny Herceg** – szellem mód (villám/fagy töri); skorpió/rinó seregeknek kihívás.
- **70. Káosz Iker Hercegek** – harcos + gyógyító páros.
- **80. Lávagólem** – halálrobbanás + düh.
- **90. Káosz Sárkány** – idézés + bénítás.
- **100. Mega Káosz Király** – három fázis (düh), idézés, bénítás, halálrobbanás.
  A finálé a kampány csúcspontja: a kezdő stratégia ~10–20 próbálkozással,
  az erős játékos 1–2 próbával győz.

## Meglepetés-főellenségek

20 hullámos blokkonként pontosan egy (összesen 5 végigjátszásonként), a profilazonosítóból
determinisztikusan választva: Kappa Kapitány (idéző), Rém Álomlepke (szellem + méreg),
Vas Sün (tüskés), Bubi Hercegnő (gyógyító), Üresség Szem (távoli bénító).
A választás menthető és reload-biztos; a meglepetésboss a helyettesített hullám
legerősebb szintje alatt eggyel érkezik, így legyőzhető marad.

## A kiegyensúlyozás folyamata

1. A `scripts/margins.ts` minden hullámnál méri a győzelmi HP-maradékot 3 referenciasereggel.
2. A 30% alatti maradékú hullámokat gyengítettük, a 80% felettieket erősítettük.
3. A `npm run balance` 880 futása igazolta a végső görbét.
4. A korai 20 hullám ellenséglistái, jutalmai és a bossok (10, 20) érintetlenek.

## Ismert korlátok

- A tiszta Fagy Bagoly sereg szándékosan gyenge a páncélos hullámok ellen; kevert
  seregekben a lassítás erős támogatás.
- A Végtelen mód gyenge stratégiákkal valódi kihívás; a gazdasági elakadást a
  vigaszdíj és a replay-farmolás minden módban megakadályozza.
