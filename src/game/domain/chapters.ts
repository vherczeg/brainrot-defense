export interface ChapterDefinition {
  readonly id: number;
  readonly nameHu: string;
  readonly firstWave: number;
  readonly lastWave: number;
}

export const CHAPTER_DEFINITIONS: readonly ChapterDefinition[] = [
  { id: 1, nameHu: 'A Káosz kapuja', firstWave: 1, lastWave: 10 },
  { id: 2, nameHu: 'Méreg az égen', firstWave: 11, lastWave: 20 },
  { id: 3, nameHu: 'A rozsda földje', firstWave: 21, lastWave: 30 },
  { id: 4, nameHu: 'Vihar éjszakája', firstWave: 31, lastWave: 40 },
  { id: 5, nameHu: 'A mocsár királya', firstWave: 41, lastWave: 50 },
  { id: 6, nameHu: 'Az árnyék trónja', firstWave: 51, lastWave: 60 },
  { id: 7, nameHu: 'Iker káosz', firstWave: 61, lastWave: 70 },
  { id: 8, nameHu: 'A lávafolyosó', firstWave: 71, lastWave: 80 },
  { id: 9, nameHu: 'A sárkány tornya', firstWave: 81, lastWave: 90 },
  { id: 10, nameHu: 'A végső kapu', firstWave: 91, lastWave: 100 },
];

export function chapterOfWave(waveId: number): ChapterDefinition | null {
  return (
    CHAPTER_DEFINITIONS.find(
      (chapter) => waveId >= chapter.firstWave && waveId <= chapter.lastWave,
    ) ?? null
  );
}
