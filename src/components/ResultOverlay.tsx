import { useGameController } from '../app/ControllerContext';
import type { BattleResultView } from '../app/controller';
import { CHARACTER_DEFINITIONS } from '../game/domain/characters';
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
          {victory ? <Icon name="trophy" size={54} /> : <Icon name="defeat-heart" size={54} />}
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

      {result.persistenceError ? (
        <p className="result-hint result-hint--error" role="alert" data-testid="result-save-error">
          {t('errorSaveFailed')}
        </p>
      ) : null}

      {!result.persistenceError ? (
        victory ? (
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
        )
      ) : null}

      {!result.persistenceError && victory && result.xpPerUnit > 0 ? (
        <div className="reward-box reward-box--xp" data-testid="result-xp-reward">
          <Icon name="bolt" size={24} />
          <div>
            <p className="panel-label">{t('resultXpReward')}</p>
            <p className="reward-amount">
              {t('resultXpPerUnit', { xp: formatNumber(result.xpPerUnit) })}
            </p>
            <p className="progression-hint">
              {t('resultXpTotal', { xp: formatNumber(result.totalXpAwarded) })}
            </p>
          </div>
        </div>
      ) : null}

      {victory && result.levelUps.length > 0 ? (
        <div className="level-up-box" data-testid="result-level-ups">
          <p className="panel-label">{t('resultLevelUps')}</p>
          <ul className="level-up-list">
            {result.levelUps.map((levelUp) => (
              <li key={levelUp.characterId}>
                <Icon name="bolt" size={16} />
                {t('resultLevelUpDetail', {
                  name: CHARACTER_DEFINITIONS[levelUp.typeId].nameHu,
                  from: levelUp.fromLevel,
                  to: levelUp.toLevel,
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {victory && result.maxLevelReached ? (
        <p className="max-level-note">{t('maxLevelReached')}</p>
      ) : null}

      {victory && !result.persistenceError && !result.completedAllWaves ? (
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
          <Icon name="home-base" size={18} />
          {t('resultBackToMenu')}
        </button>
      </div>
    </Modal>
  );
}
