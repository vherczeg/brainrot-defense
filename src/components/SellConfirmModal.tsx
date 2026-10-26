import { useGameController } from '../app/ControllerContext';
import type { SellOfferView } from '../app/controller';
import { CHARACTER_DEFINITIONS } from '../game/domain/characters';
import { formatNumber, t } from '../localization';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function SellConfirmModal({ offer }: { offer: SellOfferView }) {
  const controller = useGameController();
  const definition = CHARACTER_DEFINITIONS[offer.typeId];

  return (
    <Modal
      title={t('sellTitle')}
      tone="danger"
      size="small"
      onClose={() => controller.cancelSell()}
      testId="sell-confirm-modal"
    >
      <p className="modal-text">{t('sellConfirmQuestion')}</p>
      <dl className="sell-summary">
        <div>
          <dt>{t('selectedTitle')}</dt>
          <dd>{definition.nameHu}</dd>
        </div>
        <div>
          <dt>{t('mergeRankLabel')}</dt>
          <dd>{t('rankWithNumber', { rank: offer.mergeRank })}</dd>
        </div>
        <div>
          <dt>{t('characterLevelLabel')}</dt>
          <dd>{t('levelWithNumber', { level: offer.level })}</dd>
        </div>
        <div className="sell-summary__refund">
          <dt>{t('sellPrice')}</dt>
          <dd data-testid="sell-confirm-refund">
            <Icon name="coin" size={18} />
            {formatNumber(offer.refund)} {t('coins')}
          </dd>
        </div>
      </dl>
      <p className="sell-warning">
        <Icon name="warning" size={16} />
        {t('sellUndoWarning')}
      </p>
      <div className="modal-actions sell-confirm-actions">
        <button
          type="button"
          className="button button--soft"
          onClick={() => controller.cancelSell()}
          data-testid="sell-cancel"
          data-autofocus
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={() => controller.confirmSell()}
          data-testid="sell-confirm"
        >
          <Icon name="sell" size={18} />
          {t('sellConfirm')}
        </button>
      </div>
    </Modal>
  );
}
