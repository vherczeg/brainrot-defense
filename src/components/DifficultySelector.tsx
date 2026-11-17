import { useGameController } from '../app/ControllerContext';
import type { Difficulty } from '../game/domain/types';
import { t } from '../localization';
import { Icon, type IconName } from './Icon';

const DIFFICULTY_OPTIONS: readonly {
  id: Difficulty;
  label: string;
  hint: string;
  icon: IconName;
}[] = [
  { id: 'easy', label: t('difficultyEasy'), hint: t('difficultyEasyHint'), icon: 'life-heart' },
  { id: 'normal', label: t('difficultyNormal'), hint: t('difficultyNormalHint'), icon: 'shield' },
  { id: 'hard', label: t('difficultyHard'), hint: t('difficultyHardHint'), icon: 'swords' },
  {
    id: 'extreme',
    label: t('difficultyExtreme'),
    hint: t('difficultyExtremeHint'),
    icon: 'skull',
  },
];

export function DifficultySelector({ difficulty }: { difficulty: Difficulty }) {
  const controller = useGameController();
  const active = DIFFICULTY_OPTIONS.find((option) => option.id === difficulty);

  return (
    <section className="difficulty-panel panel" data-testid="difficulty-selector">
      <div className="difficulty-panel__copy">
        <p className="panel-label">{t('difficultyTitle')}</p>
        <p className="difficulty-panel__hint">{active?.hint ?? t('difficultyNormalHint')}</p>
      </div>
      <div
        className="difficulty-options"
        role="group"
        aria-label={t('difficultyAria', { difficulty: active?.label ?? t('difficultyNormal') })}
      >
        {DIFFICULTY_OPTIONS.map((option) => {
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
