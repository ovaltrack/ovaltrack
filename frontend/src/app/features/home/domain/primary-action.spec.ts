import { AdminRuleContext, CoachRuleContext, RuleMatch, adminRules, coachRules, isActionEnabled, playerRules, resolvePrimaryAction, upcomingMatches } from './primary-action';

const now = new Date(2026, 10, 6, 18, 0); // vie 6 nov, 18:00

const at = (daysFromNow: number, hours: number): string => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromNow, hours, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00:00`;
};
const match = (id: string, status: RuleMatch['status'], date: string): RuleMatch => ({ id, status, date });

function coach(overrides: Partial<CoachRuleContext>): CoachRuleContext {
  return { now, matches: [], captureMatchId: null, lastFinished: null, ...overrides };
}

describe('coachRules', () => {
  const resolve = (ctx: CoachRuleContext) => resolvePrimaryAction(coachRules, ctx);

  it('1 · partido en curso que captura este dispositivo: continuar captura', () => {
    const action = resolve(coach({ matches: [match('m1', 'in_progress', at(0, 16))], captureMatchId: 'm1' }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'continue-capture', route: '/live-capture/m1', target: 'board' }));
  });

  it('1 · en el entretiempo: ir al entretiempo', () => {
    const action = resolve(coach({ matches: [match('m1', 'halftime', at(0, 16))], captureMatchId: 'm1' }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'go-halftime', route: '/live-capture/m1/halftime' }));
  });

  it('2 · partido con nómina en menos de 24 h: capturar en vivo', () => {
    const action = resolve(coach({ matches: [match('m2', 'not_started', at(1, 14))] }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'capture-live', route: '/live-capture/m2' }));
  });

  it('2 · a más de 24 h no ofrece capturar', () => {
    const action = resolve(coach({ matches: [match('m2', 'not_started', at(2, 14))] }));
    expect(action).toBeNull();
  });

  it('2 · sigue ofreciendo capturar poco después de la hora de inicio', () => {
    const action = resolve(coach({ matches: [match('m2', 'not_started', at(0, 17))] }));
    expect(action?.kind).toBe('capture-live');
  });

  it('3 · sin nómina a 72 h o menos: definir alineación', () => {
    const action = resolve(coach({ matches: [match('m3', 'empty_roster', at(2, 14))] }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'define-lineup', route: '/selection-roster/m3', requiresConnection: true }));
  });

  it('2/3 · partido en not_started con 0 titulares cargados: definir alineación, no capturar', () => {
    const action = resolve(coach({ matches: [match('m2', 'not_started', at(1, 14))], nextRoster: { starters: 0 } }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'define-lineup', route: '/selection-roster/m2' }));
  });

  it('2 · con 15 titulares cargados ofrece capturar', () => {
    const action = resolve(coach({ matches: [match('m2', 'not_started', at(1, 14))], nextRoster: { starters: 15 } }));
    expect(action?.kind).toBe('capture-live');
  });

  it('2 · si la nómina no se pudo leer (sin red) se confía en el estado y se ofrece capturar', () => {
    const action = resolve(coach({ matches: [match('m2', 'not_started', at(1, 14))], nextRoster: null }));
    expect(action?.kind).toBe('capture-live');
  });

  it('3 · sin nómina a más de 72 h no es primario', () => {
    const action = resolve(coach({ matches: [match('m3', 'empty_roster', at(5, 14))] }));
    expect(action).toBeNull();
  });

  it('4 · último partido con análisis incompleto: completar análisis en la tarjeta de deuda', () => {
    const action = resolve(coach({
      matches: [match('m4', 'not_started', at(5, 14))],
      lastFinished: { id: 'm0', analysisPercent: 82 }
    }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'complete-analysis', route: '/post-match/m0', target: 'debt-tile' }));
  });

  it('4 · con el análisis al 100 % no hay deuda', () => {
    const action = resolve(coach({
      matches: [match('m4', 'not_started', at(5, 14))],
      lastFinished: { id: 'm0', analysisPercent: 100 }
    }));
    expect(action).toBeNull();
  });

  it('5 · sin partidos programados: programar partido', () => {
    expect(resolve(coach({}))?.kind).toBe('schedule-match');
  });

  it('6 · si no aplica ninguna regla, no hay primario', () => {
    expect(resolve(coach({ matches: [match('m5', 'not_started', at(6, 14))] }))).toBeNull();
  });

  it('un partido que solo se captura en otro dispositivo nunca ofrece capturar desde acá', () => {
    const matches = [match('live', 'in_progress', at(0, 16)), match('next', 'not_started', at(0, 20))];
    const action = resolve(coach({ matches, captureMatchId: 'otro-partido' }));
    expect(action?.kind).not.toBe('capture-live');
    expect(action?.kind).not.toBe('continue-capture');
    expect(action).toBeNull();
  });

  it('un partido en curso sin captura local tampoco ofrece programar otro', () => {
    expect(resolve(coach({ matches: [match('live', 'in_progress', at(0, 16))] }))).toBeNull();
  });

  it('un partido sin iniciar de hace meses no cuenta como próximo', () => {
    const action = resolve(coach({ matches: [match('viejo', 'not_started', '2026-03-01T15:00:00')] }));
    expect(action?.kind).toBe('schedule-match');
  });
});

describe('isActionEnabled', () => {
  const capture = resolvePrimaryAction(coachRules, coach({ matches: [match('m2', 'not_started', at(1, 14))] }))!;
  const lineup = resolvePrimaryAction(coachRules, coach({ matches: [match('m3', 'empty_roster', at(2, 14))] }))!;

  it('capturar sigue habilitado sin conexión', () => {
    expect(isActionEnabled(capture, false)).toBeTrue();
  });

  it('definir alineación requiere conexión', () => {
    expect(isActionEnabled(lineup, false)).toBeFalse();
    expect(isActionEnabled(lineup, true)).toBeTrue();
  });
});

describe('upcomingMatches', () => {
  it('ordena por fecha e ignora finalizados y cancelados', () => {
    const result = upcomingMatches([
      match('b', 'not_started', at(3, 10)),
      match('x', 'finished', at(1, 10)),
      match('a', 'empty_roster', at(1, 12)),
      match('y', 'cancelled', at(1, 9))
    ], now);
    expect(result.map(m => m.id)).toEqual(['a', 'b']);
  });
});

describe('adminRules', () => {
  const resolve = (ctx: AdminRuleContext) => resolvePrimaryAction(adminRules, ctx);
  const division = (id: string, hasCoach = true) => ({ id, hasCoach });
  const admin = (overrides: Partial<AdminRuleContext>): AdminRuleContext => ({ now, divisions: [division('d1')], matches: [], ...overrides });
  const clubMatch = (id: string, divisionId: string, status: RuleMatch['status'], date: string) => ({ ...match(id, status, date), divisionId });

  it('1 · partido en not_started con nómina incompleta a 72 h o menos: definir alineación', () => {
    const action = resolvePrimaryAction(adminRules, {
      now, divisions: [{ id: 'd1', hasCoach: true }], matches: [clubMatch('m1', 'd1', 'not_started', at(0, 20))], rosters: { m1: { starters: 0 } }
    });
    expect(action).toEqual(jasmine.objectContaining({ kind: 'define-lineup', route: '/selection-roster/m1' }));
  });

  it('1 · gana la división que juega primero sin nómina', () => {
    const action = resolve(admin({
      divisions: [division('d1'), division('d2')],
      matches: [clubMatch('tarde', 'd1', 'empty_roster', at(2, 16)), clubMatch('temprano', 'd2', 'empty_roster', at(1, 10))]
    }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'define-lineup', route: '/selection-roster/temprano' }));
  });

  it('2 · división sin entrenador: asignar', () => {
    const action = resolve(admin({
      divisions: [division('d1'), division('d2', false)],
      matches: [clubMatch('m', 'd1', 'not_started', at(5, 10))]
    }));
    expect(action).toEqual(jasmine.objectContaining({ kind: 'assign-coach', route: '/divisions/d2/coaches', target: 'inbox-tile' }));
  });

  it('3 · club sin divisiones: crear división', () => {
    expect(resolve(admin({ divisions: [] }))?.kind).toBe('create-division');
  });

  it('3 · divisiones sin partidos: programar partido', () => {
    expect(resolve(admin({}))?.kind).toBe('schedule-match');
  });

  it('con todo en orden no hay primario', () => {
    expect(resolve(admin({ matches: [clubMatch('m', 'd1', 'not_started', at(5, 10))] }))).toBeNull();
  });
});

describe('playerRules', () => {
  it('con un partido jugado ofrece ver ese partido', () => {
    expect(resolvePrimaryAction(playerRules, { lastMatchId: 'm9' })).toEqual(jasmine.objectContaining({
      kind: 'view-my-match', route: '/player-statistics/m9', target: 'board', requiresConnection: true
    }));
  });

  it('sin partidos no hay primario', () => {
    expect(resolvePrimaryAction(playerRules, { lastMatchId: null })).toBeNull();
  });
});
