import { useGameController } from '../app/ControllerContext';
import type { BattleHudView } from '../app/controller';
import { formatSeconds, t } from '../localization';
import { Icon } from './Icon';

export function BattleHud({ battle }: { battle: BattleHudView }) {
  const controller = useGameController();
  return (
    <section className="battle-hud" data-testid="battle-hud">
      <div className="battle-hud__counts">
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
          {t('battleTime')} {formatSeconds(battle.elapsedSec)}s
        </span>
        <button
          type="button"
          className="hud-button"
          onClick={() => controller.setBattleSpeed(battle.speed === 1 ? 2 : 1)}
          aria-label={t('battleSpeed')}
          data-testid="battle-speed"
        >
          <Icon name="bolt" size={16} />
          {t('battleSpeedValue', { speed: battle.speed })}
        </button>
        <button
          type="button"
          className="hud-button hud-button--accent"
          onClick={() => controller.togglePause()}
          aria-label={battle.paused ? t('battleResume') : t('battlePause')}
          data-testid="battle-pause"
        >
          <Icon name={battle.paused ? 'play' : 'pause'} size={16} />
          {battle.paused ? t('battleResume') : t('battlePause')}
        </button>
      </div>
    </section>
  );
}
