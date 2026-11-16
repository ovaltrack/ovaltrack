import { CoverageEvent, activeTypeIdsOf, coveragePercent, isUnassignedEvent, reviewCoverage, reviewableEvents } from './review-coverage';

describe('review-coverage', () => {
  const event = (eventTypeId: string, playerId: string | null, teamPossession: CoverageEvent['teamPossession']): CoverageEvent => ({ eventTypeId, playerId, teamPossession });

  /** 10 eventos: 6 propios con jugador, 2 propios sin jugador (uno de un tipo inactivo), 1 rival y 1 neutral sin jugador. */
  const events = [
    ...Array.from({ length: 6 }, () => event('activo', 'p1', 'OWN')),
    event('activo', null, 'OWN'),
    event('baja', null, 'OWN'),
    event('activo', null, 'OPPONENT'),
    event('activo', '', 'NEUTRAL')
  ];
  const active = new Set(['activo']);

  it('sin jugador: sin playerId (o vacío) y posesión distinta de OPPONENT', () => {
    expect(isUnassignedEvent({ playerId: null, teamPossession: 'OWN' })).toBeTrue();
    expect(isUnassignedEvent({ playerId: '  ', teamPossession: 'NEUTRAL' })).toBeTrue();
    expect(isUnassignedEvent({ playerId: null, teamPossession: 'OPPONENT' })).toBeFalse();
    expect(isUnassignedEvent({ playerId: 'p1', teamPossession: 'OWN' })).toBeFalse();
  });

  it('con un tipo inactivo en el partido: 9 eventos, 2 sin jugador, 78 %', () => {
    expect(reviewCoverage(events, active)).toEqual({ totalEvents: 9, unassigned: 2, percent: 78 });
  });

  it('con todos los tipos activos: 10 eventos, 3 sin jugador, 70 %', () => {
    expect(reviewCoverage(events, new Set(['activo', 'baja']))).toEqual({ totalEvents: 10, unassigned: 3, percent: 70 });
  });

  it('sin catálogo no se filtra nada', () => {
    expect(reviewCoverage(events, null).percent).toBe(70);
    expect(activeTypeIdsOf([])).toBeNull();
  });

  it('activeTypeIdsOf descarta los inactivos', () => {
    expect([...activeTypeIdsOf([{ id: 'a', isActive: true }, { id: 'b', isActive: false }, { id: 'c' }])!]).toEqual(['a', 'c']);
  });

  it('reviewableEvents no muta la lista original', () => {
    expect(reviewableEvents(events, active).length).toBe(9);
    expect(events.length).toBe(10);
  });

  it('un partido sin eventos cuenta como 100 %, y el 145 de 438 da 67 %', () => {
    expect(reviewCoverage([], active).percent).toBe(100);
    expect(coveragePercent(438, 145)).toBe(67);
  });
});
