import { MetricComparison } from '../../player-statistics/types/player-stats-api.types';
import { squadComparison } from './squad-comparison';

describe('squadComparison', () => {
  const metric = (overrides: Partial<MetricComparison>): MetricComparison => ({
    key: 'points', playerValue: 4, squadValue: 2, format: 'PER_MATCH', higherIsBetter: true, verdict: 'ABOVE', ...overrides
  });

  it('sin métricas no hay tarjeta', () => {
    expect(squadComparison([])).toBeNull();
  });

  it('cuenta a favor y a mejorar con la frase «n a favor · n a mejorar»', () => {
    const result = squadComparison([
      metric({ key: 'points' }),
      metric({ key: 'tries', verdict: 'ABOVE' }),
      metric({ key: 'tacklesMade', verdict: 'BELOW' })
    ]);
    expect(result).toEqual(jasmine.objectContaining({ good: 2, bad: 1, summary: '2 a favor · 1 a mejorar' }));
  });

  it('en penales estar por encima es malo y por debajo es bueno', () => {
    const above = squadComparison([metric({ key: 'penaltiesConceded', higherIsBetter: false, verdict: 'ABOVE' })]);
    const below = squadComparison([metric({ key: 'penaltiesConceded', higherIsBetter: false, verdict: 'BELOW' })]);
    expect(above).toEqual(jasmine.objectContaining({ good: 0, bad: 1, summary: '0 a favor · 1 a mejorar' }));
    expect(above!.rows[0].tone).toBe('bad');
    expect(below).toEqual(jasmine.objectContaining({ good: 1, bad: 0 }));
    expect(below!.rows[0].tone).toBe('good');
  });

  it('en el promedio o sin datos no cuenta ni a favor ni a mejorar, y muestra «—»', () => {
    const result = squadComparison([
      metric({ verdict: 'EQUAL', playerValue: 2 }),
      metric({ key: 'tries', verdict: 'NO_DATA', playerValue: null, squadValue: null })
    ])!;
    expect(result).toEqual(jasmine.objectContaining({ good: 0, bad: 0 }));
    expect(result.rows[1]).toEqual(jasmine.objectContaining({ player: '—', squad: '—', verdictLabel: 'Sin datos', tone: 'muted' }));
  });

  it('formatea con coma decimal y espacio antes del %', () => {
    const [per, percent] = squadComparison([
      metric({ playerValue: 1.5, squadValue: 1.2 }),
      metric({ key: 'tackleEffectiveness', format: 'PERCENT', playerValue: 74.9, squadValue: 80 })
    ])!.rows;
    expect(per.player).toBe('1,5');
    expect(percent.player).toBe('75 %');
  });
});
