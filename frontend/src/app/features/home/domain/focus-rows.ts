import { formatDecimal, formatSigned } from './number-format';
import {
  FOCUS_MIN_MATCHES, FocusMetricId, FocusSeries, LINEOUT_METRIC, PENALTIES_METRIC, TACKLE_METRIC, TrendMetric, computeFocus, computeTrend
} from './trend-rules';

/** Partidos que dibuja el mini gráfico. */
export const FOCUS_SPARK_MATCHES = 8;

export interface FocusInput {
  series: FocusSeries;
  /** Line-outs del último partido, para «7 de 12 ganados»; sin dato, la fila omite esa nota. */
  lineoutLast?: { won: number; total: number } | null;
}

export interface FocusRow {
  metric: FocusMetricId;
  name: string;
  /** «Promedio previo 74,9 % · 7 de 12 ganados». */
  subtitle: string;
  /** Valor del último partido: «58 %» o «13». */
  valueLabel: string;
  /** Texto de la variación; nunca solo color: flecha, signo y «peor» o «mejor». */
  chip: { text: string; tone: 'worse' | 'better' };
  /** Últimos partidos (hasta 8), del más viejo al más reciente. */
  spark: number[];
  /** Promedio previo de toda la temporada, para la línea del mini gráfico. */
  average: number;
  ariaLabel: string;
}

export type FocusView =
  /** Menos de 3 partidos: «Todavía no hay 3 partidos». */
  | { status: 'not-enough' }
  /** Hay datos pero ninguna alerta ni mejora: «Sin desvíos importantes». */
  | { status: 'stable'; stable: string[] }
  | { status: 'rows'; rows: FocusRow[]; stable: string[] };

interface MetricDefinition {
  id: FocusMetricId;
  name: string;
  metric: TrendMetric;
  /** Porcentajes llevan « %» y la variación va en puntos porcentuales. */
  percent: boolean;
  note: (input: FocusInput) => string | null;
}

const DEFINITIONS: readonly MetricDefinition[] = [
  { id: 'lineout', name: 'Line-out propio', metric: LINEOUT_METRIC, percent: true, note: ({ lineoutLast }) => lineoutLast ? `${lineoutLast.won} de ${lineoutLast.total} ganados` : null },
  { id: 'tackle', name: 'Efectividad de tackle', metric: TACKLE_METRIC, percent: true, note: () => null },
  { id: 'penalties', name: 'Penales cometidos', metric: PENALTIES_METRIC, percent: false, note: () => 'subir es peor' }
];

const BEST_IMPROVEMENT_NOTE = 'la mejora más grande';

/**
 * «Qué trabajar esta semana»: las filas de `computeFocus` (hasta 3: alertas y la mejora más grande) con su texto, y las
 * métricas estables para el pie. Usa las 3 métricas que ya evalúa `trend-rules` (Q5: sin scrum).
 */
export function focusRows(input: FocusInput): FocusView {
  const available = Math.max(...DEFINITIONS.map(definition => input.series[definition.id].length));
  if (available < FOCUS_MIN_MATCHES) return { status: 'not-enough' };

  const stable = DEFINITIONS
    .filter(definition => input.series[definition.id].length >= FOCUS_MIN_MATCHES && computeTrend(input.series[definition.id], definition.metric)?.tone === 'stable')
    .map(definition => definition.name);

  const rows = computeFocus(input.series).flatMap((item): FocusRow[] => {
    const definition = DEFINITIONS.find(candidate => candidate.id === item.metric);
    const trend = definition && computeTrend(input.series[item.metric], definition.metric);
    return definition && trend ? [toRow(definition, input, item.tone, trend)] : [];
  });
  return rows.length === 0 ? { status: 'stable', stable } : { status: 'rows', rows, stable };
}

function toRow(definition: MetricDefinition, input: FocusInput, tone: 'worse' | 'better', trend: { latest: number; average: number; delta: number }): FocusRow {
  const unit = definition.percent ? ' %' : '';
  const note = tone === 'better' ? BEST_IMPROVEMENT_NOTE : definition.note(input);
  const spark = input.series[definition.id].slice(-FOCUS_SPARK_MATCHES);
  const average = formatDecimal(trend.average);
  const arrow = trend.delta > 0 ? '▲' : '▼';
  const variation = `${formatSigned(trend.delta)}${definition.percent ? ' p.p.' : ''}`;
  return {
    metric: definition.id,
    name: definition.name,
    subtitle: [`Promedio previo ${average}${unit}`, note].filter(Boolean).join(' · '),
    valueLabel: `${formatDecimal(trend.latest)}${unit}`,
    chip: { text: `${arrow} ${variation} · ${tone === 'worse' ? 'peor' : 'mejor'}`, tone },
    spark,
    average: trend.average,
    ariaLabel: `${definition.name} en los últimos ${spark.length} partidos: ${spark.map(value => formatDecimal(value)).join(', ')}. Último ${formatDecimal(trend.latest)}${unit}, promedio previo ${average}${unit}`
  };
}
