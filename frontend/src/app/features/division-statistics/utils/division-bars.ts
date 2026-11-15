import { BarChart, BarGroup, BarUnit, axisMaxFor } from '../../../shared/utils/bars';
import { PeriodStatisticDTO } from '../../match/statistics/types/statistic.types';
import { DivisionMetricDef, formatMetricValue } from './division-metrics';

const NO_VALUE = '—';

/**
 * Vista «Por partido» de una métrica del dashboard: un grupo de columnas por partido del rango, en orden de fecha, con
 * una columna por serie y los mismos colores que las líneas de la evolución. Un partido sin dato (`null`) no tiene
 * columna y muestra «—»; los porcentajes van de 0 a 100 y las cantidades en una escala común.
 */
export function matchBars(metric: DivisionMetricDef, matches: PeriodStatisticDTO[], labels: string[], details: string[]): BarChart {
  const unit: BarUnit = metric.unit === 'percent' ? 'percent' : 'count';
  const groups = matches.map<BarGroup>((match, index) => ({
    label: labels[index],
    detail: details[index],
    values: metric.series.map(serie => {
      const value = serie.value(match);
      return {
        series: serie.label,
        value,
        display: value === null ? NO_VALUE : formatMetricValue(value, metric.unit),
        color: serie.color,
      };
    }),
  }));
  return {
    id: metric.id,
    title: metric.label,
    orientation: 'vertical',
    unit,
    max: axisMaxFor(unit, groups.flatMap(group => group.values.map(value => value.value))),
    groups,
    legend: metric.series.map(serie => ({ label: serie.label, color: serie.color })),
  };
}
