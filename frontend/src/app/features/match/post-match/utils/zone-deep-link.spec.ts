import { resolveZoneDeepLink, zoneDeepLinkParams } from './zone-deep-link';
import { EventZoneLink } from './zone-event-link';
import { ZoneAssignmentResponse } from '../../types/zone.types';

describe('zone-deep-link', () => {
  const segment = (id: string, period: 1 | 2, startMinute: number, endMinute: number): ZoneAssignmentResponse =>
    ({ id, matchId: 'm', period, startMinute, endMinute, row: 2, col: 4 });
  const tramos = [segment('a', 1, 10, 25), segment('b', 2, 50, 60)];

  describe('resolveZoneDeepLink', () => {
    it('sin parámetros no hace nada', () => {
      expect(resolveZoneDeepLink({}, tramos)).toEqual({ kind: 'none' });
      expect(resolveZoneDeepLink({ tramo: null, minuto: null }, tramos)).toEqual({ kind: 'none' });
    });

    it('?tramo= abre el tramo del partido', () => {
      expect(resolveZoneDeepLink({ tramo: 'b' }, tramos)).toEqual({ kind: 'segment', segment: tramos[1] });
    });

    it('?tramo= borrado, ajeno o inventado es inválido', () => {
      expect(resolveZoneDeepLink({ tramo: 'zzz' }, tramos)).toEqual({ kind: 'invalid', reason: 'tramo' });
      expect(resolveZoneDeepLink({ tramo: 'a' }, [])).toEqual({ kind: 'invalid', reason: 'tramo' });
    });

    it('?tramo= manda sobre ?minuto=', () => {
      expect(resolveZoneDeepLink({ tramo: 'a', minuto: '55' }, tramos)).toEqual({ kind: 'segment', segment: tramos[0] });
      expect(resolveZoneDeepLink({ tramo: 'nope', minuto: '5' }, tramos)).toEqual({ kind: 'invalid', reason: 'tramo' });
    });

    it('?minuto= dentro de un hueco lo precarga', () => {
      expect(resolveZoneDeepLink({ minuto: '5' }, tramos)).toEqual({ kind: 'gap', gap: { period: 1, start: 0, end: 10 }, minute: 5 });
      expect(resolveZoneDeepLink({ minuto: '70' }, tramos)).toEqual({ kind: 'gap', gap: { period: 2, start: 60, end: 80 }, minute: 70 });
    });

    it('?minuto= ya dentro de un tramo abre ese tramo; el fin es exclusivo', () => {
      expect(resolveZoneDeepLink({ minuto: '10' }, tramos)).toEqual({ kind: 'segment', segment: tramos[0] });
      expect(resolveZoneDeepLink({ minuto: '24' }, tramos)).toEqual({ kind: 'segment', segment: tramos[0] });
      expect(resolveZoneDeepLink({ minuto: '25' }, tramos)).toEqual({ kind: 'gap', gap: { period: 1, start: 25, end: 40 }, minute: 25 });
    });

    it('sin tramos el hueco es todo el tiempo (el 0 y el 79 son válidos)', () => {
      expect(resolveZoneDeepLink({ minuto: '0' }, [])).toEqual({ kind: 'gap', gap: { period: 1, start: 0, end: 40 }, minute: 0 });
      expect(resolveZoneDeepLink({ minuto: '79' }, [])).toEqual({ kind: 'gap', gap: { period: 2, start: 40, end: 80 }, minute: 79 });
    });

    it('?minuto= no numérico, negativo, decimal o fuera de 0–79 es inválido', () => {
      for (const minuto of ['abc', '-1', '5.5', '80', '120', '', ' 5', '1e1']) {
        expect(resolveZoneDeepLink({ minuto }, tramos)).toEqual({ kind: 'invalid', reason: 'minuto' });
      }
    });
  });

  describe('zoneDeepLinkParams', () => {
    const link = (overrides: Partial<EventZoneLink>): EventZoneLink =>
      ({ segment: null, gap: null, minute: 12, isAddedTime: false, ...overrides });

    it('con tramo lleva al tramo', () => {
      expect(zoneDeepLinkParams(link({ segment: tramos[0] }))).toEqual({ tramo: 'a' });
    });

    it('sin zona lleva al minuto del hueco', () => {
      expect(zoneDeepLinkParams(link({ gap: { period: 1, start: 0, end: 10 }, minute: 7 }))).toEqual({ minuto: '7' });
    });

    it('con zona pero sin tramo (o sin datos) lleva a Zonas sin parámetros', () => {
      expect(zoneDeepLinkParams(link({}))).toEqual({});
      expect(zoneDeepLinkParams(null)).toEqual({});
    });
  });
});
