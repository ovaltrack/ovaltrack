import { ZoneCellSummary } from '../../match/types/zone.types';
import { zoneLabel, zoneName } from '../../match/post-match/utils/zone-grid';
import {
  ComparisonVerdict,
  MetricComparison,
  MetricKey,
  PlayerActionCount,
  PlayerMatchSummary,
  PlayerZoneMap,
} from '../types/player-stats-api.types';
import { MatchResult } from '../types/player-statistics.types';

/** Cómo se lee una comparación: bien, mal, neutral (en el promedio) o sin datos. */
export type ComparisonTone = 'good' | 'bad' | 'neutral' | 'muted';

/** Fila de la tarjeta de comparación con el plantel, lista para pintar. */
export interface ComparisonRow {
  key: MetricKey;
  label: string;
  hint: string;
  player: string;
  squad: string;
  verdictLabel: string;
  /** Ícono de dirección según el valor (arriba / abajo del promedio); el color lo da `tone`. */
  icon: string;
  tone: ComparisonTone;
  /** Ancho (0–100) de cada barra, relativo al mayor de los dos valores. */
  playerWidth: number;
  squadWidth: number;
}

const METRIC_LABELS: Record<MetricKey, { label: string; hint: string }> = {
  points: { label: 'Puntos', hint: 'por partido' },
  tries: { label: 'Tries', hint: 'por partido' },
  tacklesMade: { label: 'Tackles completados', hint: 'por partido' },
  tackleEffectiveness: { label: 'Efectividad de tackle', hint: 'completados / intentados' },
  goalKickingEffectiveness: { label: 'Pateo a palos', hint: 'conversiones y penales convertidos' },
  turnoversWon: { label: 'Turnovers ganados', hint: 'por partido' },
  penaltiesConceded: { label: 'Penales cometidos', hint: 'por partido · menos es mejor' },
  handlingErrors: { label: 'Errores de manejo', hint: 'por partido · menos es mejor' },
};

const VERDICT_ICONS: Record<ComparisonVerdict, string> = {
  ABOVE: 'bi-arrow-up-right',
  EQUAL: 'bi-dash',
  BELOW: 'bi-arrow-down-right',
  NO_DATA: 'bi-slash-circle',
};

const VERDICT_LABELS: Record<ComparisonVerdict, string> = {
  ABOVE: 'Por encima',
  EQUAL: 'En el promedio',
  BELOW: 'Por debajo',
  NO_DATA: 'Sin datos',
};

/** Bien o mal según el sentido de la métrica: en penales, estar por encima del promedio es malo. */
export function comparisonTone(comparison: Pick<MetricComparison, 'verdict' | 'higherIsBetter'>): ComparisonTone {
  switch (comparison.verdict) {
    case 'NO_DATA': return 'muted';
    case 'EQUAL': return 'neutral';
    case 'ABOVE': return comparison.higherIsBetter ? 'good' : 'bad';
    case 'BELOW': return comparison.higherIsBetter ? 'bad' : 'good';
  }
}

/** "1,3" por partido o "61 %"; "—" sin datos. Hasta un decimal, sin ",0". */
export function formatMetricValue(value: number | null, format: MetricComparison['format']): string {
  if (value === null) return '—';
  if (format === 'PERCENT') return `${Math.round(value)} %`;
  return formatDecimal(value);
}

export function formatDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toString().replace('.', ',');
}

export function toComparisonRows(comparisons: MetricComparison[]): ComparisonRow[] {
  return comparisons.map(comparison => {
    const { label, hint } = METRIC_LABELS[comparison.key];
    const player = comparison.playerValue ?? 0;
    const squad = comparison.squadValue ?? 0;
    const max = Math.max(player, squad);
    return {
      key: comparison.key,
      label,
      hint,
      player: formatMetricValue(comparison.playerValue, comparison.format),
      squad: formatMetricValue(comparison.squadValue, comparison.format),
      verdictLabel: VERDICT_LABELS[comparison.verdict],
      icon: VERDICT_ICONS[comparison.verdict],
      tone: comparisonTone(comparison),
      playerWidth: max === 0 ? 0 : Math.round((player / max) * 100),
      squadWidth: max === 0 ? 0 : Math.round((squad / max) * 100),
    };
  });
}

/** Cuántas métricas están bien y mal, para el resumen de la tarjeta. */
export function toneCounts(rows: ComparisonRow[]): Record<ComparisonTone, number> {
  const counts: Record<ComparisonTone, number> = { good: 0, bad: 0, neutral: 0, muted: 0 };
  rows.forEach(row => counts[row.tone]++);
  return counts;
}

/** Celdas para `app-rugby-field`, que pinta el calor según `eventCount`. */
export function toFieldCells(zones: PlayerZoneMap): ZoneCellSummary[] {
  return zones.cells.map(cell => ({ row: cell.row, col: cell.col, eventCount: cell.count }));
}

export interface TopZone {
  label: string;
  name: string;
  count: number;
  /** Porcentaje sobre las acciones con zona. */
  percent: number;
}

/** Las `limit` zonas con más acciones; en empate, la primera en la grilla. */
export function topZones(zones: PlayerZoneMap, limit = 3): TopZone[] {
  if (zones.zonedEvents === 0) return [];
  return [...zones.cells]
    .sort((a, b) => b.count - a.count || a.row - b.row || a.col - b.col)
    .slice(0, limit)
    .map(cell => ({
      label: zoneLabel(cell),
      name: zoneName(cell),
      count: cell.count,
      percent: Math.round((cell.count / zones.zonedEvents) * 100),
    }));
}

/** Resultado desde el club del jugador, que siempre es local. */
export function matchResult(match: Pick<PlayerMatchSummary, 'homeScore' | 'awayScore'>): MatchResult {
  if (match.homeScore > match.awayScore) return 'win';
  if (match.homeScore < match.awayScore) return 'loss';
  return 'draw';
}

export interface ActionRow {
  name: string;
  /** "3" o, en los pateos a palos, "2 de 3". */
  value: string;
}

export interface ActionGroup {
  title: string;
  rows: ActionRow[];
}

/** Títulos para el jugador cuando el nombre del grupo en el catálogo es técnico. */
const GROUP_TITLES: Record<string, string> = {
  'Puntuación': 'Puntos y pateo',
  'Neutro': 'Disciplina',
};

/** Nombres para el jugador cuando el del catálogo es técnico; los demás usan el del catálogo. */
const ACTION_NAMES: Record<string, string> = {
  PENALTY_KICK: 'Penales a palos',
  PENALTY_CONCEDED: 'Penales cometidos',
  YELLOW_CARD: 'Tarjetas amarillas',
  RED_CARD: 'Tarjetas rojas',
};

/** Tipos que se cargan con jugador pero no son una acción de juego. */
const NON_PLAY_CODES = new Set(['INJURY', 'SUBSTITUTION']);

/** Acciones de juego del jugador agrupadas por grupo del catálogo, de mayor a menor cantidad dentro de cada grupo. */
export function toActionGroups(actions: PlayerActionCount[]): ActionGroup[] {
  const groups = new Map<string, PlayerActionCount[]>();
  for (const action of actions.filter(a => !NON_PLAY_CODES.has(a.code))) {
    const title = GROUP_TITLES[action.groupName] ?? (action.groupName || 'Otras');
    groups.set(title, [...(groups.get(title) ?? []), action]);
  }
  return Array.from(groups, ([title, items]) => ({
    title,
    rows: [...items]
      .sort((a, b) => b.count - a.count)
      .map(item => ({
        name: ACTION_NAMES[item.code] ?? item.name,
        value: item.made === null ? `${item.count}` : `${item.made} de ${item.count}`,
      })),
  }));
}
