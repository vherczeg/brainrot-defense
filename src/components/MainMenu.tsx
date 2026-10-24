import { useGameController } from '../app/ControllerContext';
import type { AppSnapshot } from '../app/controller';
import { TOTAL_WAVES } from '../game/domain/types';
import { getWave } from '../game/domain/waves';
import { formatNumber, t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';
import { Icon } from './Icon';

export function MainMenu({ snapshot }: { snapshot: AppSnapshot }) {
  const controller = useGameController();
  const profile = snapshot.activeProfile;
  const completed = profile?.completedWaves.length ?? 0;
  const allWaves = completed >= TOTAL_WAVES;
  const currentWave = profile ? getWave(profile.currentWave) : null;
  const primaryLabel = profile
    ? completed > 0
      ? t('menuContinue')
      : t('menuStart')
    : t('menuNewGame');

  return (
    <main className="menu-screen">
      <div className="menu-glow menu-glow--green" aria-hidden="true" />
      <div className="menu-glow menu-glow--purple" aria-hidden="true" />
      <div className="menu-grid" aria-hidden="true" />

      <section className="menu-hero">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <CreatureAvatar kind="laser-crocodile" size={64} />
          </div>
          <div>
            <p className="eyebrow">{t('appSubtitle')}</p>
            <h1 className="brand-title">
              <span>BRAINROT</span>
              <span className="brand-title__accent">DEFENSE</span>
            </h1>
          </div>
        </div>
        <p className="menu-tagline">{t('appTagline')}</p>

        <div className="menu-floaters" aria-hidden="true">
          <div className="menu-floater menu-floater--one">
            <CreatureAvatar kind="lightning-scorpion" size={86} />
          </div>
          <div className="menu-floater menu-floater--two">
            <CreatureAvatar kind="mini-brainrot" size={70} />
          </div>
          <div className="menu-floater menu-floater--three">
            <CreatureAvatar kind="mega-brainrot-gorilla" size={98} />
          </div>
        </div>

        <div className="menu-card panel">
          {profile ? (
            <div className="profile-summary">
              <div className="profile-avatar" aria-hidden="true">
                {profile.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="profile-summary__text">
                <p className="panel-label">{t('menuProfileLabel')}</p>
                <h2 className="profile-name" data-testid="profile-name">
                  {profile.name}
                </h2>
                <p className="profile-meta">
                  {t('waveLabel', { wave: profile.currentWave })}
                  {currentWave ? ` · ${currentWave.nameHu}` : ''}
                </p>
              </div>
              <div className="profile-coins">
                <Icon name="coin" size={20} />
                <span>{formatNumber(profile.coins)}</span>
              </div>
            </div>
          ) : (
            <div className="profile-summary profile-summary--empty">
              <div className="profile-avatar" aria-hidden="true">
                ?
              </div>
              <div className="profile-summary__text">
                <h2 className="profile-name">{t('menuNewGame')}</h2>
                <p className="profile-meta">{t('profileEmpty')}</p>
              </div>
            </div>
          )}

          {profile ? (
            <div className="progress-block">
              <div className="progress-block__labels">
                <span>{t('menuProgress', { done: completed })}</span>
                <span>{Math.round((completed / TOTAL_WAVES) * 100)}%</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${(completed / TOTAL_WAVES) * 100}%` }} />
              </div>
            </div>
          ) : null}

          <div className="menu-actions">
            <button
              type="button"
              className="button button--primary button--hero"
              onClick={() => (profile ? controller.enterGame() : controller.openProfiles())}
              data-testid="menu-continue"
            >
              <Icon name="play" size={24} />
              {primaryLabel}
              <Icon name="arrow-right" size={22} />
            </button>
            {profile && allWaves ? (
              <p className="all-waves-badge">
                <Icon name="trophy" size={18} />
                {t('menuAllWaves')}
              </p>
            ) : null}
            <div className="menu-secondary">
              <button
                type="button"
                className="button button--soft"
                onClick={() => controller.openProfiles()}
                data-testid="menu-profiles"
              >
                <span aria-hidden="true">👾</span>
                {t('menuProfiles')}
              </button>
              {profile ? (
                <button
                  type="button"
                  className="button button--soft"
                  onClick={() => controller.openModal('settings')}
                  data-testid="menu-settings"
                >
                  <Icon name="settings" size={19} />
                  {t('menuSettings')}
                </button>
              ) : null}
              {profile ? (
                <button
                  type="button"
                  className="button button--soft"
                  onClick={() => controller.openModal('save')}
                  data-testid="menu-save"
                >
                  <Icon name="save" size={19} />
                  {t('menuSaveManager')}
                </button>
              ) : null}
              <button
                type="button"
                className="button button--soft"
                onClick={() => controller.openTutorial()}
                data-testid="menu-help"
              >
                <Icon name="tutorial" size={19} />
                {t('menuHowTo')}
              </button>
            </div>
          </div>
        </div>

        {!snapshot.storageAvailable ? (
          <div className="warning-banner" role="alert">
            <Icon name="warning" size={18} />
            <span>{t('storageWarning')}</span>
          </div>
        ) : null}
      </section>

      <footer className="menu-footer">
        <span>{t('menuFooter')}</span>
        <span className="menu-footer__dna">v0.2 · M1.1</span>
      </footer>
    </main>
  );
}
