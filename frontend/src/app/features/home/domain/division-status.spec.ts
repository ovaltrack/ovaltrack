import { Match } from '../../match/types/match.types';
import { DivisionStat, DivisionStatusInput, divisionStatusRows } from './division-status';

describe('division-status', () => {
  const now = new Date(2026, 10, 6, 18, 0);
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-07T14:30:00', divisionId: 'd1', status: 'not_started', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }, ...overrides
  });
  const stat = (overrides: Partial<DivisionStat> = {}): DivisionStat => ({
    divisionId: 'd1', staff: 2, players: 30, analysisPercent: 95, roster: { starters: 15, substitutes: 8 }, ...overrides
  });
  const rowOf = (stats: DivisionStat[], matches: Match[] = [match({})], divisions = [{ id: 'd1', name: 'Superior' }]) => {
    const input: DivisionStatusInput = { now, divisions, stats, matches };
    return divisionStatusRows(input)[0];
  };

  it('una división en orden no marca nada ni ofrece acción', () => {
    const row = rowOf([stat()]);
    expect(row.staff).toEqual({ text: '2 en staff', issue: null });
    expect(row.players).toEqual({ text: '30', issue: null });
    expect(row.roster).toEqual({ text: 'Lista', issue: null });
    expect(row.action).toBeNull();
    expect(row.next).toEqual({ text: 'Sáb 7 nov', sub: '14:30 · vs Trelew', live: false });
  });

  it('sin entrenador: error y «Asignar entrenador», aunque haya más problemas', () => {
    const row = rowOf([stat({ staff: 0, players: 10 })]);
    expect(row.staff).toEqual({ text: 'Sin entrenador', issue: 'error' });
    expect(row.action).toEqual({ label: 'Asignar entrenador', route: '/divisions/d1/coaches', ariaLabel: 'Asignar entrenador a Superior' });
  });

  it('plantel menor a 15: ámbar con «no alcanza para 15» y «Ver jugadores»', () => {
    const row = rowOf([stat({ players: 12 })]);
    expect(row.players).toEqual({ text: '12', issue: 'warn', note: 'no alcanza para 15' });
    expect(row.action).toEqual(jasmine.objectContaining({ label: 'Ver jugadores', route: '/divisions/d1/players' }));
    expect(row.action?.ariaLabel).toContain('no alcanza para 15');
  });

  it('nómina ausente o con suplentes faltantes: ámbar y «Ver nómina» del próximo partido', () => {
    const none = rowOf([stat({ roster: null })], [match({ status: 'empty_roster' })]);
    expect(none.roster).toEqual({ text: 'Sin nómina', issue: 'warn' });
    expect(none.action).toEqual(jasmine.objectContaining({ label: 'Ver nómina', route: '/selection-roster/m1' }));
    expect(rowOf([stat({ roster: { starters: 15, substitutes: 6 } })]).roster).toEqual({ text: 'Suplentes 6/8', issue: 'warn' });
  });

  it('una nómina que no se pudo leer o datos viejos sin nómina no se acusan', () => {
    expect(rowOf([stat({ roster: null })]).roster).toEqual({ text: '–', issue: null });
    const old = stat();
    delete old.roster;
    expect(rowOf([old]).action).toBeNull();
  });

  it('sin próximo partido la nómina no aplica', () => {
    const row = rowOf([stat()], []);
    expect(row.next).toEqual({ text: 'Sin partido', sub: null, live: false });
    expect(row.roster.issue).toBeNull();
  });

  it('un partido en curso se ve como «En curso» y no acusa la nómina del próximo', () => {
    const row = rowOf([stat({ roster: null })], [match({ id: 'v', status: 'in_progress', date: '2026-11-01T10:00:00' }), match({ id: 'n', status: 'empty_roster', date: '2026-11-14T10:00:00' })]);
    expect(row.next).toEqual({ text: 'En curso', sub: 'vs Trelew', live: true });
    expect(row.roster.issue).toBeNull();
  });

  it('datos sin leer quedan en «–», sin marcar', () => {
    const row = rowOf([stat({ staff: null, players: null, analysisPercent: null })]);
    expect(row.staff.text).toBe('–');
    expect(row.players.text).toBe('–');
    expect(row.analysis).toEqual({ percent: null, tone: 'good' });
    expect(row.action).toBeNull();
  });

  it('el análisis trae su tono y los últimos 5 salen de los partidos finalizados del año', () => {
    const finished = [1, 2, 3, 4, 5, 6].map(n => match({ id: `f${n}`, status: 'finished', date: `2026-0${n}-10T15:00:00`, homeScore: n, awayScore: 3 }));
    const row = rowOf([stat({ analysisPercent: 70 })], finished);
    expect(row.analysis).toEqual({ percent: 70, tone: 'warn' });
    expect(row.last.map(entry => entry.matchId)).toEqual(['f2', 'f3', 'f4', 'f5', 'f6']);
  });

  it('respeta el orden del club (D4)', () => {
    const rows = divisionStatusRows({ now, divisions: [{ id: 'd2', name: 'M15' }, { id: 'd1', name: 'Superior' }], stats: [stat(), stat({ divisionId: 'd2' })], matches: [] });
    expect(rows.map(row => row.name)).toEqual(['M15', 'Superior']);
  });
});
