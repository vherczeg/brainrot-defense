import { useGameController } from '../app/ControllerContext';
import {
  CHARACTER_DEFINITIONS,
  CHARACTER_TYPE_IDS,
  characterStats,
} from '../game/domain/characters';
import { emptyAlliedCells } from '../game/domain/grid';
import type { CharacterTypeId, PlayerProfile } from '../game/domain/types';
import { formatNumber, t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';
import { Icon } from './Icon';

export function ShopPanel({ profile }: { profile: PlayerProfile }) {
  const controller = useGameController();
  const hasSpace = emptyAlliedCells(profile.characters).length > 0;

  return (
    <section className="panel shop-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-label">{t('shopTitle')}</p>
          <h2 className="panel-title">{t('shopSubtitle')}</h2>
        </div>
        <span className="coin-pill coin-pill--small">
          <Icon name="coin" size={16} />
          {formatNumber(profile.coins)}
        </span>
      </div>
      <div className="shop-list">
        {CHARACTER_TYPE_IDS.map((typeId: CharacterTypeId) => {
          const definition = CHARACTER_DEFINITIONS[typeId];
          const stats = characterStats(typeId, 1, 0);
          const tooExpensive = profile.coins < definition.cost;
          const disabled = tooExpensive || !hasSpace;
          const reason = tooExpensive ? t('notEnoughCoins') : !hasSpace ? t('boardFull') : t('buy');
          return (
            <article className="shop-card" key={typeId}>
              <div className="shop-card__art">
                <CreatureAvatar kind={typeId} size={58} title={definition.nameHu} mergeRank={1} />
              </div>
              <div className="shop-card__body">
                <div className="shop-card__title-row">
                  <h3 className="shop-card__name">{definition.nameHu}</h3>
                  <span className="rank-chip">{t('rankWithNumber', { rank: 1 })}</span>
                  <span className="level-chip">{t('levelWithNumber', { level: 1 })}</span>
                </div>
                <p className="shop-card__role">{definition.roleHu}</p>
                <div className="mini-stats">
                  <span>
                    <Icon name="skull" size={14} /> {stats.attack}
                  </span>
                  <span>
                    <Icon name="life-heart" size={14} className="heart-icon" /> {stats.maxHp}
                  </span>
                  <span>
                    <Icon name="timer" size={14} /> {stats.attackIntervalSec}s
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="buy-button"
                disabled={disabled}
                title={reason}
                aria-label={`${t('buy')} – ${definition.nameHu} – ${definition.cost} ${t('coins')}`}
                onClick={() => controller.purchase(typeId)}
                data-testid={`shop-buy-${typeId}`}
              >
                <Icon name="coin" size={18} />
                {definition.cost}
              </button>
            </article>
          );
        })}
      </div>
      {!hasSpace ? (
        <p className="shop-warning">
          <Icon name="warning" size={16} />
          {t('boardFull')}
        </p>
      ) : null}
    </section>
  );
}
