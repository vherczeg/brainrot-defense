import { ENEMY_DEFINITIONS } from '../game/domain/enemies';
import type { PlayerProfile } from '../game/domain/types';
import { getWave } from '../game/domain/waves';
import { formatNumber, t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';
import { Icon } from './Icon';

interface EnemyStack {
  readonly typeId: keyof typeof ENEMY_DEFINITIONS;
  readonly level: number;
  readonly count: number;
}

export function WavePreview({ profile }: { profile: PlayerProfile }) {
  const wave = getWave(profile.currentWave);
  if (!wave) return null;

  const stacks = new Map<string, EnemyStack>();
  for (const enemy of wave.enemies) {
    const key = `${enemy.typeId}:${enemy.level}`;
    const existing = stacks.get(key);
    if (existing) {
      stacks.set(key, { ...existing, count: existing.count + 1 });
    } else {
      stacks.set(key, { typeId: enemy.typeId, level: enemy.level, count: 1 });
    }
  }

  return (
    <section className="panel wave-preview">
      <div className="panel-heading">
        <div>
          <p className="panel-label">{t('waveLabel', { wave: wave.id })}</p>
          <h2 className="panel-title">{wave.nameHu}</h2>
        </div>
        {wave.isBossWave ? (
          <span className="boss-chip">
            <Icon name="skull" size={15} />
            {t('bossLabel')}
          </span>
        ) : null}
      </div>
      <p className="wave-preview__description">{wave.descriptionHu}</p>
      <div className="enemy-stack-list" aria-label={t('wavePreviewTitle')}>
        {[...stacks.values()].map((stack) => {
          const definition = ENEMY_DEFINITIONS[stack.typeId];
          return (
            <div className="enemy-stack" key={`${stack.typeId}-${stack.level}`}>
              <CreatureAvatar
                kind={stack.typeId}
                size={42}
                title={definition.nameHu}
                className={definition.isBoss ? 'enemy-avatar enemy-avatar--boss' : 'enemy-avatar'}
              />
              <div className="enemy-stack__text">
                <span className="enemy-stack__name">{definition.nameHu}</span>
                <span className="enemy-stack__meta">
                  {t('levelShort')} {stack.level}
                  {stack.count > 1 ? ` · ×${stack.count}` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="wave-preview__footer">
        <span>
          <Icon name="coin" size={16} />
          {t('resultReward')}: {formatNumber(wave.rewardCoins)}
        </span>
        <span className="wave-preview__hint">{t('wavePreviewHint')}</span>
      </div>
    </section>
  );
}
