import { DivisionMatchStatistic } from '../../division-statistics/types/division-statistics.types';
import { focusInputOf } from './focus-series';

describe('focusInputOf', () => {
  const stat = (date: string, overrides: Record<string, number> = {}): DivisionMatchStatistic => ({
    matchId: date, date, opponentName: 'Rival',
    statistics: {
      ownLineoutsWon: 7, ownLineoutsLost: 3, ownTacklesCompleted: 80, ownTacklesMissed: 20, ownTackleEffectiveness: 80,
      ownPenaltiesConceded: 9, ...overrides
    } as DivisionMatchStatistic['statistics']
  });

  it('ordena los partidos del más viejo al más reciente', () => {
    const input = focusInputOf([
      stat('2026-03-10T15:00:00', { ownPenaltiesConceded: 3 }),
      stat('2026-02-10T15:00:00', { ownPenaltiesConceded: 1 }),
      stat('2026-04-10T15:00:00', { ownPenaltiesConceded: 5 })
    ]);
    expect(input.series.penalties).toEqual([1, 3, 5]);
  });

  it('line-out es el % ganado sobre los resueltos, con 1 decimal', () => {
    const input = focusInputOf([stat('2026-02-10T15:00:00', { ownLineoutsWon: 2, ownLineoutsLost: 1 })]);
    expect(input.series.lineout).toEqual([66.7]);
  });

  it('un partido sin line-outs ni tackles no entra en esas series, pero sí en penales', () => {
    const input = focusInputOf([
      stat('2026-02-10T15:00:00'),
      stat('2026-03-10T15:00:00', { ownLineoutsWon: 0, ownLineoutsLost: 0, ownTacklesCompleted: 0, ownTacklesMissed: 0, ownTackleEffectiveness: 0 })
    ]);
    expect(input.series.lineout).toEqual([70]);
    expect(input.series.tackle).toEqual([80]);
    expect(input.series.penalties).toEqual([9, 9]);
  });

  it('lineoutLast es el del último partido con «n de m ganados»', () => {
    const input = focusInputOf([stat('2026-02-10T15:00:00'), stat('2026-03-10T15:00:00', { ownLineoutsWon: 7, ownLineoutsLost: 5 })]);
    expect(input.lineoutLast).toEqual({ won: 7, total: 12 });
  });

  it('lineoutLast es null si el último partido no tuvo line-outs (la nota sería de otro partido)', () => {
    const input = focusInputOf([stat('2026-02-10T15:00:00'), stat('2026-03-10T15:00:00', { ownLineoutsWon: 0, ownLineoutsLost: 0 })]);
    expect(input.lineoutLast).toBeNull();
  });

  it('sin partidos devuelve series vacías', () => {
    expect(focusInputOf([])).toEqual({ series: { lineout: [], tackle: [], penalties: [] }, lineoutLast: null });
  });
});
