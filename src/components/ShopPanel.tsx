import { useGameController } from '../app/ControllerContext';
import {
  CHARACTER_DEFINITIONS,
  CHARACTER_TYPE_IDS,
  characterStats,
} from '../game/domain/characters';
import { emptyAlliedCells } from '../game/domain/grid';
import { nextExpansionCost } from '../game/domain/expansion';
import {
  UPGRADE_DEFINITIONS,
  UPGRADE_KINDS,
  maxUpgradeLevelReached,
  upgradeCost,
  upgradeLevel,
} from '../game/domain/upgrades';
import {
  MAX_EXPANSION_CELLS,
  type CharacterTypeId,
  type PlayerProfile,
  type UpgradeKind,
} from '../game/domain/types';
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
                <p className="shop-card__special">{definition.specialHu}</p>
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
      <div className="upgrades-block">
        <div className="panel-heading">
          <div>
            <p className="panel-label">{t('upgradesTitle')}</p>
            <h2 className="panel-title">{t('upgradesSubtitle')}</h2>
          </div>
        </div>
        <div className="upgrades-list">
          {UPGRADE_KINDS.map((kind: UpgradeKind) => {
            const definition = UPGRADE_DEFINITIONS[kind];
            const level = upgradeLevel(profile, kind);
            const maxed = maxUpgradeLevelReached(profile, kind);
            const cost = maxed ? 0 : upgradeCost(kind, level);
            const tooExpensive = !maxed && profile.coins < cost;
            return (
              <article className="upgrade-card" key={kind} data-testid={`upgrade-${kind}`}>
                <div className="upgrade-card__body">
                  <div className="upgrade-card__title-row">
                    <h3 className="upgrade-card__name">{definition.nameHu}</h3>
                    <span className="rank-chip">
                      {maxed ? t('upgradeMaxLabel') : t('upgradeLevelLabel', { level: level + 1 })}
                    </span>
                    <span className="level-chip">{t('upgradeLevelLabel', { level })}</span>
                  </div>
                  <p className="upgrade-card__description">{definition.descriptionHu}</p>
                </div>
                <button
                  type="button"
                  className="buy-button"
                  disabled={maxed || tooExpensive}
                  title={
                    maxed
                      ? t('errorMaxUpgrade')
                      : tooExpensive
                        ? t('notEnoughCoins')
                        : t('upgradeBuy')
                  }
                  aria-label={`${t('upgradeBuy')} – ${definition.nameHu} – ${cost} ${t('coins')}`}
                  onClick={() => controller.purchaseUpgrade(kind)}
                  data-testid={`upgrade-buy-${kind}`}
                >
                  {maxed ? (
                    t('upgradeMaxLabel')
                  ) : (
                    <>
                      <Icon name="coin" size={18} />
                      {formatNumber(cost)}
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      </div>
      <ExpansionBlock profile={profile} />
    </section>
  );
}

function ExpansionBlock({ profile }: { profile: PlayerProfile }) {
  const controller = useGameController();
  const count = Math.min(MAX_EXPANSION_CELLS, Math.max(0, Math.floor(profile.expansionCells)));
  const cost = nextExpansionCost(count);
  const maxed = cost === null;
  const tooExpensive = !maxed && profile.coins < (cost ?? 0);
  return (
    <div className="upgrades-block expansion-block" data-testid="expansion-block">
      <div className="panel-heading">
        <div>
          <p className="panel-label">{t('expansionTitle')}</p>
          <h2 className="panel-title">{t('expansionSubtitle')}</h2>
        </div>
        <span className="rank-chip" data-testid="expansion-count">
          {t('expansionExtraCells', { count, max: MAX_EXPANSION_CELLS })}
        </span>
      </div>
      <p className="upgrade-card__description">{t('expansionTradeoffHint')}</p>
      <p className="expansion-mirror" data-testid="expansion-mirror">
        <Icon name="skull" size={14} />
        {t('expansionMirrorInvasion', { count })}
      </p>
      <article className="upgrade-card">
        <div className="upgrade-card__body">
          <h3 className="upgrade-card__name">{t('expansionBuy')}</h3>
          <p className="upgrade-card__description">
            {maxed
              ? t('errorMaxExpansion')
              : t('expansionCostLabel', { cost: formatNumber(cost ?? 0) })}
          </p>
        </div>
        <button
          type="button"
          className="buy-button"
          disabled={maxed || tooExpensive}
          title={
            maxed ? t('errorMaxExpansion') : tooExpensive ? t('notEnoughCoins') : t('expansionBuy')
          }
          onClick={() => controller.purchaseExpansion()}
          data-testid="expansion-buy"
        >
          {maxed ? (
            t('expansionMaxLabel')
          ) : (
            <>
              <Icon name="coin" size={18} />
              {formatNumber(cost ?? 0)}
            </>
          )}
        </button>
      </article>
    </div>
  );
}
