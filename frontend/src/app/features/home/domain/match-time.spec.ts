import { dayLabel, shortDateLabel, formatLocalClock, formatUtcAsArgentina, msUntil, parseBackendInstant, parseWallClock, relativeMatchLabel, seasonRange } from './match-time';

describe('match-time', () => {
  const now = new Date(2026, 10, 6, 18, 0, 0); // vie 6 nov 2026, 18:00

  describe('parseWallClock', () => {
    it('toma la hora de pared sin correrla', () => {
      const start = parseWallClock('2026-11-07T14:30:00')!;
      expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()])
        .toEqual([2026, 10, 7, 14, 30]);
    });

    it('acepta fecha sin segundos y descarta textos inválidos', () => {
      expect(parseWallClock('2026-11-07T14:30')!.getHours()).toBe(14);
      expect(parseWallClock('mañana')).toBeNull();
    });
  });

  describe('relativeMatchLabel', () => {
    it('mañana', () => {
      expect(relativeMatchLabel(new Date(2026, 10, 7, 14, 30), now)).toBe('Sáb 7 nov · mañana · 14:30');
    });

    it('hoy', () => {
      expect(relativeMatchLabel(new Date(2026, 10, 6, 21, 5), now)).toBe('Vie 6 nov · hoy · 21:05');
    });

    it('desde pasado mañana no lleva palabra relativa', () => {
      expect(relativeMatchLabel(new Date(2026, 10, 9, 9, 0), now)).toBe('Lun 9 nov · 09:00');
    });

    it('ayer', () => {
      expect(relativeMatchLabel(new Date(2026, 10, 5, 16, 0), now)).toBe('Jue 5 nov · ayer · 16:00');
    });
  });

  it('msUntil es negativo si el partido ya empezó', () => {
    expect(msUntil(new Date(2026, 10, 6, 17, 0), now)).toBe(-3_600_000);
  });

  describe('parseBackendInstant', () => {
    it('un LocalDateTime sin zona es UTC, no la hora del navegador', () => {
      expect(parseBackendInstant('2026-11-07T01:05:00')!.toISOString()).toBe('2026-11-07T01:05:00.000Z');
      expect(parseBackendInstant('2026-11-07T01:05:00.123456')!.toISOString()).toBe('2026-11-07T01:05:00.123Z');
    });

    it('respeta la Z y los offsets', () => {
      expect(parseBackendInstant('2026-11-07T01:05:00.000Z')!.toISOString()).toBe('2026-11-07T01:05:00.000Z');
      expect(parseBackendInstant('2026-11-07T01:05:00-03:00')!.toISOString()).toBe('2026-11-07T04:05:00.000Z');
      expect(parseBackendInstant('2026-11-07T01:05:00+0100')!.toISOString()).toBe('2026-11-07T00:05:00.000Z');
    });

    it('texto inválido: null', () => {
      expect(parseBackendInstant('no-es-fecha')).toBeNull();
    });
  });

  describe('formatUtcAsArgentina', () => {
    it('sin zona se interpreta como UTC (así llega del backend)', () => {
      expect(formatUtcAsArgentina('2026-11-07T01:12:00')).toBe('22:12');
    });

    it('convierte UTC a hora de Buenos Aires (UTC-3)', () => {
      expect(formatUtcAsArgentina('2026-11-06T17:30:00Z')).toBe('14:30');
    });

    it('cruza la medianoche', () => {
      expect(formatUtcAsArgentina('2026-11-07T01:05:00Z')).toBe('22:05');
    });

    it('devuelve null con una fecha inválida', () => {
      expect(formatUtcAsArgentina('no-es-fecha')).toBeNull();
    });
  });

  it('seasonRange cubre del 1 de enero al día de hoy', () => {
    expect(seasonRange(now)).toEqual({ from: '2026-01-01', to: '2026-11-06' });
  });

  it('formatLocalClock da la hora local con ceros', () => {
    expect(formatLocalClock(new Date(2026, 10, 6, 9, 5).getTime())).toBe('09:05');
  });

  it('shortDateLabel da día y mes', () => {
    expect(shortDateLabel(new Date(2026, 10, 1))).toBe('1 nov');
  });

  it('dayLabel da día de la semana, número y mes', () => {
    expect(dayLabel(new Date(2026, 10, 7))).toBe('Sáb 7 nov');
  });
});
