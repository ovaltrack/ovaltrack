import { DonutChart } from '../../../shared/utils/donut';
import { PeriodStatisticDTO } from '../../match/statistics/types/statistic.types';
import { DivisionMetricDef, MetricSeriesDef, formatMetricValue } from './division-metrics';

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

/** Suma del rango: un partido sin dato (`null`) no suma. */
function totalOf(serie: MetricSeriesDef, matches: PeriodStatisticDTO[]): number {
  return sum(matches.map(match => serie.value(match) ?? 0));
}

/** Promedio por partido de un porcentaje, solo sobre los partidos que tienen dato; `null` si ninguno lo tiene. */
function averageOf(serie: MetricSeriesDef, matches: PeriodStatisticDTO[]): number | null {
  const values = matches.map(match => serie.value(match)).filter((value): value is number => value !== null);
  return values.length > 0 ? Math.round((sum(values) / values.length) * 10) / 10 : null;
}

/** Cantidades: reparte la suma del rango entre las series de la métrica (a favor y en contra, ganados y perdidos…). */
function shareOf(metric: DivisionMetricDef, matches: PeriodStatisticDTO[]): DonutChart {
  const slices = metric.series.map(serie => ({ label: serie.label, value: totalOf(serie, matches), color: serie.color }));
  const total = sum(slices.map(slice => slice.value));
  return { id: metric.id, title: metric.label, slices, max: total, center: { value: `${total}`, label: 'total' }, variant: 'share' };
}

/** Porcentajes: un anillo con el promedio por partido de cada serie, no una torta (un porcentaje no es parte de un total). */
function gaugesOf(metric: DivisionMetricDef, matches: PeriodStatisticDTO[]): DonutChart[] {
  return metric.series.map(serie => {
    const average = averageOf(serie, matches);
    return {
      id: `${metric.id}-${serie.key}`,
      title: metric.series.length > 1 ? `${metric.label} · ${serie.label}` : metric.label,
      slices: average === null ? [] : [{ label: serie.label, value: average, color: serie.color }],
      max: 100,
      center: average === null
        ? { value: '—', label: '' }
        : { value: formatMetricValue(average, 'percent'), label: 'promedio' },
      variant: 'gauge',
    };
  });
}

/**
 * Vista «Totales» de una métrica del dashboard: las cantidades se suman en el rango de fechas y se reparten entre
 * sus series; los porcentajes se promedian por partido. Usa los mismos colores que las líneas de la evolución.
 */
export function metricTotals(metric: DivisionMetricDef, matches: PeriodStatisticDTO[]): DonutChart[] {
  return metric.unit === 'percent' ? gaugesOf(metric, matches) : [shareOf(metric, matches)];
}
