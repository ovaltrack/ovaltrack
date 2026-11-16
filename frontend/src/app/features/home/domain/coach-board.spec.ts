import { Match } from '../../match/types/match.types';
import { CoachBoardContext, buildCoachBoard, periodText } from './coach-board';

describe('coach-board', () => {
  const now = new Date(2026, 10, 6, 18, 0);
  const match = (overrides: Partial<Match>): Match => ({
    id: 'm1', date: '2026-11-07T14:30:00', divisionId: 'd1', status: 'empty_roster', currentPeriod: 1,
    clockElapsedSeconds: 0, clockPaused: true, currentPossession: 'NEUTRAL', homeScore: 0, awayScore: 0,
    opponent: { id: 'o', name: 'Trelew Rugby Club', alias: 'Trelew RC', city: 'Trelew' },
    ...overrides
  });
  const context = (matches: Match[], overrides: Partial<CoachBoardContext> = {}): CoachBoardContext => ({
    now, divisionName: 'Superior', matches, captureMatchId: null, progress: null, recent: [],
    roster: { starters: 15, substitutes: 6 }, readyOffline: true, analysis: null, ...overrides
  });

  it('partido en curso que captura este dispositivo: live-here con período y reloj', () => {
    const board = buildCoachBoard(context([match({ status: 'in_progress', homeScore: 14, awayScore: 7 })], {
      captureMatchId: 'm1', progress: { periodLabel: '2T', gameClock: '52:10' }
    }));
    expect(board).toEqual(jasmine.objectContaining({ kind: 'live-here', periodLabel: "2T 52'", ownScore: 14, opponentScore: 7 }));
  });

  it('partido en curso en otro dispositivo: live-elsewhere con el último dato en hora de Argentina', () => {
    const board = buildCoachBoard(context([match({ status: 'in_progress', clockUpdatedAt: '2026-11-06T17:05:00Z' })]));
    expect(board).toEqual(jasmine.objectContaining({ kind: 'live-elsewhere', lastDataAt: '14:05' }));
  });

  it('live-elsewhere trae el período y el minuto del último dato, sin extrapolar', () => {
    const second = buildCoachBoard(context([match({ status: 'in_progress', currentPeriod: 2, clockElapsedSeconds: 52 * 60 + 40 })]));
    const first = buildCoachBoard(context([match({ status: 'in_progress', currentPeriod: 1, clockElapsedSeconds: 7 * 60 })]));
    const halftime = buildCoachBoard(context([match({ status: 'halftime', currentPeriod: 1, clockElapsedSeconds: 40 * 60 })]));
    expect(second).toEqual(jasmine.objectContaining({ periodLabel: "2T 52'" }));
    expect(first).toEqual(jasmine.objectContaining({ periodLabel: "1T 7'" }));
    expect(halftime).toEqual(jasmine.objectContaining({ periodLabel: 'Entretiempo' }));
  });

  it('next lleva los huecos de la nómina: sin nómina, suplentes 3/8 y completa', () => {
    const date = '2026-11-12T14:30:00';
    const none = buildCoachBoard(context([match({ status: 'empty_roster', date })], { roster: null }));
    const short = buildCoachBoard(context([match({ status: 'not_started', date })], { roster: { starters: 15, substitutes: 3 } }));
    const full = buildCoachBoard(context([match({ status: 'not_started', date })], { roster: { starters: 15, substitutes: 8 } }));
    expect(none).toEqual(jasmine.objectContaining({ kind: 'next', rosterGaps: jasmine.objectContaining({ kind: 'none' }) }));
    expect(short).toEqual(jasmine.objectContaining({ rosterGaps: jasmine.objectContaining({ kind: 'substitutes', label: 'Suplentes 3/8' }) }));
    expect(full).toEqual(jasmine.objectContaining({ rosterGaps: { kind: 'complete' } }));
  });

  it('con menos de 24 h y nómina: match-day', () => {
    const board = buildCoachBoard(context([match({ status: 'not_started' })]));
    expect(board.kind).toBe('match-day');
  });

  it('más lejos: next con fecha relativa, hora y chips de nómina', () => {
    const board = buildCoachBoard(context([match({ date: '2026-11-09T14:30:00', status: 'not_started' })]));
    expect(board).toEqual(jasmine.objectContaining({
      kind: 'next', dateLabel: 'Lun 9 nov', time: '14:30', opponent: 'Trelew', city: 'Trelew', starters: 15, substitutes: 6, readyOffline: true
    }));
  });

  it('sin nómina a menos de 24 h sigue siendo next (no se ofrece capturar)', () => {
    expect(buildCoachBoard(context([match({ status: 'empty_roster' })])).kind).toBe('next');
  });

  describe('semana de juego', () => {
    const stages = (board: ReturnType<typeof buildCoachBoard>) => board.kind !== 'onboarding' && 'week' in board ? board.week : null;

    it('next lleva la semana: Entrenar con el rótulo de la división y el paso', () => {
      const week = stages(buildCoachBoard(context([match({ date: '2026-11-12T14:30:00', status: 'not_started' })], { roster: { starters: 15, substitutes: 8 } })));
      expect(week?.stage).toBe('train');
      expect(week?.label).toBe('Semana de juego · Superior · paso 2 de 4');
      expect(week?.steps.map(step => step.status)).toEqual(['done', 'current', 'done', 'pending']);
    });

    it('con suplentes 6/8 a menos de 72 h la etapa es Convocar', () => {
      const week = stages(buildCoachBoard(context([match({ date: '2026-11-08T14:30:00', status: 'not_started' })])));
      expect(week?.stage).toBe('call-up');
      expect(week?.steps[2]).toEqual(jasmine.objectContaining({ status: 'current', subtitle: 'Suplentes 6/8' }));
    });

    it('el día de partido (match-day) y los partidos en curso son la etapa Jugar', () => {
      expect(stages(buildCoachBoard(context([match({ status: 'not_started' })])))?.stage).toBe('play');
      expect(stages(buildCoachBoard(context([match({ status: 'in_progress', date: '2026-11-07T14:30:00' })])))?.stage).toBe('play');
      expect(stages(buildCoachBoard(context([match({ status: 'in_progress' })], { captureMatchId: 'm1', progress: null })))?.stage).toBe('play');
    });

    it('un análisis incompleto del último partido hace de Analizar el paso actual y muestra su rival y %', () => {
      const board = buildCoachBoard(context([
        match({ id: 'f', status: 'finished', date: '2026-11-01T15:00:00' }),
        match({ id: 'n', status: 'not_started', date: '2026-11-20T15:00:00' })
      ], { analysis: { percent: 85, minutesWithoutZone: 0 } }));
      const week = stages(board);
      expect(week?.stage).toBe('analyze');
      expect(week?.steps[0].subtitle).toBe('vs Trelew · 85 %');
    });

    it('sin partido por jugar ni análisis pendiente no hay semana', () => {
      expect(stages(buildCoachBoard(context([match({ status: 'finished', date: '2026-11-01T15:00:00' })])))).toBeNull();
    });
  });

  it('sin partidos: primeros pasos para programar uno', () => {
    expect(buildCoachBoard(context([]))).toEqual({ kind: 'onboarding', step: 'schedule-match' });
  });

  it('con partidos jugados y ninguno programado: team-idle con el último resultado, no "Arrancá la temporada"', () => {
    const board = buildCoachBoard(context([
      match({ id: 'a', status: 'finished', date: '2026-10-10T15:00:00', homeScore: 10, awayScore: 20 }),
      match({ id: 'b', status: 'finished', date: '2026-10-17T15:00:00', homeScore: 32, awayScore: 21 })
    ]));
    expect(board).toEqual({
      kind: 'team-idle', divisionName: 'Superior',
      last: { opponent: 'Trelew', dateLabel: '17 oct', ownScore: 32, opponentScore: 21, result: 'win' }
    });
  });

  it('team-idle: un terminado con fecha futura que se jugó antes no es el último, y con finishedAt nulo manda la fecha', () => {
    const board = buildCoachBoard(context([
      match({ id: 'a', status: 'finished', date: '2026-12-15T15:00:00', finishedAt: '2026-10-10T19:00:00Z', homeScore: 10, awayScore: 20 }),
      match({ id: 'b', status: 'finished', date: '2026-10-17T15:00:00', finishedAt: null, homeScore: 32, awayScore: 21 })
    ]));
    expect(board).toEqual(jasmine.objectContaining({ kind: 'team-idle', last: jasmine.objectContaining({ dateLabel: '17 oct', ownScore: 32 }) }));
  });

  it('team-idle: un terminado con fecha futura cuenta como jugado y se rotula con el día en que terminó', () => {
    const board = buildCoachBoard(context([
      match({ id: 'a', status: 'finished', date: '2026-10-10T15:00:00', finishedAt: '2026-10-10T19:00:00Z' }),
      match({ id: 'b', status: 'finished', date: '2026-12-15T15:00:00', finishedAt: '2026-11-06T15:00:00Z', homeScore: 5, awayScore: 3 })
    ]));
    expect(board).toEqual(jasmine.objectContaining({ kind: 'team-idle', last: jasmine.objectContaining({ dateLabel: '6 nov', ownScore: 5 }) }));
  });

  it('en curso con fecha de mañana: live-elsewhere / live-here, no "next"', () => {
    const tomorrow = match({ status: 'in_progress', date: '2026-11-07T14:30:00' });
    expect(buildCoachBoard(context([tomorrow])).kind).toBe('live-elsewhere');
    expect(buildCoachBoard(context([tomorrow], { captureMatchId: 'm1' })).kind).toBe('live-here');
  });

  it('team-idle también si el último fue derrota o empate', () => {
    const lost = buildCoachBoard(context([match({ status: 'finished', date: '2026-10-10T15:00:00', homeScore: 10, awayScore: 20 })]));
    const drawn = buildCoachBoard(context([match({ status: 'finished', date: '2026-10-10T15:00:00', homeScore: 20, awayScore: 20 })]));
    expect(lost.kind === 'team-idle' && lost.last.result).toBe('loss');
    expect(drawn.kind === 'team-idle' && drawn.last.result).toBe('draw');
  });

  it('solo partidos cancelados: sigue siendo primeros pasos (nunca se jugó)', () => {
    expect(buildCoachBoard(context([match({ status: 'cancelled' })]))).toEqual({ kind: 'onboarding', step: 'schedule-match' });
  });

  it('con un próximo programado gana el próximo aunque haya partidos jugados', () => {
    const board = buildCoachBoard(context([
      match({ id: 'a', status: 'finished', date: '2026-10-10T15:00:00' }),
      match({ id: 'b', status: 'empty_roster', date: '2026-11-09T14:30:00' })
    ]));
    expect(board.kind).toBe('next');
  });

  it('el entretiempo se muestra como tal', () => {
    expect(periodText(match({ status: 'halftime' }), null)).toBe('Entretiempo');
  });
});
