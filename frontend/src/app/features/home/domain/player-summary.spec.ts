import { PlayerStatColumn, PlayerStatistic } from '../../match/statistics/types/statistic.types';
import { PlayerMatchDTO, PlayerMatchStatistic } from '../../player-statistics/types/player-statistics.types';
import { buildPlayerSummary, latestMatchOf } from './player-summary';

describe('buildPlayerSummary', () => {
  const columns: PlayerStatColumn[] = ['TRY', 'TACKLE_MADE', 'TACKLE_MISSED'].map(code => ({
    eventTypeId: code, code, label: code, groupName: 'g', isScoring: false, hasAttempts: false
  }));
  const entry = (id: string, date: string, home: number, away: number, values: { tries?: number; made?: number; missed?: number; points?: number }, role: 'TITULAR' | 'SUPLENTE' = 'TITULAR', finishedAt: string | null = null): PlayerMatchStatistic => {
    const stat = {
      playerId: 'p', jerseyNumber: 14, playerName: 'Lucas', isStarter: role === 'TITULAR', minutesPlayed: 80,
      totalPoints: values.points ?? 0, hasActivity: true,
      values: {
        TRY: { count: values.tries ?? 0, made: null },
        TACKLE_MADE: { count: values.made ?? 0, made: null },
        TACKLE_MISSED: { count: values.missed ?? 0, made: null }
      }
    } as PlayerStatistic;
    const match: PlayerMatchDTO = { matchId: id, date, opponentName: 'Draig Goch', divisionName: 'M18', homeScore: home, awayScore: away, role, slotNumber: 14, finishedAt };
    return { match, columns, stat };
  };

  it('sin partidos no hay resumen', () => {
    expect(buildPlayerSummary(null, 100)).toBeNull();
  });

  it('el último partido trae resultado, rol, tries, tackles y análisis', () => {
    const summary = buildPlayerSummary(entry('m2', '2026-11-01T15:00:00', 22, 14, { tries: 1, made: 6, missed: 1, points: 5 }), 78);
    expect(summary?.last).toEqual({
      matchId: 'm2', dateLabel: 'Dom 1 nov', opponent: 'Draig Goch', ownScore: 22, opponentScore: 14, result: 'win',
      role: 'TITULAR', tries: 1, tackles: 6, tacklePercent: 86, slotNumber: 14, analysisPercent: 78
    });
  });

  it('con el análisis incompleto un 0 no es un dato: tries y tackles quedan en null', () => {
    const summary = buildPlayerSummary(entry('m2', '2026-11-01T15:00:00', 22, 14, {}), 78);
    expect(summary?.last).toEqual(jasmine.objectContaining({ tries: null, tackles: null, tacklePercent: null, analysisPercent: 78 }));
  });

  it('con el análisis incompleto los valores mayores que 0 se muestran', () => {
    const summary = buildPlayerSummary(entry('m2', '2026-11-01T15:00:00', 22, 14, { tries: 2 }), 78);
    expect(summary?.last).toEqual(jasmine.objectContaining({ tries: 2, tackles: null }));
  });

  it('con el análisis completo el 0 es un dato', () => {
    const summary = buildPlayerSummary(entry('m2', '2026-11-01T15:00:00', 22, 14, {}), 100);
    expect(summary?.last).toEqual(jasmine.objectContaining({ tries: 0, tackles: 0, tacklePercent: null }));
  });
});

describe('latestMatchOf', () => {
  const match = (matchId: string, date: string, finishedAt: string | null = null): PlayerMatchDTO =>
    ({ matchId, date, opponentName: 'Draig Goch', divisionName: 'M18', homeScore: 1, awayScore: 0, role: 'TITULAR', slotNumber: 14, finishedAt });

  it('sin partidos no hay último', () => {
    expect(latestMatchOf([])).toBeNull();
  });

  it('un terminado con fecha futura y finishedAt viejo no gana', () => {
    const latest = latestMatchOf([match('futuro', '2026-12-15T15:00:00', '2026-10-10T19:00:00'), match('reciente', '2026-11-01T15:00:00', '2026-11-01T19:00:00')]);
    expect(latest?.matchId).toBe('reciente');
  });

  it('un terminado con fecha futura que terminó hoy cuenta como jugado y como último', () => {
    const latest = latestMatchOf([match('viejo', '2026-10-01T15:00:00', '2026-10-01T19:00:00'), match('futuro', '2026-12-15T15:00:00', '2026-11-06T20:00:00')]);
    expect(latest?.matchId).toBe('futuro');
  });

  it('sin finishedAt manda la fecha, sin importar el orden en que llegan', () => {
    expect(latestMatchOf([match('a', '2026-02-01T15:00:00'), match('b', '2026-03-01T15:00:00')])?.matchId).toBe('b');
  });
});
