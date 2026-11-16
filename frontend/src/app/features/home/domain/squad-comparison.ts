import { ComparisonRow, toComparisonRows, toneCounts } from '../../player-statistics/utils/player-comparison';
import { MetricComparison } from '../../player-statistics/types/player-stats-api.types';

/** «Vos contra el plantel»: las filas de la comparación y cuántas están a favor y a mejorar. */
export interface SquadComparison {
  rows: ComparisonRow[];
  good: number;
  bad: number;
  /** «4 a favor · 1 a mejorar». */
  summary: string;
}

/**
 * Las métricas que devuelve el backend frente al promedio del plantel de la división. Quién está «a favor» lo decide
 * `higherIsBetter` (en penales, estar por encima es malo); lo que está en el promedio o sin datos no cuenta en ninguno.
 * Sin métricas no hay tarjeta (`null`).
 */
export function squadComparison(comparisons: readonly MetricComparison[]): SquadComparison | null {
  if (comparisons.length === 0) return null;
  const rows = toComparisonRows([...comparisons]);
  const { good, bad } = toneCounts(rows);
  return { rows, good, bad, summary: `${good} a favor · ${bad} a mejorar` };
}
