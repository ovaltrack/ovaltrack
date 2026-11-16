import { Match } from '../../match/types/match.types';
import { ClubAgendaContext, agendaChip, agendaWindowEnd, buildClubAgenda, rosterWindowMatches } from './club-agenda';

describe('club-agenda', () => {
  /** Viernes 6 de noviembre, 18:00. */
  const friday = new Date(2026, 10, 6, 18, 0);
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-07T14:30:00', divisionId: 'd1', status: 'not_started', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }, ...overrides
  });
  const full = { starters: 15, substitutes: 8 };
  const context = (matches: Match[], overrides: Partial<ClubAgendaContext> = {}): ClubAgendaContext => ({
    now: friday,
    divisions: [{ id: 'd1', name: 'Superior', hasCoach: true }, { id: 'd2', name: 'M15', hasCoach: false }],
    matches, rosters: {}, ...overrides
  });
  const agenda = (matches: Match[], overrides: Partial<ClubAgendaContext> = {}) => {
    const board = buildClubAgenda(context(matches, overrides));
    if (board.kind !== 'club-agenda') throw new Error(`se esperaba club-agenda y fue ${board.kind}`);
    return board;
  };

  describe('ventana', () => {
    it('llega hasta el domingo próximo (límite exclusivo el lunes)', () => {
      expect(agendaWindowEnd(friday)).toEqual(new Date(2026, 10, 9));
      expect(agendaWindowEnd(new Date(2026, 10, 8, 10, 0))).toEqual(new Date(2026, 10, 9));
      expect(agendaWindowEnd(new Date(2026, 10, 9, 10, 0))).toEqual(new Date(2026, 10, 16));
    });

    it('rosterWindowMatches toma los sin iniciar de la ventana o de las próximas 72 h', () => {
      const ids = rosterWindowMatches([
        match({ id: 'sab' }), match({ id: 'dom', date: '2026-11-08T10:00:00', status: 'empty_roster' }),
        match({ id: 'lun', date: '2026-11-09T10:00:00' }), match({ id: 'lejos', date: '2026-11-14T10:00:00' }),
        match({ id: 'fin', status: 'finished' })
      ], friday, 72 * 3_600_000).map(candidate => candidate.id);
      expect(ids).toEqual(['sab', 'dom', 'lun']);
    });
  });

  describe('semana', () => {
    it('fin de semana: título, rótulo y una fila por partido con el estado de su nómina', () => {
      const board = agenda(
        [match({ id: 'a', date: '2026-11-07T10:00:00', divisionId: 'd2' }), match({ id: 'b', date: '2026-11-07T14:30:00' }), match({ id: 'c', date: '2026-11-08T13:00:00' })],
        { rosters: { b: full, c: { starters: 15, substitutes: 6 } } }
      );
      expect(board.mode).toBe('week');
      expect(board.title).toBe('3 partidos este fin de semana');
      expect(board.label).toBe('Fin de semana · Sáb 7 y Dom 8');
      expect(board.sections.length).toBe(1);
      expect(board.sections[0].rows.map(row => [row.dayLabel, row.timeLabel, row.division, row.chip.label, row.chip.tone])).toEqual([
        ['Sáb 7', '10:00', 'M15', 'Sin entrenador', 'warn'],
        ['Sáb 7', '14:30', 'Superior', 'Nómina lista', 'ok'],
        ['Dom 8', '13:00', 'Superior', 'Suplentes 6/8', 'warn']
      ]);
    });

    it('con un partido de entre semana dice «esta semana»', () => {
      const board = agenda([match({ id: 'a', date: '2026-11-05T20:00:00' })], { now: new Date(2026, 10, 4, 10, 0) });
      expect(board.title).toBe('1 partido esta semana');
      expect(board.label).toBe('Esta semana · Jue 5');
    });

    it('un partido de la semana próxima no entra: no hay agenda y se muestra la próxima fecha', () => {
      const board = buildClubAgenda(context([match({ id: 'a', date: '2026-11-14T10:00:00' }), match({ id: 'b', date: '2026-11-14T13:00:00' })]));
      expect(board).toEqual({ kind: 'club-idle', nextLabel: 'Sáb 14 nov · 2 partidos' });
    });

    it('sin nada por jugar: club-idle sin próxima fecha', () => {
      expect(buildClubAgenda(context([match({ status: 'finished', date: '2026-10-31T10:00:00' })]))).toEqual({ kind: 'club-idle', nextLabel: null });
    });
  });

  describe('día de partido', () => {
    const saturday = new Date(2026, 10, 7, 9, 0);

    it('con partidos hoy: «Hoy» y «Mañana», con los conteos en el rótulo', () => {
      const board = agenda(
        [match({ id: 'h2', date: '2026-11-07T16:00:00' }), match({ id: 'h1', date: '2026-11-07T12:00:00' }), match({ id: 'd', date: '2026-11-08T10:00:00' })],
        { now: saturday, rosters: { h1: full, h2: full, d: full } }
      );
      expect(board.mode).toBe('day');
      expect(board.title).toBe('Hoy en el club');
      expect(board.label).toBe('Hoy en el club · Sáb 7 nov · 2 hoy, 1 mañana');
      expect(board.sections.map(section => [section.key, section.label, section.rows.map(row => row.matchId)])).toEqual([
        ['today', null, ['h1', 'h2']],
        ['tomorrow', 'Mañana', ['d']]
      ]);
      expect(board.live).toBeNull();
    });

    it('un partido en curso va primero en «Ahora», aunque su fecha sea otra, y arma el panel en vivo', () => {
      const board = agenda([
        match({ id: 'h', date: '2026-11-07T20:00:00' }),
        match({ id: 'vivo', status: 'in_progress', date: '2026-11-01T14:30:00', divisionId: 'd2', homeScore: 10, awayScore: 7, currentPeriod: 2, clockElapsedSeconds: 52 * 60, clockUpdatedAt: '2026-11-07T17:05:00' })
      ], { now: saturday });
      expect(board.sections.map(section => [section.key, section.label, section.rows.map(row => row.matchId)])).toEqual([
        ['now', 'Ahora', ['vivo']],
        ['today', 'Hoy', ['h']]
      ]);
      expect(board.sections[0].rows[0].chip).toEqual({ label: "En curso · 2T 52'", tone: 'live' });
      expect(board.live).toEqual({ division: 'M15', opponent: 'Trelew', ownScore: 10, opponentScore: 7, periodLabel: "2T 52'", lastDataAt: '14:05' });
    });

    it('un partido terminado hoy se ve con su resultado', () => {
      const board = agenda([match({ status: 'finished', date: '2026-11-07T07:00:00', homeScore: 22, awayScore: 14 })], { now: saturday });
      expect(board.sections[0].rows[0].chip).toEqual({ label: 'Final 22–14', tone: 'neutral' });
    });

    it('los cancelados no aparecen', () => {
      expect(buildClubAgenda(context([match({ status: 'cancelled' })])).kind).toBe('club-idle');
    });
  });

  describe('agendaChip', () => {
    it('prioridad: final, en curso, sin entrenador, nómina', () => {
      expect(agendaChip(match({ status: 'finished', homeScore: 3, awayScore: 0 }), false, undefined).label).toBe('Final 3–0');
      expect(agendaChip(match({ status: 'halftime' }), false, undefined)).toEqual({ label: 'En curso · Entretiempo', tone: 'live' });
      expect(agendaChip(match({}), false, full)).toEqual({ label: 'Sin entrenador', tone: 'warn' });
    });

    it('estados de la nómina', () => {
      expect(agendaChip(match({ status: 'empty_roster' }), true, undefined)).toEqual({ label: 'Sin nómina', tone: 'warn' });
      expect(agendaChip(match({}), true, { starters: 13, substitutes: 8 }).label).toBe('Titulares 13/15');
      expect(agendaChip(match({}), true, { starters: 15, substitutes: 7 }).label).toBe('Suplentes 7/8');
      expect(agendaChip(match({}), true, full)).toEqual({ label: 'Nómina lista', tone: 'ok' });
    });

    it('una nómina ilegible no se acusa', () => {
      expect(agendaChip(match({}), true, undefined)).toEqual({ label: 'Nómina sin datos', tone: 'neutral' });
    });
  });
});
