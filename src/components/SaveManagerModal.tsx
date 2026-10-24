import { useRef } from 'react';
import { useGameController } from '../app/ControllerContext';
import type { AppSnapshot } from '../app/controller';
import { formatNumber, t } from '../localization';
import { Icon } from './Icon';
import { Modal } from './Modal';

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SaveManagerModal({ snapshot }: { snapshot: AppSnapshot }) {
  const controller = useGameController();
  const fileInput = useRef<HTMLInputElement>(null);
  const profile = snapshot.activeProfile;

  const handleExport = () => {
    const result = controller.exportSave();
    if (result) downloadText(result.filename, result.content);
  };

  return (
    <Modal
      title={t('menuSaveManager')}
      onClose={() => controller.closeModal()}
      size="medium"
      testId="save-modal"
    >
      {profile ? (
        <div className="save-profile-strip">
          <div className="profile-avatar profile-avatar--small" aria-hidden="true">
            {profile.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="panel-label">{t('settingsProfile')}</p>
            <h3 className="save-profile-name">{profile.name}</h3>
          </div>
          <div className="save-profile-stats">
            <span>
              <Icon name="coin" size={15} /> {formatNumber(profile.coins)}
            </span>
            <span>
              <Icon name="trophy" size={15} /> {t('waveLabel', { wave: profile.currentWave })}
            </span>
          </div>
        </div>
      ) : null}

      <p className="settings-note">{t('settingsSaveInfo')}</p>

      <div className="save-action-grid">
        <button
          type="button"
          className="save-action"
          onClick={handleExport}
          data-testid="export-save"
        >
          <span className="save-action__icon">
            <Icon name="download" size={24} />
          </span>
          <span>
            <strong>{t('settingsExport')}</strong>
            <small>{t('settingsExportHint')}</small>
          </span>
        </button>

        <button
          type="button"
          className="save-action"
          onClick={() => fileInput.current?.click()}
          data-testid="import-save-button"
        >
          <span className="save-action__icon">
            <Icon name="upload" size={24} />
          </span>
          <span>
            <strong>{t('settingsImport')}</strong>
            <small>{t('settingsImportHint')}</small>
          </span>
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        aria-label={t('ariaImportFile')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          void file.text().then((text) => controller.prepareImport(text, file.name));
        }}
        data-testid="import-save-input"
      />

      <div className="storage-status">
        <span
          className={`status-dot${
            snapshot.storageAvailable ? ' status-dot--ok' : ' status-dot--bad'
          }`}
          aria-hidden="true"
        />
        <span>
          {snapshot.storageAvailable
            ? t('settingsStorageAvailable')
            : t('settingsStorageUnavailable')}
        </span>
        <span className="storage-status__persist">
          {snapshot.persistenceGranted === true
            ? t('settingsPersistentYes')
            : snapshot.persistenceGranted === false
              ? t('settingsPersistentNo')
              : t('settingsPersistentUnknown')}
        </span>
      </div>

      <div className="modal-actions">
        <button type="button" className="button button--ghost" onClick={() => controller.saveNow()}>
          <Icon name="save" size={18} />
          {t('save')}
        </button>
        <button
          type="button"
          className="button button--soft"
          onClick={() => controller.closeModal()}
        >
          {t('close')}
        </button>
      </div>
    </Modal>
  );
}
