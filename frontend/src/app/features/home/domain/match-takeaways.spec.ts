import { PlayerMatchSummary, PlayerMetrics } from '../../player-statistics/types/player-stats-api.types';
import { PROVISIONAL_NOTE, matchTakeaways } from './match-takeaways';

describe('matchTakeaways', () => {
  const zero: PlayerMetrics = {
    points: 0, tries: 0, tacklesMade: 0, tacklesMissed: 0, conversionsMade: 0, conversionAttempts: 0, penaltyKicksMade: 0,
    penaltyKickAttempts: 0, dropGoals: 0, penaltiesConceded: 0, turnoversWon: 0, yellowCards: 0, redCards: 0, actions: 0
  };
  const game = (matchId: string, date: string, metrics: Partial<PlayerMetrics>): PlayerMatchSummary => ({
    matchId, date, opponentName: 'TRC', homeScore: 10, awayScore: 5, role: 'TITULAR', number: 9, metrics: { ...zero, ...metrics }
  });
  const history = [
    game('m1', '2026-02-01T15:00:00', { points: 5, tries: 1, tacklesMade: 6 }),
    game('m2', '2026-03-01T15:00:00', { points: 0, tries: 0, tacklesMade: 8 })
  ];

  it('el partido que no está en la temporada no deja líneas', () => {
    expect(matchTakeaways(history, 'zzz', 100)).toBeNull();
  });

  it('mejor marca: supera a todos los anteriores (con al menos 2 anteriores)', () => {
    const result = matchTakeaways([...history, game('m3', '2026-04-01T15:00:00', { tacklesMade: 12 })], 'm3', 100);
    expect(result?.lines).toEqual(['Tu mejor partido en tackles de la temporada: 12']);
  });

  it('empatar la marca no es mejor marca, y con un solo anterior no se compara', () => {
    expect(matchTakeaways([...history, game('m3', '2026-04-01T15:00:00', { tacklesMade: 8 })], 'm3', 100)).toBeNull();
    expect(matchTakeaways([history[0], game('m2', '2026-03-01T15:00:00', { tacklesMade: 20 })], 'm2', 100)).toBeNull();
  });

  it('la mejor marca elige una sola métrica, por prioridad: puntos, tries, tackles', () => {
    const result = matchTakeaways([...history, game('m3', '2026-04-01T15:00:00', { points: 10, tries: 2, tacklesMade: 15 })], 'm3', 100);
    expect(result?.lines[0]).toBe('Tu mejor partido en puntos de la temporada: 10');
  });

  it('hito: cruzar un múltiplo en el partido', () => {
    const prior = [game('m1', '2026-02-01T15:00:00', { tries: 3 }), game('m2', '2026-03-01T15:00:00', { tries: 1 })];
    const result = matchTakeaways([...prior, game('m3', '2026-04-01T15:00:00', { tries: 1 })], 'm3', 100);
    expect(result?.lines).toEqual(['Llegaste a 5 tries en la temporada']);
  });

  it('hito: no se repite si el partido no cruzó el múltiplo', () => {
    const prior = [game('m1', '2026-02-01T15:00:00', { tries: 5 }), game('m2', '2026-03-01T15:00:00', { tries: 0 })];
    expect(matchTakeaways([...prior, game('m3', '2026-04-01T15:00:00', { tries: 1 })], 'm3', 100)).toBeNull();
  });

  it('penales: cuenta sin inventar el tipo de infracción y compara con el promedio', () => {
    const prior = [game('m1', '2026-02-01T15:00:00', { penaltiesConceded: 1 }), game('m2', '2026-03-01T15:00:00', { penaltiesConceded: 2 })];
    const result = matchTakeaways([...prior, game('m3', '2026-04-01T15:00:00', { penaltiesConceded: 3 })], 'm3', 100);
    expect(result?.lines).toEqual(['3 penales cometidos · tu promedio es 1,5']);
    expect(matchTakeaways([game('m1', '2026-02-01T15:00:00', { penaltiesConceded: 1 })], 'm1', 100)?.lines).toEqual(['1 penal cometido']);
  });

  it('nunca más de 3 líneas, en el orden mejor marca, hito y penales', () => {
    const prior = [game('m1', '2026-02-01T15:00:00', { tries: 2, penaltiesConceded: 1 }), game('m2', '2026-03-01T15:00:00', { tries: 0 })];
    const result = matchTakeaways([...prior, game('m3', '2026-04-01T15:00:00', { tries: 3, penaltiesConceded: 2 })], 'm3', 100);
    expect(result?.lines).toEqual(['Tu mejor partido en tries de la temporada: 3', 'Llegaste a 5 tries en la temporada', '2 penales cometidos · tu promedio es 0,5']);
  });

  it('con el análisis incompleto suma el aviso, y alcanza para dibujar el panel sin líneas', () => {
    const result = matchTakeaways(history, 'm2', 80);
    expect(result).toEqual({ lines: [], provisionalNote: PROVISIONAL_NOTE });
    expect(matchTakeaways(history, 'm2', 100)).toBeNull();
  });

  it('acepta los partidos en cualquier orden', () => {
    const result = matchTakeaways([game('m3', '2026-04-01T15:00:00', { tacklesMade: 12 }), history[1], history[0]], 'm3', 100);
    expect(result?.lines).toEqual(['Tu mejor partido en tackles de la temporada: 12']);
  });
});
