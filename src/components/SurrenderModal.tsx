import { useGameController } from '../app/ControllerContext';
import { t } from '../localization';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function SurrenderModal() {
  const controller = useGameController();
  return (
    <Modal
      title={t('battleSurrender')}
      onClose={() => controller.closeModal()}
      size="small"
      tone="danger"
      testId="surrender-modal"
    >
      <p className="modal-text">{t('battleSurrenderConfirm')}</p>
      <div className="modal-actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => controller.closeModal()}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={() => controller.surrenderBattle()}
          data-testid="surrender-confirm"
        >
          <Icon name="skull" size={18} />
          {t('battleSurrender')}
        </button>
      </div>
    </Modal>
  );
}
