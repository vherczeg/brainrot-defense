import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { characterStats } from '../src/game/domain/characters';
import {
  MAX_CHARACTER_LEVEL,
  MAX_CHARACTER_XP,
  MAX_MERGE_RANK,
  characterLevelFromXp,
  xpRequiredForLevel,
} from '../src/game/domain/progression';
import { LAST_WAVE_ID } from '../src/game/domain/waves';
import { runCampaign, type SimulationReport, type Strategy } from './campaignSim';

const BALANCE_DEFEAT_WARNING_THRESHOLD = 40;
const REPORT_PATH = resolve(process.cwd(), 'docs/qa/simulate-report.json');

interface BoundaryReport {
  readonly maxRank: number;
  readonly maxLevel: number;
  readonly maxXp: number;
  readonly crocodile: ReturnType<typeof characterStats>;
  readonly scorpion: ReturnType<typeof characterStats>;
  readonly rhino: ReturnType<typeof characterStats>;
  readonly owl: ReturnType<typeof characterStats>;
  readonly checks: readonly string[];
}

const strategies: readonly Strategy[] = [
  {
    name: '1. Kezdő játékos (széles sereg, kevés egyesítés)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 6,
    upgradeReserveFactor: 2,
  },
  {
    name: '2. Kazsuális gyerek (széles sereg, óvatos egyesítés)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 6,
    upgradeReserveFactor: 2,
  },
  {
    name: '3. Tapasztalt játékos (krokodil-fókusz)',
    buy: 'crocodile',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
  },
  {
    name: '4. Skorpió specialista',
    buy: 'scorpion',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 4,
    upgradeReserveFactor: 2,
  },
  {
    name: '5. Rinó tankos',
    buy: 'rhino',
    merge: 'board-fill',
    start: 'new',
    reserveCoins: 0,
    minArmy: 6,
    upgradeReserveFactor: 2,
  },
  {
    name: '6. Bagoly lassító + fejlesztések',
    buy: 'owl',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 4,
    upgradeReserveFactor: 2,
    // A pure support-unit army is a documented anti-pattern: it clears the campaign
    // slowly on its own and shines inside mixed armies. Blocking is expected.
    expectedBlock: true,
  },
  {
    name: '7. Optimalizált játékos (tartalék + széles elit)',
    buy: 'crocodile',
    merge: 'late',
    start: 'new',
    reserveCoins: 100,
    minArmy: 10,
    upgradeReserveFactor: 2,
  },
  {
    name: '8. Replay farmer (9. hullám x10)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
    replayFarm: { waveId: 9, times: 10 },
  },
  {
    name: '9. Replay farmer (15. hullám x10)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
    replayFarm: { waveId: 15, times: 10 },
  },
  {
    name: '10. Valódi M0.1 mentés (fixture)',
    buy: 'mixed',
    merge: 'late',
    start: 'legacy',
    reserveCoins: 0,
    minArmy: 8,
    upgradeReserveFactor: 2,
  },
  {
    name: '11. Maximum rang és szint határ',
    buy: 'mixed',
    merge: 'board-fill',
    start: 'max-rank',
    reserveCoins: 0,
  },
];

const reports: SimulationReport[] = strategies.map((strategy) =>
  runCampaign({ strategy, seed: 1, verbose: true }),
);

function runBoundaryReport(): BoundaryReport {
  const crocodile = characterStats('laser-crocodile', MAX_MERGE_RANK, MAX_CHARACTER_XP);
  const scorpion = characterStats('lightning-scorpion', MAX_MERGE_RANK, MAX_CHARACTER_XP);
  const rhino = characterStats('armored-rhino', MAX_MERGE_RANK, MAX_CHARACTER_XP);
  const owl = characterStats('frost-owl', MAX_MERGE_RANK, MAX_CHARACTER_XP);
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
  for (const stats of [crocodile, scorpion, rhino, owl]) {
    if (stats.attack <= 0 || stats.maxHp <= 0) checks.push('max-rank stats must be positive');
    if (!Number.isFinite(stats.attack) || !Number.isFinite(stats.maxHp)) {
      checks.push('max-rank stats must be finite');
    }
  }

  console.log('\n=== Maximum rank and level boundaries ===');
  console.log(`  LVL 1 = ${xpRequiredForLevel(1)} TP, LVL 100 = ${xpRequiredForLevel(100)} TP`);
  console.log(`  Lézer Krokodil R10 L100: ATK ${crocodile.attack}, HP ${crocodile.maxHp}`);
  console.log(`  Villám Skorpió R10 L100: ATK ${scorpion.attack}, HP ${scorpion.maxHp}`);
  console.log(`  Páncél Rinó R10 L100: ATK ${rhino.attack}, HP ${rhino.maxHp}`);
  console.log(`  Fagy Bagoly R10 L100: ATK ${owl.attack}, HP ${owl.maxHp}`);
  console.log(`  Numerikus határellenőrzések: ${checks.length === 0 ? 'OK' : checks.join('; ')}`);

  return {
    maxRank: MAX_MERGE_RANK,
    maxLevel: MAX_CHARACTER_LEVEL,
    maxXp: MAX_CHARACTER_XP,
    crocodile,
    scorpion,
    rhino,
    owl,
    checks,
  };
}

const boundary = runBoundaryReport();

const correctnessFailures: string[] = [];
const balanceWarnings: string[] = [];

for (const report of reports) {
  if (report.blocked) {
    const strategy = strategies.find((entry) => entry.name === report.name);
    if (strategy?.expectedBlock) {
      balanceWarnings.push(
        `${report.name}: blocked at wave ${report.blockedWave} (documented anti-pattern)`,
      );
    } else {
      correctnessFailures.push(
        `${report.name}: blocked before completing wave ${LAST_WAVE_ID} (wave ${report.blockedWave})`,
      );
    }
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
  if (report.surpriseBossWaves.length < (report.blocked ? 1 : 5)) {
    correctnessFailures.push(
      `${report.name}: too few surprise boss waves (${report.surpriseBossWaves.length})`,
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

const json = {
  scenarios: reports,
  boundary,
  correctnessFailures,
  balanceWarnings,
  completed,
  total: reports.length,
};
console.log(`SIMULATION_JSON ${JSON.stringify(json)}`);
try {
  writeFileSync(REPORT_PATH, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Riport elmentve: ${REPORT_PATH}`);
} catch (error) {
  console.log(`Riport mentése nem sikerült: ${String(error)}`);
}

if (correctnessFailures.length > 0) {
  process.exitCode = 1;
}
