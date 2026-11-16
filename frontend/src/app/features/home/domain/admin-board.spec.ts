import { Match } from '../../match/types/match.types';
import { AdminBoardContext, buildAdminBoard, clubDayItemState } from './admin-board';

describe('admin-board', () => {
  const now = new Date(2026, 10, 6, 18, 0);
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-07T14:30:00', divisionId: 'd1', status: 'not_started', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew', alias: 'Trelew', city: null }, ...overrides
  });
  const full = { starters: 15, substitutes: 8 };
  const context = (matches: Match[], overrides: Partial<AdminBoardContext> = {}): AdminBoardContext => ({
    now,
    divisions: [{ id: 'd1', name: 'Superior', hasCoach: true }, { id: 'd2', name: 'M15', hasCoach: false }],
    matches, rosters: {}, ...overrides
  });

  it('sin divisiones: crear la primera', () => {
    expect(buildAdminBoard(context([], { divisions: [] }))).toEqual({ kind: 'onboarding', step: 'create-division' });
  });

  it('con divisiones y sin partidos: programar el primero', () => {
    expect(buildAdminBoard(context([]))).toEqual({ kind: 'onboarding', step: 'schedule-match' });
  });

  it('mañana en el club con un ítem por partido y el estado de cada nómina', () => {
    const board = buildAdminBoard(context(
      [match({ id: 'a', date: '2026-11-07T10:00:00', divisionId: 'd2' }), match({ id: 'b', date: '2026-11-07T14:30:00' }), match({ id: 'c', date: '2026-11-07T13:00:00', divisionId: 'd1' })],
      { rosters: { b: full, c: { starters: 15, substitutes: 6 } } }
    ));
    expect(board.kind).toBe('club-day');
    if (board.kind === 'club-day') {
      expect(board.title).toBe('Mañana en el club');
      expect(board.label).toBe('Mañana · Sáb 7 nov · 3 partidos');
      expect(board.nowMinute).toBeNull();
      expect(board.items.map(item => [item.timeLabel, item.status, item.detail])).toEqual([
        ['10:00', 'alert', 'Sin entrenador asignado'],
        ['13:00', 'alert', 'Suplentes 6/8'],
        ['14:30', 'ok', 'Nómina lista']
      ]);
    }
  });

  it('hoy marca el minuto actual y gana sobre mañana', () => {
    const board = buildAdminBoard(context([match({ id: 'h', date: '2026-11-06T20:00:00' }), match({ id: 't', date: '2026-11-07T10:00:00' })]));
    expect(board).toEqual(jasmine.objectContaining({ kind: 'club-day', title: 'Hoy en el club', nowMinute: 18 * 60 }));
  });

  it('un partido en curso con fecha de mañana es de "hoy" y va primero, no en "Mañana en el club"', () => {
    const board = buildAdminBoard(context([
      match({ id: 'h', date: '2026-11-06T20:00:00' }),
      match({ id: 'vivo', status: 'in_progress', date: '2026-11-07T14:30:00', divisionId: 'd2' }),
      match({ id: 't', date: '2026-11-07T10:00:00' })
    ]));
    expect(board.kind).toBe('club-day');
    if (board.kind === 'club-day') {
      expect(board.title).toBe('Hoy en el club');
      expect(board.items.map(item => [item.id, item.status, item.detail])).toEqual([['vivo', 'live', 'En curso'], ['h', 'alert', 'Sin nómina']]);
    }
  });

  it('un partido en curso con fecha de otro día alcanza para armar el día, sin caer en club-idle', () => {
    const board = buildAdminBoard(context([match({ id: 'vivo', status: 'halftime', date: '2026-11-01T10:00:00' })]));
    expect(board).toEqual(jasmine.objectContaining({ kind: 'club-day', title: 'Hoy en el club' }));
  });

  it('sin partidos hoy ni mañana muestra la próxima fecha', () => {
    const board = buildAdminBoard(context([match({ id: 'a', date: '2026-11-14T10:00:00' }), match({ id: 'b', date: '2026-11-14T13:00:00' })]));
    expect(board).toEqual({ kind: 'club-idle', nextLabel: 'Sáb 14 nov · 2 partidos' });
  });

  it('los partidos cancelados no cuentan', () => {
    expect(buildAdminBoard(context([match({ status: 'cancelled' })]))).toEqual({ kind: 'onboarding', step: 'schedule-match' });
  });

  describe('clubDayItemState', () => {
    it('terminado, en curso y entretiempo', () => {
      expect(clubDayItemState(match({ status: 'finished', homeScore: 22, awayScore: 14 }), true, undefined)).toEqual({ status: 'final', detail: '22-14' });
      expect(clubDayItemState(match({ status: 'in_progress' }), true, undefined)).toEqual({ status: 'live', detail: 'En curso' });
      expect(clubDayItemState(match({ status: 'halftime' }), true, undefined).detail).toBe('Entretiempo');
    });

    it('sin nómina o con titulares incompletos es alerta', () => {
      expect(clubDayItemState(match({ status: 'empty_roster' }), true, undefined).detail).toBe('Sin nómina');
      expect(clubDayItemState(match({}), true, { starters: 13, substitutes: 8 }).detail).toBe('Titulares 13/15');
    });
  });
});
