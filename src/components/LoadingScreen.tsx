import { t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';

export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <div className="loading-orbits" aria-hidden="true">
        <div className="loading-orbit loading-orbit--one">
          <CreatureAvatar kind="laser-crocodile" size={54} />
        </div>
        <div className="loading-orbit loading-orbit--two">
          <CreatureAvatar kind="lightning-scorpion" size={48} />
        </div>
        <div className="loading-orbit loading-orbit--three">
          <CreatureAvatar kind="mini-brainrot" size={42} />
        </div>
      </div>
      <h1 className="loading-screen__title">{t('appTitle')}</h1>
      <p className="loading-screen__subtitle">{t('appSubtitle')}</p>
      <div className="loading-bar" role="progressbar" aria-label={t('loading')}>
        <span />
      </div>
      <p className="loading-screen__hint">{t('loadingHint')}</p>
    </main>
  );
}
