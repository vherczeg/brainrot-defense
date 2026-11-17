# Zöld Méreg Sólyom – M3.2 vizuális QA

A generált assetek **ideiglenes koncepció**, nem végleges grafika. Ábel jóváhagyása szükséges.

## Contact sheet és preview

- Összes animáció: `docs/green-venom-falcon/contact-sheet.png`
- Animált előnézet: `docs/green-venom-falcon/preview.gif`
- Assetlista: `docs/green-venom-falcon/ASSET_LIST.md`

## 20. hullám – játékbeli képernyőképek

- Belépés / földrengés: `docs/green-venom-falcon/qa/01-earthquake-entrance.png`
- Karmolás: `docs/green-venom-falcon/qa/02-claw-attack.png`
- Méregköpés: `docs/green-venom-falcon/qa/03-poison-spit.png`
- Teljes sebességű forgó pajzs: `docs/green-venom-falcon/qa/04-spin-shield-full-speed.png`
- Pajzstörés távolsági találattól: `docs/green-venom-falcon/qa/05-spin-shield-broken.png`
- Boss legyőzése: `docs/green-venom-falcon/qa/06-boss-defeat.png`
- Csata összkép: `docs/green-venom-falcon/qa/07-battle-overview.png`
- Összesítő: `docs/green-venom-falcon/qa/contact-sheet.png`

A képek a valódi 20. hullámos csatából készültek, a szimuláció megfelelő pillanataiban
megállított scene-nel (nem a pause overlay-jel). A képernyőképek készítése:

```bash
npm run dev -- --port 5174 --strictPort
node scripts/qa-green-venom-falcon.mjs
```
