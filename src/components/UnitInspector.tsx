import { useGameController } from '../app/ControllerContext';
import { CHARACTER_DEFINITIONS, characterStats } from '../game/domain/characters';
import { MAX_CHARACTER_LEVEL, type PlayerProfile } from '../game/domain/types';
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
  const stats = characterStats(selected.typeId, selected.level);
  const partners = profile.characters.filter(
    (character) =>
      character.id !== selected.id &&
      character.typeId === selected.typeId &&
      character.level === selected.level &&
      character.level < MAX_CHARACTER_LEVEL,
  );
  const atMax = selected.level >= MAX_CHARACTER_LEVEL;

  return (
    <section className="panel inspector" data-testid="unit-inspector">
      <div className="panel-heading">
        <div>
          <p className="panel-label">{t('selectedTitle')}</p>
          <h2 className="panel-title">{definition.nameHu}</h2>
        </div>
        <span className={`level-chip${atMax ? ' level-chip--max' : ''}`}>
          {atMax ? t('levelMax') : `${selected.level}. ${t('levelShort')}`}
        </span>
      </div>

      <div className="inspector-hero">
        <div className={`inspector-avatar level-glow level-glow--${Math.min(selected.level, 6)}`}>
          <CreatureAvatar kind={selected.typeId} size={92} title={definition.nameHu} />
          <span className="inspector-level-badge">{selected.level}</span>
        </div>
        <div className="inspector-role">
          <span className="role-chip">{definition.roleHu}</span>
          <p className="inspector-description">{definition.descriptionHu}</p>
          <p className="inspector-position">
            {t('positionLabel', { col: selected.col + 1, row: selected.row + 1 })}
          </p>
        </div>
      </div>

      <dl className="stat-grid">
        <div>
          <dt>
            <span className="heart-icon" aria-hidden="true">
              ♥
            </span>{' '}
            {t('statHp')}
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
          <dt>⏱ {t('statInterval')}</dt>
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
        {atMax ? (
          <span>{t('mergeMaxLevel')}</span>
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
