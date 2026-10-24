import { useGameController } from '../app/ControllerContext';
import type { FatalErrorView } from '../app/controller';
import { t } from '../localization';
import { Icon } from './Icon';

export function ErrorScreen({ error }: { error: FatalErrorView }) {
  const controller = useGameController();
  return (
    <main className="error-screen" data-testid="error-screen">
      <div className="menu-glow menu-glow--purple" aria-hidden="true" />
      <section className="panel error-card" role="alert">
        <span className="error-card__icon" aria-hidden="true">
          <Icon name="warning" size={40} />
        </span>
        <h1>{error.title}</h1>
        <p>{error.body}</p>
        <div className="error-card__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => controller.dismissFatalError()}
          >
            <Icon name="arrow-right" size={18} />
            {t('menuProfiles')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => controller.goToMenu()}
          >
            {t('errorContinue')}
          </button>
        </div>
        <p className="error-card__hint">{t('errorScreenHint')}</p>
      </section>
    </main>
  );
}
