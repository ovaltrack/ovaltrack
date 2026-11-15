import { advancedBars, indicatorBars, measurementBars, playerActionBars, scoreBars } from './bar-presentation';
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

const matchStats = (overrides: Partial<MatchStatistics> = {}): MatchStatistics => ({
  view: 'full',
  score: { own: 19, opponent: 5 },
  ownPossessionPercentage: 61.5,
  groups: [{ name: 'Puntuación', types: [tryStat, conversionStat] }],
  derived: [],
  ...overrides,
});

describe('scoreBars', () => {
  const charts = scoreBars(matchStats(), names);

  it('el orden es posesión, tantos y puntos: los puntos salen de los tantos', () => {
    expect(charts.map(chart => chart.id)).toEqual(['possession', 'score', 'points']);
  });

  it('los tantos con intentos miden los intentos en el carril y los convertidos en la barra', () => {
    const conversion = charts.find(chart => chart.id === 'score')?.groups[1];
    expect(conversion?.values.map(value => [value.value, value.of, value.display])).toEqual([[2, 3, '2/3'], [0, 1, '0/1']]);
  });

  it('arranca con la posesión sobre 0–100: la propia y el complemento para el rival', () => {
    expect(charts[0].id).toBe('possession');
    expect(charts[0].unit).toBe('percent');
    expect(charts[0].max).toBe(100);
    expect(charts[0].groups[0].values.map(value => [value.value, value.display])).toEqual([[61.5, '61.5%'], [38.5, '38.5%']]);
  });

  it('compara los puntos de cada equipo por tipo de tanto', () => {
    const points = charts.find(chart => chart.id === 'points');
    expect(points?.groups.map(group => [group.label, group.values[0].value, group.values[1].value])).toEqual([
      ['Try', 15, 5],
      ['Conversión', 4, 0],
    ]);
  });

  it('muestra cada tanto con convertidos/intentos y sin perder los tipos en cero', () => {
    const score = charts.find(chart => chart.id === 'score');
    expect(score?.groups.map(group => group.label)).toEqual(['Try', 'Conversión']);
    expect(score?.groups[1].values[0].display).toBe('2/3');
  });

  it('sin puntos no hay gráfico de puntos', () => {
    const quiet = scoreBars(matchStats({ groups: [{ name: 'Puntuación', types: [{ ...tryStat, points: null }] }] }), names);

    expect(quiet.map(chart => chart.id)).toEqual(['possession', 'score']);
  });
});

describe('indicatorBars', () => {
  const metric = (overrides: Partial<DerivedMetric>): DerivedMetric => ({
    id: 'm', label: 'Métrica', format: 'percent', value: { own: 70, opponent: null }, status: null, ...overrides,
  });

  it('junta todos los porcentajes en un eje de 0 a 100 y muestra «—» donde un equipo no tiene dato', () => {
    const card = indicatorBars([
      metric({ id: 'a', label: 'Efectividad de tackle', value: { own: 85, opponent: 70 } }),
      metric({ id: 'b', label: 'Lineout', value: { own: 70, opponent: null } }),
    ], names);

    expect(card.charts.length).toBe(1);
    expect(card.charts[0].unit).toBe('percent');
    expect(card.charts[0].groups.map(group => group.label)).toEqual(['Efectividad de tackle', 'Lineout']);
    expect(card.charts[0].groups[1].values.map(value => [value.value, value.display])).toEqual([[70, '70%'], [null, '—']]);
    expect(card.rest).toEqual([]);
  });

  it('deja como fila los saldos y los porcentajes sin dato de ningún equipo', () => {
    const card = indicatorBars([
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

describe('advancedBars', () => {
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
  const sectionOf = (id: string, value = advanced()) => presentAdvancedStatistics(value).find(section => section.id === id)!;
  const cardOf = (id: string, value = advanced()) => advancedBars(sectionOf(id, value), names);

  it('ningún gráfico se titula igual que su tarjeta', () => {
    const full = advanced({
      trySources: [{ key: 'SCRUM', own: 1, opponent: 1 }],
      turnoverPossessions: { own: 2, opponent: 1 },
      pointsFromTurnovers: { own: 5, opponent: 0 },
      penaltiesByTerritory: { ownHalf: { own: 2, opponent: 1 }, opponentHalf: zero, withoutZone: zero },
      scoreByBlock: [{ fromMinute: 0, toMinute: 10, own: 5, opponent: 0 }, { fromMinute: 10, toMinute: 20, own: 0, opponent: 3 }],
    });
    const repeated = presentAdvancedStatistics(full)
      .filter(section => advancedBars(section, names).charts.some(chart => chart.title === section.title))
      .map(section => section.id);
    expect(repeated).toEqual([]);
  });

  it('posesiones: «Cómo terminan» y «Cantidad de posesiones»', () => {
    expect(cardOf('possessions').charts.map(chart => chart.title)).toEqual(['Cómo terminan', 'Cantidad de posesiones']);
  });

  it('posesiones: finales en un gráfico, la cantidad en otro y la tasa como fila', () => {
    const card = cardOf('possessions');

    expect(card.charts.map(chart => chart.id)).toEqual(['possessions-distribution', 'possessions-Posesiones']);
    expect(card.charts[0].groups.map(group => group.label)).toEqual(['Terminan en puntos', 'Terminan en patada']);
    expect(card.rest.map(line => line.label)).toEqual(['Puntos por posesión']);
  });

  it('cada cantidad va en su gráfico, sin etiqueta de fila: así no se mezclan visitas con puntos', () => {
    const card = cardOf('turnovers', advanced({ turnoverPossessions: { own: 2, opponent: 1 }, pointsFromTurnovers: { own: 7, opponent: 0 } }));

    expect(card.charts.map(chart => chart.title)).toEqual(['Posesiones ganadas', 'Puntos conseguidos']);
    expect(card.charts.map(chart => chart.groups.map(group => group.label))).toEqual([[''], ['']]);
    expect(card.charts.map(chart => chart.max)).toEqual([4, 8]);
  });

  it('las cantidades sin datos quedan como fila: nada desaparece', () => {
    const section = sectionOf('discipline');
    const card = advancedBars(section, names);

    expect(card.charts).toEqual([]);
    expect(card.rest).toEqual(section.lines);
  });

  it('puntos cada 10 minutos: columnas en orden de tiempo, incluidos los bloques sin puntos', () => {
    const blocks = Array.from({ length: 8 }, (_, index) => ({ fromMinute: index * 10, toMinute: index * 10 + 10, own: index === 0 ? 0 : 3, opponent: 0 }));
    const card = cardOf('score-blocks', advanced({ scoreByBlock: blocks }));

    expect(card.charts.length).toBe(1);
    expect(card.charts[0].orientation).toBe('vertical');
    expect(card.charts[0].groups.map(group => group.label)).toEqual(["0'–10'", "10'–20'", "20'–30'", "30'–40'", "40'–50'", "50'–60'", "60'–70'", "70'–80'"]);
    expect(card.charts[0].groups[0].values[0].display).toBe('0');
  });

  it('el reparto por categorías usa barras horizontales', () => {
    expect(cardOf('possessions').charts[0].orientation).toBe('horizontal');
  });
});

describe('measurementBars', () => {
  const group = presentGroups([{ name: 'Defensa', types: [tackleStat] }], { includePoints: true })[0];

  it('un gráfico con la cantidad de cada tipo y uno por desglose', () => {
    const card = measurementBars(group, names);

    expect(card.charts.map(chart => chart.id)).toEqual(['Defensa-types', 'tackle-Resultado']);
    expect(card.charts[0].groups.map(item => [item.label, item.values[0].value, item.values[1].value])).toEqual([['Tackle', 10, 4]]);
    expect(card.charts[1].title).toBe('Tackle · Resultado');
    expect(card.charts[1].groups.map(item => item.label)).toEqual(['Completado', 'Errado', 'Sin completar']);
  });

  it('un tipo con intentos pero ningún acierto queda como fila', () => {
    const failed = stat({ eventTypeId: 'f', name: 'Patada', count: { own: 2, opponent: 0 }, made: zero, hasAttempts: true });
    const card = measurementBars(presentGroups([{ name: 'Pateo', types: [failed] }], { includePoints: false })[0], names);

    expect(card.charts).toEqual([]);
    expect(card.rest.map(line => [line.label, line.own])).toEqual([['Patada', '0/2']]);
  });

  it('los totales y promedios de campos numéricos quedan como fila', () => {
    const withPoints = presentGroups([{ name: 'Puntuación', types: [tryStat] }], { includePoints: true })[0];

    expect(measurementBars(withPoints, names).rest.map(line => line.label)).toEqual(['Puntos']);
  });
});

describe('playerActionBars', () => {
  const column = (code: string, groupName: string, hasAttempts = false): PlayerStatColumn => ({
    eventTypeId: code, code, label: code, groupName, isScoring: false, hasAttempts,
  });
  const columns = [column('TACKLE', 'Defensa'), column('MISS', 'Defensa'), column('KICK', 'Pateo', true), column('RUCK', 'Ataque')];
  const player = (values: PlayerStatistic['values']): PlayerStatistic => ({
    playerId: 'p', jerseyNumber: 9, playerName: 'Jugador', isStarter: true, minutesPlayed: 80, totalPoints: 0, values, hasActivity: true,
  });

  it('un gráfico por grupo con acciones, con acertados/intentos en los pateos', () => {
    const charts = playerActionBars(columns, player({ TACKLE: { count: 5, made: null }, KICK: { count: 3, made: 2 } }));

    expect(charts.map(chart => chart.title)).toEqual(['Defensa', 'Pateo']);
    expect(charts[1].groups[0].values[0].display).toBe('2/3');
  });

  it('ordena de la acción que más hizo a la que menos', () => {
    const charts = playerActionBars(columns, player({ TACKLE: { count: 2, made: null }, MISS: { count: 5, made: null } }));

    expect(charts[0].groups.map(group => group.label)).toEqual(['MISS', 'TACKLE']);
  });

  it('un jugador sin acciones no tiene gráficos', () => {
    expect(playerActionBars(columns, player({}))).toEqual([]);
  });
});
