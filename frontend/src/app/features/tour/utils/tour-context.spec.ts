import { Match } from '../../match/types/match.types';
import { pickTourContext } from './tour-context';

const match = (id: string, status: Match['status'], date: string, divisionId = 'd1'): Match => ({
  id, status, date, divisionId,
  opponent: { id: 'o1', name: 'Rival', alias: 'RIV', city: null },
  currentPeriod: 1, clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'OWN', homeScore: 0, awayScore: 0
});

describe('pickTourContext', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');

  it('elige el último finalizado, el en curso y el próximo más cercano', () => {
    const context = pickTourContext([
      match('f-old', 'finished', '2026-10-01T15:00:00Z'),
      match('f-new', 'finished', '2026-11-08T15:00:00Z'),
      match('live', 'in_progress', '2026-11-14T11:00:00Z'),
      match('up-far', 'not_started', '2026-12-20T15:00:00Z'),
      match('up-near', 'not_started', '2026-11-21T15:00:00Z'),
      match('cancel', 'cancelled', '2026-11-15T15:00:00Z')
    ], 'd1', now);

    expect(context).toEqual({
      divisionId: 'd1', upcomingMatchId: 'up-near', liveMatchId: 'live', finishedMatchId: 'f-new'
    });
  });

  it('prefiere un próximo con nómina antes que uno sin convocar', () => {
    const context = pickTourContext([
      match('empty', 'empty_roster', '2026-11-15T15:00:00Z'),
      match('ready', 'not_started', '2026-11-28T15:00:00Z')
    ], null, now);
    expect(context.upcomingMatchId).toBe('ready');
  });

  it('el entretiempo cuenta como partido en curso', () => {
    expect(pickTourContext([match('ht', 'halftime', '2026-11-14T11:00:00Z')], null, now).liveMatchId).toBe('ht');
  });

  it('sin división pedida usa la del partido finalizado', () => {
    const context = pickTourContext([match('f', 'finished', '2026-11-08T15:00:00Z', 'd9')], null, now);
    expect(context.divisionId).toBe('d9');
  });

  it('sin partidos deja todo en null', () => {
    expect(pickTourContext([], null, now)).toEqual({
      divisionId: null, upcomingMatchId: null, liveMatchId: null, finishedMatchId: null
    });
  });
});
