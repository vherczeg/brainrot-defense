import { useGameController } from '../app/ControllerContext';
import type { AppSnapshot } from '../app/controller';
import { t } from '../localization';
import { Icon } from './Icon';
import { Modal } from './Modal';

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  testId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId: string;
}) {
  return (
    <div className="settings-row">
      <div>
        <p className="settings-row__label">{label}</p>
        {hint ? <p className="settings-row__hint">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' switch--on' : ''}`}
        onClick={() => onChange(!checked)}
        data-testid={testId}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

export function SettingsModal({ snapshot }: { snapshot: AppSnapshot }) {
  const controller = useGameController();
  const profile = snapshot.activeProfile;
  if (!profile) return null;
  const settings = profile.settings;
  return (
    <Modal
      title={t('settingsTitle')}
      onClose={() => controller.closeModal()}
      size="medium"
      testId="settings-modal"
    >
      <ToggleRow
        label={t('settingsSound')}
        hint={settings.soundEnabled ? t('settingsSoundOn') : t('settingsSoundOff')}
        checked={settings.soundEnabled}
        onChange={(value) => controller.updateSettings({ soundEnabled: value })}
        testId="sound-toggle"
      />
      <ToggleRow
        label={t('settingsMotion')}
        hint={t('settingsMotionHint')}
        checked={settings.reducedMotion}
        onChange={(value) => controller.updateSettings({ reducedMotion: value })}
        testId="motion-toggle"
      />

      <div className="settings-row">
        <div>
          <p className="settings-row__label">{t('settingsBattleSpeed')}</p>
          <p className="settings-row__hint">{t('settingsBattleSpeedHint')}</p>
        </div>
        <div className="segmented segmented--compact">
          {[1, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              className={`segmented__option${
                settings.battleSpeed === speed ? ' segmented__option--active' : ''
              }`}
              onClick={() => controller.setBattleSpeed(speed as 1 | 2)}
              aria-pressed={settings.battleSpeed === speed}
            >
              {t('battleSpeedValue', { speed })}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <p className="panel-label">{t('settingsSaveSection')}</p>
        <p className="settings-note">{t('settingsSaveInfo')}</p>
        <div className="settings-info-grid">
          <div>
            <span className="settings-info-label">{t('settingsProfile')}</span>
            <strong>{profile.name}</strong>
          </div>
          <div>
            <span className="settings-info-label">{t('settingsStorage')}</span>
            <strong>
              {snapshot.storageAvailable
                ? t('settingsStorageAvailable')
                : t('settingsStorageUnavailable')}
            </strong>
          </div>
          <div>
            <span className="settings-info-label">{t('settingsPersistentYes')}</span>
            <strong>
              {snapshot.persistenceGranted === true
                ? t('settingsPersistentYes')
                : snapshot.persistenceGranted === false
                  ? t('settingsPersistentNo')
                  : t('settingsPersistentUnknown')}
            </strong>
          </div>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button button--soft"
            onClick={() => controller.openModal('save')}
          >
            <Icon name="save" size={18} />
            {t('menuSaveManager')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => controller.saveNow()}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
