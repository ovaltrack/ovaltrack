import { DIVISION_METRICS, isMetricSelection } from './division-metrics';

describe('isMetricSelection', () => {
  const [first, second] = DIVISION_METRICS.map(metric => metric.id);

  it('acepta una lista de métricas que existen, incluso vacía', () => {
    expect(isMetricSelection([first, second])).toBeTrue();
    expect(isMetricSelection([])).toBeTrue();
  });

  it('descarta una métrica que ya no existe', () => {
    expect(isMetricSelection([first, 'metrica-borrada'])).toBeFalse();
  });

  it('descarta lo que no es una lista de textos', () => {
    expect(isMetricSelection(first)).toBeFalse();
    expect(isMetricSelection([1, 2])).toBeFalse();
    expect(isMetricSelection(null)).toBeFalse();
  });
});
