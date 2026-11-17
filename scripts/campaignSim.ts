import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mergeCharacters,
  purchaseCharacter,
  purchaseUpgrade,
  resolveBattleRewards,
  resolveDefeatRewards,
  sellCharacter,
} from '../src/game/commands/profileCommands';
import { characterStats } from '../src/game/domain/characters';
import { emptyAlliedCells } from '../src/game/domain/grid';
import { characterLevelFromXp } from '../src/game/domain/progression';
import { createInitialProfile } from '../src/game/domain/state';
import {
  MAX_CHARACTER_XP,
  MAX_MERGE_RANK,
  type CharacterInstance,
  type CharacterTypeId,
  type Difficulty,
  type PlayerProfile,
} from '../src/game/domain/types';
import { upgradeCost, upgradeLevel, maxUpgradeLevelReached } from '../src/game/domain/upgrades';
import { LAST_WAVE_ID, getWave, getWaveForProfile } from '../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../src/game/simulation/battle';
import { parseProfileFromImport } from '../src/persistence/import-export/saveCodec';

export type BuyPolicy = 'crocodile' | 'scorpion' | 'mixed' | 'rhino' | 'owl';
export type MergePolicy = 'aggressive' | 'board-fill' | 'late';
export type StartPolicy = 'new' | 'weak' | 'legacy' | 'max-rank';

export interface ReplayFarm {
  readonly waveId: number;
  readonly times: number;
}

export interface Strategy {
  readonly name: string;
  readonly buy: BuyPolicy;
  readonly merge: MergePolicy;
  readonly start: StartPolicy;
  readonly reserveCoins: number;
  readonly minArmy?: number;
  readonly replayFarm?: ReplayFarm;
  readonly upgradeReserveFactor?: number;
  readonly maxUpgradeLevel?: number;
  readonly expectedBlock?: boolean;
}

export interface WaveReport {
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
  readonly surpriseBoss: boolean;
}

export interface ReplayReport {
  readonly waveId: number;
  readonly times: number;
  readonly wins: number;
  readonly earned: number;
}

export interface Checkpoint {
  readonly waveId: number;
  readonly coins: number;
  readonly armyPower: number;
  readonly ranks: string;
  readonly army: string;
  readonly upgrades: string;
}

export interface SimulationReport {
  readonly name: string;
  readonly profileId: string;
  readonly difficulty: Difficulty;
  readonly start: StartPolicy;
  readonly buy: BuyPolicy;
  readonly merge: MergePolicy;
  readonly finalWave: number;
  readonly blocked: boolean;
  readonly blockedWave: number | null;
  readonly defeats: number;
  readonly startingCoins: number;
  readonly coins: number;
  readonly earned: number;
  readonly spent: number;
  readonly army: string;
  readonly totalXp: number;
  readonly upgrades: Readonly<Record<string, number>>;
  readonly waves: readonly WaveReport[];
  readonly replays: readonly ReplayReport[];
  readonly checkpoints: readonly Checkpoint[];
  readonly difficultyCliff: { readonly waveId: number; readonly defeats: number } | null;
  readonly surpriseBossWaves: readonly number[];
  readonly signature: string;
}

export interface CampaignOptions {
  readonly strategy: Strategy;
  readonly seed: number;
  readonly difficulty?: Difficulty;
  readonly maxAttemptsPerWave?: number;
  readonly verbose?: boolean;
}

const LEGACY_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/m0.1-legacy-save.json');
const CHARACTER_COSTS: Readonly<Record<CharacterTypeId, number>> = {
  'laser-crocodile': 100,
  'lightning-scorpion': 150,
  'armored-rhino': 200,
  'frost-owl': 250,
};

export function startProfile(profileId: string): PlayerProfile {
  return createInitialProfile({ profileId, name: 'Sim', now: 1 });
}

export function weakStartProfile(): PlayerProfile {
  return {
    ...startProfile('weak-start'),
    coins: 0,
    characters: [
      { id: 'unit-1', typeId: 'laser-crocodile', mergeRank: 1, totalXp: 0, col: 0, row: 3 },
    ],
    nextCharacterId: 2,
  };
}

export function legacyProfile(): PlayerProfile {
  const text = readFileSync(LEGACY_FIXTURE_PATH, 'utf8');
  const parsed = parseProfileFromImport(text);
  if (!parsed.ok) {
    throw new Error(`legacy fixture failed validation: ${parsed.error} ${parsed.detail ?? ''}`);
  }
  return parsed.value;
}

export function maxRankProfile(): PlayerProfile {
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

function profileFor(strategy: Strategy, seed: number): PlayerProfile {
  if (strategy.start === 'legacy') return legacyProfile();
  if (strategy.start === 'weak') return weakStartProfile();
  if (strategy.start === 'max-rank') return maxRankProfile();
  return startProfile(`sim-${seed}`);
}

export function pairForMerge(profile: PlayerProfile): readonly [string, string] | null {
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

export function mergeOnce(profile: PlayerProfile): PlayerProfile | null {
  const pair = pairForMerge(profile);
  if (!pair) return null;
  const result = mergeCharacters(profile, pair[0], pair[1], 1);
  return result.ok ? result.value.profile : null;
}

export function chooseType(profile: PlayerProfile, policy: BuyPolicy): CharacterTypeId {
  if (policy === 'crocodile') return 'laser-crocodile';
  if (policy === 'rhino') return 'armored-rhino';
  if (policy === 'owl') {
    // Owl lovers still field crocodiles for reliable ranged damage.
    const owls = profile.characters.filter((character) => character.typeId === 'frost-owl').length;
    const crocs = profile.characters.filter(
      (character) => character.typeId === 'laser-crocodile',
    ).length;
    return owls > (crocs + 1) * 2 ? 'laser-crocodile' : 'frost-owl';
  }
  if (policy === 'scorpion') {
    // Scorpion lovers mix in crocodiles against armored targets.
    const scorpions = profile.characters.filter(
      (character) => character.typeId === 'lightning-scorpion',
    ).length;
    const crocs = profile.characters.filter(
      (character) => character.typeId === 'laser-crocodile',
    ).length;
    return scorpions > (crocs + 1) * 3 ? 'laser-crocodile' : 'lightning-scorpion';
  }
  // Mixed: kids buy their favorites. Concentrate purchases on the type with the most
  // rank-1 units so merges keep flowing, then fall back to the most-owned type.
  const types: readonly CharacterTypeId[] = [
    'laser-crocodile',
    'lightning-scorpion',
    'armored-rhino',
    'frost-owl',
  ];
  const rankOne = new Map<CharacterTypeId, number>();
  const totals = new Map<CharacterTypeId, number>();
  for (const type of types) {
    rankOne.set(type, 0);
    totals.set(type, 0);
  }
  for (const character of profile.characters) {
    totals.set(character.typeId, (totals.get(character.typeId) ?? 0) + 1);
    if (character.mergeRank === 1) {
      rankOne.set(character.typeId, (rankOne.get(character.typeId) ?? 0) + 1);
    }
  }
  let best = types[0] ?? 'laser-crocodile';
  for (const type of types) {
    const rankOneBest = rankOne.get(best) ?? 0;
    const rankOneCurrent = rankOne.get(type) ?? 0;
    if (
      rankOneCurrent > rankOneBest ||
      (rankOneCurrent === rankOneBest && (totals.get(type) ?? 0) > (totals.get(best) ?? 0))
    ) {
      best = type;
    }
  }
  return best;
}

export function costOf(typeId: CharacterTypeId): number {
  return CHARACTER_COSTS[typeId];
}

export function buyIfAffordable(
  profile: PlayerProfile,
  typeId: CharacterTypeId,
  reserveCoins: number,
): PlayerProfile | null {
  if (emptyAlliedCells(profile.characters).length === 0) return null;
  if (profile.coins < costOf(typeId) + reserveCoins) return null;
  const purchase = purchaseCharacter(profile, typeId, 1);
  return purchase.ok ? purchase.value.profile : null;
}

export function buyUpgradeIfWise(profile: PlayerProfile, strategy: Strategy): PlayerProfile | null {
  const kinds: readonly ('army-attack' | 'army-hp')[] = ['army-attack', 'army-hp'];
  const maxLevel = strategy.maxUpgradeLevel ?? 25;
  let best: { kind: 'army-attack' | 'army-hp'; cost: number } | null = null;
  for (const kind of kinds) {
    const level = upgradeLevel(profile, kind);
    if (level >= maxLevel || maxUpgradeLevelReached(profile, kind)) continue;
    const cost = upgradeCost(kind, level);
    const candidate = { kind, cost };
    if (!best || cost < best.cost) best = candidate;
  }
  if (!best) return null;
  // Default: only buy upgrades when the treasury is huge; strategies that want to invest
  // in the upgrade shop early pass a lower factor explicitly.
  const reserveFactor = strategy.upgradeReserveFactor ?? 100;
  if (profile.coins < best.cost * reserveFactor) return null;
  const outcome = purchaseUpgrade(profile, best.kind, 1);
  return outcome.ok ? outcome.value.profile : null;
}

export function sellWeakest(profile: PlayerProfile): PlayerProfile | null {
  let weakest: CharacterInstance | null = null;
  for (const character of profile.characters) {
    if (
      !weakest ||
      character.mergeRank < weakest.mergeRank ||
      (character.mergeRank === weakest.mergeRank && character.totalXp < weakest.totalXp)
    ) {
      weakest = character;
    }
  }
  if (!weakest) return null;
  const outcome = sellCharacter(profile, weakest.id, 1);
  return outcome.ok ? outcome.value.profile : null;
}

export function prepareArmy(profile: PlayerProfile, strategy: Strategy): PlayerProfile {
  let current = profile;
  const minimumArmy = strategy.minArmy ?? 0;
  for (let guard = 0; guard < 3000; guard += 1) {
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
    }

    if (current.characters.length > minimumArmy) {
      const merged = mergeOnce(current);
      if (merged) {
        current = merged;
        continue;
      }
    }

    if (strategy.merge !== 'aggressive') {
      const upgraded = buyUpgradeIfWise(current, strategy);
      if (upgraded) {
        current = upgraded;
        continue;
      }
    }

    // Board full, nothing to merge, and the treasury cannot buy power: free a slot by
    // selling the weakest unit, exactly like the in-game sell flow teaches.
    if (free === 0 && current.characters.length > minimumArmy) {
      const sold = sellWeakest(current);
      if (sold) {
        current = sold;
        continue;
      }
    }

    break;
  }
  return current;
}

export function armySummary(profile: PlayerProfile): string {
  return profile.characters
    .map((character) => {
      const short =
        character.typeId === 'laser-crocodile'
          ? 'K'
          : character.typeId === 'lightning-scorpion'
            ? 'S'
            : character.typeId === 'armored-rhino'
              ? 'R'
              : 'B';
      const level = characterLevelFromXp(character.totalXp);
      return `${short}${character.mergeRank}L${level}`;
    })
    .join(',');
}

export function rankSummary(profile: PlayerProfile): string {
  const counts = new Map<number, number>();
  for (const character of profile.characters) {
    counts.set(character.mergeRank, (counts.get(character.mergeRank) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, count]) => `R${rank}x${count}`)
    .join(' ');
}

export function totalXp(profile: PlayerProfile): number {
  return profile.characters.reduce((sum, character) => sum + character.totalXp, 0);
}

export function armyPower(profile: PlayerProfile): number {
  return profile.characters.reduce((total, character) => {
    const stats = characterStats(character.typeId, character.mergeRank, character.totalXp);
    return total + stats.attack + stats.maxHp / 10;
  }, 0);
}

function signatureOf(profile: PlayerProfile, defeats: number): string {
  return `${profile.characters
    .map((character) => `${character.typeId}:${character.mergeRank}:${character.totalXp}`)
    .sort()
    .join('|')}#${defeats}#${profile.coins}#${JSON.stringify(profile.upgrades)}`;
}

export function battleMetrics(battle: ReturnType<typeof runBattleToCompletion>): {
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

export function runCampaign(options: CampaignOptions): SimulationReport {
  const strategy = options.strategy;
  const difficulty = options.difficulty ?? 'normal';
  const maxAttempts = options.maxAttemptsPerWave ?? 60;
  let profile = profileFor(strategy, options.seed);
  if (difficulty !== 'normal') {
    profile = {
      ...profile,
      settings: { ...profile.settings, difficulty },
    };
  }
  const profileId = profile.profileId;
  let defeats = 0;
  let finalWave = 0;
  let blocked = false;
  let blockedWave: number | null = null;
  let earned = 0;
  let spent = 0;
  const startingCoins = profile.coins;
  const waves: WaveReport[] = [];
  const replays: ReplayReport[] = [];
  const checkpoints: Checkpoint[] = [];
  const surpriseBossWaves: number[] = [];

  if (options.verbose) console.log(`\n=== ${strategy.name} (${difficulty}) ===`);
  for (let waveId = 1; waveId <= LAST_WAVE_ID; waveId += 1) {
    const wave = getWaveForProfile(profileId, waveId);
    if (!wave) throw new Error(`missing wave ${waveId}`);
    const baseWave = getWave(waveId);
    const surpriseBoss = baseWave ? wave.nameHu !== baseWave.nameHu : false;
    if (surpriseBoss) surpriseBossWaves.push(waveId);
    if ([1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100].includes(waveId)) {
      checkpoints.push({
        waveId,
        coins: profile.coins,
        armyPower: Math.round(armyPower(profile)),
        ranks: rankSummary(profile),
        army: armySummary(profile),
        upgrades: `${profile.upgrades['army-attack'] ?? 0}A/${profile.upgrades['army-hp'] ?? 0}H`,
      });
    }

    let won = false;
    let attempts = 0;
    let lastReport: WaveReport | null = null;
    const defeatsBeforeWave = defeats;
    const coinsBeforePreparation = profile.coins;
    let waveSpent = 0;

    while (!won && attempts < maxAttempts) {
      attempts += 1;
      const coinsBeforeBuy = profile.coins;
      profile = prepareArmy(profile, strategy);
      waveSpent += coinsBeforeBuy - profile.coins;
      const roster = profile.characters.map((character) => character.id);
      const seed = waveId * 100_000 + attempts * 7 + options.seed;
      const result = runBattleToCompletion(
        createBattleState(profile.characters, wave, seed, difficulty, profile.upgrades),
      );
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
          surpriseBoss,
        };
      } else {
        defeats += 1;
        const beforeComfort = profile.coins;
        const comfort = resolveDefeatRewards(profile, waveId, roster, 2);
        if (!comfort.ok) throw new Error(`defeat reward failed on wave ${waveId}`);
        profile = comfort.value.profile;
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
          surpriseBoss,
        };

        // A stuck player naturally replays earlier, safely beaten waves for extra coins.
        const defeatsOnWave = defeats - defeatsBeforeWave;
        if (defeatsOnWave > 0 && defeatsOnWave % 8 === 0) {
          const farmWaveId = Math.max(1, waveId - 8);
          const farmWave = getWaveForProfile(profileId, farmWaveId);
          if (farmWave) {
            for (let farm = 0; farm < 3; farm += 1) {
              const farmRoster = profile.characters.map((character) => character.id);
              const farmBattle = runBattleToCompletion(
                createBattleState(
                  profile.characters,
                  farmWave,
                  farmWaveId * 500_000 + farm + options.seed,
                  difficulty,
                  profile.upgrades,
                ),
              );
              if (farmBattle.state.status !== 'victory') break;
              const farmReward = resolveBattleRewards(profile, farmWaveId, farmRoster, 2);
              if (!farmReward.ok) break;
              const farmGain = farmReward.value.profile.coins - profile.coins;
              profile = farmReward.value.profile;
              earned += farmGain;
            }
          }
        }
      }
    }

    spent += waveSpent;
    if (lastReport) waves.push(lastReport);
    if (!won) {
      blocked = true;
      blockedWave = waveId;
      if (options.verbose) {
        console.log(
          `  Hullám ${waveId}: NEM TELJESÍTHETŐ ${maxAttempts} próbából (${defeats - defeatsBeforeWave} vereség)`,
        );
      }
      break;
    }

    if (strategy.replayFarm && strategy.replayFarm.waveId === waveId) {
      let replayWins = 0;
      let replayEarned = 0;
      for (let replayIndex = 0; replayIndex < strategy.replayFarm.times; replayIndex += 1) {
        const roster = profile.characters.map((character) => character.id);
        const replayBattle = runBattleToCompletion(
          createBattleState(
            profile.characters,
            wave,
            waveId * 200_000 + replayIndex + options.seed,
            difficulty,
            profile.upgrades,
          ),
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

    if (options.verbose && attempts > 1) {
      console.log(`  Hullám ${waveId}: győzelem ${attempts}. próbára.`);
    }
  }

  const difficultyCliff =
    waves.length === 0
      ? null
      : waves.reduce((worst, wave) => (wave.defeats > worst.defeats ? wave : worst), waves[0]!);
  const report: SimulationReport = {
    name: strategy.name,
    profileId,
    difficulty,
    start: strategy.start,
    buy: strategy.buy,
    merge: strategy.merge,
    finalWave,
    blocked,
    blockedWave,
    defeats,
    startingCoins,
    coins: profile.coins,
    earned,
    spent,
    army: armySummary(profile),
    totalXp: totalXp(profile),
    upgrades: profile.upgrades,
    waves,
    replays,
    checkpoints,
    difficultyCliff:
      difficultyCliff && difficultyCliff.defeats > 0
        ? { waveId: difficultyCliff.waveId, defeats: difficultyCliff.defeats }
        : null,
    surpriseBossWaves,
    signature: signatureOf(profile, defeats),
  };
  if (options.verbose) {
    console.log(
      `  Végső hullám: ${report.finalWave}/${LAST_WAVE_ID}, vereségek: ${report.defeats}, érme: ${report.coins}`,
    );
    console.log(
      `  Gazdaság: kezdő ${report.startingCoins}, bevétel ${report.earned}, költés ${report.spent}, maradék ${report.coins}`,
    );
    console.log(`  Sereg: ${report.army || 'üres'}`);
    console.log(
      `  Fejlesztések: ${report.upgrades['army-attack'] ?? 0}A / ${report.upgrades['army-hp'] ?? 0}H`,
    );
    if (report.blocked) console.log('  ÁLLAPOT: blokkolt');
  }
  return report;
}
