import { useGameController } from '../app/ControllerContext';
import type { PrepView } from '../app/controller';
import { CHARACTER_DEFINITIONS } from '../game/domain/characters';
import { cellKey } from '../game/domain/grid';
import { characterLevelFromXp } from '../game/domain/progression';
import { ALLY_ROW_START, BOARD_COLS } from '../game/domain/types';
import { t } from '../localization';
import { CreatureAvatar } from './CreatureAvatar';

export function AccessiblePlacement({
  prep,
  selectedId,
}: {
  prep: PrepView;
  selectedId: string | null;
}) {
  const controller = useGameController();
  const moveKeys = new Set(prep.validMoveCells.map((cell) => cellKey(cell.col, cell.row)));
  const mergeKeys = new Set(prep.mergeTargets.map((cell) => cellKey(cell.col, cell.row)));
  const characters = new Map(prep.characters.map((character) => [character.id, character]));
  const rows = [ALLY_ROW_START, ALLY_ROW_START + 1];

  return (
    <details className="accessible-panel panel" data-testid="accessible-panel">
      <summary className="accessible-panel__summary">
        <span className="accessible-panel__icon" aria-hidden="true">
          ⌨
        </span>
        <span>{t('accessibilityPanel')}</span>
        <span className="accessible-panel__chevron" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="accessible-panel__body">
        <p className="accessible-panel__hint">{t('accessibilityHint')}</p>

        <div className="accessible-units" role="group" aria-label={t('armyTitle')}>
          {prep.characters.length === 0 ? (
            <p className="muted-text">{t('noSelectionHint')}</p>
          ) : (
            prep.characters.map((character) => {
              const definition = CHARACTER_DEFINITIONS[character.typeId];
              return (
                <button
                  key={character.id}
                  type="button"
                  className={`accessible-unit${
                    selectedId === character.id ? ' accessible-unit--selected' : ''
                  }`}
                  onClick={() => {
                    if (selectedId === character.id) controller.handleUnitTap(character.id);
                    else controller.selectCharacter(character.id);
                  }}
                  aria-pressed={selectedId === character.id}
                  data-testid={`accessible-unit-${character.id}`}
                >
                  <CreatureAvatar kind={character.typeId} size={28} />
                  <span className="accessible-unit__name">{definition.shortNameHu}</span>
                  <span className="accessible-unit__level">
                    {t('rankWithNumber', { rank: character.mergeRank })} ·{' '}
                    {t('levelWithNumber', {
                      level: characterLevelFromXp(character.totalXp),
                    })}
                  </span>
                  <span className="accessible-unit__pos">
                    {character.col + 1}/{character.row + 1}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div
          className="accessible-grid"
          role="group"
          aria-label={t('accessibilityPanel')}
          style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))` }}
        >
          {rows.flatMap((row) =>
            Array.from({ length: BOARD_COLS }, (_, col) => {
              const key = cellKey(col, row);
              const occupantId =
                prep.characters.find((character) => character.col === col && character.row === row)
                  ?.id ?? null;
              const occupant = occupantId ? characters.get(occupantId) : null;
              const isMove = moveKeys.has(key);
              const isMerge = mergeKeys.has(key);
              const label = occupant
                ? `${CHARACTER_DEFINITIONS[occupant.typeId].shortNameHu}, ${t('rankWithNumber', {
                    rank: occupant.mergeRank,
                  })}, ${t('levelWithNumber', {
                    level: characterLevelFromXp(occupant.totalXp),
                  })}`
                : t('emptyCell');
              return (
                <button
                  key={key}
                  type="button"
                  className={`accessible-cell${occupant ? ' accessible-cell--occupied' : ''}${
                    isMove ? ' accessible-cell--move' : ''
                  }${isMerge ? ' accessible-cell--merge' : ''}`}
                  onClick={() => controller.handleCellTap(col, row)}
                  aria-label={`${t('cellAria', { col: col + 1, row: row + 1 })}: ${label}`}
                  data-testid={`accessible-cell-${col}-${row}`}
                  data-occupant={occupantId ?? ''}
                >
                  <span className="accessible-cell__coord">
                    {String.fromCharCode(65 + col)}
                    {row + 1}
                  </span>
                  <span className="accessible-cell__content">
                    {occupant ? (
                      <>
                        <CreatureAvatar kind={occupant.typeId} size={22} />
                        <span>{occupant.mergeRank}</span>
                      </>
                    ) : isMerge ? (
                      t('mergeTarget')
                    ) : isMove ? (
                      t('validTarget')
                    ) : (
                      '·'
                    )}
                  </span>
                </button>
              );
            }),
          )}
        </div>
      </div>
    </details>
  );
}
