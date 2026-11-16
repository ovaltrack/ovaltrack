import { FormMatch, finishedOfSeason, formAverages, formRecord, resultOf } from './form-record';

describe('form-record', () => {
  const now = new Date(2026, 10, 6, 18, 0);
  const match = (id: string, date: string, home: number, away: number, status: FormMatch['status'] = 'finished', alias = 'Draig Goch'): FormMatch => ({
    id, date, status, homeScore: home, awayScore: away,
    opponent: { id: 'o', name: alias, alias, city: null }
  });

  it('resultOf compara el marcador propio con el rival', () => {
    expect(resultOf(24, 17)).toBe('win');
    expect(resultOf(10, 10)).toBe('draw');
    expect(resultOf(3, 9)).toBe('loss');
  });

  it('solo cuenta los FINISHED del año en curso, en orden cronológico', () => {
    const matches = [
      match('b', '2026-03-10T15:00:00', 1, 0),
      match('a', '2026-02-10T15:00:00', 2, 0),
      match('old', '2025-11-10T15:00:00', 9, 0),
      match('next', '2026-11-07T15:00:00', 0, 0, 'not_started')
    ];
    expect(finishedOfSeason(matches, now).map(m => m.id)).toEqual(['a', 'b']);
  });

  it('ordena por cuándo se jugó: un terminado con fecha futura entra en la temporada en que terminó', () => {
    const matches = [
      { ...match('futuro', '2027-01-15T15:00:00', 3, 0), finishedAt: '2026-11-01T19:00:00Z' },
      { ...match('mar', '2026-03-10T15:00:00', 1, 0), finishedAt: null },
      { ...match('otroAnio', '2026-12-20T15:00:00', 9, 0), finishedAt: '2027-01-02T10:00:00Z' }
    ];
    expect(finishedOfSeason(matches, now).map(m => m.id)).toEqual(['mar', 'futuro']);
  });

  it('arma récord, diferencia y últimos 5', () => {
    const matches = [
      match('1', '2026-01-01T15:00:00', 24, 17),
      match('2', '2026-01-08T15:00:00', 15, 22),
      match('3', '2026-01-15T15:00:00', 19, 19),
      match('4', '2026-01-22T15:00:00', 31, 12),
      match('5', '2026-01-29T15:00:00', 27, 10),
      match('6', '2026-02-05T15:00:00', 10, 3)
    ];
    const record = formRecord(matches, now);
    expect(record).toEqual(jasmine.objectContaining({ wins: 4, draws: 1, losses: 1, diff: 7 - 7 + 0 + 19 + 17 + 7 }));
    expect(record?.last.map(entry => entry.matchId)).toEqual(['2', '3', '4', '5', '6']);
    expect(record?.last[0]).toEqual({ matchId: '2', result: 'loss', score: '15-22', opponent: 'Draig Goch' });
  });

  it('promedia los tantos a favor y en contra por partido de la temporada, con 1 decimal', () => {
    const record = formRecord([
      match('1', '2026-01-01T15:00:00', 24, 17),
      match('2', '2026-01-08T15:00:00', 15, 22),
      match('3', '2026-01-15T15:00:00', 19, 19),
      match('4', '2026-01-22T15:00:00', 31, 12),
      match('5', '2026-01-29T15:00:00', 27, 10),
      match('6', '2026-02-05T15:00:00', 10, 3),
      match('viejo', '2025-10-05T15:00:00', 90, 0)
    ], now);
    expect(record).toEqual(jasmine.objectContaining({ averageFor: 21, averageAgainst: 13.8 }));
  });

  it('un solo partido: sus tantos son el promedio', () => {
    expect(formRecord([match('1', '2026-01-01T15:00:00', 24, 17)], now)).toEqual(jasmine.objectContaining({ averageFor: 24, averageAgainst: 17 }));
  });

  it('sin partidos jugados no hay forma', () => {
    expect(formRecord([match('n', '2026-11-07T15:00:00', 0, 0, 'not_started')], now)).toBeNull();
  });

  it('formAverages formatea con coma decimal', () => {
    expect(formAverages({ averageFor: 24.1, averageAgainst: 18 })).toEqual({ for: '24,1', against: '18' });
  });

  it('formAverages tolera un snapshot viejo sin promedios', () => {
    expect(formAverages({})).toBeNull();
    expect(formAverages({ averageFor: 10 })).toBeNull();
  });
});
