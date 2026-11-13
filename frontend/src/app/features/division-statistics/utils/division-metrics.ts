import { PeriodStatisticDTO } from '../../match/statistics/types/statistic.types';

export type MetricUnit = 'int' | 'percent';

export interface MetricSeriesDef {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  /** `null` cuando el partido no tiene datos para la serie (se corta la línea en ese punto). */
  value: (stats: PeriodStatisticDTO) => number | null;
}

/** Métrica del dashboard: un gráfico con una o más series (una línea por serie, un punto por partido). */
export interface DivisionMetricDef {
  id: string;
  label: string;
  unit: MetricUnit;
  defaultSelected: boolean;
  series: MetricSeriesDef[];
}

const OWN = '#3a6410';
const OPPONENT = '#8a8f80';
const NAVY = '#16324f';
const BLUE = '#2b6ca3';
const AMBER = '#b7791f';
const RED = '#b42318';

/** Porcentaje de ganadas sobre ganadas + perdidas, con 1 decimal; `null` si no hubo ninguna resuelta. */
export function winRate(won: number, lost: number): number | null {
  const total = won + lost;
  return total > 0 ? Math.round((won / total) * 1000) / 10 : null;
}

/**
 * Catálogo de métricas. Todas salen de `PeriodStatisticDTO`, el mismo DTO que ya calcula el backend
 * con las estrategias de estadística; agregar una métrica es sumar una entrada acá.
 */
export const DIVISION_METRICS: DivisionMetricDef[] = [
  {
    id: 'points', label: 'Puntos', unit: 'int', defaultSelected: true,
    series: [
      { key: 'own', label: 'A favor', color: OWN, value: s => s.ownScore },
      { key: 'opp', label: 'En contra', color: OPPONENT, dashed: true, value: s => s.opponentScore },
    ],
  },
  {
    id: 'tries', label: 'Tries', unit: 'int', defaultSelected: true,
    series: [
      { key: 'own', label: 'Propios', color: OWN, value: s => s.ownTries },
      { key: 'opp', label: 'Rival', color: OPPONENT, dashed: true, value: s => s.opponentTries },
    ],
  },
  {
    id: 'penalties', label: 'Penales', unit: 'int', defaultSelected: true,
    series: [
      { key: 'own', label: 'Convertidos', color: OWN, value: s => s.ownPenalties },
      { key: 'opp', label: 'Rival', color: OPPONENT, dashed: true, value: s => s.opponentPenalties },
    ],
  },
  {
    id: 'penalties-conceded', label: 'Penales cometidos', unit: 'int', defaultSelected: false,
    series: [
      { key: 'own', label: 'Propios', color: RED, value: s => s.ownPenaltiesConceded },
      { key: 'opp', label: 'Rival', color: OPPONENT, dashed: true, value: s => s.opponentPenaltiesConceded },
    ],
  },
  {
    id: 'scrum-effectiveness', label: 'Obtención en scrum (efectividad)', unit: 'percent', defaultSelected: true,
    series: [{ key: 'own', label: 'Scrum propio ganado', color: OWN, value: s => winRate(s.ownScrumsWon, s.ownScrumsLost) }],
  },
  {
    id: 'lineout-effectiveness', label: 'Obtención en line (efectividad)', unit: 'percent', defaultSelected: true,
    series: [{ key: 'own', label: 'Line propio ganado', color: NAVY, value: s => winRate(s.ownLineoutsWon, s.ownLineoutsLost) }],
  },
  {
    id: 'scrum-result', label: 'Scrum propio: ganados / perdidos', unit: 'int', defaultSelected: false,
    series: [
      { key: 'won', label: 'Ganados', color: OWN, value: s => s.ownScrumsWon },
      { key: 'lost', label: 'Perdidos', color: RED, dashed: true, value: s => s.ownScrumsLost },
    ],
  },
  {
    id: 'lineout-result', label: 'Line propio: ganados / perdidos', unit: 'int', defaultSelected: false,
    series: [
      { key: 'won', label: 'Ganados', color: OWN, value: s => s.ownLineoutsWon },
      { key: 'lost', label: 'Perdidos', color: RED, dashed: true, value: s => s.ownLineoutsLost },
    ],
  },
  {
    id: 'turnovers', label: 'Turnovers', unit: 'int', defaultSelected: false,
    series: [
      { key: 'won', label: 'Ganados', color: OWN, value: s => s.ownTurnoversWon },
      { key: 'lost', label: 'Perdidos', color: RED, dashed: true, value: s => s.ownTurnoversLost },
    ],
  },
  {
    id: 'possession', label: 'Posesión', unit: 'percent', defaultSelected: true,
    series: [{ key: 'own', label: 'Posesión propia', color: NAVY, value: s => s.ownPossessionPercentage }],
  },
  {
    id: 'conversions', label: 'Conversiones', unit: 'int', defaultSelected: false,
    series: [
      { key: 'own', label: 'Propias', color: OWN, value: s => s.ownConversions },
      { key: 'opp', label: 'Rival', color: OPPONENT, dashed: true, value: s => s.opponentConversions },
    ],
  },
  {
    id: 'tackles', label: 'Efectividad de tackles', unit: 'percent', defaultSelected: false,
    series: [{ key: 'own', label: 'Efectividad', color: BLUE, value: s => s.ownTackleEffectiveness }],
  },
  {
    id: 'cards', label: 'Tarjetas propias', unit: 'int', defaultSelected: false,
    series: [
      { key: 'yellow', label: 'Amarillas', color: AMBER, value: s => s.ownYellowCards },
      { key: 'red', label: 'Rojas', color: RED, dashed: true, value: s => s.ownRedCards },
    ],
  },
];

export function formatMetricValue(value: number, unit: MetricUnit): string {
  if (unit === 'percent') {
    return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
  }
  return `${value}`;
}

export function isMetricSelection(value: unknown): value is string[] {
  const knownIds = new Set(DIVISION_METRICS.map(metric => metric.id));
  return Array.isArray(value) && value.every(id => typeof id === 'string' && knownIds.has(id));
}
