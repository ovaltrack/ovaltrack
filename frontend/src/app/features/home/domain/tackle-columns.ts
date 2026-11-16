import { shortTeamName, teamNameCore } from '../../match/post-match/utils/zone-grid';
import { MetricComparison, PlayerMatchSummary } from '../../player-statistics/types/player-stats-api.types';
import { BarChart, axisMaxFor } from '../../../shared/utils/bars';
import { OWN_COLOR_VAR } from '../../../shared/utils/donut';
import { formatDecimal } from './number-format';
import { parseWallClock } from './match-time';

export const TACKLE_COLUMNS = 8;
const SIGLA_MAX = 3;
const NO_RIVAL = '—';
const pad = (value: number): string => String(value).padStart(2, '0');

/** «Tus tackles»: las columnas de los últimos partidos, el texto para lectores de pantalla y el pie. */
export interface TackleColumns {
  chart: BarChart;
  ariaLabel: string;
  /** «Promedio 12,3 por partido · el plantel hace 7,2.»; sin promedio del plantel, solo la primera parte. */
  foot: { average: string; squad: string | null };
}

/** Sigla del rival: iniciales si el nombre tiene varias palabras («Draig Goch» → «DG»), si no las tres primeras letras. */
export function opponentSigla(name: string | null): string {
  if (!name?.trim()) return NO_RIVAL;
  const words = teamNameCore(name).split(' ');
  const letters = words.length > 1 ? words.map(word => word[0]).join('') : words[0];
  return letters.slice(0, SIGLA_MAX).toUpperCase();
}

/** «02/11»; el campo `date` es hora de pared, no se convierte. */
function dayMonth(date: string): string {
  const parsed = parseWallClock(date);
  return parsed ? `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}` : '';
}

/** Los partidos anteriores: el mismo verde propio atenuado, sin un color nuevo. */
const PREVIOUS_COLOR = `color-mix(in srgb, var(${OWN_COLOR_VAR}) 55%, transparent)`;

/**
 * Tackles completados en los últimos 8 partidos del jugador, del más viejo al más nuevo; el último va en el color propio
 * y los anteriores atenuados. Con menos de 8 partidos, los que haya; sin partidos no hay gráfico (`null`). El promedio
 * es el de las columnas dibujadas; el del plantel sale de la métrica `tacklesMade` de la comparación (por partido).
 */
export function tackleColumns(matches: readonly PlayerMatchSummary[], comparisons: readonly MetricComparison[]): TackleColumns | null {
  const recent = [...matches].sort((a, b) => a.date.localeCompare(b.date)).slice(-TACKLE_COLUMNS);
  if (recent.length === 0) return null;

  const counts = recent.map(match => match.metrics.tacklesMade);
  const lastIndex = recent.length - 1;
  const groups = recent.map((match, index) => ({
    label: dayMonth(match.date),
    sublabel: opponentSigla(match.opponentName),
    detail: `${dayMonth(match.date)} · ${match.opponentName ? shortTeamName(match.opponentName) : 'rival sin nombre'}`,
    values: [{ series: 'Tackles', value: counts[index], display: String(counts[index]), color: index === lastIndex ? `var(${OWN_COLOR_VAR})` : PREVIOUS_COLOR }]
  }));
  const squad = comparisons.find(comparison => comparison.key === 'tacklesMade')?.squadValue ?? null;
  const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;

  return {
    chart: { id: 'player-tackles', title: 'Tackles completados', orientation: 'vertical', unit: 'count', max: axisMaxFor('count', counts), groups },
    ariaLabel: `Tackles completados en ${recent.length === 1 ? 'tu último partido' : `los últimos ${recent.length} partidos`}: ${groups.map((group, index) => `${counts[index]} contra ${group.sublabel} el ${group.label}`).join(', ')}`,
    foot: { average: formatDecimal(average), squad: squad === null ? null : formatDecimal(squad) }
  };
}
