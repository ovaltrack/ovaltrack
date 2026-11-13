import { EventZoneLink, describeEventZone, resolveEventZoneLink, zoneForEvent } from './zone-event-link';
import { ZoneRule } from '../../types/event-type.types';
import { ZoneAssignmentResponse } from '../../types/zone.types';

describe('zone-event-link', () => {
  const segment = (id: string, period: 1 | 2, startMinute: number, endMinute: number, row = 2, col = 4): ZoneAssignmentResponse =>
    ({ id, matchId: 'm', period, startMinute, endMinute, row, col });

  const event = (period: number, minutes: number, seconds = 0, zone: { row: number; col: number } | null = { row: 2, col: 4 }) =>
    ({ period, matchTime: minutes * 60 + seconds, zone });

  describe('con zona', () => {
    it('devuelve el tramo que contiene el minuto cuando coincide con la zona', () => {
      const tramo = segment('a', 1, 10, 25);

      const link = resolveEventZoneLink(event(1, 12), [segment('x', 1, 0, 10, 1, 1), tramo]);

      expect(link?.segment).toBe(tramo);
      expect(link?.gap).toBeNull();
      expect(link?.minute).toBe(12);
      expect(link?.isAddedTime).toBeFalse();
    });

    it('el inicio es inclusivo y el fin exclusivo: el minuto 25 es del tramo que empieza en 25', () => {
      const primero = segment('a', 1, 10, 25, 2, 4);
      const segundo = segment('b', 1, 25, 40, 2, 4);

      expect(resolveEventZoneLink(event(1, 10), [primero, segundo])?.segment).toBe(primero);
      expect(resolveEventZoneLink(event(1, 24, 59), [primero, segundo])?.segment).toBe(primero);
      expect(resolveEventZoneLink(event(1, 25), [primero, segundo])?.segment).toBe(segundo);
    });

    it('en el 2T usa minutos acumulados (40–80)', () => {
      const tramo = segment('a', 2, 50, 60);

      expect(resolveEventZoneLink(event(2, 55), [tramo])?.segment).toBe(tramo);
      expect(resolveEventZoneLink(event(2, 55), [tramo])?.minute).toBe(55);
    });

    it('no mezcla tiempos: un tramo del 2T no explica un evento del 1T', () => {
      const link = resolveEventZoneLink(event(1, 55), [segment('a', 2, 50, 60)]);

      expect(link?.segment).toBeNull();
    });

    it('si el tramo no coincide con la zona del evento, devuelve solo el minuto (se muestra solo la zona)', () => {
      const link = resolveEventZoneLink(event(1, 12, 0, { row: 3, col: 6 }), [segment('a', 1, 10, 25, 2, 4)]);

      expect(link?.segment).toBeNull();
      expect(link?.gap).toBeNull();
      expect(link?.minute).toBe(12);
    });

    it('con zona pero sin ningún tramo en ese minuto, tampoco ofrece hueco', () => {
      const link = resolveEventZoneLink(event(1, 12), []);

      expect(link?.segment).toBeNull();
      expect(link?.gap).toBeNull();
    });
  });

  describe('tiempo añadido', () => {
    it('después del 40′ del 1T cuenta en el tramo que termina en 40′', () => {
      const ultimo = segment('a', 1, 30, 40);

      const link = resolveEventZoneLink(event(1, 41, 30), [ultimo]);

      expect(link?.segment).toBe(ultimo);
      expect(link?.minute).toBe(39);
      expect(link?.isAddedTime).toBeTrue();
    });

    it('después del 80′ del 2T cuenta en el tramo que termina en 80′', () => {
      const ultimo = segment('a', 2, 70, 80);

      const link = resolveEventZoneLink(event(2, 83), [ultimo]);

      expect(link?.segment).toBe(ultimo);
      expect(link?.minute).toBe(79);
      expect(link?.isAddedTime).toBeTrue();
    });

    it('el segundo exacto 40:00 ya es tiempo añadido; 39:59 no', () => {
      expect(resolveEventZoneLink(event(1, 39, 59), [])?.isAddedTime).toBeFalse();
      expect(resolveEventZoneLink(event(1, 40, 0), [])?.isAddedTime).toBeTrue();
    });

    it('sin zona, el hueco del tiempo añadido es el último del tiempo', () => {
      const link = resolveEventZoneLink(event(1, 42, 0, null), [segment('a', 1, 0, 30)]);

      expect(link?.gap).toEqual({ period: 1, start: 30, end: 40 });
      expect(link?.isAddedTime).toBeTrue();
    });
  });

  describe('sin zona', () => {
    it('devuelve el hueco que contiene el minuto', () => {
      const link = resolveEventZoneLink(event(1, 12, 0, null), [segment('a', 1, 0, 10), segment('b', 1, 20, 40)]);

      expect(link?.segment).toBeNull();
      expect(link?.gap).toEqual({ period: 1, start: 10, end: 20 });
    });

    it('sin ningún tramo el hueco es todo el tiempo', () => {
      expect(resolveEventZoneLink(event(2, 55, 0, null), [])?.gap).toEqual({ period: 2, start: 40, end: 80 });
    });

    it('sin zona pero dentro de un tramo (datos desfasados) no ofrece hueco ni tramo', () => {
      const link = resolveEventZoneLink(event(1, 12, 0, null), [segment('a', 1, 10, 25)]);

      expect(link?.segment).toBeNull();
      expect(link?.gap).toBeNull();
    });
  });

  describe('zoneForEvent', () => {
    it('devuelve la celda del tramo que contiene el minuto, con el tiempo añadido en el último tramo', () => {
      const tramos = [segment('a', 1, 0, 20, 1, 2), segment('b', 1, 20, 40, 3, 5)];

      expect(zoneForEvent(event(1, 10), tramos)).toEqual({ row: 1, col: 2 });
      expect(zoneForEvent(event(1, 20), tramos)).toEqual({ row: 3, col: 5 });
      expect(zoneForEvent(event(1, 42), tramos)).toEqual({ row: 3, col: 5 });
    });

    it('devuelve null sin tramo en ese minuto o sin tiempo válido', () => {
      expect(zoneForEvent(event(2, 55), [segment('a', 1, 0, 40)])).toBeNull();
      expect(zoneForEvent({ period: 0, matchTime: 600 }, [segment('a', 1, 0, 40)])).toBeNull();
    });
  });

  describe('zoneForEvent con la regla del tipo', () => {
    const TRY: ZoneRule = { columns: [6], rowFrom: 'zone' };
    const FIELD_PLAY: ZoneRule = { columns: [2, 3, 4, 5] };
    const timed = (minutes: number, teamPossession: 'OWN' | 'OPPONENT' | 'NEUTRAL' = 'OWN', attributes: Record<string, unknown> = {}) =>
      ({ period: 1, matchTime: minutes * 60, teamPossession, attributes });

    it('sin regla devuelve la celda del tramo, como siempre', () => {
      expect(zoneForEvent(timed(22), [segment('a', 1, 20, 25, 2, 5)])).toEqual({ row: 2, col: 5 });
      expect(zoneForEvent(timed(22), [segment('a', 1, 20, 25, 2, 5)], null)).toEqual({ row: 2, col: 5 });
    });

    it('una zona fija ignora el tramo', () => {
      expect(zoneForEvent(timed(22, 'OWN', { zone: 'right' }), [segment('a', 1, 20, 25, 2, 5)], TRY)).toEqual({ row: 3, col: 6 });
    });

    it('una zona fija existe aunque no haya tramos', () => {
      expect(zoneForEvent(timed(30, 'OWN', { zone: 'left' }), [], TRY)).toEqual({ row: 1, col: 6 });
    });

    it('un try del rival se espeja', () => {
      expect(zoneForEvent(timed(22, 'OPPONENT', { zone: 'left' }), [segment('a', 1, 20, 25, 2, 5)], TRY)).toEqual({ row: 3, col: 1 });
    });

    it('una celda de tramo prohibida para el tipo deja el evento sin zona', () => {
      expect(zoneForEvent(timed(22), [segment('a', 1, 20, 25, 2, 6)], FIELD_PLAY)).toBeNull();
    });

    it('una celda de tramo permitida se conserva', () => {
      expect(zoneForEvent(timed(22), [segment('a', 1, 20, 25, 2, 4)], FIELD_PLAY)).toEqual({ row: 2, col: 4 });
    });
  });

  describe('describeEventZone con zona fija', () => {
    it('aclara que la zona sale del tipo de evento y no de un tramo', () => {
      expect(describeEventZone({ row: 3, col: 6 }, null, true)).toBe('D6 · Derecha · In-goal rival · zona fija por el tipo');
    });

    it('sin zona fija el texto no cambia', () => {
      expect(describeEventZone({ row: 3, col: 6 }, null, false)).toBe('D6 · Derecha · In-goal rival');
    });
  });

  describe('describeEventZone', () => {
    const link = (overrides: Partial<EventZoneLink>): EventZoneLink => ({ segment: null, gap: null, minute: 12, isAddedTime: false, ...overrides });

    it('con zona y tramo: etiqueta, lateral, franja y rango', () => {
      expect(describeEventZone({ row: 2, col: 4 }, link({ segment: segment('a', 1, 10, 25) })))
        .toBe('C4 · Centro · Campo rival · tramo 10′–25′');
    });

    it('con zona pero sin tramo conocido: solo la zona', () => {
      expect(describeEventZone({ row: 3, col: 6 }, link({}))).toBe('D6 · Derecha · In-goal rival');
      expect(describeEventZone({ row: 3, col: 6 }, null)).toBe('D6 · Derecha · In-goal rival');
    });

    it('sin zona: nombra el hueco si se conoce', () => {
      expect(describeEventZone(null, link({ gap: { period: 1, start: 0, end: 10 } }))).toBe('Sin zona · hueco 0′–10′');
      expect(describeEventZone(null, null)).toBe('Sin zona');
    });

    it('aclara el tiempo añadido con el minuto en que termina el tiempo (40′ o 80′)', () => {
      expect(describeEventZone({ row: 2, col: 4 }, link({ segment: segment('a', 1, 30, 40), minute: 39, isAddedTime: true })))
        .toBe('C4 · Centro · Campo rival · tramo 30′–40′ · tiempo añadido: cuenta en el tramo que termina en 40′');
      expect(describeEventZone(null, link({ minute: 79, isAddedTime: true })))
        .toBe('Sin zona · tiempo añadido: cuenta en el tramo que termina en 80′');
    });
  });

  describe('evento sin tiempo válido', () => {
    it('devuelve null si el período no es 1 ni 2', () => {
      expect(resolveEventZoneLink(event(0, 12), [])).toBeNull();
      expect(resolveEventZoneLink(event(3, 12), [])).toBeNull();
    });

    it('devuelve null si el minuto de juego no es un número válido', () => {
      expect(resolveEventZoneLink({ period: 1, matchTime: NaN, zone: null }, [])).toBeNull();
      expect(resolveEventZoneLink({ period: 1, matchTime: -5, zone: null }, [])).toBeNull();
    });
  });
});
