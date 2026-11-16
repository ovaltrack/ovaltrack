import { Match } from '../../match/types/match.types';
import { buildAdminBoard } from './admin-board';

describe('admin-board', () => {
  const now = new Date(2026, 10, 6, 18, 0);
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-07T14:30:00', divisionId: 'd1', status: 'not_started', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }, ...overrides
  });
  const divisions = [{ id: 'd1', name: 'Superior', hasCoach: true }];

  it('sin divisiones: crear la primera', () => {
    expect(buildAdminBoard({ now, divisions: [], matches: [], rosters: {} })).toEqual({ kind: 'onboarding', step: 'create-division' });
  });

  it('con divisiones y sin partidos: programar el primero', () => {
    expect(buildAdminBoard({ now, divisions, matches: [], rosters: {} })).toEqual({ kind: 'onboarding', step: 'schedule-match' });
  });

  it('los partidos cancelados no cuentan', () => {
    expect(buildAdminBoard({ now, divisions, matches: [match({ status: 'cancelled' })], rosters: {} })).toEqual({ kind: 'onboarding', step: 'schedule-match' });
  });

  it('con partidos arma la agenda del club', () => {
    expect(buildAdminBoard({ now, divisions, matches: [match({})], rosters: {} }).kind).toBe('club-agenda');
  });
});
