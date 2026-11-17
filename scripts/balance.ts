import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Difficulty } from '../src/game/domain/types';
import { runCampaign, type SimulationReport, type Strategy } from './campaignSim';

const REPORT_PATH = resolve(process.cwd(), 'docs/qa/balance-report.json');

const STRATEGIES: readonly Strategy[] = [
  {
    name: 'beginner-wide',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 6,
    upgradeReserveFactor: 2,
  },
  {
    name: 'casual-kid',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
  },
  {
    name: 'crocodile-focus',
    buy: 'crocodile',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
  },
  {
    name: 'scorpion-focus',
    buy: 'scorpion',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 4,
    upgradeReserveFactor: 2,
  },
  {
    name: 'rhino-tank',
    buy: 'rhino',
    merge: 'board-fill',
    start: 'new',
    reserveCoins: 0,
    minArmy: 6,
    upgradeReserveFactor: 2,
  },
  {
    name: 'owl-support',
    buy: 'owl',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 4,
    upgradeReserveFactor: 2,
  },
  {
    name: 'optimized-elite',
    buy: 'crocodile',
    merge: 'late',
    start: 'new',
    reserveCoins: 100,
    minArmy: 10,
    upgradeReserveFactor: 2,
  },
  {
    name: 'replay-farmer-9',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
    replayFarm: { waveId: 9, times: 10 },
  },
  {
    name: 'replay-farmer-15',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
    replayFarm: { waveId: 15, times: 10 },
  },
  {
    name: 'legacy-save',
    buy: 'mixed',
    merge: 'late',
    start: 'legacy',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
  },
  {
    name: 'max-rank-boundary',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'max-rank',
    reserveCoins: 0,
  },
];

interface DifficultyRun {
  readonly difficulty: Difficulty;
  readonly seeds: number;
}

function parseArgs(): { seedsPerStrategy: number; runs: readonly DifficultyRun[] } {
  const seedsPerStrategy = Number(process.env.BALANCE_SEEDS ?? '20');
  const difficultyArg = process.env.BALANCE_DIFFICULTIES ?? 'normal';
  const difficulties = difficultyArg.split(',').filter(Boolean) as Difficulty[];
  return {
    seedsPerStrategy,
    runs: difficulties.map((difficulty) => ({ difficulty, seeds: seedsPerStrategy })),
  };
}

function analyze(reports: readonly SimulationReport[]) {
  const perWaveDefeats = new Map<number, number[]>();
  const perWaveAttempts = new Map<number, number[]>();
  const perWaveBlocked = new Map<number, number>();
  const surpriseWaves = new Map<number, number>();
  const completions: string[] = [];
  const blockedRuns: { name: string; difficulty: Difficulty; wave: number; defeats: number }[] = [];

  for (const report of reports) {
    if (!report.blocked) {
      completions.push(`${report.name}@${report.difficulty}`);
    } else if (report.blockedWave !== null) {
      blockedRuns.push({
        name: report.name,
        difficulty: report.difficulty,
        wave: report.blockedWave,
        defeats: report.defeats,
      });
    }
    for (const wave of report.waves) {
      const defeats = perWaveDefeats.get(wave.waveId) ?? [];
      defeats.push(wave.defeats);
      perWaveDefeats.set(wave.waveId, defeats);
      const attempts = perWaveAttempts.get(wave.waveId) ?? [];
      attempts.push(wave.attempts);
      perWaveAttempts.set(wave.waveId, attempts);
      if (wave.defeats >= 20) {
        perWaveBlocked.set(wave.waveId, (perWaveBlocked.get(wave.waveId) ?? 0) + 1);
      }
    }
    for (const waveId of report.surpriseBossWaves) {
      surpriseWaves.set(waveId, (surpriseWaves.get(waveId) ?? 0) + 1);
    }
  }

  const waveStats = [...perWaveDefeats.entries()]
    .map(([waveId, defeats]) => {
      const attempts = perWaveAttempts.get(waveId) ?? [];
      const total = defeats.length;
      const avg = defeats.reduce((sum, value) => sum + value, 0) / Math.max(1, total);
      const max = Math.max(...defeats, 0);
      const attemptsAvg =
        attempts.reduce((sum, value) => sum + value, 0) / Math.max(1, attempts.length);
      return {
        waveId,
        samples: total,
        avgDefeats: Number(avg.toFixed(2)),
        maxDefeats: max,
        avgAttempts: Number(attemptsAvg.toFixed(2)),
        heavyLosses: perWaveBlocked.get(waveId) ?? 0,
      };
    })
    .sort((a, b) => a.waveId - b.waveId);

  const totalDefeats = reports.reduce((sum, report) => sum + report.defeats, 0);
  const difficultyGroups = new Map<Difficulty, { total: number; completed: number }>();
  for (const report of reports) {
    const group = difficultyGroups.get(report.difficulty) ?? { total: 0, completed: 0 };
    group.total += 1;
    if (!report.blocked) group.completed += 1;
    difficultyGroups.set(report.difficulty, group);
  }

  return {
    totalRuns: reports.length,
    completedRuns: completions.length,
    blockedRuns,
    totalDefeats,
    difficultyGroups: [...difficultyGroups.entries()].map(([difficulty, group]) => ({
      difficulty,
      ...group,
    })),
    waveStats,
    surpriseWaves: [...surpriseWaves.entries()].map(([waveId, count]) => ({ waveId, count })),
    warnings: waveStats.filter((wave) => wave.maxDefeats >= 40 && wave.heavyLosses > 2),
  };
}

async function main(): Promise<void> {
  const { runs } = parseArgs();
  const reports: SimulationReport[] = [];
  let index = 0;
  const totalRuns = runs.reduce((sum, run) => sum + run.seeds * STRATEGIES.length, 0);
  console.log(
    `Balance suite: ${totalRuns} runs (${STRATEGIES.length} strategies × ${runs
      .map((run) => `${run.seeds}×${run.difficulty}`)
      .join(', ')})`,
  );
  const startedAt = Date.now();

  for (const run of runs) {
    for (const strategy of STRATEGIES) {
      for (let seed = 1; seed <= run.seeds; seed += 1) {
        index += 1;
        const report = runCampaign({
          strategy,
          seed,
          difficulty: run.difficulty,
          maxAttemptsPerWave: 60,
        });
        reports.push(report);
        if (index % 25 === 0 || index === totalRuns) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(`  ${index}/${totalRuns} runs (${elapsed}s)`);
        }
      }
    }
  }

  const analysis = analyze(reports);
  console.log(`\nBefejezve: ${analysis.completedRuns}/${analysis.totalRuns} végigjátszás.`);
  for (const group of analysis.difficultyGroups) {
    console.log(`  ${group.difficulty}: ${group.completed}/${group.total} teljesítve`);
  }
  if (analysis.blockedRuns.length > 0) {
    console.log('\nElakadások:');
    for (const blocked of analysis.blockedRuns.slice(0, 20)) {
      console.log(`  ${blocked.name} (${blocked.difficulty}): ${blocked.wave}. hullám`);
    }
  }
  if (analysis.warnings.length > 0) {
    console.log('\nNehéz hullámok (max >= 40 vereség, több futásban is):');
    for (const wave of analysis.warnings) {
      console.log(
        `  ${wave.waveId}. hullám: átlag ${wave.avgDefeats} vereség, max ${wave.maxDefeats}`,
      );
    }
  }

  writeFileSync(REPORT_PATH, `${JSON.stringify(analysis, null, 2)}\n`);
  console.log(`\nRiport: ${REPORT_PATH}`);
}

void main();
