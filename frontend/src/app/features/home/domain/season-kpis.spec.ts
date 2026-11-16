import { PlayerMatchSummary, PlayerMetrics } from '../../player-statistics/types/player-stats-api.types';
import { NO_DATA, seasonKpis } from './season-kpis';

describe('seasonKpis', () => {
  const zero: PlayerMetrics = {
    points: 0, tries: 0, tacklesMade: 0, tacklesMissed: 0, conversionsMade: 0, conversionAttempts: 0, penaltyKicksMade: 0,
    penaltyKickAttempts: 0, dropGoals: 0, penaltiesConceded: 0, turnoversWon: 0, yellowCards: 0, redCards: 0, actions: 0
  };
  const game = (home: number, away: number, role: 'TITULAR' | 'SUPLENTE' = 'TITULAR'): PlayerMatchSummary => ({
    matchId: `${home}-${away}-${role}`, date: '2026-03-01T15:00:00', opponentName: 'TRC', homeScore: home, awayScore: away, role, number: 9, metrics: zero
  });
  const byKey = (kpis: ReturnType<typeof seasonKpis>, key: string) => kpis!.find(kpi => kpi.key === key)!;

  it('sin partidos no hay franja', () => {
    expect(seasonKpis(zero, [])).toBeNull();
  });

  it('puntos y tries salen de los totales, con los puntos en el color propio', () => {
    const kpis = seasonKpis({ ...zero, points: 25, tries: 5 }, [game(10, 3)]);
    expect(byKey(kpis, 'points')).toEqual(jasmine.objectContaining({ value: '25', own: true }));
    expect(byKey(kpis, 'tries')).toEqual(jasmine.objectContaining({ value: '5', own: false }));
  });

  it('partidos con titular y suplente, con singular y plural', () => {
    expect(byKey(seasonKpis(zero, [game(1, 0), game(2, 0, 'SUPLENTE'), game(3, 0)]), 'matches')).toEqual(jasmine.objectContaining({ value: '3', sub: '2 titulares · 1 suplente' }));
    expect(byKey(seasonKpis(zero, [game(1, 0)]), 'matches').sub).toBe('1 titular · 0 suplentes');
  });

  it('tackles con su efectividad, y «—» con «sin datos» si no intentó ninguno', () => {
    expect(byKey(seasonKpis({ ...zero, tacklesMade: 27, tacklesMissed: 3 }, [game(1, 0)]), 'tackles')).toEqual(jasmine.objectContaining({ value: '27', sub: '90 % de efectividad' }));
    expect(byKey(seasonKpis(zero, [game(1, 0)]), 'tackles')).toEqual(jasmine.objectContaining({ value: NO_DATA, sub: 'sin datos' }));
  });

  it('récord jugando: ganados, empatados y perdidos', () => {
    expect(byKey(seasonKpis(zero, [game(10, 3), game(5, 5), game(0, 7), game(9, 1)]), 'record')).toEqual(jasmine.objectContaining({ value: '2–1–1', sub: 'G · E · P' }));
  });

  it('siempre trae los 5 KPIs en el mismo orden', () => {
    expect(seasonKpis(zero, [game(1, 0)])!.map(kpi => kpi.key)).toEqual(['points', 'tries', 'matches', 'tackles', 'record']);
  });
});
