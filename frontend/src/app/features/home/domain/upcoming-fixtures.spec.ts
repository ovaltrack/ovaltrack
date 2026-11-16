import { Match } from '../../match/types/match.types';
import { upcomingFixtures } from './upcoming-fixtures';

describe('upcomingFixtures', () => {
  const now = new Date(2026, 10, 16, 10, 0);
  const match = (id: string, date: string, status: Match['status'] = 'not_started', alias = 'Draig Goch'): Match => ({
    id, date, divisionId: 'd1', status, currentPeriod: 1, clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL',
    homeScore: 0, awayScore: 0, opponent: { id: 'o', name: alias, alias, city: null }
  });

  it('sin partidos por jugar devuelve una lista vacía', () => {
    expect(upcomingFixtures([match('f', '2026-11-01T15:00:00', 'finished')], now, null)).toEqual([]);
  });

  it('devuelve hasta 3, el más cercano primero, con día, mes, rival corto y hora de 24 h', () => {
    const rows = upcomingFixtures([
      match('c', '2026-12-05T15:30:00'), match('a', '2026-11-21T15:30:00'), match('b', '2026-11-28T09:05:00'), match('d', '2026-12-12T15:00:00')
    ], now, { starters: 15, substitutes: 8 });
    expect(rows.map(row => row.matchId)).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toEqual(jasmine.objectContaining({ day: 21, month: 'nov', when: 'Sábado · 15:30', rosterChip: null }));
    expect(rows[1].when).toBe('Sábado · 09:05');
  });

  it('el chip de nómina es solo del primero y solo si está incompleta', () => {
    const matches = [match('a', '2026-11-21T15:30:00'), match('b', '2026-11-28T15:30:00', 'empty_roster')];
    const rows = upcomingFixtures(matches, now, { starters: 15, substitutes: 6 });
    expect(rows[0].rosterChip).toBe('Suplentes 6/8');
    expect(rows[0].ariaLabel).toContain('nómina: Suplentes 6/8');
    expect(rows[1].rosterChip).toBeNull();
  });

  it('un primer partido sin nómina dice «Sin nómina»; con nómina ilegible no acusa nada', () => {
    expect(upcomingFixtures([match('a', '2026-11-21T15:30:00', 'empty_roster')], now, null)[0].rosterChip).toBe('Sin nómina');
    expect(upcomingFixtures([match('a', '2026-11-21T15:30:00')], now, null)[0].rosterChip).toBeNull();
  });
});
