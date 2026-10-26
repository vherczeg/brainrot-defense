import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyDefeatComfort,
  armyPower,
  mergeCharacters,
  purchaseCharacter,
  resolveBattleRewards,
} from '../src/game/commands/profileCommands';
import { characterStats } from '../src/game/domain/characters';
import { emptyAlliedCells } from '../src/game/domain/grid';
import { characterLevelFromXp } from '../src/game/domain/progression';
import { createInitialProfile } from '../src/game/domain/state';
import type { CharacterInstance, CharacterTypeId, PlayerProfile } from '../src/game/domain/types';
import { LAST_WAVE_ID, getWave } from '../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../src/game/simulation/battle';
import { parseProfileFromImport } from '../src/persistence/import-export/saveCodec';
import {
  MAX_CHARACTER_LEVEL,
  MAX_CHARACTER_XP,
  MAX_MERGE_RANK,
  xpRequiredForLevel,
} from '../src/game/domain/progression';

type BuyPolicy = 'crocodile' | 'scorpion' | 'mixed';
type MergePolicy = 'aggressive' | 'board-fill' | 'late';
type StartPolicy = 'new' | 'weak' | 'legacy' | 'max-rank';

interface ReplayFarm {
  readonly waveId: number;
  readonly times: number;
}

interface Strategy {
  readonly name: string;
  readonly buy: BuyPolicy;
  readonly merge: MergePolicy;
  readonly start: StartPolicy;
  readonly reserveCoins: number;
  readonly minArmy?: number;
  readonly replayFarm?: ReplayFarm;
}

interface WaveReport {
  readonly waveId: number;
  readonly attempts: number;
  readonly defeats: number;
  readonly durationSec: number;
  readonly survivors: number;
  readonly remainingHpPct: number;
  readonly coinsBefore: number;
  readonly coinsAfter: number;
  readonly earned: number;
  readonly spent: number;
  readonly armyPower: number;
  readonly army: string;
  readonly seed: number;
}

interface ReplayReport {
  readonly waveId: number;
  readonly times: number;
  readonly wins: number;
  readonly earned: number;
}

interface Checkpoint {
  readonly waveId: number;
  readonly coins: number;
  readonly armyPower: number;
  readonly ranks: string;
  readonly army: string;
}

interface SimulationReport {
  readonly name: string;
  readonly start: StartPolicy;
  readonly buy: BuyPolicy;
  readonly merge: MergePolicy;
  readonly finalWave: number;
  readonly blocked: boolean;
  readonly defeats: number;
  readonly startingCoins: number;
  readonly coins: number;
  readonly earned: number;
  readonly spent: number;
  readonly army: string;
  readonly totalXp: number;
  readonly waves: readonly WaveReport[];
  readonly replays: readonly ReplayReport[];
  readonly checkpoints: readonly Checkpoint[];
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
    const minimumArmy = strategy.minArmy ?? 0;

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
      const merged = current.characters.length > minimumArmy ? mergeOnce(current) : null;
      if (merged) {
        current = merged;
        continue;
      }
      break;
    }

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
    const merged = current.characters.length > minimumArmy ? mergeOnce(current) : null;
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

function rankSummary(profile: PlayerProfile): string {
  const counts = new Map<number, number>();
  for (const character of profile.characters) {
    counts.set(character.mergeRank, (counts.get(character.mergeRank) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, count]) => `R${rank}x${count}`)
    .join(' ');
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

function battleMetrics(battle: ReturnType<typeof runBattleToCompletion>): {
  readonly durationSec: number;
  readonly survivors: number;
  readonly remainingHpPct: number;
} {
  const allies = battle.state.units.filter((unit) => unit.team === 'ally');
  const maxHp = allies.reduce((sum, unit) => sum + unit.maxHp, 0);
  const currentHp = allies.reduce((sum, unit) => sum + (unit.alive ? unit.hp : 0), 0);
  return {
    durationSec: battle.state.elapsedSec,
    survivors: allies.filter((unit) => unit.alive).length,
    remainingHpPct: maxHp > 0 ? currentHp / maxHp : 0,
  };
}

function simulate(strategy: Strategy): SimulationReport {
  let profile = profileFor(strategy);
  let defeats = 0;
  let finalWave = 0;
  let blocked = false;
  let earned = 0;
  let spent = 0;
  const startingCoins = profile.coins;
  const waves: WaveReport[] = [];
  const replays: ReplayReport[] = [];
  const checkpoints: Checkpoint[] = [];

  console.log(`\n=== ${strategy.name} ===`);
  for (let waveId = 1; waveId <= LAST_WAVE_ID; waveId += 1) {
    const wave = getWave(waveId);
    if (!wave) throw new Error(`missing wave ${waveId}`);
    if ([1, 5, 10, 15, 20].includes(waveId)) {
      checkpoints.push({
        waveId,
        coins: profile.coins,
        armyPower: Math.round(armyPower(profile)),
        ranks: rankSummary(profile),
        army: armySummary(profile),
      });
    }

    let won = false;
    let attempts = 0;
    let lastReport: WaveReport | null = null;
    const defeatsBeforeWave = defeats;
    const coinsBeforePreparation = profile.coins;
    let waveSpent = 0;

    while (!won && attempts < MAX_ATTEMPTS_PER_WAVE) {
      attempts += 1;
      const coinsBeforeBuy = profile.coins;
      profile = prepareArmy(profile, strategy);
      waveSpent += coinsBeforeBuy - profile.coins;
      const roster = profile.characters.map((character) => character.id);
      const seed = waveId * 10_000 + attempts;
      const result = runBattleToCompletion(createBattleState(profile.characters, wave, seed));
      const metrics = battleMetrics(result);

      if (result.state.status === 'victory') {
        const beforeReward = profile.coins;
        const awarded = resolveBattleRewards(profile, waveId, roster, 2);
        if (!awarded.ok) throw new Error(`reward failed on wave ${waveId}`);
        profile = awarded.value.profile;
        won = true;
        finalWave = waveId;
        const reward = profile.coins - beforeReward;
        earned += reward;
        lastReport = {
          waveId,
          attempts,
          defeats: defeats - defeatsBeforeWave,
          durationSec: metrics.durationSec,
          survivors: metrics.survivors,
          remainingHpPct: metrics.remainingHpPct,
          coinsBefore: coinsBeforePreparation,
          coinsAfter: profile.coins,
          earned: reward,
          spent: waveSpent,
          armyPower: Math.round(armyPower(profile)),
          army: armySummary(profile),
          seed,
        };
      } else {
        defeats += 1;
        const beforeComfort = profile.coins;
        const comfort = applyDefeatComfort(profile, 2);
        if (!comfort.ok) throw new Error('comfort failed');
        profile = comfort.value;
        const comfortCoins = profile.coins - beforeComfort;
        earned += comfortCoins;
        lastReport = {
          waveId,
          attempts,
          defeats: defeats - defeatsBeforeWave,
          durationSec: metrics.durationSec,
          survivors: metrics.survivors,
          remainingHpPct: metrics.remainingHpPct,
          coinsBefore: coinsBeforePreparation,
          coinsAfter: profile.coins,
          earned: comfortCoins,
          spent: waveSpent,
          armyPower: Math.round(armyPower(profile)),
          army: armySummary(profile),
          seed,
        };
      }
    }

    spent += waveSpent;
    if (lastReport) waves.push(lastReport);
    if (!won) {
      blocked = true;
      console.log(
        `  Hullám ${waveId}: NEM TELJESÍTHETŐ ${MAX_ATTEMPTS_PER_WAVE} próbából (${defeats - defeatsBeforeWave} vereség)`,
      );
      break;
    }

    if (strategy.replayFarm && strategy.replayFarm.waveId === waveId) {
      let replayWins = 0;
      let replayEarned = 0;
      for (let replayIndex = 0; replayIndex < strategy.replayFarm.times; replayIndex += 1) {
        const roster = profile.characters.map((character) => character.id);
        const replayBattle = runBattleToCompletion(
          createBattleState(profile.characters, wave, waveId * 20_000 + replayIndex),
        );
        if (replayBattle.state.status !== 'victory') break;
        const beforeReplay = profile.coins;
        const replayReward = resolveBattleRewards(profile, waveId, roster, 2);
        if (!replayReward.ok) throw new Error(`replay reward failed on wave ${waveId}`);
        profile = replayReward.value.profile;
        const reward = profile.coins - beforeReplay;
        replayEarned += reward;
        earned += reward;
        replayWins += 1;
      }
      replays.push({
        waveId,
        times: strategy.replayFarm.times,
        wins: replayWins,
        earned: replayEarned,
      });
    }

    if (attempts > 1) {
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
    startingCoins,
    coins: profile.coins,
    earned,
    spent,
    army: armySummary(profile),
    totalXp: totalXp(profile),
    waves,
    replays,
    checkpoints,
    difficultyCliff:
      difficultyCliff && difficultyCliff.defeats > 0
        ? { waveId: difficultyCliff.waveId, defeats: difficultyCliff.defeats }
        : null,
    signature: signatureOf(profile, defeats),
  };
  console.log(
    `  Végső hullám: ${report.finalWave}/${LAST_WAVE_ID}, vereségek: ${report.defeats}, érme: ${report.coins}`,
  );
  console.log(
    `  Gazdaság: kezdő ${report.startingCoins}, bevétel ${report.earned}, költés ${report.spent}, maradék ${report.coins}`,
  );
  console.log(`  Sereg: ${report.army || 'üres'}`);
  console.log(`  Összes TP: ${report.totalXp}`);
  for (const checkpoint of report.checkpoints) {
    console.log(
      `  Checkpoint ${checkpoint.waveId}. hullám: ${checkpoint.coins} érme, ${checkpoint.armyPower} erő, [${checkpoint.ranks}]`,
    );
  }
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
  const clamped = characterStats('laser-crocodile', MAX_MERGE_RANK + 1, MAX_CHARACTER_XP);
  if (clamped.attack !== crocodile.attack || clamped.maxHp !== crocodile.maxHp) {
    checks.push('rank clamping above MAX_MERGE_RANK failed');
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
    name: '1. Kezdő játékos (széles sereg, kevés egyesítés)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
  },
  {
    name: '2. Kazsuális gyerek (széles sereg, óvatos egyesítés)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
  },
  {
    name: '3. Tapasztalt játékos (krokodil-fókusz)',
    buy: 'crocodile',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
  },
  {
    name: '4. Optimalizált játékos (tartalék + széles elit)',
    buy: 'crocodile',
    merge: 'late',
    start: 'new',
    reserveCoins: 100,
    minArmy: 10,
  },
  {
    name: '5. Replay farmer (9. hullám x10)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    replayFarm: { waveId: 9, times: 10 },
  },
  {
    name: '6. Replay farmer (15. hullám x10)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    replayFarm: { waveId: 15, times: 10 },
  },
  {
    name: '7. Valódi M0.1 mentés (fixture)',
    buy: 'mixed',
    merge: 'late',
    start: 'legacy',
    reserveCoins: 0,
    minArmy: 8,
  },
  {
    name: '8. Maximum rang és szint határ',
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
    balanceWarnings.push(`${report.name}: ${report.defeats} defeats`);
  }
  const expectedCoins = report.startingCoins + report.earned - report.spent;
  if (report.coins !== expectedCoins) {
    correctnessFailures.push(
      `${report.name}: economy ledger mismatch (${report.coins} != ${expectedCoins})`,
    );
  }
}
for (const check of boundary.checks) {
  correctnessFailures.push(`boundary: ${check}`);
}
const legacyReport = reports.find((report) => report.start === 'legacy');
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
  console.log('\nEgyensúlyi megjegyzések:');
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
