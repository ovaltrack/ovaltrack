import { ZoneAssignmentResponse } from '../../types/zone.types';
import { ZoneEvent } from './zone-stats';
import {
  FULL_TRACK, allGaps, blockLabel, blockLayout, isInWindow, trackWindow, countByFranja, gapAtMinute, gapsWithEventCount, isShortBlock,
  minuteAtOffset, minuteToPercent, suggestNextRange, territoryRows, fixedZoneMarks, describeFixedMark, tramoCuts, crossedCut, findTramoCut,
  TramoCutMark
} from './zone-track-layout';
import { ZoneRule } from '../../types/event-type.types';
import { RuleEvent, ZoneRulesByType } from './zone-rule';

describe('zone-track-layout', () => {
  const zone = (id: string, period: 1 | 2, startMinute: number, endMinute: number, row = 2, col = 3): ZoneAssignmentResponse =>
    ({ id, matchId: 'm', period, startMinute, endMinute, row, col });
  const ev = (id: string, period: 1 | 2, minute: number, cell: { row: number; col: number } | null): ZoneEvent =>
    ({ id, period, matchTime: minute * 60, zone: cell });

  describe('posición y ancho de los bloques', () => {
    it('el eje cubre 80 minutos: el 40 queda al 50 %', () => {
      expect(minuteToPercent(0)).toBe(0);
      expect(minuteToPercent(40)).toBe(50);
      expect(minuteToPercent(80)).toBe(100);
    });

    it('un bloque de 10 a 25 empieza al 12,5 % y ocupa el 18,75 %', () => {
      expect(blockLayout({ startMinute: 10, endMinute: 25 })).toEqual({ left: 12.5, width: 18.75 });
    });

    it('un tramo del 2T usa minutos acumulados', () => {
      expect(blockLayout({ startMinute: 60, endMinute: 80 })).toEqual({ left: 75, width: 25 });
    });
  });

  describe('tiempo a la vista', () => {
    it('en pantalla angosta con 1T o 2T la grilla muestra ese tiempo; con "Todo" o en pantalla ancha, los 80 minutos', () => {
      expect(trackWindow(1, true)).toEqual({ start: 0, end: 40 });
      expect(trackWindow(2, true)).toEqual({ start: 40, end: 80 });
      expect(trackWindow('ALL', true)).toEqual(FULL_TRACK);
      expect(trackWindow(2, false)).toEqual(FULL_TRACK);
    });

    it('las posiciones se miden contra el tramo mostrado: en el 2T el minuto 50 queda al 25 %', () => {
      expect(minuteToPercent(50, { start: 40, end: 80 })).toBe(25);
      expect(blockLayout({ startMinute: 50, endMinute: 60 }, { start: 40, end: 80 })).toEqual({ left: 25, width: 25 });
    });

    it('un rango que sobresale del tramo mostrado se recorta y uno de afuera no se ve', () => {
      const first = { start: 0, end: 40 };
      expect(blockLayout({ startMinute: 30, endMinute: 50 }, first)).toEqual({ left: 75, width: 25 });
      expect(isInWindow({ startMinute: 40, endMinute: 50 }, first)).toBeFalse();
      expect(isInWindow({ startMinute: 39, endMinute: 41 }, first)).toBeTrue();
    });

    it('el minuto bajo el puntero se mide dentro del tramo mostrado', () => {
      expect(minuteAtOffset(0, 400, { start: 40, end: 80 })).toBe(40);
      expect(minuteAtOffset(399, 400, { start: 40, end: 80 })).toBe(79);
    });
  });

  describe('bloques cortos', () => {
    it('de 1 o 2 minutos son cortos; de 3 o más, no', () => {
      expect(isShortBlock({ startMinute: 10, endMinute: 11 })).toBeTrue();
      expect(isShortBlock({ startMinute: 10, endMinute: 12 })).toBeTrue();
      expect(isShortBlock({ startMinute: 10, endMinute: 13 })).toBeFalse();
    });

    it('la etiqueta es la celda completa, o solo la letra del lateral si es corto', () => {
      expect(blockLabel(zone('a', 1, 10, 25, 3, 5))).toBe('D5');
      expect(blockLabel(zone('b', 1, 10, 11, 3, 5))).toBe('D');
      expect(blockLabel(zone('c', 1, 10, 12, 1, 2))).toBe('I');
    });
  });

  describe('etiqueta en pantalla angosta', () => {
    it('los bloques de menos de 4 minutos no llevan etiqueta; los de 4 o más, la celda', () => {
      expect(blockLabel(zone('a', 1, 10, 13), true)).toBe('');
      expect(blockLabel(zone('b', 1, 10, 14), true)).toBe('C3');
    });

    it('en pantalla ancha no cambia: el corto muestra la letra del lateral', () => {
      expect(blockLabel(zone('a', 1, 10, 12))).toBe('C');
    });
  });

  describe('territoryRows', () => {
    it('lista las 6 franjas con el in-goal rival arriba y el propio abajo', () => {
      const rows = territoryRows();

      expect(rows.map(r => r.col)).toEqual([6, 5, 4, 3, 2, 1]);
      expect(rows[0].name).toBe('In-goal rival');
      expect(rows[5].name).toBe('In-goal propio');
    });

    it('informa los metros de cada franja y "in-goal" para los extremos', () => {
      const rows = territoryRows();

      expect(rows[0].range).toBe('in-goal');
      expect(rows[1].range).toBe('78–100 m');
      expect(rows[2].range).toBe('50–78 m');
      expect(rows[5].range).toBe('in-goal');
    });
  });

  describe('countByFranja', () => {
    const events = [ev('a', 1, 5, { row: 1, col: 3 }), ev('b', 1, 8, { row: 2, col: 3 }), ev('c', 2, 50, { row: 2, col: 5 }), ev('d', 2, 60, null)];

    it('cuenta los eventos con zona por columna e ignora los sin zona', () => {
      const counts = countByFranja(events, 'ALL');

      expect(counts.get(3)).toBe(2);
      expect(counts.get(5)).toBe(1);
      expect(counts.has(1)).toBeFalse();
    });

    it('respeta el filtro de tiempo', () => {
      expect(countByFranja(events, 1).get(3)).toBe(2);
      expect(countByFranja(events, 1).has(5)).toBeFalse();
      expect(countByFranja(events, 2).get(5)).toBe(1);
    });
  });

  describe('minuteAtOffset', () => {
    it('convierte la posición horizontal en minuto entero', () => {
      expect(minuteAtOffset(0, 800)).toBe(0);
      expect(minuteAtOffset(400, 800)).toBe(40);
      expect(minuteAtOffset(409, 800)).toBe(40);
    });

    it('limita a 0–79 fuera del eje y con ancho inválido', () => {
      expect(minuteAtOffset(-30, 800)).toBe(0);
      expect(minuteAtOffset(900, 800)).toBe(79);
      expect(minuteAtOffset(100, 0)).toBe(0);
    });
  });

  describe('huecos', () => {
    const assignments = [zone('a', 1, 10, 25), zone('b', 2, 40, 60)];

    it('lista los huecos de ambos tiempos con minutos acumulados', () => {
      expect(allGaps(assignments)).toEqual([
        { period: 1, start: 0, end: 10 }, { period: 1, start: 25, end: 40 }, { period: 2, start: 60, end: 80 }
      ]);
    });

    it('gapAtMinute devuelve el hueco que contiene el minuto', () => {
      expect(gapAtMinute(assignments, 3)).toEqual({ period: 1, start: 0, end: 10 });
      expect(gapAtMinute(assignments, 25)).toEqual({ period: 1, start: 25, end: 40 });
      expect(gapAtMinute(assignments, 79)).toEqual({ period: 2, start: 60, end: 80 });
    });

    it('F2-S1. gapAtMinute es null sobre un tramo existente (inicio incluido, fin excluido)', () => {
      expect(gapAtMinute(assignments, 10)).toBeNull();
      expect(gapAtMinute(assignments, 24)).toBeNull();
      expect(gapAtMinute(assignments, 45)).toBeNull();
    });

    it('sin tramos todo el partido son dos huecos, y con el partido completo no hay ninguno', () => {
      expect(allGaps([])).toEqual([{ period: 1, start: 0, end: 40 }, { period: 2, start: 40, end: 80 }]);
      expect(allGaps([zone('a', 1, 0, 40), zone('b', 2, 40, 80)])).toEqual([]);
    });

    it('gapsWithEventCount cuenta los eventos de cada hueco, incluido el tiempo añadido', () => {
      const events = [ev('x', 1, 5, null), ev('y', 1, 30, null), ev('z', 1, 43, null), ev('w', 2, 70, null), ev('v', 1, 12, { row: 2, col: 3 })];

      expect(gapsWithEventCount(assignments, events).map(g => g.eventCount)).toEqual([1, 2, 1]);
    });
  });

  describe('gapsWithEventCount con zonas fijas', () => {
    it('un evento de zona fija dentro de un hueco no cuenta: ya tiene zona', () => {
      const assignments = [zone('a', 1, 10, 25)];
      const events = [ev('sin', 1, 5, null), ev('fija', 1, 30, { row: 2, col: 6 })];

      expect(gapsWithEventCount(assignments, events).map(g => g.eventCount)).toEqual([1, 0, 0]);
    });
  });

  describe('fixedZoneMarks', () => {
    const TRY: ZoneRule = { columns: [6], rowFrom: 'zone' };
    const rules: ZoneRulesByType = new Map<string, ZoneRule | null>([
      ['try', TRY], ['scrum', { columns: [2, 3, 4, 5] }], ['tackle', null]
    ]);
    const rev = (id: string, typeId: string, period: 1 | 2, seconds: number, extra: Partial<RuleEvent> = {}): RuleEvent =>
      ({ id, eventTypeId: typeId, eventTypeName: typeId, period, matchTime: seconds, teamPossession: 'OWN', attributes: {}, ...extra });
    const tryAt = (id: string, period: 1 | 2, seconds: number, zoneAttr: string, extra: Partial<RuleEvent> = {}) =>
      rev(id, 'try', period, seconds, { attributes: { zone: zoneAttr }, ...extra });

    it('marca el try en su celda y su minuto con decimales (22:30 -> 22,5)', () => {
      const [mark] = fixedZoneMarks([tryAt('a', 1, 22 * 60 + 30, 'right')], rules, 'ALL');

      expect(mark).toEqual({ eventId: 'a', eventTypeName: 'try', period: 1, cell: { row: 3, col: 6 }, minute: 22.5 });
    });

    it('un try del rival se marca espejado', () => {
      const [mark] = fixedZoneMarks([tryAt('a', 1, 600, 'left', { teamPossession: 'OPPONENT' })], rules, 'ALL');

      expect(mark.cell).toEqual({ row: 3, col: 1 });
    });

    it('solo marca los eventos cuya zona sale de la regla: no los tipos sin regla ni los que dependen del tramo', () => {
      const events = [rev('s', 'scrum', 1, 600), rev('t', 'tackle', 1, 600), rev('u', 'desconocido', 1, 600), tryAt('a', 1, 600, 'left')];

      expect(fixedZoneMarks(events, rules, 'ALL').map(m => m.eventId)).toEqual(['a']);
    });

    it('un try sin el atributo de lado depende del tramo y no se marca', () => {
      expect(fixedZoneMarks([rev('a', 'try', 1, 600)], rules, 'ALL')).toEqual([]);
    });

    it('respeta el filtro de tiempo', () => {
      const events = [tryAt('a', 1, 600, 'left'), tryAt('b', 2, 3000, 'left')];

      expect(fixedZoneMarks(events, rules, 1).map(m => m.eventId)).toEqual(['a']);
      expect(fixedZoneMarks(events, rules, 2).map(m => m.eventId)).toEqual(['b']);
      expect(fixedZoneMarks(events, rules, 'ALL').map(m => m.eventId)).toEqual(['a', 'b']);
    });

    it('ordena cronológicamente y deja el tiempo añadido en el último segundo del tiempo', () => {
      const events = [tryAt('late', 1, 43 * 60, 'left'), tryAt('early', 1, 5 * 60, 'left')];
      const marks = fixedZoneMarks(events, rules, 'ALL');

      expect(marks.map(m => m.eventId)).toEqual(['early', 'late']);
      expect(marks[1].minute).toBeCloseTo(40 - 1 / 60, 5);
    });

    it('sin eventos no hay marcas', () => {
      expect(fixedZoneMarks([], rules, 'ALL')).toEqual([]);
    });
  });

  describe('suggestNextRange', () => {
    const assignments = [zone('a', 1, 0, 5), zone('b', 1, 10, 25)];

    it('propone 5 minutos desde el primer hueco', () => {
      expect(suggestNextRange(assignments)).toEqual({ start: 5, end: 10 });
      expect(suggestNextRange([])).toEqual({ start: 0, end: 5 });
    });

    it('continúa en el hueco que arranca donde terminó el tramo anterior', () => {
      expect(suggestNextRange(assignments, 25)).toEqual({ start: 25, end: 30 });
    });

    it('si no hay hueco después, vuelve al primero; un hueco corto limita la duración', () => {
      expect(suggestNextRange([zone('a', 1, 0, 3), zone('b', 1, 8, 40), zone('c', 2, 40, 80)], 60)).toEqual({ start: 3, end: 8 });
    });

    it('pasa al 2T cuando el 1T está completo y devuelve null con el partido completo', () => {
      expect(suggestNextRange([zone('a', 1, 0, 40)])).toEqual({ start: 40, end: 45 });
      expect(suggestNextRange([zone('a', 1, 0, 40), zone('b', 2, 40, 80)])).toBeNull();
    });

    // Caracterización (C0.2): tras guardar, el formulario sugiere desde `request.endMinute` (panel `resetForm`/`applySuggestion`).
    it('tras guardar un tramo que termina en el 80, vuelve al primer hueco', () => {
      expect(suggestNextRange([zone('a', 1, 0, 5), zone('b', 2, 40, 80)], 80)).toEqual({ start: 5, end: 10 });
    });

    it('tras guardar un tramo que termina en el 40, pasa al primer hueco del 2T', () => {
      expect(suggestNextRange([zone('a', 1, 0, 30)], 40)).toEqual({ start: 40, end: 45 });
    });

    it('afterMinute 0 equivale a no indicarlo', () => {
      expect(suggestNextRange(assignments, 0)).toEqual(suggestNextRange(assignments));
    });

    it('si afterMinute cae dentro de un hueco, salta al siguiente hueco que arranca desde ahí', () => {
      expect(suggestNextRange(assignments, 7)).toEqual({ start: 25, end: 30 });
    });
  });

  describe('describeFixedMark', () => {
    const mark = (minute: number) => ({ eventId: 'a', eventTypeName: 'Try', period: 1 as const, cell: { row: 3, col: 6 }, minute });

    it('describe el tipo, el reloj, la celda y que la zona sale del tipo', () => {
      expect(describeFixedMark(mark(22.5))).toBe('Try 22:30 · D6 · zona fija por el tipo');
    });

    it('rellena con cero y el tiempo añadido queda en el último segundo del tiempo', () => {
      expect(describeFixedMark(mark(5))).toBe('Try 05:00 · D6 · zona fija por el tipo');
      expect(describeFixedMark(mark(40 - 1 / 60))).toBe('Try 39:59 · D6 · zona fija por el tipo');
    });
  });

  describe('cortes por try', () => {
    const TRY: ZoneRule = { columns: [6], rowFrom: 'zone', closesTramo: true };
    const KICK: ZoneRule = { columns: [2, 3, 4, 5], rowFrom: 'zone', closesTramo: true };
    const rules: ZoneRulesByType = new Map<string, ZoneRule | null>([
      ['try', TRY], ['kick', KICK], ['scrum', { columns: [2, 3, 4, 5] }], ['tackle', null]
    ]);
    const rev = (id: string, typeId: string, name: string, period: number, seconds: number, extra: Partial<RuleEvent> = {}): RuleEvent =>
      ({ id, eventTypeId: typeId, eventTypeName: name, period, matchTime: seconds, teamPossession: 'OWN', attributes: {}, ...extra });
    const tryAt = (id: string, period: number, seconds: number, extra: Partial<RuleEvent> = {}) => rev(id, 'try', 'Try', period, seconds, extra);
    const cut = (minute: number, label = 'Try 22:30', period: 1 | 2 = 1): TramoCutMark =>
      ({ eventId: 'x', eventTypeName: 'Try', period, minute, label });

    describe('tramoCuts', () => {
      it('el try corta en el minuto siguiente al suyo y se describe con su reloj', () => {
        expect(tramoCuts([tryAt('a', 1, 22 * 60 + 30)], rules, 'ALL'))
          .toEqual([{ eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30' }]);
      });

      it('cortan los tipos que lo declaran, también del rival; no los demás', () => {
        const events = [
          tryAt('rival', 1, 600, { teamPossession: 'OPPONENT' }),
          rev('kick', 'kick', 'Kick H (Penal a palos)', 1, 900),
          rev('scrum', 'scrum', 'Scrum', 1, 700),
          rev('tackle', 'tackle', 'Tackle completado', 1, 800),
          rev('otro', 'desconocido', 'Otro', 1, 850)
        ];

        expect(tramoCuts(events, rules, 'ALL').map(c => c.eventId)).toEqual(['rival', 'kick']);
      });

      it('el tiempo añadido corta en el final del tiempo y conserva su reloj', () => {
        const [mark] = tramoCuts([tryAt('a', 1, 43 * 60)], rules, 'ALL');

        expect([mark.minute, mark.label]).toEqual([40, 'Try 43:00']);
      });

      it('ordena cronológicamente, respeta el filtro de tiempo e ignora eventos sin tiempo válido', () => {
        const events = [tryAt('b', 2, 50 * 60), tryAt('a', 1, 5 * 60), tryAt('sin', 3, 600)];

        expect(tramoCuts(events, rules, 'ALL').map(c => c.eventId)).toEqual(['a', 'b']);
        expect(tramoCuts(events, rules, 2).map(c => c.eventId)).toEqual(['b']);
      });
    });

    describe('crossedCut', () => {
      it('detecta el corte que queda adentro del rango', () => {
        expect(crossedCut({ period: 1, startMinute: 20, endMinute: 25 }, [cut(23)])?.minute).toBe(23);
      });

      it('un rango que termina o empieza en el corte no lo cruza, ni uno de otro tiempo', () => {
        expect(crossedCut({ period: 1, startMinute: 20, endMinute: 23 }, [cut(23)])).toBeNull();
        expect(crossedCut({ period: 1, startMinute: 23, endMinute: 30 }, [cut(23)])).toBeNull();
        expect(crossedCut({ period: 2, startMinute: 40, endMinute: 60 }, [cut(23)])).toBeNull();
      });

      it('con varios cortes devuelve el primero', () => {
        expect(crossedCut({ period: 1, startMinute: 20, endMinute: 30 }, [cut(25, 'Try 24:00'), cut(22, 'Try 21:00')])?.label)
          .toBe('Try 21:00');
      });
    });

    describe('findTramoCut', () => {
      it('arma el mismo mensaje que el 409 del backend', () => {
        expect(findTramoCut({ period: 1, startMinute: 20, endMinute: 25 }, [tryAt('a', 1, 22 * 60 + 30)], rules)?.message)
          .toBe("El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'");
      });

      it('en el segundo tiempo usa el tiempo acumulado y el nombre del tipo', () => {
        const kick = rev('k', 'kick', 'Kick H (Penal a palos)', 2, 65 * 60);

        expect(findTramoCut({ period: 2, startMinute: 60, endMinute: 70 }, [kick], rules)?.message)
          .toBe("El tramo 2T 60'–70' no puede seguir después del Kick H (Penal a palos) (2T 65:00): terminalo en 66'");
      });

      it('sin corte adentro no hay problema', () => {
        expect(findTramoCut({ period: 1, startMinute: 20, endMinute: 23 }, [tryAt('a', 1, 22 * 60 + 30)], rules)).toBeNull();
      });
    });

    describe('suggestNextRange con cortes', () => {
      it('el rango sugerido termina en el próximo corte', () => {
        expect(suggestNextRange([zone('a', 1, 0, 20)], undefined, [cut(23)])).toEqual({ start: 20, end: 23 });
      });

      it('un corte en el inicio del hueco no lo acorta', () => {
        expect(suggestNextRange([zone('a', 1, 0, 23)], undefined, [cut(23)])).toEqual({ start: 23, end: 28 });
      });
    });
  });
});
