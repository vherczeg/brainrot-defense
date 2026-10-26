import { useGameController } from '../app/ControllerContext';
import type { AppSnapshot, SaveStatus } from '../app/controller';
import { formatNumber, t } from '../localization';
import { MAX_ARMY_SIZE } from '../game/domain/types';
import { getWave } from '../game/domain/waves';
import { AccessiblePlacement } from './AccessiblePlacement';
import { BattleHud } from './BattleHud';
import { BattlePauseOverlay } from './BattlePauseOverlay';
import { BattlefieldView } from './BattlefieldView';
import { DifficultySelector } from './DifficultySelector';
import { ImportConfirmModal } from './ImportConfirmModal';
import { ResultOverlay } from './ResultOverlay';
import { SaveManagerModal } from './SaveManagerModal';
import { SellConfirmModal } from './SellConfirmModal';
import { SettingsModal } from './SettingsModal';
import { ShopPanel } from './ShopPanel';
import { SurrenderModal } from './SurrenderModal';
import { TutorialModal } from './TutorialModal';
import { UnitInspector } from './UnitInspector';
import { WavePreview } from './WavePreview';
import { Icon } from './Icon';

function saveLabel(status: SaveStatus): { text: string; icon: 'save' | 'check' | 'warning' } {
  switch (status) {
    case 'saving':
      return { text: t('saving'), icon: 'save' };
    case 'saved':
      return { text: t('saved'), icon: 'check' };
    case 'error':
      return { text: t('saveError'), icon: 'warning' };
    case 'unavailable':
      return { text: t('storageWarningShort'), icon: 'warning' };
    default:
      return { text: t('save'), icon: 'save' };
  }
}

export function GameScreen({ snapshot }: { snapshot: AppSnapshot }) {
  const controller = useGameController();
  const profile = snapshot.activeProfile;
  if (!profile) return null;
  const wave = getWave(profile.currentWave);
  const prep = controller.getPrepView();
  const phase = snapshot.phase;
  const save = saveLabel(snapshot.saveStatus);
  const battle = snapshot.battle;

  const openSettings = () => {
    if (phase === 'battle' && battle?.status === 'running' && !battle.paused) {
      controller.togglePause();
    }
    controller.openModal('settings');
  };

  const openSurrender = () => {
    if (phase === 'battle' && battle?.status === 'running' && !battle.paused) {
      controller.togglePause();
    }
    controller.openModal('surrender');
  };

  return (
    <main className={`game-screen${profile.settings.reducedMotion ? ' reduced-motion' : ''}`}>
      <div className="game-bg-glow game-bg-glow--one" aria-hidden="true" />
      <div className="game-bg-glow game-bg-glow--two" aria-hidden="true" />

      <header className="game-topbar">
        <button
          type="button"
          className="button button--ghost button--compact"
          onClick={() => controller.goToMenu()}
          disabled={phase === 'battle'}
          data-testid="game-menu"
        >
          <Icon name="home-base" size={18} />
          {t('menu')}
        </button>

        <div className="game-topbar__title">
          <p className="eyebrow">{profile.name}</p>
          <h1>
            {t('waveLabel', { wave: profile.currentWave })}
            {wave ? <span> · {wave.nameHu}</span> : null}
          </h1>
        </div>

        <div className="game-topbar__right">
          <span
            className={`save-status save-status--${snapshot.saveStatus}`}
            data-testid="save-status"
          >
            <Icon name={save.icon} size={15} />
            <span>{save.text}</span>
          </span>
          <span
            className="coin-pill"
            data-testid="coins-value"
            data-coins={profile.coins}
            aria-label={`${profile.coins} ${t('coins')}`}
          >
            <Icon name="coin" size={20} />
            <strong>{formatNumber(profile.coins)}</strong>
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              if (phase === 'battle' && battle?.status === 'running' && !battle.paused) {
                controller.togglePause();
              }
              controller.openTutorial();
            }}
            aria-label={t('tutorialOpenHelp')}
            title={t('tutorialOpenHelp')}
          >
            <Icon name="tutorial" size={20} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={openSettings}
            aria-label={t('ariaOpenSettings')}
            title={t('settingsTitle')}
            data-testid="open-settings"
          >
            <Icon name="settings" size={20} />
          </button>
        </div>
      </header>

      {!snapshot.storageAvailable ? (
        <div className="warning-banner warning-banner--compact" role="alert">
          <Icon name="warning" size={16} />
          <span>{t('storageWarning')}</span>
        </div>
      ) : null}

      <div className="game-layout">
        <section className="board-column">
          {phase === 'battle' && battle ? (
            <BattleHud battle={battle} />
          ) : (
            <div className="board-caption">
              <div>
                <p className="panel-label">{t('prepTitle')}</p>
                <h2>{wave?.nameHu}</h2>
              </div>
              <p className="board-caption__hint">{t('prepHintDrag')}</p>
            </div>
          )}

          <div className="battlefield-frame panel">
            <BattlefieldView controller={controller} />
          </div>

          {phase === 'preparation' ? (
            <>
              <DifficultySelector difficulty={profile.settings.difficulty} />
              <div className="battle-launch panel">
                <div className="battle-launch__info">
                  <p className="battle-launch__hint">{t('battleReadyHint')}</p>
                  <span
                    className="army-count"
                    data-testid="unit-count"
                    data-count={profile.characters.length}
                  >
                    {t('armyCount', {
                      count: profile.characters.length,
                      max: MAX_ARMY_SIZE,
                    })}
                  </span>
                </div>
                <div className="battle-launch__actions">
                  <button
                    type="button"
                    className="button button--soft undo-button"
                    onClick={() => controller.undo()}
                    disabled={snapshot.undoCount === 0}
                    title={t('undoHint')}
                    data-testid="undo-button"
                  >
                    <Icon name="undo" size={18} />
                    {t('undo')}
                    {snapshot.undoCount > 0 ? ` (${snapshot.undoCount})` : ''}
                  </button>
                  <button
                    type="button"
                    className="button button--battle"
                    onClick={() => controller.startBattle()}
                    disabled={profile.characters.length === 0}
                    data-testid="battle-button"
                  >
                    <Icon name="bolt" size={28} />
                    {t('battleButton')}
                  </button>
                </div>
              </div>
              <AccessiblePlacement prep={prep} selectedId={snapshot.selectedCharacterId} />
            </>
          ) : null}

          {phase === 'battle' && battle ? (
            <div className="battle-live-bar">
              <span className="battle-live-bar__pulse" aria-hidden="true" />
              <span>{battle.paused ? t('battlePausedHint') : t('battleLiveHint')}</span>
              <button
                type="button"
                className="button button--danger-ghost button--compact"
                onClick={openSurrender}
              >
                {t('battleSurrender')}
              </button>
            </div>
          ) : null}
        </section>

        <aside className="game-sidebar">
          {phase === 'preparation' ? (
            <>
              <WavePreview profile={profile} />
              <ShopPanel profile={profile} />
              <UnitInspector profile={profile} />
              <div className="sidebar-tip panel">
                <Icon name="tutorial" size={18} />
                <p>{t('tutorialStep2')}</p>
                <button
                  type="button"
                  className="button button--ghost button--compact"
                  onClick={() => controller.openTutorial()}
                >
                  {t('tutorialOpenHelp')}
                </button>
              </div>
            </>
          ) : (
            <>
              <section className="panel battle-side-card">
                <div className="panel-heading">
                  <div>
                    <p className="panel-label">{t('battleTitle')}</p>
                    <h2 className="panel-title">{wave?.nameHu}</h2>
                  </div>
                  <span className={`status-chip status-chip--${phase}`}>
                    {battle?.paused ? t('battlePaused') : t('battleWatching')}
                  </span>
                </div>
                <p className="battle-side-card__hint">{t('battleSideHint')}</p>
                {battle ? (
                  <div className="battle-side-stats">
                    <div>
                      <span>{t('battleAllies')}</span>
                      <strong className="text-green">{battle.alliesAlive}</strong>
                    </div>
                    <div>
                      <span>{t('battleEnemies')}</span>
                      <strong className="text-red">{battle.enemiesAlive}</strong>
                    </div>
                    <div>
                      <span>{t('battleTime')}</span>
                      <strong>{formatNumber(battle.elapsedSec)}s</strong>
                    </div>
                  </div>
                ) : null}
                <div className="battle-side-actions">
                  {battle ? (
                    <button
                      type="button"
                      className="button button--soft button--compact"
                      onClick={() => controller.togglePause()}
                    >
                      <Icon name={battle.paused ? 'resume' : 'pause'} size={16} />
                      {battle.paused ? t('battleResume') : t('battlePause')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button button--danger-ghost button--compact"
                    onClick={openSurrender}
                  >
                    {t('battleSurrender')}
                  </button>
                </div>
              </section>
              <WavePreview profile={profile} />
            </>
          )}
        </aside>
      </div>

      {snapshot.modal === 'tutorial' ? <TutorialModal /> : null}
      {snapshot.modal === 'settings' ? <SettingsModal snapshot={snapshot} /> : null}
      {snapshot.modal === 'save' ? <SaveManagerModal snapshot={snapshot} /> : null}
      {snapshot.modal === 'import-confirm' ? (
        <ImportConfirmModal fileName={snapshot.pendingImportName} />
      ) : null}
      {snapshot.modal === 'surrender' ? <SurrenderModal /> : null}
      {snapshot.modal === 'sell-confirm' && snapshot.sellOffer ? (
        <SellConfirmModal offer={snapshot.sellOffer} />
      ) : null}
      {snapshot.modal === null && phase === 'battle' && battle?.paused ? (
        <BattlePauseOverlay battle={battle} />
      ) : null}
      {snapshot.modal === null && phase === 'result' && snapshot.result ? (
        <ResultOverlay result={snapshot.result} />
      ) : null}
    </main>
  );
}
