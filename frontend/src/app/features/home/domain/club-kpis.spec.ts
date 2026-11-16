import { Match } from '../../match/types/match.types';
import { clubKpis } from './club-kpis';
import { DivisionStat, divisionStatusRows } from './division-status';

describe('club-kpis', () => {
  const now = new Date(2026, 10, 6, 18, 0);
  const divisions = [{ id: 'd1', name: 'Superior' }, { id: 'd2', name: 'M15' }];
  const finished = (id: string, divisionId: string, home: number, away: number): Match => ({
    id, date: '2026-03-10T15:00:00', divisionId, status: 'finished', currentPeriod: 2, clockElapsedSeconds: 0, clockPaused: true,
    currentPossession: 'NEUTRAL', homeScore: home, awayScore: away, opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }
  });
  const stat = (divisionId: string, overrides: Partial<DivisionStat> = {}): DivisionStat => ({
    divisionId, staff: 1, players: 30, analysisPercent: 100, roster: null, ...overrides
  });
  const kpis = (stats: DivisionStat[], matches: Match[] = []) =>
    clubKpis(divisionStatusRows({ now, divisions, stats, matches }), stats, matches, now);
  const byKey = (list: ReturnType<typeof kpis>, key: string) => list.find(kpi => kpi.key === key)!;

  it('jugadores activos suma las divisiones y cuenta cuántas son', () => {
    expect(byKey(kpis([stat('d1', { players: 30 }), stat('d2', { players: 22 })]), 'players')).toEqual(jasmine.objectContaining({ value: '52', sub: 'en 2 divisiones' }));
  });

  it('partidos del año cuenta G · E · P de las divisiones del club y deja afuera otros años', () => {
    const old = { ...finished('viejo', 'd1', 9, 0), date: '2025-03-10T15:00:00' };
    const list = kpis([stat('d1'), stat('d2')], [finished('a', 'd1', 20, 10), finished('b', 'd2', 5, 5), finished('c', 'd1', 0, 7), old]);
    expect(byKey(list, 'matches')).toEqual(jasmine.objectContaining({ label: 'Partidos 2026', value: '3', sub: '1 G · 1 E · 1 P' }));
  });

  it('análisis promedio: promedia lo conocido, con coma y %, y se marca bajo 90 %', () => {
    const low = byKey(kpis([stat('d1', { analysisPercent: 80 }), stat('d2', { analysisPercent: 83 })]), 'analysis');
    expect(low).toEqual(jasmine.objectContaining({ value: '82 %', warn: true }));
    const good = byKey(kpis([stat('d1', { analysisPercent: 100 }), stat('d2', { analysisPercent: null })]), 'analysis');
    expect(good).toEqual(jasmine.objectContaining({ value: '100 %', warn: false }));
  });

  it('sin análisis conocido el valor queda en «–», no en 0', () => {
    expect(byKey(kpis([stat('d1', { analysisPercent: null }), stat('d2', { analysisPercent: null })]), 'analysis').value).toBe('–');
    expect(byKey(kpis([stat('d1', { players: null }), stat('d2', { players: null })]), 'players').value).toBe('–');
  });

  it('pendientes: cuenta las divisiones con algo marcado y dice dónde', () => {
    const pending = byKey(kpis([stat('d1', { staff: 0 }), stat('d2', { players: 10 })]), 'pending');
    expect(pending).toEqual(jasmine.objectContaining({ value: '2', sub: 'Superior y M15', warn: true }));
    const calm = byKey(kpis([stat('d1'), stat('d2')]), 'pending');
    expect(calm).toEqual(jasmine.objectContaining({ value: '0', sub: 'Todo en orden', warn: false }));
  });
});
