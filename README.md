# Brainrot Defense: Káosz Invázió

Egy színes, magyar nyelvű **merge-védekező játék** böngészőre, gyerekeknek (kb. 6–10 éves) és
stratégiát kedvelő felnőtteknek. Vásárolj fantáziaharcosokat, húzd őket a csatatérre, egyesítsd
az azonosakat, majd indíts automatikus csatát a betolakodó szörnyek ellen.

- Ingyenes, reklám nélküli, offline-first.
- Nincs fiók, nincs backend, nincs mikrotransaction.
- Három helyi játékosprofil, automatikus mentés IndexedDB-be.
- 10 adatvezérelt hullám, köztük a **Mega Brainrot Gorilla** főellenség.
- Egérrel, érintéssel és billentyűzettel is játszható.
- A játéklogika teljesen független a Phaser rendereléstől és a React UI-tól.

## Képernyőképek

| Főmenü                               | Felkészülés                                      |
| ------------------------------------ | ------------------------------------------------ |
| ![Főmenü](docs/screenshots/menu.png) | ![Felkészülés](docs/screenshots/preparation.png) |

| Csata                                 | Győzelem                                 |
| ------------------------------------- | ---------------------------------------- |
| ![Csata](docs/screenshots/battle.png) | ![Győzelem](docs/screenshots/result.png) |

Mobilnézet: [docs/screenshots/mobile.png](docs/screenshots/mobile.png)

## Játékmenet

1. A játékos **350 érmével** és három kezdőharcossal indul.
2. A felkészülési szakaszban nincs időkorlát. Lehet vásárolni, rendezkedni, egyesíteni.
3. Két **azonos típusú és szintű** harcos egy magasabb szintű harcossá egyesíthető.
4. A **HARCOLJ!** gombra kattintva elindul a determinisztikus, automatikus csata.
5. Győzelem esetén a hullám jutalma begyűjthető, és nyílik a következő hullám.
6. Vereség esetén a sereg **nem tűnik el**. Ingyen újrapróbálható, és apró vigasztaló érmék
   segítik a továbbjutást (20 érme/vereség), így nem alakulhat ki gazdasági zsákutca.
7. A haladás minden fontos művelet után automatikusan mentődik. A böngésző bármikor bezárható.

A részletes szabályokat lásd: [docs/GAMEPLAY_RULES.md](docs/GAMEPLAY_RULES.md).

## Fejlesztői gyorsindítás

Követelmények: **Node.js 24** (Vite 7 miatt minimum 20.19), npm.

```bash
npm install
npm run dev
```

A fejlesztői szerver alapértelmezésben a `http://localhost:5173` címen fut.

### Parancsok

| Parancs                | Leírás                                            |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Vite fejlesztői szerver                           |
| `npm run build`        | TypeScript-ellenőrzés + produkciós build (SW-vel) |
| `npm run verify:build` | Build assetutak és SW-precache ellenőrzése        |
| `npm run preview`      | A `dist/` produkciós előnézete                    |
| `npm run test`         | Vitest unit- és integrációs tesztek               |
| `npm run test:watch`   | Tesztek figyelő módban                            |
| `npm run test:e2e`     | Build + Playwright böngészőtesztek                |
| `npm run lint`         | ESLint                                            |
| `npm run typecheck`    | `tsc --noEmit`                                    |
| `npm run format`       | Prettier formázás                                 |
| `npm run format:check` | Prettier ellenőrzés                               |

Az E2E tesztek először produkciós buildet készítenek, majd a `vite preview` szervert használják.
Playwright böngésző telepítése szükség esetén:

```bash
npx playwright install chromium
```

## Architektúra

```text
src/
  app/            Alkalmazásvezérlő, React belépési pont, nézetek
  components/     React UI (menük, bolt, felkészülés, modálok)
  game/
    domain/       Tiszta domainmodellek, karakterek, ellenségek, hullámok, gazdaság
    commands/     Immutábilis állapotátmenetek (vásárlás, mozgatás, egyesítés, jutalom)
    simulation/   Determinisztikus, fix lépésközű csataszimuláció
    rendering/    Phaser jelenet és rajzolás (csak megjelenítés)
  persistence/    IndexedDB, séma, validáció, import/export
  localization/   Externalizált magyar szövegek
  audio/          Web Audio alapú, generált hangeffektek
  styles/         Reszponzív, akadálymentes CSS
tests/
  unit/           Domain-, combat- és perzisztenciatesztek
  integration/    Teljes 10 hullámos végigjátszás, mentés-visszatöltés
  e2e/            Playwright böngészőtesztek (desktop + mobil)
```

Az irányított függőségek: `domain ← commands ← app/controller`; a `simulation` csak a domainre
támaszkodik; a `rendering` és a React UI a vezérlőn keresztül olvassa az állapotot. A játék
egyetlen autoritatív állapotmodellje a `GameController` birtokában lévő `PlayerProfile` és az
aktuális `BattleSession`.

Részletek: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Mentés

- IndexedDB adatbázis: `brainrot-defense`, `profiles` és `meta` object store-ok.
- Verziózott séma (`schemaVersion: 1`), szigorú validáció, FNV-1a checksum.
- Profilonként egy atomi rekordfrissítés; megszakadt írás nem hoz létre félkész mentést.
- Az autosave-ek egy szerializált, koaleszkált írási sorban futnak. A legfrissebb állapot
  felülírja a még nem elindult korábbi pillanatképeket, így nincs korlátlan írási torlódás.
- Import-, törlés- és profilváltási műveletek írási barrierként viselkednek. Egy megerősített
  import nem írható felül régi autosave-ekkel, és egy törölt profil nem támad fel a sorból.
- A profilokhoz generációs azonosító tartozik; a profil életciklusát átlépő elavult írások
  eldobódnak. A profil létrehozása/importja és az aktív profil metaadatinak írása egy
  IndexedDB-tranzakcióban történik.
- Legfeljebb három helyi profil. Alapértelmezett profil: **Ábel**.
- Automatikus mentés vásárlás, egyesítés, mozgatás, hullámjutalom, beállítás és tutorial után.
- Csata közben a rendszer az utolsó stabil felkészülési állapotot őrzi meg; bezárás után a
  csata újraindítható. A csata közbeni sebesség- és beállításváltozások mentődnek, de a
  harci egységek/eredmény csak a csata lezárása után kerül a profilba.
- Egy profil egyszerre egy lapon szerkeszthető. A Web Locks API-val a második lap érthető
  hibaüzenetet kap ahelyett, hogy csendben felülírná az első lap haladását.
- JSON export/import, import előtti megerősítéssel. Hibás import nem írja felül a meglévő mentést.
- Érvényes importált profil minden támogatott játékművelet után érvényes marad. Az érme- és
  karakter-ID túlcsordulás explicit hibát ad, nem hoz létre menthetetlen állapotot.
- Sérült mentést a játék nem töröl csendben; hibaüzenetet mutat, és másik profil/import választható.
- A böngésző tartós tárhelye (`navigator.storage.persist()`) opcionálisan kérhető, de nem garantált.

Részletek: [docs/SAVE_SCHEMA.md](docs/SAVE_SCHEMA.md).

## Offline működés (PWA)

A produkciós build a `vite.config.ts` build-pluginjével generálja a `dist/sw.js` service
workert. A generált fájl a tényleges, hash-elt Vite asseteket tartalmazó, build-verziózott
precache listát kap:

- a teljes app shell (HTML, JS, CSS, manifest, ikonok, CNAME) előre cache-elődik;
- a cache neve a build tartalmából számított hash-t tartalmaz;
- a telepítés egy külön staging cache-be tölt, hiba esetén nem aktivál félkész cache-t;
- aktiváláskor a régi, azonos prefixű cache-ek törlődnek;
- navigáció network-first, cache-fallback; az essential assetek cache-first módon jönnek a
  precache-ből, offline nincs hálózati függőségük.

A Playwright tesztek külön ellenőrzik, hogy egy friss első látogatás után, további online
újratöltés nélkül is működik az offline újranyitás, és hogy a mentett haladás megmarad.
A service worker csak produkciós módban regisztrál. A mentési adatok IndexedDB-ben vannak, így
az appfrissítés nem írja felül őket; a sémaverzió és checksum védi a betöltést.

## GitHub Pages telepítés

A kiválasztott production cél a **custom-domain root**: `https://brainrot.herczeg.cc/`.
A workflow explicit `VITE_BASE_PATH=/` értékkel buildel, a `public/CNAME` a custom domainhez
tartozik. Projekt-aloldalra váltáskor a base pathot és a CNAME-t is át kell állítani.

A `.github/workflows/deploy.yml` minden `main` pushnál és manuális `workflow_dispatch` esetén
futtatja a lintet, típusellenőrzést, unit/integrációs teszteket, production buildet,
asset-path/precache ellenőrzést és E2E teszteket. Pull requesten csak az ellenőrzések futnak.

A deploy job szándékosan csak akkor fut, ha a repository Actions-változója
`PAGES_DEPLOY_ENABLED=true`. Ez megakadályozza, hogy a custom domain/DNS beállítása előtt
véletlenül éles deploy történjen. **A custom domain és a Pages beállítás ebben a repository
állapotában nincs konfigurálva, és nem történt push/deploy.** A pontos owner-lépések:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Tesztelés

- **Unit/integrációs:** 105 teszt, 13 fájlban. merge/mozgatás-szabályok, gazdaság,
  statisztikák, rács, hullámok, targeting, range, cooldown, páncél, láncvillám, halál,
  győzelem/vereség, determinizmus, 1×/2× sebesség, frame-rate függetlenség, IndexedDB
  round-trip, checksum, korrupt mentés, import validáció és invariánsok, profilizoláció,
  írási sor/koaleszálás, import/törlés versenyhelyzetek, boundary- és overflow-tesztek,
  aktív profil metaadat hibakezelés, több-lapos zárolás, teljes 10 hullámos végigjátszás.
- **Böngésző:** 40 sikeres teszt + 2 kihagyott (desktop-only tablet- és canvas drag teszt a
  mobil futásban), valódi IndexedDB-vel: menü, játék indítás, vásárlás, egyesítés egérrel és
  akadálymentes panellel, áthelyezés, csata, pause/resume, 2× sebesség, győzelem, vereség,
  jutalom, reload utáni folytatás, export/import, profil létrehozás/törlés, boundary import,
  nagy autosave-backlog utáni import/törlés, hang-szinkron, surrender lifecycle,
  több-lapos védelem, friss első látogatás utáni offline újranyitás.
- Determinisztikus tesztek fix seeddel és fix lépésközzel; nincs kép-összehasonlításos
  törékeny teszt.

## Ismert korlátok (M0)

- A csatatér Phaser canvas; a nem-drag interakciót és a billentyűzetes elhelyezést külön DOM
  panel biztosítja. A canvas tartalma önmagában nem olvasható képernyőolvasóval.
- A hangok szintetizált placeholderek, nincs zene.
- A grafikák programozott, eredeti placeholderek; nincs még sprite atlas vagy asset pipeline.
- A Phaser miatt a JS bundle ~1.56 MB (gzip ~437 kB). Később kódrészletekre bontható.
- Az automatikus több-lapos védelem a Web Locks API-ra épül; ahol ez nem elérhető, ott a
  játék a korábbi single-tab viselkedésre esik vissza.
- Automatizált böngészőteszt Chromiumon (desktop + mobil emuláció) fut. Firefox és Safari
  manuális ellenőrzést igényel; a kód szabványos Pointer Events/IndexedDB/Web Locks API-kra épül.
- A custom domain beállítása és az éles deploy a tulajdonos jóváhagyását igényli.

## Következő mérföldkövek

- **M1:** sprite/asset pipeline, zene és több hangeffekt, animált hátterek.
- **M2:** további karakterek, upgrade-ek, passzív képességek, hullámválasztó.
- **M3:** verziózott sémamigrációk, export/import minden profilra.
- **M4:** akadálymentességi audit, Firefox/Safari CI, teljesítményprofilozás, kódrészletezés.

## Jogosultság és assetek

A kód MIT licenc alatt áll (lásd [LICENSE](LICENSE)). A játékhoz készült programozott
vektor- és hangassetek eredeti placeholderek, harmadik fél jogait nem sértik. Részletek:
[docs/ASSETS.md](docs/ASSETS.md).
