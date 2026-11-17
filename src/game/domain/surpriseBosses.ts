import { ENEMY_DEFINITIONS } from './enemies';
import type { SurpriseBossTypeId, WaveDefinition, WaveEnemyConfig } from './types';

export const SURPRISE_BOSS_TYPE_IDS: readonly SurpriseBossTypeId[] = [
  'kappa-captain',
  'nightmare-moth',
  'iron-hedgehog',
  'bubble-duchess',
  'void-eye',
];

export const SURPRISE_BLOCKS = 5;
const BLOCK_SIZE = 20;

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function surpriseBlockOf(waveId: number): number {
  return Math.floor((waveId - 1) / BLOCK_SIZE);
}

export function surpriseBossWaveCandidates(blockIndex: number): readonly number[] {
  const start = blockIndex * BLOCK_SIZE + 1;
  const end = start + BLOCK_SIZE - 1;
  const candidates: number[] = [];
  const from = blockIndex === 0 ? start + 11 : start + 5;
  for (let wave = from; wave <= end - 1; wave += 1) {
    if (wave % 10 === 0) continue;
    candidates.push(wave);
  }
  return candidates;
}

export function surpriseBossWaveFor(profileId: string, blockIndex: number): number | null {
  if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= SURPRISE_BLOCKS) {
    return null;
  }
  const candidates = surpriseBossWaveCandidates(blockIndex);
  if (candidates.length === 0) return null;
  const index = fnv1a(`${profileId}:surprise:${blockIndex}`) % candidates.length;
  return candidates[index] ?? null;
}

export function surpriseBossTypeFor(profileId: string, waveId: number): SurpriseBossTypeId {
  const index = fnv1a(`${profileId}:surprise-type:${waveId}`) % SURPRISE_BOSS_TYPE_IDS.length;
  return SURPRISE_BOSS_TYPE_IDS[index] ?? 'kappa-captain';
}

export function surpriseBossLevel(waveId: number, baseEnemyLevels: readonly number[]): number {
  const maxLevel = Math.max(1, ...baseEnemyLevels, 0);
  // The surprise boss steps in for a normal wave, so it must be beatable by the army that
  // handles that wave: one level below the wave's strongest enemy, with a modest premium
  // in the later chapters where armies are more developed.
  const premium = waveId >= 60 ? 1 : 0;
  return Math.min(40, Math.max(1, maxLevel - 1 + premium));
}

export function buildSurpriseBossWave(
  profileId: string,
  wave: WaveDefinition,
): { wave: WaveDefinition; bossTypeId: SurpriseBossTypeId } | null {
  const block = surpriseBlockOf(wave.id);
  if (surpriseBossWaveFor(profileId, block) !== wave.id) return null;
  const bossTypeId = surpriseBossTypeFor(profileId, wave.id);
  const definition = ENEMY_DEFINITIONS[bossTypeId];
  const bossEnemy: WaveEnemyConfig = {
    typeId: bossTypeId,
    level: surpriseBossLevel(
      wave.id,
      wave.enemies.map((entry) => entry.level),
    ),
    col: 2,
    row: 0,
  };
  return {
    bossTypeId,
    wave: {
      ...wave,
      nameHu: definition.nameHu,
      descriptionHu: `MEGLEPETÉS! ${definition.descriptionHu}`,
      rewardCoins: Math.max(1, Math.round(wave.rewardCoins * 1.5)),
      enemies: [bossEnemy],
    },
  };
}

export function isSurpriseBossWaveFor(profileId: string, waveId: number): boolean {
  const block = surpriseBlockOf(waveId);
  return surpriseBossWaveFor(profileId, block) === waveId;
}
