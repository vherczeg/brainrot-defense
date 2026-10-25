import { useGameController } from '../app/ControllerContext';
import type { BattleHudView } from '../app/controller';
import { t } from '../localization';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function BattlePauseOverlay({ battle }: { battle: BattleHudView }) {
  const controller = useGameController();
  return (
    <Modal
      title={t('battlePaused')}
      onClose={() => controller.togglePause()}
      size="small"
      testId="pause-modal"
    >
      <p className="modal-text">{t('battlePausedHint')}</p>
      <div className="pause-illustration" aria-hidden="true">
        <span className="pause-glyph">
          <Icon name="pause" size={42} />
        </span>
      </div>
      <div className="speed-picker">
        <span className="field__label">{t('settingsBattleSpeed')}</span>
        <div className="segmented">
          {[1, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              className={`segmented__option${
                battle.speed === speed ? ' segmented__option--active' : ''
              }`}
              onClick={() => controller.setBattleSpeed(speed as 1 | 2)}
              aria-pressed={battle.speed === speed}
            >
              {t('battleSpeedValue', { speed })}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-actions modal-actions--stack">
        <button
          type="button"
          className="button button--primary"
          onClick={() => controller.togglePause()}
        >
          <Icon name="resume" size={18} />
          {t('battleResume')}
        </button>
        <button
          type="button"
          className="button button--soft"
          onClick={() => controller.openModal('settings')}
        >
          <Icon name="settings" size={18} />
          {t('settingsTitle')}
        </button>
        <button
          type="button"
          className="button button--danger-ghost"
          onClick={() => controller.openModal('surrender')}
        >
          <Icon name="skull" size={18} />
          {t('battleSurrender')}
        </button>
      </div>
    </Modal>
  );
}
