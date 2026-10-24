import { ControllerProvider } from './ControllerContext';
import type { GameController } from './controller';
import { useGameSnapshot } from './useGameSnapshot';
import { t } from '../localization';
import { ErrorScreen } from '../components/ErrorScreen';
import { GameScreen } from '../components/GameScreen';
import { ImportConfirmModal } from '../components/ImportConfirmModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { MainMenu } from '../components/MainMenu';
import { ProfileScreen } from '../components/ProfileScreen';
import { SaveManagerModal } from '../components/SaveManagerModal';
import { SettingsModal } from '../components/SettingsModal';
import { ToastViewport } from '../components/ToastViewport';
import { TutorialModal } from '../components/TutorialModal';

function GlobalModals({ controller }: { controller: GameController }) {
  const snapshot = useGameSnapshot(controller);
  return (
    <>
      {snapshot.modal === 'tutorial' ? <TutorialModal /> : null}
      {snapshot.modal === 'settings' ? <SettingsModal snapshot={snapshot} /> : null}
      {snapshot.modal === 'save' ? <SaveManagerModal snapshot={snapshot} /> : null}
      {snapshot.modal === 'import-confirm' ? (
        <ImportConfirmModal fileName={snapshot.pendingImportName} />
      ) : null}
    </>
  );
}

export function App({ controller }: { controller: GameController }) {
  const snapshot = useGameSnapshot(controller);

  return (
    <ControllerProvider controller={controller}>
      <div
        className={`app-root${snapshot.activeProfile?.settings.reducedMotion ? ' reduced-motion' : ''}`}
      >
        {snapshot.loading ? (
          <LoadingScreen />
        ) : snapshot.fatalError ? (
          <ErrorScreen error={snapshot.fatalError} />
        ) : snapshot.screen === 'menu' ? (
          <MainMenu snapshot={snapshot} />
        ) : snapshot.screen === 'profiles' ? (
          <ProfileScreen snapshot={snapshot} />
        ) : snapshot.screen === 'game' ? (
          <GameScreen snapshot={snapshot} />
        ) : (
          <ErrorScreen
            error={{
              title: t('errorAppStateTitle'),
              body: t('errorAppStateBody'),
            }}
          />
        )}

        {snapshot.screen !== 'game' ? <GlobalModals controller={controller} /> : null}
        <ToastViewport toast={snapshot.toast} onDismiss={() => controller.dismissToast()} />
      </div>
    </ControllerProvider>
  );
}
