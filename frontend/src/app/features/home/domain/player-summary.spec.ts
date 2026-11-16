import { PlayerStatColumn, PlayerStatistic } from '../../match/statistics/types/statistic.types';
import { PlayerMatchDTO, PlayerMatchStatistic } from '../../player-statistics/types/player-statistics.types';
import { buildPlayerSummary } from './player-summary';

describe('buildPlayerSummary', () => {
  const now = new Date(2026, 10, 6, 18, 0);
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
    expect(buildPlayerSummary([], 100, now)).toBeNull();
  });

  it('el último partido trae resultado, rol, tries, tackles y análisis', () => {
    const summary = buildPlayerSummary([entry('m2', '2026-11-01T15:00:00', 22, 14, { tries: 1, made: 6, missed: 1, points: 5 })], 78, now);
    expect(summary?.last).toEqual({
      matchId: 'm2', dateLabel: 'Dom 1 nov', opponent: 'Draig Goch', ownScore: 22, opponentScore: 14, result: 'win',
      role: 'TITULAR', tries: 1, tackles: 6, tacklePercent: 86, slotNumber: 14, analysisPercent: 78
    });
  });

  it('con el análisis incompleto un 0 no es un dato: tries y tackles quedan en null', () => {
    const summary = buildPlayerSummary([entry('m2', '2026-11-01T15:00:00', 22, 14, {})], 78, now);
    expect(summary?.last).toEqual(jasmine.objectContaining({ tries: null, tackles: null, tacklePercent: null, analysisPercent: 78 }));
  });

  it('con el análisis incompleto los valores mayores que 0 se muestran', () => {
    const summary = buildPlayerSummary([entry('m2', '2026-11-01T15:00:00', 22, 14, { tries: 2 })], 78, now);
    expect(summary?.last).toEqual(jasmine.objectContaining({ tries: 2, tackles: null }));
  });

  it('con el análisis completo el 0 es un dato', () => {
    const summary = buildPlayerSummary([entry('m2', '2026-11-01T15:00:00', 22, 14, {})], 100, now);
    expect(summary?.last).toEqual(jasmine.objectContaining({ tries: 0, tackles: 0, tacklePercent: null }));
  });

  it('el último es el que se jugó más tarde: un terminado con fecha futura y finishedAt viejo no gana', () => {
    const summary = buildPlayerSummary([
      entry('futuro', '2026-12-15T15:00:00', 1, 0, {}, 'TITULAR', '2026-10-10T19:00:00'),
      entry('reciente', '2026-11-01T15:00:00', 22, 14, {}, 'TITULAR', '2026-11-01T19:00:00')
    ], 100, now);
    expect(summary?.last.matchId).toBe('reciente');
  });

  it('un terminado con fecha futura que terminó hoy cuenta como jugado y como último', () => {
    const summary = buildPlayerSummary([
      entry('viejo', '2026-10-01T15:00:00', 1, 0, {}, 'TITULAR', '2026-10-01T19:00:00'),
      entry('futuro', '2026-12-15T15:00:00', 5, 3, {}, 'TITULAR', '2026-11-06T20:00:00')
    ], 100, now);
    expect(summary?.last.matchId).toBe('futuro');
    expect(summary?.season.last.map(item => item.matchId)).toEqual(['viejo', 'futuro']);
  });

  it('sin finishedAt manda la fecha, sin importar el orden en que llegan', () => {
    const summary = buildPlayerSummary([entry('a', '2026-02-01T15:00:00', 1, 0, {}), entry('b', '2026-03-01T15:00:00', 1, 0, {})], 100, now);
    expect(summary?.last.matchId).toBe('b');
  });

  it('la temporada suma solo el año en curso', () => {
    const summary = buildPlayerSummary([
      entry('m3', '2026-03-01T15:00:00', 10, 12, { tries: 0, made: 4, missed: 1, points: 0 }, 'SUPLENTE'),
      entry('m2', '2026-02-01T15:00:00', 22, 14, { tries: 1, made: 6, missed: 1, points: 5 }),
      entry('m1', '2025-10-01T15:00:00', 30, 0, { tries: 4, made: 9, missed: 0, points: 20 })
    ], 100, now);
    expect(summary?.season).toEqual(jasmine.objectContaining({ year: 2026, points: 5, tries: 1, matches: 2, starts: 1, tacklePercent: 83 }));
    expect(summary?.season.last.map(item => item.matchId)).toEqual(['m2', 'm3']);
    expect(summary?.season.last[1]).toEqual({ matchId: 'm3', result: 'loss', score: '10-12', opponent: 'Draig Goch' });
  });

  it('sin tackles intentados el porcentaje es null', () => {
    const summary = buildPlayerSummary([entry('m1', '2026-02-01T15:00:00', 1, 0, {})], 100, now);
    expect(summary?.season.tacklePercent).toBeNull();
  });
});
