import { DivisionMatchState, StateMatch, divisionMatchState, finishedInPlayOrder, playedAt } from './division-match-state';

describe('division-match-state', () => {
  const now = new Date(2026, 10, 6, 18, 0); // vie 6 nov 2026, 18:00
  const match = (id: string, status: StateMatch['status'], date: string, finishedAt?: string | null): StateMatch => ({ id, status, date, finishedAt });
  const state = (matches: StateMatch[], capture: string | null = null): DivisionMatchState<StateMatch> => divisionMatchState(matches, capture, now);

  describe('partido en curso', () => {
    it('con fecha de mañana sigue en curso: el estado del servidor gana sobre la fecha', () => {
      const result = state([match('a', 'in_progress', '2026-11-07T14:30:00'), match('b', 'not_started', '2026-11-08T14:30:00')]);
      expect(result.live?.id).toBe('a');
      expect(result.next?.id).toBe('b');
    });

    it('en el entretiempo también es en curso', () => {
      expect(state([match('a', 'halftime', '2026-11-05T14:30:00')]).live?.id).toBe('a');
    });

    it('capturado en este dispositivo: liveHere', () => {
      const result = state([match('a', 'in_progress', '2026-11-07T14:30:00')], 'a');
      expect(result.liveHere).toBeTrue();
    });

    it('en otro dispositivo: live sin liveHere', () => {
      const result = state([match('a', 'in_progress', '2026-11-07T14:30:00')], 'otro');
      expect(result.live?.id).toBe('a');
      expect(result.liveHere).toBeFalse();
    });

    it('si hay dos, gana el que captura este dispositivo', () => {
      const result = state([match('a', 'in_progress', '2026-11-06T10:00:00'), match('b', 'halftime', '2026-11-06T12:00:00')], 'b');
      expect(result.live?.id).toBe('b');
      expect(result.liveHere).toBeTrue();
    });

    it('sin partido en curso', () => {
      const result = state([match('a', 'not_started', '2026-11-07T14:30:00')]);
      expect(result.live).toBeNull();
      expect(result.liveHere).toBeFalse();
    });
  });

  describe('próximos', () => {
    it('quedan ordenados y excluyen finalizados, cancelados y en curso', () => {
      const result = state([
        match('tarde', 'empty_roster', '2026-11-09T14:30:00'),
        match('vivo', 'in_progress', '2026-11-07T10:00:00'),
        match('cancelado', 'cancelled', '2026-11-07T11:00:00'),
        match('jugado', 'finished', '2026-11-07T12:00:00'),
        match('pronto', 'not_started', '2026-11-07T14:30:00')
      ]);
      expect(result.upcoming.map(m => m.id)).toEqual(['pronto', 'tarde']);
      expect(result.next?.id).toBe('pronto');
    });
  });

  describe('último finalizado', () => {
    it('se ordena por finishedAt: uno con fecha futura pero jugado antes no gana', () => {
      const result = state([
        match('futuro', 'finished', '2026-12-15T15:00:00', '2026-11-01T20:00:00Z'),
        match('reciente', 'finished', '2026-11-05T15:00:00', '2026-11-05T19:00:00Z')
      ]);
      expect(result.lastFinished?.id).toBe('reciente');
    });

    it('un terminado con fecha futura cuenta como jugado si es el último en terminar', () => {
      const result = state([
        match('viejo', 'finished', '2026-10-20T15:00:00', '2026-10-20T19:00:00Z'),
        match('futuro', 'finished', '2026-12-15T15:00:00', '2026-11-06T20:00:00Z')
      ]);
      expect(result.lastFinished?.id).toBe('futuro');
    });

    it('con finishedAt nulo o ilegible usa la fecha programada', () => {
      const result = state([
        match('a', 'finished', '2026-10-20T15:00:00', null),
        match('b', 'finished', '2026-11-02T15:00:00'),
        match('c', 'finished', '2026-10-30T15:00:00', 'basura')
      ]);
      expect(result.lastFinished?.id).toBe('b');
    });

    it('un finishedAt sin zona (así llega del backend) se lee como UTC', () => {
      expect(playedAt(match('a', 'finished', '2026-11-05T15:00:00', '2026-11-05T22:00:00'))!.toISOString()).toBe('2026-11-05T22:00:00.000Z');
    });

    it('ignora los que no están finalizados y devuelve null si no hay ninguno', () => {
      expect(state([match('a', 'not_started', '2026-11-07T14:30:00'), match('b', 'cancelled', '2026-11-01T14:30:00')]).lastFinished).toBeNull();
    });

    it('finishedInPlayOrder va del más viejo al más reciente', () => {
      const ordered = finishedInPlayOrder([
        match('b', 'finished', '2026-11-05T15:00:00'), match('a', 'finished', '2026-11-01T15:00:00'), match('x', 'not_started', '2026-11-02T15:00:00')
      ]);
      expect(ordered.map(m => m.id)).toEqual(['a', 'b']);
    });
  });
});
