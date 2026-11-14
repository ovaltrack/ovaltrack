import { computeMatchStatistics } from './match-statistics-calculator';
import { EventTypeStat, MatchStatistics } from '../types/statistic.types';
import { buildEventType, buildLocalEvent } from '../../../../testing/offline-test-helpers';
import { LocalMatchEvent } from '../../types/event.types';

const conversion = buildEventType({
  id: 'conversion', code: 'CONVERSION', name: 'Conversión', groupName: 'Puntuación', isScoring: true, points: 2,
  actor: 'ATTACKING', statView: ['basic', 'intermediate'],
  templateEventFields: [
    { key: 'wasSuccessful', label: 'Resultado', type: 'boolean', phase: 'live', required: true, effects: ['scoring'] },
    { key: 'distanceMeters', label: 'Distancia (m)', type: 'number', phase: 'post', required: false, min: 0, max: 80 },
  ],
});
const lineout = buildEventType({
  id: 'lineout', code: 'LINEOUT', name: 'Line-out', groupName: 'Juego Fijo', actor: 'ATTACKING',
  statView: ['intermediate'],
  templateEventFields: [
    {
      key: 'lineResult', label: 'Resultado', type: 'select', phase: 'live', required: true,
      options: [{ value: 'won_clean', label: 'Ganado limpio' }, { value: 'penalty_against', label: 'Penal en contra' }],
    },
    { key: 'isMaulFormed', label: 'Generó Maul', type: 'boolean', phase: 'post', required: false },
  ],
});
const tackleMade = buildEventType({
  id: 'tackle-made', code: 'TACKLE_MADE', name: 'Tackle completado', groupName: 'Defensa', actor: 'DEFENDING', statView: [],
});
const tackleMissed = buildEventType({
  id: 'tackle-missed', code: 'TACKLE_MISSED', name: 'Tackle fallado', groupName: 'Defensa', actor: 'DEFENDING', statView: [],
});
const penalty = buildEventType({
  id: 'penalty', code: 'PENALTY_CONCEDED', name: 'Penal', groupName: 'Neutro', actor: 'CHOOSE',
  statView: ['basic', 'intermediate'],
});
const types = [conversion, lineout, tackleMade, tackleMissed, penalty];

let sequence = 0;
const event = (overrides: Partial<LocalMatchEvent>): LocalMatchEvent => {
  sequence++;
  return buildLocalEvent({ id: `e-${sequence}`, clientEventId: `e-${sequence}`, localSequence: sequence, ...overrides });
};

const typeStat = (stats: MatchStatistics, code: string): EventTypeStat | undefined =>
  stats.groups.flatMap(group => group.types).find(type => type.code === code);

describe('computeMatchStatistics', () => {
  const events = [
    event({ eventTypeId: 'conversion', teamPossession: 'OWN', attributes: { wasSuccessful: true, distanceMeters: 20 } }),
    event({ eventTypeId: 'conversion', teamPossession: 'OWN', attributes: { wasSuccessful: false, distanceMeters: 40 } }),
    event({ eventTypeId: 'conversion', teamPossession: 'OPPONENT', attributes: { wasSuccessful: true } }),
    event({ eventTypeId: 'lineout', teamPossession: 'OWN', attributes: { lineResult: 'won_clean', isMaulFormed: true } }),
    event({ eventTypeId: 'lineout', teamPossession: 'OPPONENT', attributes: { lineResult: 'penalty_against' } }),
    event({ eventTypeId: 'lineout', teamPossession: 'OWN', attributes: {} }),
    // teamPossession guarda el equipo que ejecutó la acción: tackles propios.
    event({ eventTypeId: 'tackle-made', teamPossession: 'OWN' }),
    event({ eventTypeId: 'tackle-made', teamPossession: 'OWN' }),
    event({ eventTypeId: 'tackle-missed', teamPossession: 'OWN' }),
    event({ eventTypeId: 'penalty', teamPossession: 'OWN' }),
  ];

  it('solo incluye en las vistas en vivo los tipos marcados en statView, agrupados por groupName', () => {
    const basic = computeMatchStatistics(events, types, 'basic');
    const intermediate = computeMatchStatistics(events, types, 'intermediate');
    const full = computeMatchStatistics(events, types, 'full');

    expect(basic.groups.map(group => group.name)).toEqual(['Puntuación', 'Neutro']);
    expect(intermediate.groups.map(group => group.name)).toEqual(['Puntuación', 'Juego Fijo', 'Neutro']);
    expect(full.groups.map(group => [group.name, group.types.map(type => type.code)])).toEqual([
      ['Puntuación', ['CONVERSION']],
      ['Juego Fijo', ['LINEOUT']],
      ['Defensa', ['TACKLE_MADE', 'TACKLE_MISSED']],
      ['Neutro', ['PENALTY_CONCEDED']],
    ]);
  });

  it('cuenta intentos, convertidos y puntos de los tipos que suman, y el marcador con todos ellos', () => {
    const stats = computeMatchStatistics(events, types, 'intermediate');
    const stat = typeStat(stats, 'CONVERSION');

    expect(stat?.count).toEqual({ own: 2, opponent: 1 });
    expect(stat?.made).toEqual({ own: 1, opponent: 1 });
    expect(stat?.points).toEqual({ own: 2, opponent: 2 });
    expect(stat?.hasAttempts).toBeTrue();
    expect(stats.score).toEqual({ own: 2, opponent: 2 });
  });

  it('el marcador suma también los tipos que no están en la vista', () => {
    const hiddenScoring = { ...conversion, statView: [] };
    const stats = computeMatchStatistics(events, [hiddenScoring, penalty], 'basic');

    expect(typeStat(stats, 'CONVERSION')).toBeUndefined();
    expect(stats.score).toEqual({ own: 2, opponent: 2 });
  });

  it('desglosa durante el partido solo los campos live y en el post-partido todos', () => {
    const live = typeStat(computeMatchStatistics(events, types, 'intermediate'), 'LINEOUT');
    const full = typeStat(computeMatchStatistics(events, types, 'full'), 'LINEOUT');

    expect(live?.fields.map(field => field.key)).toEqual(['lineResult']);
    expect(full?.fields.map(field => field.key)).toEqual(['lineResult', 'isMaulFormed']);

    const select = live?.fields[0];
    expect(select?.kind === 'select' && select.options.map(option => [option.value, option.count])).toEqual([
      ['won_clean', { own: 1, opponent: 0 }],
      ['penalty_against', { own: 0, opponent: 1 }],
    ]);
    expect(select?.kind === 'select' && select.pending).toEqual({ own: 1, opponent: 0 });

    const maul = full?.fields[1];
    expect(maul?.kind === 'boolean' && maul.yes).toEqual({ own: 1, opponent: 0 });
  });

  it('no desglosa el campo de efecto scoring (ya está en convertidos) y totaliza los numéricos', () => {
    const stat = typeStat(computeMatchStatistics(events, types, 'full'), 'CONVERSION');

    expect(stat?.fields.map(field => field.key)).toEqual(['distanceMeters']);
    const distance = stat?.fields[0];
    expect(distance?.kind === 'number' && distance.total).toEqual({ own: 60, opponent: null });
    expect(distance?.kind === 'number' && distance.average).toEqual({ own: 30, opponent: null });
  });

  it('un tipo dado de baja solo aparece si tiene eventos', () => {
    const retired = buildEventType({ id: 'retired', code: 'RETIRED', name: 'Viejo', groupName: 'Neutro', isActive: false, statView: ['basic'] });

    const withoutEvents = computeMatchStatistics(events, [...types, retired], 'basic');
    const withEvents = computeMatchStatistics(
      [...events, event({ eventTypeId: 'retired', teamPossession: 'OWN' })], [...types, retired], 'basic',
    );

    expect(typeStat(withoutEvents, 'RETIRED')).toBeUndefined();
    expect(typeStat(withEvents, 'RETIRED')?.count).toEqual({ own: 1, opponent: 0 });
  });
});
