import { DIVISION_METRICS, DivisionMetricDef } from './division-metrics';
import { metricTotals } from './division-totals';
import { isEmptyDonut } from '../../../shared/utils/donut';
import { PeriodStatisticDTO } from '../../match/statistics/types/statistic.types';

const stats = (values: Partial<PeriodStatisticDTO>) => values as PeriodStatisticDTO;
const metric = (id: string): DivisionMetricDef => DIVISION_METRICS.find(candidate => candidate.id === id)!;

describe('metricTotals', () => {
  it('cantidades: suma el rango y reparte entre las series con sus mismos colores', () => {
    const [chart] = metricTotals(metric('points'), [
      stats({ ownScore: 20, opponentScore: 10 }),
      stats({ ownScore: 15, opponentScore: 5 }),
    ]);

    expect(chart.variant).toBe('share');
    expect(chart.slices.map(slice => [slice.label, slice.value])).toEqual([['A favor', 35], ['En contra', 15]]);
    expect(chart.slices.map(slice => slice.color)).toEqual(metric('points').series.map(serie => serie.color));
    expect(chart.max).toBe(50);
    expect(chart.center).toEqual({ value: '50', label: 'total' });
  });

  it('una métrica sin ningún dato en el rango queda vacía', () => {
    const [chart] = metricTotals(metric('tries'), [stats({ ownTries: 0, opponentTries: 0 })]);
    expect(chart.slices.every(slice => slice.value === 0)).toBeTrue();
    expect(chart.center.value).toBe('0');
  });

  it('scrum: ganados sobre jugados en todo el rango, no el promedio de los porcentajes', () => {
    const [chart] = metricTotals(metric('scrum-effectiveness'), [
      stats({ ownScrumsWon: 1, ownScrumsLost: 0 }),
      stats({ ownScrumsWon: 6, ownScrumsLost: 6 }),
    ]);

    expect(chart.variant).toBe('gauge');
    expect(chart.slices[0].value).toBe(53.8);
    expect(chart.max).toBe(100);
    expect(chart.center).toEqual({ value: '53.8%', label: 'del rango' });
    expect(chart.note).toBe('7 de 13');
    expect(chart.title).toBe('Obtención en scrum (efectividad)');
  });

  it('line: un partido sin line-outs propios no suma', () => {
    const [chart] = metricTotals(metric('lineout-effectiveness'), [
      stats({ ownLineoutsWon: 3, ownLineoutsLost: 1 }),
      stats({ ownLineoutsWon: 0, ownLineoutsLost: 0 }),
    ]);
    expect(chart.center.value).toBe('75%');
    expect(chart.note).toBe('3 de 4');
  });

  it('tackles: un partido sin tackles no cuenta como 0 % (el backend lo manda en 0)', () => {
    const [chart] = metricTotals(metric('tackles'), [
      stats({ ownTacklesCompleted: 8, ownTacklesMissed: 2, ownTackleEffectiveness: 80 }),
      stats({ ownTacklesCompleted: 0, ownTacklesMissed: 0, ownTackleEffectiveness: 0 }),
    ]);
    expect(chart.center.value).toBe('80%');
    expect(chart.note).toBe('8 de 10');
  });

  it('posesión: sin tiempos por partido, sigue siendo el promedio por partido', () => {
    const [chart] = metricTotals(metric('possession'), [
      stats({ ownPossessionPercentage: 40 }),
      stats({ ownPossessionPercentage: 55 }),
    ]);
    expect(chart.center).toEqual({ value: '47.5%', label: 'promedio' });
    expect(chart.note).toBe('por partido');
  });

  it('porcentajes: un promedio de 0 es un dato, no un anillo vacío', () => {
    const [chart] = metricTotals(metric('possession'), [stats({ ownPossessionPercentage: 0 })]);
    expect(isEmptyDonut(chart)).toBeFalse();
    expect(chart.center.value).toBe('0%');
  });

  it('porcentajes: sin ningún partido con dato muestra «—»', () => {
    const [chart] = metricTotals(metric('lineout-effectiveness'), [stats({ ownLineoutsWon: 0, ownLineoutsLost: 0 })]);
    expect(chart.slices).toEqual([]);
    expect(chart.center.value).toBe('—');
    expect(chart.note).toBeUndefined();
  });

  it('sin partidos no hay nada que sumar ni promediar', () => {
    expect(metricTotals(metric('points'), [])[0].center.value).toBe('0');
    expect(metricTotals(metric('possession'), [])[0].center.value).toBe('—');
  });
});
