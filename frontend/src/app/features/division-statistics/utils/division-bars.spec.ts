import { DIVISION_METRICS, DivisionMetricDef } from './division-metrics';
import { matchBars, opponentAcronym } from './division-bars';
import { PeriodStatisticDTO } from '../../match/statistics/types/statistic.types';

const stats = (values: Partial<PeriodStatisticDTO>) => values as PeriodStatisticDTO;
const metric = (id: string): DivisionMetricDef => DIVISION_METRICS.find(candidate => candidate.id === id)!;
const labels = ['10/05', '17/05'];
const details = ['10/05/2026 · vs Rival A', '17/05/2026 · vs Rival B'];

describe('opponentAcronym', () => {
  it('con varias palabras, sus iniciales (sin «Club», «Rugby Club» ni conectores)', () => {
    expect(opponentAcronym('Deportivo Portugués')).toBe('DP');
    expect(opponentAcronym('Puerto Madryn Rugby Club')).toBe('PM');
    expect(opponentAcronym('Club Atlético de San Isidro')).toBe('ASI');
  });

  it('con una palabra, sus tres primeras letras, en mayúsculas y sin tildes', () => {
    expect(opponentAcronym('Patoruzú Rugby Club')).toBe('PAT');
    expect(opponentAcronym('Ñandúes')).toBe('NAN');
  });

  it('es estable y sin rival no hay sigla', () => {
    expect(opponentAcronym('Deportivo Portugués')).toBe(opponentAcronym('Deportivo Portugués'));
    expect(opponentAcronym(null)).toBe('');
  });
});

describe('matchBars', () => {
  it('cada grupo lleva la sigla del rival debajo de la fecha', () => {
    const chart = matchBars(metric('points'), [stats({ ownScore: 1, opponentScore: 2 }), stats({})], labels, details, ['DP', 'PAT']);
    expect(chart.groups.map(group => [group.label, group.sublabel])).toEqual([[labels[0], 'DP'], [labels[1], 'PAT']]);
  });

  it('un grupo de columnas por partido, en el orden recibido, con su fecha y rival de detalle', () => {
    const chart = matchBars(metric('points'), [stats({ ownScore: 20, opponentScore: 10 }), stats({ ownScore: 15, opponentScore: 5 })], labels, details);

    expect(chart.orientation).toBe('vertical');
    expect(chart.groups.map(group => [group.label, group.detail])).toEqual([[labels[0], details[0]], [labels[1], details[1]]]);
    expect(chart.groups[0].values.map(value => [value.series, value.value])).toEqual([['A favor', 20], ['En contra', 10]]);
  });

  it('usa los mismos colores que las líneas de la evolución y los pone en la leyenda', () => {
    const chart = matchBars(metric('points'), [stats({ ownScore: 1, opponentScore: 2 })], ['10/05'], ['d']);
    const colors = metric('points').series.map(serie => serie.color);

    expect(chart.groups[0].values.map(value => value.color)).toEqual(colors);
    expect(chart.legend).toEqual([{ label: 'A favor', color: colors[0] }, { label: 'En contra', color: colors[1] }]);
  });

  it('las cantidades comparten una escala redondeada sobre el mayor valor del rango', () => {
    const chart = matchBars(metric('points'), [stats({ ownScore: 33, opponentScore: 10 }), stats({ ownScore: 5, opponentScore: 3 })], labels, details);

    expect(chart.unit).toBe('count');
    expect(chart.max).toBe(40);
  });

  it('los porcentajes van de 0 a 100 con el símbolo, y un partido sin dato no tiene columna', () => {
    const chart = matchBars(metric('scrum-effectiveness'), [
      stats({ ownScrumsWon: 3, ownScrumsLost: 1 }),
      stats({ ownScrumsWon: 0, ownScrumsLost: 0 }),
    ], labels, details);

    expect(chart.unit).toBe('percent');
    expect(chart.max).toBe(100);
    expect(chart.groups[0].values[0]).toEqual(jasmine.objectContaining({ value: 75, display: '75%' }));
    expect(chart.groups[1].values[0]).toEqual(jasmine.objectContaining({ value: null, display: '—' }));
  });

  it('una métrica en cero en todo el rango sigue siendo un dato, no «sin datos»', () => {
    const chart = matchBars(metric('cards'), [stats({ ownYellowCards: 0, ownRedCards: 0 })], ['10/05'], ['d']);

    expect(chart.groups[0].values.map(value => value.display)).toEqual(['0', '0']);
    expect(chart.max).toBe(4);
  });

  it('sin partidos no hay grupos', () => {
    expect(matchBars(metric('tries'), [], [], []).groups).toEqual([]);
  });
});
