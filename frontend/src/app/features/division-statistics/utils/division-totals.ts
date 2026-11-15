import { DonutChart } from '../../../shared/utils/donut';
import { formatMetric } from '../../match/statistics/presentation/stat-presentation';
import { PeriodStatisticDTO } from '../../match/statistics/types/statistic.types';
import { DivisionMetricDef, MetricSeriesDef, formatMetricValue, winRate } from './division-metrics';

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

/** Lo logrado sobre lo jugado en un partido (scrums ganados sobre scrums propios, tackles completados sobre intentados). */
interface Attempts {
  made: number;
  total: number;
}

/**
 * Porcentajes que se pueden ponderar porque cada partido trae sus cantidades: el del rango es lo logrado sobre lo
 * jugado en todos los partidos, así uno con un solo scrum no pesa lo mismo que uno con doce. Los que solo traen el
 * porcentaje (la posesión) se promedian por partido.
 */
const WEIGHTED: Record<string, (stats: PeriodStatisticDTO) => Attempts> = {
  'scrum-effectiveness': s => ({ made: s.ownScrumsWon, total: s.ownScrumsWon + s.ownScrumsLost }),
  'lineout-effectiveness': s => ({ made: s.ownLineoutsWon, total: s.ownLineoutsWon + s.ownLineoutsLost }),
  tackles: s => ({ made: s.ownTacklesCompleted, total: s.ownTacklesCompleted + s.ownTacklesMissed }),
};

/** Suma del rango: un partido sin dato (`null`) no suma. */
function totalOf(serie: MetricSeriesDef, matches: PeriodStatisticDTO[]): number {
  return sum(matches.map(match => serie.value(match) ?? 0));
}

/** Promedio por partido de un porcentaje, solo sobre los partidos que tienen dato; `null` si ninguno lo tiene. */
function averageOf(serie: MetricSeriesDef, matches: PeriodStatisticDTO[]): number | null {
  const values = matches.map(match => serie.value(match)).filter((value): value is number => value !== null);
  return values.length > 0 ? Math.round((sum(values) / values.length) * 10) / 10 : null;
}

/**
 * Qué muestra el centro de una cantidad con dos series: sumar series opuestas (a favor y en contra) no significa nada,
 * así que va la diferencia con signo (la primera menos la segunda); en la formación fija propia, ganados sobre jugados
 * (la suma son los saques propios). Las demás (tarjetas: amarillas más rojas) muestran la suma.
 */
const TOTAL_CENTERS: Record<string, 'difference' | 'won'> = {
  points: 'difference',
  tries: 'difference',
  penalties: 'difference',
  'penalties-conceded': 'difference',
  conversions: 'difference',
  turnovers: 'difference',
  'scrum-result': 'won',
  'lineout-result': 'won',
};

function centerOf(metric: DivisionMetricDef, values: number[]): DonutChart['center'] {
  const total = sum(values);
  switch (TOTAL_CENTERS[metric.id]) {
    case 'difference': return { value: formatMetric(values[0] - values[1], 'signed'), label: 'diferencia' };
    case 'won': return { value: `${values[0]}/${total}`, label: 'ganados' };
    default: return { value: `${total}`, label: 'total' };
  }
}

/** Cantidades: reparte la suma del rango entre las series de la métrica (a favor y en contra, ganados y perdidos…). */
function shareOf(metric: DivisionMetricDef, matches: PeriodStatisticDTO[]): DonutChart {
  const slices = metric.series.map(serie => ({ label: serie.label, value: totalOf(serie, matches), color: serie.color }));
  const values = slices.map(slice => slice.value);
  return { id: metric.id, title: metric.label, slices, max: sum(values), center: centerOf(metric, values), variant: 'share' };
}

/** Porcentaje del rango con su aclaración: ponderado («7 de 13») o, si el partido solo trae el %, promedio por partido. */
function rangePercent(metric: DivisionMetricDef, serie: MetricSeriesDef, matches: PeriodStatisticDTO[]) {
  const attempts = WEIGHTED[metric.id];
  if (!attempts) {
    return { value: averageOf(serie, matches), label: 'promedio', note: 'por partido' };
  }
  const made = sum(matches.map(match => attempts(match).made));
  const total = sum(matches.map(match => attempts(match).total));
  return { value: winRate(made, total - made), label: 'del rango', note: `${made} de ${total}` };
}

/** Porcentajes: un anillo por serie con el porcentaje del rango, no una torta (un porcentaje no es parte de un total). */
function gaugesOf(metric: DivisionMetricDef, matches: PeriodStatisticDTO[]): DonutChart[] {
  return metric.series.map(serie => {
    const percent = rangePercent(metric, serie, matches);
    const base = { id: `${metric.id}-${serie.key}`, title: metric.series.length > 1 ? `${metric.label} · ${serie.label}` : metric.label };
    if (percent.value === null) {
      return { ...base, slices: [], max: 100, center: { value: '—', label: '' }, variant: 'gauge' };
    }
    return {
      ...base,
      slices: [{ label: serie.label, value: percent.value, color: serie.color }],
      max: 100,
      center: { value: formatMetricValue(percent.value, 'percent'), label: percent.label },
      variant: 'gauge',
      note: percent.note,
    };
  });
}

/**
 * Vista «Totales» de una métrica del dashboard: las cantidades se suman en el rango de fechas y se reparten entre
 * sus series; los porcentajes se ponderan con lo jugado en el rango (o se promedian por partido si solo hay el %).
 * Usa los mismos colores que las líneas de la evolución.
 */
export function metricTotals(metric: DivisionMetricDef, matches: PeriodStatisticDTO[]): DonutChart[] {
  return metric.unit === 'percent' ? gaugesOf(metric, matches) : [shareOf(metric, matches)];
}
