import {
  comparisonTone,
  formatMetricValue,
  matchResult,
  toActionGroups,
  toComparisonRows,
  topZones,
} from './player-comparison';
import { MetricComparison } from '../types/player-stats-api.types';

const comparison = (overrides: Partial<MetricComparison>): MetricComparison => ({
  key: 'points',
  playerValue: 4,
  squadValue: 2,
  format: 'PER_MATCH',
  higherIsBetter: true,
  verdict: 'ABOVE',
  ...overrides,
});

describe('player-comparison', () => {
  it('estar por encima es bueno salvo en métricas donde menos es mejor', () => {
    expect(comparisonTone({ verdict: 'ABOVE', higherIsBetter: true })).toBe('good');
    expect(comparisonTone({ verdict: 'ABOVE', higherIsBetter: false })).toBe('bad');
    expect(comparisonTone({ verdict: 'BELOW', higherIsBetter: false })).toBe('good');
    expect(comparisonTone({ verdict: 'EQUAL', higherIsBetter: true })).toBe('neutral');
    expect(comparisonTone({ verdict: 'NO_DATA', higherIsBetter: true })).toBe('muted');
  });

  it('formatea por partido con coma decimal y porcentajes redondeados', () => {
    expect(formatMetricValue(1.33, 'PER_MATCH')).toBe('1,3');
    expect(formatMetricValue(2, 'PER_MATCH')).toBe('2');
    expect(formatMetricValue(66.67, 'PERCENT')).toBe('67 %');
    expect(formatMetricValue(null, 'PERCENT')).toBe('—');
  });

  it('las barras se escalan contra el mayor de los dos valores', () => {
    const [row] = toComparisonRows([comparison({ playerValue: 1, squadValue: 4 })]);
    expect(row.playerWidth).toBe(25);
    expect(row.squadWidth).toBe(100);
    expect(row.label).toBe('Puntos');
    expect(row.verdictLabel).toBe('Por encima');
    expect(row.icon).toBe('bi-arrow-up-right');
  });

  it('sin valores las barras quedan vacías', () => {
    const [row] = toComparisonRows([comparison({ playerValue: null, squadValue: 0, verdict: 'NO_DATA' })]);
    expect(row.playerWidth).toBe(0);
    expect(row.squadWidth).toBe(0);
    expect(row.player).toBe('—');
  });

  it('ordena las zonas con más acciones y calcula su porcentaje', () => {
    const zones = topZones({
      cells: [{ row: 1, col: 2, count: 2 }, { row: 2, col: 3, count: 6 }, { row: 3, col: 5, count: 2 }],
      zonedEvents: 10, unzonedEvents: 4, matchesWithZones: 2,
    }, 2);
    expect(zones.map(z => z.label)).toEqual(['C3', 'I2']);
    expect(zones[0].percent).toBe(60);
  });

  it('sin acciones con zona no hay zonas destacadas', () => {
    expect(topZones({ cells: [], zonedEvents: 0, unzonedEvents: 3, matchesWithZones: 0 })).toEqual([]);
  });

  it('el resultado se lee desde el club, que siempre es local', () => {
    expect(matchResult({ homeScore: 20, awayScore: 10 })).toBe('win');
    expect(matchResult({ homeScore: 3, awayScore: 10 })).toBe('loss');
    expect(matchResult({ homeScore: 7, awayScore: 7 })).toBe('draw');
  });

  it('deja afuera lesiones y cambios, que no son acciones de juego', () => {
    const groups = toActionGroups([
      { code: 'INJURY', name: 'Lesión', groupName: 'Neutro', count: 1, made: null },
      { code: 'PENALTY_CONCEDED', name: 'Penal / Infracción', groupName: 'Neutro', count: 2, made: null },
    ]);
    expect(groups).toEqual([{ title: 'Disciplina', rows: [{ name: 'Penales cometidos', value: '2' }] }]);
  });

  it('agrupa las acciones por grupo y muestra aciertos en los pateos', () => {
    const groups = toActionGroups([
      { code: 'CARRY', name: 'Acarreo', groupName: 'Ataque', count: 2, made: null },
      { code: 'CONVERSION', name: 'Conversión', groupName: 'Puntuación', count: 3, made: 2 },
      { code: 'PASS_OFFLOAD', name: 'Pase', groupName: 'Ataque', count: 5, made: null },
    ]);
    expect(groups.map(g => g.title)).toEqual(['Ataque', 'Puntos y pateo']);
    expect(groups[0].rows.map(r => r.name)).toEqual(['Pase', 'Acarreo']);
    expect(groups[1].rows[0].value).toBe('2 de 3');
  });
});
