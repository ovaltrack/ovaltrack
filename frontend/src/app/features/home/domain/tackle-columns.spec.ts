import { MetricComparison, PlayerMatchSummary, PlayerMetrics } from '../../player-statistics/types/player-stats-api.types';
import { opponentSigla, tackleColumns } from './tackle-columns';

describe('tackleColumns', () => {
  const zero: PlayerMetrics = {
    points: 0, tries: 0, tacklesMade: 0, tacklesMissed: 0, conversionsMade: 0, conversionAttempts: 0, penaltyKicksMade: 0,
    penaltyKickAttempts: 0, dropGoals: 0, penaltiesConceded: 0, turnoversWon: 0, yellowCards: 0, redCards: 0, actions: 0
  };
  const game = (day: number, tackles: number, opponentName: string | null = 'Tigres RC'): PlayerMatchSummary => ({
    matchId: `m${day}`, date: `2026-03-${String(day).padStart(2, '0')}T15:00:00`, opponentName, homeScore: 10, awayScore: 5, role: 'TITULAR', number: 9,
    metrics: { ...zero, tacklesMade: tackles }
  });
  const squadTackles: MetricComparison = { key: 'tacklesMade', playerValue: 12, squadValue: 7.2, format: 'PER_MATCH', higherIsBetter: true, verdict: 'ABOVE' };
  const own = 'var(--btn-primary-bg)';

  it('sin partidos no hay gráfico', () => {
    expect(tackleColumns([], [squadTackles])).toBeNull();
  });

  it('con más de 8 partidos toma los últimos 8, del más viejo al más nuevo, sin importar el orden recibido', () => {
    const matches = Array.from({ length: 10 }, (_, index) => game(index + 1, index + 1)).reverse();
    const result = tackleColumns(matches, [])!;
    expect(result.chart.groups.map(group => group.label)).toEqual(['03/03', '04/03', '05/03', '06/03', '07/03', '08/03', '09/03', '10/03']);
    expect(result.chart.groups.map(group => group.values[0].display)).toEqual(['3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('con menos de 8 partidos dibuja los que haya', () => {
    const result = tackleColumns([game(1, 4), game(8, 9)], [])!;
    expect(result.chart.groups.length).toBe(2);
    expect(result.ariaLabel).toContain('los últimos 2 partidos');
  });

  it('el último va en el color propio y los anteriores atenuados', () => {
    const colors = tackleColumns([game(1, 4), game(2, 6), game(3, 9)], [])!.chart.groups.map(group => group.values[0].color);
    expect(colors[2]).toBe(own);
    expect(colors[0]).not.toBe(own);
    expect(colors[0]).toBe(colors[1]);
    expect(colors[0]).toContain('var(--btn-primary-bg)');
  });

  it('cada columna lleva la fecha y la sigla del rival; el aria-label lleva la serie completa', () => {
    const result = tackleColumns([game(2, 9, 'Draig Goch'), game(9, 12)], [])!;
    expect(result.chart.groups[0]).toEqual(jasmine.objectContaining({ label: '02/03', sublabel: 'DG' }));
    expect(result.chart.groups[1].sublabel).toBe('TIG');
    expect(result.ariaLabel).toBe('Tackles completados en los últimos 2 partidos: 9 contra DG el 02/03, 12 contra TIG el 09/03');
  });

  it('un solo partido se lee en singular', () => {
    expect(tackleColumns([game(1, 5)], [])!.ariaLabel).toContain('en tu último partido');
  });

  it('el pie trae el promedio de las columnas y el del plantel con coma decimal', () => {
    const result = tackleColumns([game(1, 9), game(2, 12), game(3, 14)], [squadTackles])!;
    expect(result.foot).toEqual({ average: '11,7', squad: '7,2' });
  });

  it('sin promedio del plantel el pie no lo inventa', () => {
    expect(tackleColumns([game(1, 9)], [])!.foot.squad).toBeNull();
    expect(tackleColumns([game(1, 9)], [{ ...squadTackles, squadValue: null, verdict: 'NO_DATA' }])!.foot.squad).toBeNull();
  });

  it('el eje se arma sobre el mayor valor', () => {
    expect(tackleColumns([game(1, 9), game(2, 15)], [])!.chart.max).toBe(16);
  });

  it('sigla: iniciales si hay varias palabras, tres letras si no, «—» sin nombre', () => {
    expect(opponentSigla('Puerto Madryn Rugby Club')).toBe('PM');
    expect(opponentSigla('Tigres')).toBe('TIG');
    expect(opponentSigla('Club Atlético San Isidro')).toBe('ASI');
    expect(opponentSigla(null)).toBe('—');
    expect(opponentSigla('  ')).toBe('—');
  });
});
