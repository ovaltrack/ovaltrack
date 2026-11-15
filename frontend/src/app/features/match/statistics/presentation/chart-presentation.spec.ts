import { advancedCard, indicatorCard, measurementCard, opponentPossessionOf, playerActionCharts, scoreCard } from './chart-presentation';
import { presentAdvancedStatistics } from './advanced-presentation';
import { presentGroups } from './stat-presentation';
import {
  AdvancedPeriodStatistics,
  DerivedMetric,
  EventTypeStat,
  MatchStatistics,
  PlayerStatColumn,
  PlayerStatistic,
} from '../types/statistic.types';

const names = { own: 'Club', opponent: 'Rival' };
const zero = { own: 0, opponent: 0 };

const stat = (overrides: Partial<EventTypeStat>): EventTypeStat => ({
  eventTypeId: 'id', code: 'CODE', name: 'Tipo', isScoring: false, count: zero, made: null, points: null,
  hasAttempts: false, fields: [], ...overrides,
});

const tryStat = stat({
  eventTypeId: 'try', code: 'TRY', name: 'Try', isScoring: true,
  count: { own: 3, opponent: 1 }, points: { own: 15, opponent: 5 },
});
const conversionStat = stat({
  eventTypeId: 'conv', code: 'CONVERSION', name: 'Conversión', isScoring: true, hasAttempts: true,
  count: { own: 3, opponent: 1 }, made: { own: 2, opponent: 0 }, points: { own: 4, opponent: 0 },
});
const tackleStat = stat({
  eventTypeId: 'tackle', code: 'TACKLE', name: 'Tackle', count: { own: 10, opponent: 4 },
  fields: [{
    kind: 'select', key: 'result', label: 'Resultado', pending: { own: 1, opponent: 0 },
    options: [
      { value: 'ok', label: 'Completado', count: { own: 8, opponent: 4 } },
      { value: 'miss', label: 'Errado', count: { own: 1, opponent: 0 } },
    ],
  }],
});

const matchStats = (): MatchStatistics => ({
  view: 'full',
  score: { own: 19, opponent: 5 },
  ownPossessionPercentage: 61.5,
  groups: [{ name: 'Puntuación', types: [tryStat, conversionStat] }],
  derived: [],
});

describe('scoreCard', () => {
  const charts = scoreCard(matchStats(), names).charts;

  it('arranca con la posesión: la propia al centro y el complemento para el rival', () => {
    expect(charts[0].id).toBe('possession');
    expect(charts[0].center.value).toBe('61.5%');
    expect(charts[0].slices.map(slice => slice.value)).toEqual([61.5, 38.5]);
  });

  it('no repite el porcentaje en la leyenda de la posesión: el valor ya lo es', () => {
    expect(charts[0].showPercent).toBeFalse();
    expect(charts[1].showPercent).toBeUndefined();
  });

  it('reparte los puntos de cada equipo por tipo de tanto, solo del equipo que tiene puntos', () => {
    const own = charts.find(chart => chart.id === 'points-own');
    const rival = charts.find(chart => chart.id === 'points-rival');
    expect(own?.slices.map(slice => [slice.label, slice.value])).toEqual([['Try', 15], ['Conversión', 4]]);
    expect(own?.title).toBe('Puntos');
    expect(own?.team).toEqual({ name: 'Club', color: 'var(--btn-primary-bg)' });
    expect(rival?.team?.name).toBe('Rival');
    expect(rival?.slices.map(slice => [slice.label, slice.value])).toEqual([['Try', 5]]);
  });

  it('suma una dona versus por tanto, con convertidos/intentos en la leyenda', () => {
    const conversion = charts.find(chart => chart.id === 'score-Conversión');
    expect(conversion?.slices[0].display).toBe('2/3');
    expect(conversion?.max).toBe(2);
  });

  it('los tantos con intentos muestran al centro convertidos sobre intentos de los dos equipos', () => {
    const conversion = charts.find(chart => chart.id === 'score-Conversión');
    expect(conversion?.center).toEqual({ value: '2/4', label: 'convertidos' });
  });

  it('los tantos sin intentos muestran «propio – rival»', () => {
    expect(charts.find(chart => chart.id === 'score-Try')?.center).toEqual({ value: '3 – 1', label: 'propio – rival' });
  });

  describe('tantos con intentos pero sin aciertos', () => {
    const dropStat = stat({
      eventTypeId: 'drop', code: 'DROP_GOAL', name: 'Drop goal', isScoring: true, hasAttempts: true,
      count: { own: 1, opponent: 0 }, made: zero, points: zero,
    });
    const penaltyTryStat = stat({
      eventTypeId: 'ptry', code: 'PENALTY_TRY', name: 'Try penal', isScoring: true, count: zero, points: zero,
    });
    const card = scoreCard({ ...matchStats(), groups: [{ name: 'Puntuación', types: [tryStat, dropStat, penaltyTryStat] }] }, names);

    it('quedan como fila con «convertidos/intentos»: no desaparecen al cambiar de vista', () => {
      expect(card.rest.map(line => [line.label, line.own, line.opponent])).toEqual([['Drop goal', '0/1', '0/0']]);
      expect(card.charts.some(chart => chart.id === 'score-Drop goal')).toBeFalse();
    });

    it('los que no tuvieron ningún intento no aparecen', () => {
      expect(card.charts.some(chart => chart.title === 'Try penal')).toBeFalse();
      expect(card.rest.some(line => line.label === 'Try penal')).toBeFalse();
    });

    it('los que tienen aciertos siguen como dona', () => {
      expect(card.charts.some(chart => chart.id === 'score-Try')).toBeTrue();
    });
  });
});

describe('opponentPossessionOf', () => {
  it('es el complemento con un decimal y nunca negativo', () => {
    expect(opponentPossessionOf(61.5)).toBe(38.5);
    expect(opponentPossessionOf(100.4)).toBe(0);
  });
});

describe('indicatorCard', () => {
  const metric = (overrides: Partial<DerivedMetric>): DerivedMetric => ({
    id: 'm', label: 'Métrica', format: 'percent', value: { own: 70, opponent: null }, status: null, ...overrides,
  });

  it('grafica un anillo por equipo en los porcentajes, aunque uno no tenga dato', () => {
    const card = indicatorCard([metric({ id: 'tackle-effectiveness', label: 'Efectividad de tackle' })], names);
    expect(card.charts.map(chart => chart.id)).toEqual(['tackle-effectiveness-own', 'tackle-effectiveness-rival']);
    expect(card.charts.map(chart => chart.team?.name)).toEqual(['Club', 'Rival']);
    expect(card.charts[0].title).toBe('Efectividad de tackle');
    expect(card.charts[1].center.value).toBe('—');
    expect(card.rest).toEqual([]);
  });

  it('los dos anillos de un indicador forman un par, propio primero, para que no se separen entre filas', () => {
    const card = indicatorCard([metric({ id: 'scrum' }), metric({ id: 'line' })], names);
    expect(card.charts.map(chart => [chart.group, chart.team?.name])).toEqual([
      ['scrum', 'Club'], ['scrum', 'Rival'], ['line', 'Club'], ['line', 'Rival'],
    ]);
  });

  it('deja como fila los saldos y los porcentajes sin dato de ningún equipo', () => {
    const card = indicatorCard([
      metric({ id: 'balance', label: 'Saldo de penales', format: 'signed', value: { own: 2, opponent: -2 } }),
      metric({ id: 'empty', label: 'Sin dato', value: { own: null, opponent: null } }),
    ], names);
    expect(card.charts).toEqual([]);
    expect(card.rest.map(line => [line.label, line.own, line.opponent])).toEqual([
      ['Saldo de penales', '+2', '-2'],
      ['Sin dato', '—', '—'],
    ]);
  });
});

describe('advancedCard', () => {
  const advanced = (overrides: Partial<AdvancedPeriodStatistics> = {}): AdvancedPeriodStatistics => ({
    period: null,
    possessions: { own: 4, opponent: 2 },
    pointsPerPossession: { own: 1.5, opponent: null },
    possessionOutcomes: [
      { key: 'POINTS', own: 2, opponent: 0 },
      { key: 'KICK', own: 2, opponent: 1 },
    ],
    trySources: [],
    turnoverPossessions: zero,
    pointsFromTurnovers: zero,
    redZone: { available: false, visits: zero, points: zero, pointsPerVisit: { own: null, opponent: null } },
    penaltiesByTerritory: { ownHalf: zero, opponentHalf: zero, withoutZone: zero },
    scoreByBlock: [],
    sinBin: { yellowCards: zero, pointsFor: zero, pointsAgainst: zero },
    ...overrides,
  });

  it('ningún gráfico se titula igual que su tarjeta', () => {
    const full = advanced({
      trySources: [{ key: 'SCRUM', own: 1, opponent: 1 }],
      turnoverPossessions: { own: 2, opponent: 1 },
      pointsFromTurnovers: { own: 5, opponent: 0 },
      penaltiesByTerritory: { ownHalf: { own: 2, opponent: 1 }, opponentHalf: zero, withoutZone: zero },
      scoreByBlock: [{ fromMinute: 0, toMinute: 10, own: 5, opponent: 0 }, { fromMinute: 10, toMinute: 20, own: 0, opponent: 3 }],
    });
    const repeated = presentAdvancedStatistics(full)
      .filter(section => advancedCard(section, names).charts.some(chart => chart.title === section.title))
      .map(section => section.id);
    expect(repeated).toEqual([]);
  });

  it('posesiones: «Cómo terminan» (una dona por equipo) y «Cantidad de posesiones»', () => {
    expect(cardOf('possessions').charts.map(chart => chart.title)).toEqual(['Cómo terminan', 'Cómo terminan', 'Cantidad de posesiones']);
  });

  const cardOf = (id: string, value = advanced()) =>
    advancedCard(presentAdvancedStatistics(value).find(section => section.id === id)!, names);

  it('posesiones: reparto de finales por equipo, cantidad versus y la tasa como fila', () => {
    const card = cardOf('possessions');
    expect(card.charts.map(chart => chart.id)).toEqual([
      'possessions-own', 'possessions-rival', 'possessions-Posesiones',
    ]);
    expect(card.charts[1].slices.map(slice => slice.label)).toEqual(['Terminan en patada']);
    expect(card.rest.map(line => line.label)).toEqual(['Puntos por posesión']);
  });

  it('no repite como fila lo que ya es una dona ni pierde las filas sin datos', () => {
    const card = cardOf('discipline');
    expect(card.charts).toEqual([]);
    expect(card.rest.length).toBe(5);
  });

  it('puntos cada 10 minutos: reparte hasta 8 bloques sin agruparlos en «Otros»', () => {
    const blocks = Array.from({ length: 8 }, (_, index) => ({ fromMinute: index * 10, toMinute: index * 10 + 10, own: 3, opponent: 0 }));
    const card = cardOf('score-blocks', advanced({ scoreByBlock: blocks }));
    expect(card.charts.map(chart => chart.id)).toEqual(['score-blocks-own']);
    expect(card.charts[0].slices.length).toBe(8);
  });

  it('sin datos no hay donas', () => {
    expect(cardOf('try-sources').charts).toEqual([]);
  });
});

describe('measurementCard', () => {
  const group = presentGroups([{ name: 'Defensa', types: [tackleStat] }], { includePoints: true })[0];

  it('una dona versus por tipo y un reparto por equipo para cada desglose', () => {
    const card = measurementCard(group, names);
    expect(card.charts.map(chart => chart.id)).toEqual(['Defensa-Tackle', 'tackle-Resultado-own', 'tackle-Resultado-rival']);
  });

  it('«Sin completar» va en neutro', () => {
    const own = measurementCard(group, names).charts.find(chart => chart.id === 'tackle-Resultado-own');
    expect(own?.slices.at(-1)?.label).toBe('Sin completar');
    expect(own?.slices.at(-1)?.color).toBe('var(--border-strong)');
  });

  it('un tipo con intentos pero ningún acierto queda como fila y no como dona vacía', () => {
    const failed = stat({ eventTypeId: 'f', name: 'Patada', count: { own: 2, opponent: 0 }, made: zero, hasAttempts: true });
    const card = measurementCard(presentGroups([{ name: 'Pateo', types: [failed] }], { includePoints: false })[0], names);
    expect(card.charts).toEqual([]);
    expect(card.rest.map(line => [line.label, line.own])).toEqual([['Patada', '0/2']]);
  });
});

describe('playerActionCharts', () => {
  const column = (code: string, groupName: string, hasAttempts = false): PlayerStatColumn => ({
    eventTypeId: code, code, label: code, groupName, isScoring: false, hasAttempts,
  });
  const columns = [column('TACKLE', 'Defensa'), column('MISS', 'Defensa'), column('KICK', 'Pateo', true), column('RUCK', 'Ataque')];
  const player = (values: PlayerStatistic['values']): PlayerStatistic => ({
    playerId: 'p', jerseyNumber: 9, playerName: 'Jugador', isStarter: true, minutesPlayed: 80, totalPoints: 0, values, hasActivity: true,
  });

  it('una dona por grupo con acciones, mostrando acertados/intentos en los pateos', () => {
    const charts = playerActionCharts(columns, player({
      TACKLE: { count: 5, made: null },
      KICK: { count: 3, made: 2 },
    }));
    expect(charts.map(chart => chart.title)).toEqual(['Defensa', 'Pateo']);
    expect(charts[1].slices[0].display).toBe('2/3');
  });

  it('un jugador sin acciones no tiene donas', () => {
    expect(playerActionCharts(columns, player({}))).toEqual([]);
  });
});
