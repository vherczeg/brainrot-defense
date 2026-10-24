import { useGameController } from '../app/ControllerContext';
import type { BattleResultView } from '../app/controller';
import { getWave } from '../game/domain/waves';
import { formatNumber, t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function ResultOverlay({ result }: { result: BattleResultView }) {
  const controller = useGameController();
  const wave = getWave(result.waveId);
  const victory = result.outcome === 'victory';
  return (
    <Modal
      title={victory ? t('resultVictory') : t('resultDefeat')}
      tone={victory ? 'victory' : 'defeat'}
      size="medium"
      testId="result-overlay"
    >
      <div className="result-hero">
        <div className={`result-emblem result-emblem--${result.outcome}`} aria-hidden="true">
          {victory ? <Icon name="trophy" size={54} /> : <Icon name="skull" size={54} />}
        </div>
        <div className="result-copy">
          <p className="result-wave">
            {t('waveLabel', { wave: result.waveId })}
            {wave ? ` · ${wave.nameHu}` : ''}
          </p>
          <h3 className="result-title" data-testid="result-title">
            {victory
              ? result.completedAllWaves
                ? t('resultAllWaves')
                : t('resultWaveCleared', { wave: result.waveId })
              : t('resultDefeat')}
          </h3>
          <p className="result-hint">
            {victory
              ? result.completedAllWaves
                ? t('resultAllWavesHint')
                : t('resultVictoryHint')
              : t('resultDefeatHint')}
          </p>
        </div>
      </div>

      {victory ? (
        <div className="reward-box reward-box--gold">
          <Icon name="coin" size={24} />
          <div>
            <p className="panel-label">{t('resultReward')}</p>
            <p className="reward-amount">
              {result.rewardCoins > 0
                ? `+${formatNumber(result.rewardCoins)}`
                : t('resultNoReward')}
            </p>
          </div>
          {result.rewardCoins > 0 ? (
            <div className="coin-rain" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index} style={{ animationDelay: `${index * 90}ms` }}>
                  <Icon name="coin" size={16} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="reward-box reward-box--comfort">
          <Icon name="coin" size={24} />
          <div>
            <p className="panel-label">{t('resultComfort')}</p>
            <p className="reward-amount">+{formatNumber(result.comfortCoins)}</p>
          </div>
          <div className="result-comfort-art" aria-hidden="true">
            <CreatureAvatar kind="laser-crocodile" size={44} />
          </div>
        </div>
      )}

      {victory && !result.completedAllWaves ? (
        <p className="next-wave-hint">
          {t('menuWaveLabel')}: <strong>{t('waveLabel', { wave: result.nextWave })}</strong>
        </p>
      ) : null}

      <div className="modal-actions">
        {victory ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => controller.nextWave()}
            data-testid="result-next"
          >
            {result.completedAllWaves ? t('resultPlayAgain') : t('resultNextWave')}
            <Icon name="arrow-right" size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="button button--primary"
            onClick={() => controller.retryBattle()}
            data-testid="result-retry"
          >
            <Icon name="bolt" size={18} />
            {t('resultRetry')}
          </button>
        )}
        <button
          type="button"
          className="button button--ghost"
          onClick={() => controller.goToMenu()}
          data-testid="result-menu"
        >
          {t('resultBackToMenu')}
        </button>
      </div>
    </Modal>
  );
}
