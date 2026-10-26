import { useGameController } from '../app/ControllerContext';
import type { BattleHudView } from '../app/controller';
import { formatSeconds, t } from '../localization';
import { Icon } from './Icon';

export function BattleHud({ battle }: { battle: BattleHudView }) {
  const controller = useGameController();
  return (
    <section className="battle-hud" data-testid="battle-hud">
      <div className="battle-hud__counts">
        <span
          className={`difficulty-chip difficulty-chip--${battle.difficulty}`}
          data-testid="battle-difficulty"
        >
          <Icon name={battle.difficulty === 'hard' ? 'swords' : 'shield'} size={14} />
          {battle.difficulty === 'hard' ? t('difficultyHard') : t('difficultyNormal')}
        </span>
        <span className="battle-hud__count battle-hud__count--ally">
          <span className="battle-hud__dot" aria-hidden="true" />
          {t('battleAllies')} <strong data-testid="allies-alive">{battle.alliesAlive}</strong>
        </span>
        <span className="battle-hud__vs" aria-hidden="true">
          VS
        </span>
        <span className="battle-hud__count battle-hud__count--enemy">
          <span className="battle-hud__dot" aria-hidden="true" />
          {t('battleEnemies')} <strong data-testid="enemies-alive">{battle.enemiesAlive}</strong>
        </span>
      </div>
      <div className="battle-hud__right">
        <span className="battle-hud__timer">
          <Icon name="timer" size={14} />
          {t('battleTime')} {formatSeconds(battle.elapsedSec)}s
        </span>
        <button
          type="button"
          className="hud-button"
          onClick={() => controller.setBattleSpeed(battle.speed === 1 ? 2 : 1)}
          aria-label={t('battleSpeed')}
          data-testid="battle-speed"
        >
          <Icon name="battle-speed" size={16} />
          {t('battleSpeedValue', { speed: battle.speed })}
        </button>
        <button
          type="button"
          className="hud-button hud-button--accent"
          onClick={() => controller.togglePause()}
          aria-label={battle.paused ? t('battleResume') : t('battlePause')}
          data-testid="battle-pause"
        >
          <Icon name={battle.paused ? 'resume' : 'pause'} size={16} />
          {battle.paused ? t('battleResume') : t('battlePause')}
        </button>
      </div>
    </section>
  );
}
