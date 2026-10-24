import { useGameController } from '../app/ControllerContext';
import { t } from '../localization';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function ImportConfirmModal({ fileName }: { fileName: string | null }) {
  const controller = useGameController();
  return (
    <Modal
      title={t('settingsImportConfirmTitle')}
      onClose={() => controller.cancelImport()}
      size="small"
      tone="danger"
      testId="import-confirm-modal"
    >
      <div className="import-file-card">
        <span className="import-file-icon" aria-hidden="true">
          <Icon name="upload" size={26} />
        </span>
        <div>
          <p className="panel-label">{t('settingsImportFile')}</p>
          <strong>{fileName ?? t('settingsNoFile')}</strong>
        </div>
      </div>
      <p className="modal-text">{t('settingsImportWarning')}</p>
      <div className="modal-actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => controller.cancelImport()}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={() => void controller.confirmImport()}
          data-testid="import-confirm"
        >
          <Icon name="check" size={18} />
          {t('confirm')}
        </button>
      </div>
    </Modal>
  );
}
