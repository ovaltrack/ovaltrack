import { BarChart, BarGroup, BarUnit, axisMaxFor } from '../../../shared/utils/bars';
import { teamNameCore } from '../../match/post-match/utils/zone-grid';
import { PeriodStatisticDTO } from '../../match/statistics/types/statistic.types';
import { DivisionMetricDef, formatMetricValue } from './division-metrics';

const NO_VALUE = '—';
const ACRONYM_LENGTH = 3;
/** Conectores que no suman una inicial («Atlético de San Isidro» → ASI). */
const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

/**
 * Sigla del rival para el eje X de las columnas (en celular no hay `title`): con varias palabras, sus iniciales (hasta
 * 3); con una, sus 3 primeras letras. Sin «Club» ni «Rugby Club», sin tildes y en mayúsculas.
 */
export function opponentAcronym(name: string | null): string {
  if (!name) return '';
  const words = teamNameCore(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s.-]+/)
    .filter(word => word.length > 0 && !CONNECTORS.has(word.toLowerCase()));
  const acronym = words.length > 1 ? words.map(word => word[0]).join('') : words.join('');
  return acronym.slice(0, ACRONYM_LENGTH).toUpperCase();
}

/**
 * Vista «Por partido» de una métrica del dashboard: un grupo de columnas por partido del rango, en orden de fecha, con
 * una columna por serie y los mismos colores que las líneas de la evolución. Un partido sin dato (`null`) no tiene
 * columna y muestra «—»; los porcentajes van de 0 a 100 y las cantidades en una escala común. Debajo de cada fecha va
 * la sigla del rival (`sublabels`).
 */
export function matchBars(
  metric: DivisionMetricDef,
  matches: PeriodStatisticDTO[],
  labels: string[],
  details: string[],
  sublabels: string[] = []
): BarChart {
  const unit: BarUnit = metric.unit === 'percent' ? 'percent' : 'count';
  const groups = matches.map<BarGroup>((match, index) => ({
    label: labels[index],
    sublabel: sublabels[index],
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
