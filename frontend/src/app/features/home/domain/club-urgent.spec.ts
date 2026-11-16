import { Match } from '../../match/types/match.types';
import { PrimaryAction } from '../types/home.types';
import { ClubUrgentContext, urgentOf } from './club-urgent';

describe('club-urgent', () => {
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-07T14:30:00', divisionId: 'd1', status: 'not_started', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }, ...overrides
  });
  const action = (kind: PrimaryAction['kind'], route: string): PrimaryAction => ({ kind, label: 'x', route, target: 'board', requiresConnection: true });
  const context = (overrides: Partial<ClubUrgentContext> = {}): ClubUrgentContext => ({
    now: new Date(2026, 10, 6, 18, 0), divisions: [{ id: 'd1', name: 'Superior' }, { id: 'd2', name: 'M15' }], matches: [match({})], rosters: {}, ...overrides
  });

  it('sin acción no hay urgencia', () => {
    expect(urgentOf(null, context())).toBeNull();
  });

  it('alineación pendiente: división, rival, cuándo y qué falta', () => {
    const ctx = context({ rosters: { m1: { starters: 15, substitutes: 5 } } });
    expect(urgentOf(action('define-lineup', '/selection-roster/m1'), ctx)).toEqual({
      title: 'Falta la alineación de Superior', detail: 'vs Trelew · Sáb 7 nov · mañana · 14:30 · Suplentes 5/8'
    });
  });

  it('división sin entrenador', () => {
    expect(urgentOf(action('assign-coach', '/divisions/d2/coaches'), context())).toEqual({ title: 'M15 no tiene entrenador', detail: 'Nadie puede capturar sus partidos.' });
  });

  it('un partido o una división que no se encuentran no inventan una explicación', () => {
    expect(urgentOf(action('define-lineup', '/selection-roster/zzz'), context())).toBeNull();
    expect(urgentOf(action('assign-coach', '/divisions/zzz/coaches'), context())).toBeNull();
  });

  it('las demás acciones no se explican en la agenda', () => {
    expect(urgentOf(action('schedule-match', '/match-selection'), context())).toBeNull();
  });
});
