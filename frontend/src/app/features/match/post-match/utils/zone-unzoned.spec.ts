import { ZoneRule } from '../../types/event-type.types';
import { ZoneAssignmentResponse } from '../../types/zone.types';
import { ZoneRulesByType } from './zone-rule';
import { UnzonedSource, unzonedReason, unzonedWithReason } from './zone-unzoned';

describe('zone-unzoned', () => {
  const tramo = (id: string, period: 1 | 2, startMinute: number, endMinute: number, row = 2, col = 6): ZoneAssignmentResponse =>
    ({ id, matchId: 'm', period, startMinute, endMinute, row, col });
  const event = (id: string, typeId: string, name: string, period: number, seconds: number, extra: Partial<UnzonedSource> = {}): UnzonedSource =>
    ({ id, eventTypeId: typeId, eventTypeName: name, period, matchTime: seconds, teamPossession: 'OWN', attributes: {}, zone: null, ...extra });
  const SCRUM: ZoneRule = { columns: [2, 3, 4, 5] };
  const rules: ZoneRulesByType = new Map<string, ZoneRule | null>([['scrum', SCRUM], ['tackle', null]]);

  describe('unzonedReason', () => {
    const tramos = [tramo('a', 1, 20, 25)];

    it('sin período válido o sin tiempo no se puede ubicar', () => {
      expect(unzonedReason({ period: 3, matchTime: 600 }, tramos)).toBe('NO_TIME');
      expect(unzonedReason({ period: 0, matchTime: 600 }, tramos)).toBe('NO_TIME');
      expect(unzonedReason({ period: 1, matchTime: null as unknown as number }, tramos)).toBe('NO_TIME');
    });

    it('si ningún tramo cubre su minuto es un hueco', () => {
      expect(unzonedReason({ period: 1, matchTime: 10 * 60 }, tramos)).toBe('GAP');
      expect(unzonedReason({ period: 2, matchTime: 50 * 60 }, tramos)).toBe('GAP');
    });

    it('si un tramo cubre su minuto, el tramo no admite el tipo', () => {
      expect(unzonedReason({ period: 1, matchTime: 22 * 60 }, tramos)).toBe('FORBIDDEN');
    });

    it('el rango es [inicio, fin): el fin ya es otro minuto', () => {
      expect(unzonedReason({ period: 1, matchTime: 20 * 60 }, tramos)).toBe('FORBIDDEN');
      expect(unzonedReason({ period: 1, matchTime: 25 * 60 }, tramos)).toBe('GAP');
    });

    it('el tiempo añadido cuenta en el último minuto del tiempo', () => {
      expect(unzonedReason({ period: 1, matchTime: 43 * 60 }, [tramo('b', 1, 35, 40)])).toBe('FORBIDDEN');
    });
  });

  describe('unzonedWithReason', () => {
    const tramos = [tramo('a', 1, 20, 25, 2, 6)];

    it('solo devuelve las jugadas sin zona', () => {
      const events = [event('con', 'tackle', 'Tackle', 1, 600, { zone: { row: 2, col: 3 } }), event('sin', 'tackle', 'Tackle', 1, 700)];

      expect(unzonedWithReason(events, tramos, rules).map(item => item.event.id)).toEqual(['sin']);
    });

    it('describe un hueco con el reloj y el minuto', () => {
      const [item] = unzonedWithReason([event('a', 'scrum', 'Scrum', 1, 10 * 60 + 5)], tramos, rules);

      expect(item.reason).toBe('GAP');
      expect(item.tramo).toBeNull();
      expect(item.minute).toBe(10);
      expect(item.clock).toBe('1T 10:05');
      expect(item.reasonText).toBe('Ningún tramo cubre este minuto');
    });

    it('describe un tramo que no admite el tipo, con lo que sí admite', () => {
      const [item] = unzonedWithReason([event('a', 'scrum', 'Scrum', 1, 22 * 60)], tramos, rules);

      expect(item.reason).toBe('FORBIDDEN');
      expect(item.tramo?.id).toBe('a');
      expect(item.minute).toBe(22);
      expect(item.reasonText).toBe("El tramo 1T 20'–25' (C6) no admite Scrum: solo puede ocurrir en las columnas 2 a 5");
    });

    it('si el catálogo no trae la regla, el motivo no inventa qué admite', () => {
      const [item] = unzonedWithReason([event('a', 'scrum', 'Scrum', 1, 22 * 60)], tramos, new Map());

      expect(item.reasonText).toBe("El tramo 1T 20'–25' (C6) no admite Scrum");
    });

    it('sin tiempo válido no hay minuto y lo dice', () => {
      const [item] = unzonedWithReason([event('a', 'tackle', 'Tackle', 3, 600)], tramos, rules);

      expect(item.reason).toBe('NO_TIME');
      expect(item.minute).toBeNull();
      expect(item.reasonText).toBe('Sin tiempo de partido');
    });

    it('en el segundo tiempo usa el reloj acumulado', () => {
      const [item] = unzonedWithReason([event('a', 'tackle', 'Tackle', 2, 65 * 60 + 30)], tramos, rules);

      expect(item.clock).toBe('2T 65:30');
      expect(item.minute).toBe(65);
    });

    it('las ordena cronológicamente y deja al final las que no tienen tiempo', () => {
      const events = [
        event('sinTiempo', 'tackle', 'Tackle', 3, 0),
        event('segundo', 'tackle', 'Tackle', 2, 50 * 60),
        event('tarde', 'tackle', 'Tackle', 1, 900),
        event('temprano', 'tackle', 'Tackle', 1, 300)
      ];

      expect(unzonedWithReason(events, tramos, rules).map(item => item.event.id)).toEqual(['temprano', 'tarde', 'segundo', 'sinTiempo']);
    });

    it('sin jugadas sin zona devuelve una lista vacía', () => {
      expect(unzonedWithReason([], tramos, rules)).toEqual([]);
    });
  });
});
