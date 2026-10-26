import { useGameController } from '../app/ControllerContext';
import type { Difficulty } from '../game/domain/types';
import { t } from '../localization';
import { Icon } from './Icon';

export function DifficultySelector({ difficulty }: { difficulty: Difficulty }) {
  const controller = useGameController();
  const options: readonly { id: Difficulty; label: string; icon: 'shield' | 'swords' }[] = [
    { id: 'normal', label: t('difficultyNormal'), icon: 'shield' },
    { id: 'hard', label: t('difficultyHard'), icon: 'swords' },
  ];

  return (
    <section className="difficulty-panel panel" data-testid="difficulty-selector">
      <div className="difficulty-panel__copy">
        <p className="panel-label">{t('difficultyTitle')}</p>
        <p className="difficulty-panel__hint">
          {difficulty === 'hard' ? t('difficultyHardHint') : t('difficultyNormalHint')}
        </p>
      </div>
      <div
        className="difficulty-options"
        role="group"
        aria-label={t('difficultyAria', {
          difficulty: t(`difficulty${difficulty === 'hard' ? 'Hard' : 'Normal'}`),
        })}
      >
        {options.map((option) => {
          const selected = difficulty === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`difficulty-option difficulty-option--${option.id}${
                selected ? ' difficulty-option--active' : ''
              }`}
              onClick={() => controller.setDifficulty(option.id)}
              aria-pressed={selected}
              data-testid={`difficulty-${option.id}`}
            >
              <Icon name={option.icon} size={18} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
