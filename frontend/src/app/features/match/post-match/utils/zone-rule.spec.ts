import { ZoneRule } from '../../types/event-type.types';
import { RuleEvent, RuleRange, ZoneRulesByType, describeZoneRule, findZoneRuleConflict, isFixedZone, placeEventZone } from './zone-rule';

describe('zone-rule', () => {
  const TRY: ZoneRule = { columns: [6], rowFrom: 'zone' };
  const TRY_PENALTY: ZoneRule = { columns: [6], rows: [2] };
  const ENTRY_22: ZoneRule = { columns: [5] };
  const FIELD_PLAY: ZoneRule = { columns: [2, 3, 4, 5] };
  const FIELD_PLAY_WITH_SIDE: ZoneRule = { columns: [2, 3, 4, 5], rowFrom: 'zone' };
  const NO_RESTRICTION: ZoneRule = {};

  describe('placeEventZone: la columna fija sale de la regla', () => {
    const sides: [string, number][] = [['left', 1], ['center', 2], ['right', 3]];
    sides.forEach(([side, row]) => {
      it(`lado ${side} -> fila ${row}, aunque el tramo diga otra cosa`, () => {
        expect(placeEventZone(TRY, 'OWN', { zone: side }, { row: 2, col: 3 })).toEqual({ row, col: 6 });
      });
    });

    it('sin tramo, la fila del atributo alcanza para fijar la celda', () => {
      expect(placeEventZone(TRY, 'OWN', { zone: 'right' }, null)).toEqual({ row: 3, col: 6 });
    });

    it('sin el atributo toma la fila del tramo', () => {
      expect(placeEventZone(TRY, 'OWN', {}, { row: 1, col: 2 })).toEqual({ row: 1, col: 6 });
    });

    it('sin el atributo y sin tramo no hay celda', () => {
      expect(placeEventZone(TRY, 'OWN', {}, null)).toBeNull();
    });

    it('un valor de atributo desconocido se ignora y se usa el tramo', () => {
      expect(placeEventZone(TRY, 'OWN', { zone: 'up' }, { row: 2, col: 4 })).toEqual({ row: 2, col: 6 });
    });

    it('fila y columna fijas: ni el tramo ni los atributos las cambian', () => {
      expect(placeEventZone(TRY_PENALTY, 'OWN', null, { row: 1, col: 1 })).toEqual({ row: 2, col: 6 });
      expect(placeEventZone(TRY_PENALTY, 'OWN', {}, null)).toEqual({ row: 2, col: 6 });
    });

    it('la fila del tramo se conserva cuando solo la columna es fija', () => {
      expect(placeEventZone(ENTRY_22, 'OWN', {}, { row: 3, col: 2 })).toEqual({ row: 3, col: 5 });
      expect(placeEventZone(ENTRY_22, 'OWN', {}, null)).toBeNull();
    });

    it('una fila del atributo fuera de las filas permitidas no deja celda', () => {
      expect(placeEventZone({ columns: [6], rows: [2], rowFrom: 'zone' }, 'OWN', { zone: 'right' }, null)).toBeNull();
    });
  });

  describe('placeEventZone: la columna sale del tramo', () => {
    [2, 3, 4, 5].forEach(col => {
      it(`dentro de las columnas permitidas conserva la celda del tramo (columna ${col})`, () => {
        expect(placeEventZone(FIELD_PLAY, 'OWN', {}, { row: 2, col })).toEqual({ row: 2, col });
      });
    });

    [1, 6].forEach(col => {
      it(`en el in-goal (columna ${col}) la celda del tramo está prohibida`, () => {
        expect(placeEventZone(FIELD_PLAY, 'OWN', {}, { row: 2, col })).toBeNull();
      });
    });

    it('sin tramo no hay celda', () => {
      expect(placeEventZone(FIELD_PLAY, 'OWN', {}, null)).toBeNull();
    });

    it('la fila sale del atributo y la columna del tramo', () => {
      expect(placeEventZone(FIELD_PLAY_WITH_SIDE, 'OWN', { zone: 'left' }, { row: 2, col: 5 })).toEqual({ row: 1, col: 5 });
    });

    it('la fila del atributo no alcanza si la columna del tramo está prohibida', () => {
      expect(placeEventZone(FIELD_PLAY_WITH_SIDE, 'OWN', { zone: 'left' }, { row: 2, col: 6 })).toBeNull();
    });

    it('sin regla o sin restricción devuelve la celda del tramo tal cual', () => {
      expect(placeEventZone(null, 'OWN', {}, { row: 3, col: 6 })).toEqual({ row: 3, col: 6 });
      expect(placeEventZone(undefined, 'OWN', {}, { row: 3, col: 6 })).toEqual({ row: 3, col: 6 });
      expect(placeEventZone(NO_RESTRICTION, 'OWN', {}, { row: 3, col: 6 })).toEqual({ row: 3, col: 6 });
      expect(placeEventZone(NO_RESTRICTION, 'OWN', {}, null)).toBeNull();
    });
  });

  describe('placeEventZone: perspectiva del equipo', () => {
    it('un try del rival se espeja: queda en el in-goal propio y el lado se lee desde su ataque', () => {
      expect(placeEventZone(TRY, 'OPPONENT', { zone: 'left' }, { row: 2, col: 5 })).toEqual({ row: 3, col: 1 });
    });

    it('la regla se evalúa desde el equipo que ejecuta: la misma celda es válida para uno y prohibida para el otro', () => {
      const ownHalf: ZoneRule = { columns: [1, 2] };
      const tramo = { row: 2, col: 6 };

      expect(placeEventZone(ownHalf, 'OWN', {}, tramo)).toBeNull();
      expect(placeEventZone(ownHalf, 'OPPONENT', {}, tramo)).toEqual({ row: 2, col: 6 });
    });

    it('la posesión neutral no se espeja', () => {
      expect(placeEventZone({ columns: [1, 2] }, 'NEUTRAL', {}, { row: 2, col: 6 })).toBeNull();
    });

    it('sin regla el rival no se espeja', () => {
      expect(placeEventZone(null, 'OPPONENT', {}, { row: 2, col: 3 })).toEqual({ row: 2, col: 3 });
    });
  });

  describe('isFixedZone', () => {
    it('columna fija y fila por atributo presente: es fija', () => {
      expect(isFixedZone(TRY, { zone: 'left' })).toBeTrue();
    });

    it('columna fija pero fila ausente: depende del tramo', () => {
      expect(isFixedZone(TRY, {})).toBeFalse();
      expect(isFixedZone(TRY, null)).toBeFalse();
    });

    it('fila y columna únicas: es fija', () => {
      expect(isFixedZone(TRY_PENALTY, {})).toBeTrue();
    });

    it('solo la columna fija, sin restricción o sin regla: no es fija', () => {
      expect(isFixedZone(ENTRY_22, {})).toBeFalse();
      expect(isFixedZone(FIELD_PLAY, {})).toBeFalse();
      expect(isFixedZone(NO_RESTRICTION, {})).toBeFalse();
      expect(isFixedZone(null, {})).toBeFalse();
    });
  });

  describe('describeZoneRule', () => {
    const cases: [ZoneRule, string][] = [
      [{ columns: [2, 3, 4, 5] }, 'las columnas 2 a 5'],
      [{ columns: [6], rowFrom: 'zone' }, 'la columna 6'],
      [{ columns: [5] }, 'la columna 5'],
      [{ columns: [1, 6] }, 'las columnas 1 y 6'],
      [{ columns: [6], rows: [2] }, 'la columna 6 y la fila C'],
      [{ rows: [1, 3] }, 'las filas I y D']
    ];
    cases.forEach(([rule, text]) => {
      it(`${JSON.stringify(rule)} -> ${text}`, () => {
        expect(describeZoneRule(rule)).toBe(text);
      });
    });
  });

  describe('findZoneRuleConflict', () => {
    const rules: ZoneRulesByType = new Map<string, ZoneRule | null>([['scrum', FIELD_PLAY], ['try', TRY], ['tackle', null]]);
    const inGoal: RuleRange = { period: 1, startMinute: 20, endMinute: 25, row: 2, col: 6 };

    const ev = (id: string, typeId: string, name: string, period: 1 | 2, seconds: number, extra: Partial<RuleEvent> = {}): RuleEvent =>
      ({ id, eventTypeId: typeId, eventTypeName: name, period, matchTime: seconds, teamPossession: 'OWN', attributes: {}, ...extra });
    const scrum = (id: string, period: 1 | 2, seconds: number) => ev(id, 'scrum', 'Scrum', period, seconds);

    it('detecta el evento que el tramo deja en una celda prohibida, con el mismo mensaje que el backend', () => {
      const conflict = findZoneRuleConflict(inGoal, [scrum('a', 1, 22 * 60)], rules);

      expect(conflict?.event.id).toBe('a');
      expect(conflict?.message)
        .toBe("Scrum (1T 22:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5");
    });

    it('el mensaje del segundo tiempo usa el tiempo acumulado', () => {
      const range: RuleRange = { period: 2, startMinute: 60, endMinute: 70, row: 3, col: 1 };

      expect(findZoneRuleConflict(range, [scrum('a', 2, 65 * 60)], rules)?.message)
        .toBe("Scrum (2T 65:00) no puede quedar en D1 (tramo 2T 60'–70'): solo puede ocurrir en las columnas 2 a 5");
    });

    it('el inicio del rango es inclusivo y el fin exclusivo', () => {
      expect(findZoneRuleConflict(inGoal, [scrum('a', 1, 20 * 60)], rules)).not.toBeNull();
      expect(findZoneRuleConflict(inGoal, [scrum('a', 1, 25 * 60)], rules)).toBeNull();
    });

    it('el tiempo añadido cuenta como el último minuto del tiempo', () => {
      const lastMinutes: RuleRange = { period: 1, startMinute: 31, endMinute: 40, row: 2, col: 6 };

      expect(findZoneRuleConflict(lastMinutes, [scrum('a', 1, 43 * 60)], rules)).not.toBeNull();
    });

    it('ignora los eventos de otro tiempo', () => {
      expect(findZoneRuleConflict(inGoal, [scrum('a', 2, 22 * 60)], rules)).toBeNull();
    });

    it('informa el primero en orden cronológico', () => {
      const conflict = findZoneRuleConflict(inGoal, [scrum('late', 1, 24 * 60), scrum('early', 1, 21 * 60)], rules);

      expect(conflict?.event.id).toBe('early');
    });

    it('ignora los tipos sin regla, los desconocidos y los de zona fija', () => {
      const events = [
        ev('t', 'tackle', 'Tackle completado', 1, 22 * 60),
        ev('x', 'desconocido', 'Otro', 1, 22 * 60),
        ev('y', 'try', 'Try', 1, 22 * 60, { attributes: { zone: 'left' } })
      ];

      expect(findZoneRuleConflict(inGoal, events, rules)).toBeNull();
    });

    it('un tramo en una celda permitida se acepta aunque contenga eventos restringidos', () => {
      expect(findZoneRuleConflict({ ...inGoal, col: 4 }, [scrum('a', 1, 22 * 60)], rules)).toBeNull();
    });

    it('evalúa desde el equipo que ejecuta el evento', () => {
      const ownHalf: ZoneRulesByType = new Map<string, ZoneRule | null>([['half', { columns: [1, 2] }]]);
      const own = ev('o', 'half', 'Evento', 1, 22 * 60);
      const opponent = ev('r', 'half', 'Evento', 1, 22 * 60, { teamPossession: 'OPPONENT' });

      expect(findZoneRuleConflict(inGoal, [own], ownHalf)?.event.id).toBe('o');
      expect(findZoneRuleConflict(inGoal, [opponent], ownHalf)).toBeNull();
    });

    it('sin eventos no hay conflicto', () => {
      expect(findZoneRuleConflict(inGoal, [], rules)).toBeNull();
    });
  });
});
