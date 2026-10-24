import { useGameController } from '../app/ControllerContext';
import { t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function TutorialModal() {
  const controller = useGameController();
  return (
    <Modal
      title={t('tutorialTitle')}
      onClose={() => controller.markTutorial()}
      size="large"
      testId="tutorial-modal"
    >
      <div className="tutorial-steps">
        <article className="tutorial-step">
          <div className="tutorial-step__number">1</div>
          <div className="tutorial-step__art" aria-hidden="true">
            <CreatureAvatar kind="laser-crocodile" size={64} />
            <span className="tutorial-coin">
              <Icon name="coin" size={22} />
            </span>
          </div>
          <h3>{t('tutorialStep1Title')}</h3>
          <p>{t('tutorialStep1')}</p>
        </article>
        <article className="tutorial-step tutorial-step--merge">
          <div className="tutorial-step__number">2</div>
          <div className="tutorial-step__art" aria-hidden="true">
            <CreatureAvatar kind="laser-crocodile" size={48} />
            <span className="tutorial-plus">+</span>
            <CreatureAvatar kind="laser-crocodile" size={48} />
            <Icon name="arrow-right" size={20} />
            <span className="tutorial-merged">
              <CreatureAvatar kind="laser-crocodile" size={48} />
              <span className="tutorial-level">2</span>
            </span>
          </div>
          <h3>{t('tutorialStep2Title')}</h3>
          <p>{t('tutorialStep2')}</p>
        </article>
        <article className="tutorial-step">
          <div className="tutorial-step__number">3</div>
          <div className="tutorial-step__art" aria-hidden="true">
            <CreatureAvatar kind="lightning-scorpion" size={58} />
            <span className="tutorial-battle">{t('tutorialBattleCry')}</span>
          </div>
          <h3>{t('tutorialStep3Title')}</h3>
          <p>{t('tutorialStep3')}</p>
        </article>
      </div>
      <div className="modal-actions">
        <button
          type="button"
          className="button button--primary button--wide"
          onClick={() => controller.markTutorial()}
          data-testid="tutorial-dismiss"
        >
          <Icon name="check" size={20} />
          {t('tutorialGotIt')}
        </button>
      </div>
    </Modal>
  );
}
