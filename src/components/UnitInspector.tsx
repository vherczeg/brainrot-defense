import { useGameController } from '../app/ControllerContext';
import { CHARACTER_DEFINITIONS, characterStats, isMaxMergeRank } from '../game/domain/characters';
import { xpProgress } from '../game/domain/progression';
import { MAX_MERGE_RANK, type PlayerProfile } from '../game/domain/types';
import { formatNumber, t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';
import { Icon } from './Icon';

export function UnitInspector({ profile }: { profile: PlayerProfile }) {
  const controller = useGameController();
  const selected = profile.characters.find(
    (character) => character.id === controller.getSnapshot().selectedCharacterId,
  );

  if (!selected) {
    return (
      <section className="panel inspector inspector--empty">
        <div className="panel-heading">
          <div>
            <p className="panel-label">{t('selectedTitle')}</p>
            <h2 className="panel-title">{t('noSelectionTitle')}</h2>
          </div>
        </div>
        <div className="inspector-empty-art" aria-hidden="true">
          <CreatureAvatar kind="laser-crocodile" size={64} />
          <span className="merge-plus">+</span>
          <CreatureAvatar kind="laser-crocodile" size={64} />
        </div>
        <p className="inspector-hint">{t('noSelectionHint')}</p>
      </section>
    );
  }

  const definition = CHARACTER_DEFINITIONS[selected.typeId];
  const stats = characterStats(selected.typeId, selected.mergeRank, selected.totalXp);
  const progression = xpProgress(selected.totalXp);
  const partners = profile.characters.filter(
    (character) =>
      character.id !== selected.id &&
      character.typeId === selected.typeId &&
      character.mergeRank === selected.mergeRank &&
      character.mergeRank < MAX_MERGE_RANK,
  );
  const atMaxRank = isMaxMergeRank(selected.mergeRank);
  const atMaxLevel = progression.level >= 100;
  const progressRatio =
    progression.nextLevelXp === null
      ? 1
      : (selected.totalXp - progression.currentLevelXp) /
        (progression.nextLevelXp - progression.currentLevelXp);

  return (
    <section className="panel inspector" data-testid="unit-inspector">
      <div className="panel-heading">
        <div>
          <p className="panel-label">{t('selectedTitle')}</p>
          <h2 className="panel-title">{definition.nameHu}</h2>
        </div>
        <div className="inspector-chips">
          <span className={`rank-chip${atMaxRank ? ' rank-chip--max' : ''}`}>
            {atMaxRank ? t('rankMax') : t('rankWithNumber', { rank: selected.mergeRank })}
          </span>
          <span className={`level-chip${atMaxLevel ? ' level-chip--max' : ''}`}>
            {atMaxLevel ? t('levelMax') : t('levelWithNumber', { level: progression.level })}
          </span>
        </div>
      </div>

      <div className="inspector-hero">
        <div
          className={`inspector-avatar level-glow level-glow--${Math.min(selected.mergeRank, 6)}`}
        >
          <CreatureAvatar
            kind={selected.typeId}
            size={92}
            title={definition.nameHu}
            mergeRank={selected.mergeRank}
          />
          <span className="inspector-level-badge">{selected.mergeRank}</span>
        </div>
        <div className="inspector-role">
          <span className="role-chip">{definition.roleHu}</span>
          <p className="inspector-description">{definition.descriptionHu}</p>
          <p className="inspector-position">
            {t('positionLabel', { col: selected.col + 1, row: selected.row + 1 })}
          </p>
        </div>
      </div>

      <div className="progression-box">
        <div className="progression-row">
          <span>{t('mergeRankLabel')}</span>
          <strong data-testid="inspector-rank">
            {selected.mergeRank} / {MAX_MERGE_RANK}
          </strong>
        </div>
        <div className="progression-row">
          <span>{t('characterLevelLabel')}</span>
          <strong data-testid="inspector-level">{progression.level}</strong>
        </div>
        <div className="progression-row">
          <span>{t('totalXpLabel')}</span>
          <strong data-testid="inspector-xp">{formatNumber(selected.totalXp)}</strong>
        </div>
        <div className="progress-track progress-track--xp" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(1, progressRatio)) * 100}%` }} />
        </div>
        <p className="progression-hint" data-testid="inspector-next-level">
          {atMaxLevel
            ? t('maxLevelReached')
            : t('xpToNextLevelLabel', {
                xp: formatNumber(progression.remaining),
              })}
        </p>
      </div>

      <dl className="stat-grid">
        <div>
          <dt>
            <Icon name="life-heart" size={14} className="heart-icon" /> {t('statHp')}
          </dt>
          <dd>{formatNumber(stats.maxHp)}</dd>
        </div>
        <div>
          <dt>
            <Icon name="bolt" size={15} /> {t('statAttack')}
          </dt>
          <dd>{formatNumber(stats.attack)}</dd>
        </div>
        <div>
          <dt>
            <Icon name="timer" size={15} /> {t('statInterval')}
          </dt>
          <dd>{stats.attackIntervalSec}s</dd>
        </div>
        <div>
          <dt>◎ {t('statRange')}</dt>
          <dd>{stats.range}</dd>
        </div>
      </dl>

      <div className="special-box">
        <p className="panel-label">{t('statSpecial')}</p>
        <p>{definition.specialHu}</p>
      </div>

      <div className={`merge-callout${partners.length > 0 ? ' merge-callout--ready' : ''}`}>
        <Icon name="merge" size={18} />
        {atMaxRank ? (
          <span>{t('mergeMaxRank')}</span>
        ) : partners.length > 0 ? (
          <span>
            {t('mergeHint')} <strong>{t('mergeHintActive', { name: definition.nameHu })}</strong>
          </span>
        ) : (
          <span>{t('mergeHint')}</span>
        )}
      </div>

      <button
        type="button"
        className="button button--ghost button--compact inspector-clear"
        onClick={() => controller.handleUnitTap(selected.id)}
      >
        {t('cancel')}
      </button>
    </section>
  );
}
