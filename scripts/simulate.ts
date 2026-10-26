import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyDefeatComfort,
  mergeCharacters,
  purchaseCharacter,
  resolveBattleRewards,
} from '../src/game/commands/profileCommands';
import { characterStats } from '../src/game/domain/characters';
import { emptyAlliedCells } from '../src/game/domain/grid';
import {
  MAX_CHARACTER_LEVEL,
  MAX_CHARACTER_XP,
  MAX_MERGE_RANK,
  characterLevelFromXp,
  xpRequiredForLevel,
} from '../src/game/domain/progression';
import { createInitialProfile } from '../src/game/domain/state';
import type { CharacterInstance, CharacterTypeId, PlayerProfile } from '../src/game/domain/types';
import { LAST_WAVE_ID, getWave } from '../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../src/game/simulation/battle';
import { parseProfileFromImport } from '../src/persistence/import-export/saveCodec';

type BuyPolicy = 'crocodile' | 'scorpion' | 'mixed';
type MergePolicy = 'aggressive' | 'board-fill' | 'late';
type StartPolicy = 'new' | 'weak' | 'legacy' | 'max-rank';

interface Strategy {
  readonly name: string;
  readonly buy: BuyPolicy;
  readonly merge: MergePolicy;
  readonly start: StartPolicy;
  readonly reserveCoins: number;
  readonly logEveryWave?: boolean;
}

interface WaveReport {
  readonly waveId: number;
  readonly attempts: number;
  readonly defeats: number;
}

interface SimulationReport {
  readonly name: string;
  readonly start: StartPolicy;
  readonly buy: BuyPolicy;
  readonly merge: MergePolicy;
  readonly finalWave: number;
  readonly blocked: boolean;
  readonly defeats: number;
  readonly coins: number;
  readonly army: string;
  readonly totalXp: number;
  readonly waves: readonly WaveReport[];
  readonly difficultyCliff: { readonly waveId: number; readonly defeats: number } | null;
  readonly signature: string;
}

interface BoundaryReport {
  readonly maxRank: number;
  readonly maxLevel: number;
  readonly maxXp: number;
  readonly crocodile: ReturnType<typeof characterStats>;
  readonly scorpion: ReturnType<typeof characterStats>;
  readonly checks: readonly string[];
}

const MAX_ATTEMPTS_PER_WAVE = 80;
const BALANCE_DEFEAT_WARNING_THRESHOLD = 30;
const LEGACY_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/m0.1-legacy-save.json');

function startProfile(profileId: string): PlayerProfile {
  return createInitialProfile({ profileId, name: 'Sim', now: 1 });
}

function weakStartProfile(): PlayerProfile {
  return {
    ...startProfile('weak-start'),
    coins: 0,
    characters: [
      { id: 'unit-1', typeId: 'laser-crocodile', mergeRank: 1, totalXp: 0, col: 0, row: 3 },
    ],
    nextCharacterId: 2,
  };
}

function legacyProfile(): PlayerProfile {
  const text = readFileSync(LEGACY_FIXTURE_PATH, 'utf8');
  const parsed = parseProfileFromImport(text);
  if (!parsed.ok) {
    throw new Error(`legacy fixture failed validation: ${parsed.error} ${parsed.detail ?? ''}`);
  }
  return parsed.value;
}

function maxRankProfile(): PlayerProfile {
  const characters: CharacterInstance[] = [
    {
      id: 'unit-1',
      typeId: 'laser-crocodile',
      mergeRank: MAX_MERGE_RANK,
      totalXp: MAX_CHARACTER_XP,
      col: 0,
      row: 3,
    },
    {
      id: 'unit-2',
      typeId: 'laser-crocodile',
      mergeRank: MAX_MERGE_RANK,
      totalXp: MAX_CHARACTER_XP,
      col: 1,
      row: 3,
    },
    {
      id: 'unit-3',
      typeId: 'lightning-scorpion',
      mergeRank: MAX_MERGE_RANK,
      totalXp: MAX_CHARACTER_XP,
      col: 2,
      row: 3,
    },
  ];
  return {
    ...startProfile('max-rank-boundary'),
    coins: 0,
    characters,
    nextCharacterId: 4,
  };
}

function profileFor(strategy: Strategy): PlayerProfile {
  if (strategy.start === 'legacy') return legacyProfile();
  if (strategy.start === 'weak') return weakStartProfile();
  if (strategy.start === 'max-rank') return maxRankProfile();
  return startProfile(strategy.name);
}

function pairForMerge(profile: PlayerProfile): readonly [string, string] | null {
  const groups = new Map<string, string[]>();
  for (const character of profile.characters) {
    if (character.mergeRank >= MAX_MERGE_RANK) continue;
    const key = `${character.typeId}:${character.mergeRank}`;
    const ids = groups.get(key) ?? [];
    ids.push(character.id);
    groups.set(key, ids);
  }
  const candidates = [...groups.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, ids] of candidates) {
    const first = ids[0];
    const second = ids[1];
    if (first && second) return [first, second];
  }
  return null;
}

function mergeOnce(profile: PlayerProfile): PlayerProfile | null {
  const pair = pairForMerge(profile);
  if (!pair) return null;
  const result = mergeCharacters(profile, pair[0], pair[1], 1);
  return result.ok ? result.value.profile : null;
}

function chooseType(profile: PlayerProfile, policy: BuyPolicy): CharacterTypeId {
  if (policy === 'crocodile') return 'laser-crocodile';
  if (policy === 'scorpion') return 'lightning-scorpion';
  return profile.characters.filter((character) => character.typeId === 'laser-crocodile').length <=
    profile.characters.filter((character) => character.typeId === 'lightning-scorpion').length
    ? 'laser-crocodile'
    : 'lightning-scorpion';
}

function costOf(typeId: CharacterTypeId): number {
  return typeId === 'laser-crocodile' ? 100 : 150;
}

function buyIfAffordable(
  profile: PlayerProfile,
  typeId: CharacterTypeId,
  reserveCoins: number,
): PlayerProfile | null {
  if (emptyAlliedCells(profile.characters).length === 0) return null;
  if (profile.coins < costOf(typeId) + reserveCoins) return null;
  const purchase = purchaseCharacter(profile, typeId, 1);
  return purchase.ok ? purchase.value.profile : null;
}

function prepareArmy(profile: PlayerProfile, strategy: Strategy): PlayerProfile {
  let current = profile;
  for (let guard = 0; guard < 2000; guard += 1) {
    const free = emptyAlliedCells(current.characters).length;
    const preferred = chooseType(current, strategy.buy);
    const fallback: CharacterTypeId =
      preferred === 'laser-crocodile' ? 'lightning-scorpion' : 'laser-crocodile';

    if (strategy.merge === 'aggressive') {
      const merged = mergeOnce(current);
      if (merged) {
        current = merged;
        continue;
      }
      const purchased = buyIfAffordable(current, preferred, strategy.reserveCoins);
      if (purchased) {
        current = purchased;
        continue;
      }
      const fallbackPurchase = buyIfAffordable(current, fallback, strategy.reserveCoins);
      if (fallbackPurchase) {
        current = fallbackPurchase;
        continue;
      }
      break;
    }

    if (strategy.merge === 'board-fill') {
      const purchased = buyIfAffordable(current, preferred, strategy.reserveCoins);
      if (purchased) {
        current = purchased;
        continue;
      }
      const fallbackPurchase = buyIfAffordable(current, fallback, strategy.reserveCoins);
      if (fallbackPurchase) {
        current = fallbackPurchase;
        continue;
      }
      const merged = mergeOnce(current);
      if (merged) {
        current = merged;
        continue;
      }
      break;
    }

    // 'late': keep buying while there is space, merge only once the board is full.
    if (free > 0) {
      const purchased = buyIfAffordable(current, preferred, strategy.reserveCoins);
      if (purchased) {
        current = purchased;
        continue;
      }
      const fallbackPurchase = buyIfAffordable(current, fallback, strategy.reserveCoins);
      if (fallbackPurchase) {
        current = fallbackPurchase;
        continue;
      }
      break;
    }
    const merged = mergeOnce(current);
    if (merged) {
      current = merged;
      continue;
    }
    break;
  }
  return current;
}

function armySummary(profile: PlayerProfile): string {
  return profile.characters
    .map((character) => {
      const short = character.typeId === 'laser-crocodile' ? 'K' : 'S';
      const level = characterLevelFromXp(character.totalXp);
      return `${short}R${character.mergeRank}L${level}`;
    })
    .join(', ');
}

function totalXp(profile: PlayerProfile): number {
  return profile.characters.reduce((sum, character) => sum + character.totalXp, 0);
}

function signatureOf(profile: PlayerProfile, defeats: number): string {
  return `${profile.characters
    .map((character) => `${character.typeId}:${character.mergeRank}:${character.totalXp}`)
    .sort()
    .join('|')}#${defeats}#${profile.coins}`;
}

function simulate(strategy: Strategy): SimulationReport {
  let profile = profileFor(strategy);
  let defeats = 0;
  let finalWave = 0;
  let blocked = false;
  const waves: WaveReport[] = [];

  console.log(`\n=== ${strategy.name} ===`);
  for (let waveId = 1; waveId <= LAST_WAVE_ID; waveId += 1) {
    const wave = getWave(waveId);
    if (!wave) throw new Error(`missing wave ${waveId}`);
    let won = false;
    let attempts = 0;
    const defeatsBeforeWave = defeats;

    while (!won && attempts < MAX_ATTEMPTS_PER_WAVE) {
      attempts += 1;
      profile = prepareArmy(profile, strategy);
      const roster = profile.characters.map((character) => character.id);
      const result = runBattleToCompletion(
        createBattleState(profile.characters, wave, waveId * 1000 + attempts),
      );
      if (result.state.status === 'victory') {
        const awarded = resolveBattleRewards(profile, waveId, roster, 2);
        if (!awarded.ok) throw new Error(`reward failed on wave ${waveId}`);
        profile = awarded.value.profile;
        won = true;
        finalWave = waveId;
        if (strategy.logEveryWave) {
          console.log(
            `  Hullám ${waveId}: győzelem (${attempts}. próba), +${awarded.value.xpPerUnit} TP/harcos`,
          );
        }
      } else {
        defeats += 1;
        const comfort = applyDefeatComfort(profile, 2);
        if (!comfort.ok) throw new Error('comfort failed');
        profile = comfort.value;
      }
    }

    const waveDefeats = defeats - defeatsBeforeWave;
    waves.push({ waveId, attempts, defeats: waveDefeats });
    if (!won) {
      blocked = true;
      console.log(
        `  Hullám ${waveId}: NEM TELJESÍTHETŐ ${MAX_ATTEMPTS_PER_WAVE} próbából (${waveDefeats} vereség)`,
      );
      break;
    }
    if (!strategy.logEveryWave && attempts > 1) {
      console.log(`  Hullám ${waveId}: győzelem ${attempts}. próbára.`);
    }
  }

  const difficultyCliff =
    waves.length === 0
      ? null
      : waves.reduce((worst, wave) => (wave.defeats > worst.defeats ? wave : worst), waves[0]!);
  const report: SimulationReport = {
    name: strategy.name,
    start: strategy.start,
    buy: strategy.buy,
    merge: strategy.merge,
    finalWave,
    blocked,
    defeats,
    coins: profile.coins,
    army: armySummary(profile),
    totalXp: totalXp(profile),
    waves,
    difficultyCliff:
      difficultyCliff && difficultyCliff.defeats > 0
        ? { waveId: difficultyCliff.waveId, defeats: difficultyCliff.defeats }
        : null,
    signature: signatureOf(profile, defeats),
  };
  console.log(
    `  Végső hullám: ${report.finalWave}/${LAST_WAVE_ID}, vereségek: ${report.defeats}, érme: ${report.coins}`,
  );
  console.log(`  Sereg: ${report.army || 'üres'}`);
  console.log(`  Összes TP: ${report.totalXp}`);
  if (report.difficultyCliff) {
    console.log(
      `  Nehézségi csúcs: ${report.difficultyCliff.waveId}. hullám (${report.difficultyCliff.defeats} vereség)`,
    );
  }
  if (report.blocked) console.log('  ÁLLAPOT: blokkolt');
  return report;
}

function runBoundaryReport(): BoundaryReport {
  const crocodile = characterStats('laser-crocodile', MAX_MERGE_RANK, MAX_CHARACTER_XP);
  const scorpion = characterStats('lightning-scorpion', MAX_MERGE_RANK, MAX_CHARACTER_XP);
  const checks: string[] = [];
  if (characterLevelFromXp(MAX_CHARACTER_XP) !== MAX_CHARACTER_LEVEL) {
    checks.push('MAX_CHARACTER_XP does not map to MAX_CHARACTER_LEVEL');
  }
  if (xpRequiredForLevel(MAX_CHARACTER_LEVEL) !== MAX_CHARACTER_XP) {
    checks.push('xpRequiredForLevel(MAX_CHARACTER_LEVEL) != MAX_CHARACTER_XP');
  }
  if (characterStats('laser-crocodile', MAX_MERGE_RANK + 1, MAX_CHARACTER_XP) !== undefined) {
    const clamped = characterStats('laser-crocodile', MAX_MERGE_RANK + 1, MAX_CHARACTER_XP);
    if (clamped.attack !== crocodile.attack || clamped.maxHp !== crocodile.maxHp) {
      checks.push('rank clamping above MAX_MERGE_RANK failed');
    }
  }
  if (
    crocodile.attack <= 0 ||
    crocodile.maxHp <= 0 ||
    scorpion.attack <= 0 ||
    scorpion.maxHp <= 0
  ) {
    checks.push('max-rank stats must be positive');
  }
  if (!Number.isFinite(crocodile.attack) || !Number.isFinite(crocodile.maxHp)) {
    checks.push('max-rank stats must be finite');
  }

  console.log('\n=== Maximum rank and level boundaries ===');
  console.log(`  LVL 1 = ${xpRequiredForLevel(1)} TP, LVL 100 = ${xpRequiredForLevel(100)} TP`);
  console.log(
    `  Lézer Krokodil R10 L100: ATK ${crocodile.attack}, HP ${crocodile.maxHp}, LVL ${characterLevelFromXp(MAX_CHARACTER_XP)}`,
  );
  console.log(
    `  Villám Skorpió R10 L100: ATK ${scorpion.attack}, HP ${scorpion.maxHp}, LVL ${characterLevelFromXp(MAX_CHARACTER_XP)}`,
  );
  console.log(`  Numerikus határellenőrzések: ${checks.length === 0 ? 'OK' : checks.join('; ')}`);

  return {
    maxRank: MAX_MERGE_RANK,
    maxLevel: MAX_CHARACTER_LEVEL,
    maxXp: MAX_CHARACTER_XP,
    crocodile,
    scorpion,
    checks,
  };
}

const strategies: readonly Strategy[] = [
  {
    name: '1. Új játék, teljes tábla',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'new',
    reserveCoins: 0,
  },
  {
    name: '2. Valódi M0.1 mentés (fixture)',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'legacy',
    reserveCoins: 0,
  },
  {
    name: '3. Agresszív egyesítő',
    buy: 'mixed',
    merge: 'aggressive',
    start: 'new',
    reserveCoins: 0,
  },
  { name: '4. Késleltetett egyesítés', buy: 'mixed', merge: 'late', start: 'new', reserveCoins: 0 },
  {
    name: '5. Krokodil hangsúly',
    buy: 'crocodile',
    merge: 'board-fill',
    start: 'new',
    reserveCoins: 0,
  },
  {
    name: '6. Skorpió hangsúly',
    buy: 'scorpion',
    merge: 'board-fill',
    start: 'new',
    reserveCoins: 0,
  },
  {
    name: '7. Takarékos formáció (300 érme tartalék)',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'new',
    reserveCoins: 300,
  },
  {
    name: '8. Gyenge kezdés utáni újrapróbálkozás',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'weak',
    reserveCoins: 0,
  },
  {
    name: '9. XP-haladás takarékos egyesítéssel',
    buy: 'mixed',
    merge: 'aggressive',
    start: 'new',
    reserveCoins: 150,
    logEveryWave: true,
  },
  {
    name: '10. Maximum rang és szint határ',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'max-rank',
    reserveCoins: 0,
  },
];

const reports = strategies.map((strategy) => simulate(strategy));
const boundary = runBoundaryReport();

const correctnessFailures: string[] = [];
const balanceWarnings: string[] = [];

for (const report of reports) {
  if (report.blocked) {
    correctnessFailures.push(`${report.name}: blocked before completing wave ${LAST_WAVE_ID}`);
  }
  if (report.defeats >= BALANCE_DEFEAT_WARNING_THRESHOLD) {
    balanceWarnings.push(
      `${report.name}: ${report.defeats} defeats (known M1.4 balance issue, not a correctness failure)`,
    );
  }
}
for (const check of boundary.checks) {
  correctnessFailures.push(`boundary: ${check}`);
}
const legacyReport = reports.find((report) => report.name.startsWith('2.'));
if (legacyReport && legacyReport.finalWave < 4) {
  correctnessFailures.push('legacy fixture did not preserve its starting wave');
}
const signatures = new Map<string, string>();
for (const report of reports) {
  const previous = signatures.get(report.signature);
  if (previous) {
    balanceWarnings.push(`${previous} and ${report.name} produced the same end state`);
  } else {
    signatures.set(report.signature, report.name);
  }
}

const completed = reports.filter((report) => !report.blocked).length;
console.log(
  `\nÖsszegzés: ${completed}/${reports.length} stratégia teljesítette mind a ${LAST_WAVE_ID} hullámot.`,
);
if (balanceWarnings.length > 0) {
  console.log('\nEgyensúlyi figyelmeztetések (M1.4):');
  for (const warning of balanceWarnings) console.log(`  - ${warning}`);
}
if (correctnessFailures.length > 0) {
  console.log('\nSzoftveres korrektségi hibák:');
  for (const failure of correctnessFailures) console.log(`  - ${failure}`);
} else {
  console.log('\nSzoftveres korrektségi ellenőrzések: OK');
}

console.log(
  `SIMULATION_JSON ${JSON.stringify({
    scenarios: reports,
    boundary,
    correctnessFailures,
    balanceWarnings,
    completed,
    total: reports.length,
  })}`,
);

if (correctnessFailures.length > 0) {
  process.exitCode = 1;
}
