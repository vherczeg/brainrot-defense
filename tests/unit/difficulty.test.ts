import { describe, expect, it } from 'vitest';
import { DIFFICULTY_CONFIG, enemyStatsForDifficulty } from '../../src/game/domain/difficulty';
import { getWave } from '../../src/game/domain/waves';
import { createBattleState } from '../../src/game/simulation/battle';

function enemyUnit(state: ReturnType<typeof createBattleState>, typeId: string) {
  const unit = state.units.find((entry) => entry.team === 'enemy' && entry.typeId === typeId);
  if (!unit) throw new Error(`missing enemy ${typeId}`);
  return unit;
}

describe('difficulty configuration', () => {
  it('defines Normal as baseline and Hard as +35% HP / +15% attack', () => {
    expect(DIFFICULTY_CONFIG.normal).toEqual({
      enemyHpMultiplier: 1,
      enemyAttackMultiplier: 1,
    });
    expect(DIFFICULTY_CONFIG.hard).toEqual({
      enemyHpMultiplier: 1.35,
      enemyAttackMultiplier: 1.15,
    });
  });

  it('scales normal enemy stats after level scaling', () => {
    expect(enemyStatsForDifficulty('mini-brainrot', 1, 'normal')).toMatchObject({
      maxHp: 55,
      attack: 7,
    });
    expect(enemyStatsForDifficulty('mini-brainrot', 1, 'hard')).toMatchObject({
      maxHp: 74,
      attack: 8,
    });
  });

  it('scales both bosses without changing ability values', () => {
    const normalGorilla = enemyStatsForDifficulty('mega-brainrot-gorilla', 3, 'normal');
    const hardGorilla = enemyStatsForDifficulty('mega-brainrot-gorilla', 3, 'hard');
    expect(normalGorilla.maxHp).toBe(3281);
    expect(hardGorilla.maxHp).toBe(4429);
    expect(normalGorilla.attack).toBe(59);
    expect(hardGorilla.attack).toBe(68);

    const normalFalcon = enemyStatsForDifficulty('green-venom-falcon', 6, 'normal');
    const hardFalcon = enemyStatsForDifficulty('green-venom-falcon', 6, 'hard');
    expect(normalFalcon.maxHp).toBe(8508);
    expect(hardFalcon.maxHp).toBe(11486);
    expect(normalFalcon.attack).toBe(134);
    expect(hardFalcon.attack).toBe(154);
  });

  it('creates battle state with Normal by default and stores the chosen difficulty', () => {
    const wave = getWave(10);
    if (!wave) throw new Error('missing wave');
    const normal = createBattleState([], wave);
    const hard = createBattleState([], wave, 1, 'hard');
    expect(normal.difficulty).toBe('normal');
    expect(hard.difficulty).toBe('hard');
    expect(enemyUnit(hard, 'mega-brainrot-gorilla').maxHp).toBe(
      Math.round(enemyUnit(normal, 'mega-brainrot-gorilla').maxHp * 1.35),
    );
    expect(enemyUnit(hard, 'mega-brainrot-gorilla').attack).toBe(
      Math.round(enemyUnit(normal, 'mega-brainrot-gorilla').attack * 1.15),
    );
  });

  it('keeps Falcon ability durations and mechanics identical in Hard', () => {
    const wave = getWave(20);
    if (!wave) throw new Error('missing wave');
    const normal = enemyUnit(createBattleState([], wave), 'green-venom-falcon');
    const hard = enemyUnit(createBattleState([], wave, 1, 'hard'), 'green-venom-falcon');
    expect(hard.abilities).toEqual(normal.abilities);
    expect(hard.abilities.earthquake?.freezeSec).toBe(2);
    expect(hard.abilities.poison).toEqual(normal.abilities.poison);
    expect(hard.abilities.spinShield).toEqual(normal.abilities.spinShield);
    expect(hard.attackIntervalSec).toBe(normal.attackIntervalSec);
    expect(hard.range).toBe(normal.range);
    expect(hard.moveSpeed).toBe(normal.moveSpeed);
    expect(hard.armor).toBe(normal.armor);
  });
});
