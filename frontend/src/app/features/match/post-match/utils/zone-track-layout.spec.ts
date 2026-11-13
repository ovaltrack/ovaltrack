import { ZoneAssignmentResponse } from '../../types/zone.types';
import { ZoneEvent } from './zone-stats';
import {
  FULL_TRACK, allGaps, blockLabel, blockLayout, isInWindow, trackWindow, countByFranja, gapAtMinute, gapsWithEventCount,
  minuteAtOffset, minuteToPercent, suggestNextRange, territoryRows, zonePoints, describePoint, tramoCuts, crossedCut, findTramoCut,
  TramoCutMark, ZonePoint, clampToCut, kickoffCell, cutGlyph, boundingCuts, clusterMarks
} from './zone-track-layout';
import { TemplateField, ZoneRule } from '../../types/event-type.types';
import { RuleEvent, ScoringTypesById, ZoneRulesByType } from './zone-rule';

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

  describe('etiqueta del bloque', () => {
    it('es siempre la letra del lateral, sea largo o corto: la fila de la grilla ya dice la franja', () => {
      expect(blockLabel(zone('a', 1, 10, 25, 3, 5))).toBe('D');
      expect(blockLabel(zone('b', 1, 10, 11, 3, 5))).toBe('D');
      expect(blockLabel(zone('c', 1, 10, 12, 1, 2))).toBe('I');
      expect(blockLabel(zone('d', 1, 10, 40, 2, 4))).toBe('C');
    });

    it('en pantalla angosta los bloques de menos de 4 minutos no llevan etiqueta; los de 4 o más, la letra', () => {
      expect(blockLabel(zone('a', 1, 10, 13), true)).toBe('');
      expect(blockLabel(zone('b', 1, 10, 14), true)).toBe('C');
    });
  });

  describe('territoryRows', () => {
    it('lista las 6 franjas con el in-goal rival arriba y el propio abajo', () => {
      const rows = territoryRows();

      expect(rows.map(r => r.col)).toEqual([6, 5, 4, 3, 2, 1]);
      expect(rows[0].name).toBe('In-goal rival');
      expect(rows[5].name).toBe('In-goal propio');
    });

    it('solo las franjas de in-goal son carriles de puntos', () => {
      expect(territoryRows().map(r => r.inGoal)).toEqual([true, false, false, false, false, true]);
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

  describe('gapsWithEventCount con puntos sin fila', () => {
    it('un try sin lado todavía no tiene zona: cuenta en el hueco hasta que un tramo le dé la fila', () => {
      const events = [ev('try', 1, 30, null), ev('con-tramo', 1, 12, { row: 1, col: 6 })];

      expect(gapsWithEventCount([zone('a', 1, 10, 25)], events).map(g => g.eventCount)).toEqual([0, 1, 0]);
    });
  });

  describe('zonePoints', () => {
    const TRY: ZoneRule = { columns: [6], rowFrom: 'zone', closesTramo: true };
    const TRY_PENALTY: ZoneRule = { columns: [6], rows: [2], closesTramo: true };
    const KICK: ZoneRule = { columns: [2, 3, 4, 5], rowFrom: 'zone', closesTramo: true };
    const rules: ZoneRulesByType = new Map<string, ZoneRule | null>([
      ['try', TRY], ['penaltyTry', TRY_PENALTY], ['kick', KICK], ['scrum', { columns: [2, 3, 4, 5] }], ['tackle', null]
    ]);
    const rev = (id: string, typeId: string, period: 1 | 2, seconds: number, extra: Partial<RuleEvent> = {}): RuleEvent =>
      ({ id, eventTypeId: typeId, eventTypeName: typeId, period, matchTime: seconds, teamPossession: 'OWN', attributes: {}, ...extra });
    const tryAt = (id: string, period: 1 | 2, seconds: number, zoneAttr: string, extra: Partial<RuleEvent> = {}) =>
      rev(id, 'try', period, seconds, { attributes: { zone: zoneAttr }, ...extra });

    it('ubica el try en su celda y su minuto con decimales (22:30 -> 22,5), con el corte en el minuto siguiente', () => {
      const [point] = zonePoints([tryAt('a', 1, 22 * 60 + 30, 'right')], rules, 'ALL');

      expect(point).toEqual({ eventId: 'a', eventTypeName: 'try', period: 1, col: 6, row: 3, minute: 22.5, cutMinute: 23 });
    });

    it('un try del rival se ubica espejado', () => {
      const [point] = zonePoints([tryAt('a', 1, 600, 'left', { teamPossession: 'OPPONENT' })], rules, 'ALL');

      expect([point.col, point.row]).toEqual([1, 3]);
    });

    it('un try sin el atributo de lado también es un punto: tiene columna y la fila queda sin conocer', () => {
      const [point] = zonePoints([rev('a', 'try', 1, 600)], rules, 'ALL');

      expect([point.col, point.row]).toEqual([6, null]);
    });

    it('un try sin lado del rival va a la columna 1 sin fila', () => {
      const [point] = zonePoints([rev('a', 'try', 1, 600, { teamPossession: 'OPPONENT' })], rules, 'ALL');

      expect([point.col, point.row]).toEqual([1, null]);
    });

    it('el try penal trae la fila de la regla', () => {
      const [point] = zonePoints([rev('a', 'penaltyTry', 2, 50 * 60)], rules, 'ALL');

      expect(point).toEqual({ eventId: 'a', eventTypeName: 'penaltyTry', period: 2, col: 6, row: 2, minute: 50, cutMinute: 51 });
    });

    it('un tipo de columna fija que no corta es un punto sin corte', () => {
      const fixedNoCut: ZoneRulesByType = new Map<string, ZoneRule | null>([['entry', { columns: [5], rows: [2] }]]);

      expect(zonePoints([rev('a', 'entry', 1, 600)], fixedNoCut, 'ALL').map(p => p.cutMinute)).toEqual([null]);
    });

    it('solo son puntos los eventos de columna única: no los tipos de varias columnas ni sin regla', () => {
      const events = [
        rev('s', 'scrum', 1, 600), rev('t', 'tackle', 1, 600), rev('u', 'desconocido', 1, 600),
        rev('k', 'kick', 1, 700, { attributes: { zone: 'left' } }), tryAt('a', 1, 800, 'left')
      ];

      expect(zonePoints(events, rules, 'ALL').map(p => p.eventId)).toEqual(['a']);
    });

    it('respeta el filtro de tiempo e ignora los eventos con un tiempo inválido', () => {
      const events = [tryAt('a', 1, 600, 'left'), tryAt('b', 2, 3000, 'left'), { ...tryAt('c', 1, 900, 'left'), period: 3 }];

      expect(zonePoints(events, rules, 1).map(p => p.eventId)).toEqual(['a']);
      expect(zonePoints(events, rules, 2).map(p => p.eventId)).toEqual(['b']);
      expect(zonePoints(events, rules, 'ALL').map(p => p.eventId)).toEqual(['a', 'b']);
    });

    it('ordena cronológicamente y deja el tiempo añadido en el último segundo del tiempo, con el corte en el 40', () => {
      const events = [tryAt('late', 1, 43 * 60, 'left'), tryAt('early', 1, 5 * 60, 'left')];
      const points = zonePoints(events, rules, 'ALL');

      expect(points.map(p => p.eventId)).toEqual(['early', 'late']);
      expect(points[1].minute).toBeCloseTo(40 - 1 / 60, 5);
      expect(points[1].cutMinute).toBe(40);
    });

    it('el corte del punto coincide con el de tramoCuts para el mismo evento', () => {
      const events = [tryAt('a', 1, 22 * 60 + 30, 'left'), tryAt('b', 1, 43 * 60, 'left'), tryAt('c', 2, 50 * 60, 'left')];

      expect(zonePoints(events, rules, 'ALL').map(p => p.cutMinute)).toEqual(tramoCuts(events, rules, new Map(), 'ALL').map(cut => cut.minute));
    });

    it('sin eventos no hay puntos', () => {
      expect(zonePoints([], rules, 'ALL')).toEqual([]);
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

  describe('describePoint', () => {
    const point = (extra: Partial<ZonePoint> = {}): ZonePoint =>
      ({ eventId: 'a', eventTypeName: 'Try', period: 1, col: 6, row: 3, minute: 22.5, cutMinute: 23, ...extra });

    it('describe el tipo, el reloj, la celda y dónde termina el tramo', () => {
      expect(describePoint(point())).toBe('Try 22:30 · D6 · el tramo termina en 23′');
    });

    it('rellena con cero y el tiempo añadido queda en el último segundo del tiempo', () => {
      expect(describePoint(point({ minute: 5, cutMinute: 6 }))).toBe('Try 05:00 · D6 · el tramo termina en 6′');
      expect(describePoint(point({ minute: 40 - 1 / 60, cutMinute: 40 }))).toBe('Try 39:59 · D6 · el tramo termina en 40′');
    });

    it('sin fila conocida nombra la franja y aclara que falta el lateral', () => {
      expect(describePoint(point({ row: null }))).toBe('Try 22:30 · In-goal rival (sin lateral) · el tramo termina en 23′');
      expect(describePoint(point({ row: null, col: 1 }))).toBe('Try 22:30 · In-goal propio (sin lateral) · el tramo termina en 23′');
    });

    it('un punto que no corta no habla del tramo', () => {
      expect(describePoint(point({ eventTypeName: 'Ingreso', col: 5, row: 2, cutMinute: null }))).toBe('Ingreso 22:30 · C5');
    });
  });

  describe('cortes por try', () => {
    const TRY: ZoneRule = { columns: [6], rowFrom: 'zone', closesTramo: true };
    const KICK: ZoneRule = { columns: [2, 3, 4, 5], rowFrom: 'zone', closesTramo: true };
    const rules: ZoneRulesByType = new Map<string, ZoneRule | null>([
      ['try', TRY], ['kick', KICK], ['scrum', { columns: [2, 3, 4, 5] }], ['tackle', null]
    ]);
    /** Campo «Resultado» del Kick H y el drop: si vale false el tanteo no suma y no reinicia el juego. */
    const RESULT: TemplateField = { key: 'wasSuccessful', label: 'Resultado', type: 'boolean', phase: 'live', required: true, effects: ['scoring'] };
    const types: ScoringTypesById = new Map([
      ['try', { isScoring: true, templateEventFields: [], code: 'TRY' }],
      ['kick', { isScoring: true, templateEventFields: [RESULT], code: 'PENALTY_KICK' }],
      ['scrum', { isScoring: false, templateEventFields: [] }],
      ['tackle', { isScoring: false, templateEventFields: [] }]
    ]);
    const rev = (id: string, typeId: string, name: string, period: number, seconds: number, extra: Partial<RuleEvent> = {}): RuleEvent =>
      ({ id, eventTypeId: typeId, eventTypeName: name, period, matchTime: seconds, teamPossession: 'OWN', attributes: {}, ...extra });
    const tryAt = (id: string, period: number, seconds: number, extra: Partial<RuleEvent> = {}) => rev(id, 'try', 'Try', period, seconds, extra);
    const kickAt = (id: string, seconds: number, wasSuccessful: boolean | undefined) =>
      rev(id, 'kick', 'Kick H (Penal a palos)', 1, seconds, { attributes: wasSuccessful === undefined ? {} : { wasSuccessful } });
    const cut = (minute: number, label = 'Try 22:30', period: 1 | 2 = 1, possession: TramoCutMark['possession'] = 'OWN'): TramoCutMark =>
      ({ eventId: 'x', eventTypeName: 'Try', period, minute, label, possession, glyph: 'T' });

    describe('tramoCuts', () => {
      it('el try corta en el minuto siguiente al suyo y se describe con su reloj', () => {
        expect(tramoCuts([tryAt('a', 1, 22 * 60 + 30)], rules, types, 'ALL'))
          .toEqual([{ eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30', possession: 'OWN', glyph: 'T' }]);
      });

      it('cortan los tipos que lo declaran, también del rival; no los demás', () => {
        const events = [
          tryAt('rival', 1, 600, { teamPossession: 'OPPONENT' }),
          rev('kick', 'kick', 'Kick H (Penal a palos)', 1, 900),
          rev('scrum', 'scrum', 'Scrum', 1, 700),
          rev('tackle', 'tackle', 'Tackle completado', 1, 800),
          rev('otro', 'desconocido', 'Otro', 1, 850)
        ];

        expect(tramoCuts(events, rules, types, 'ALL').map(c => c.eventId)).toEqual(['rival', 'kick']);
      });

      it('el tiempo añadido corta en el final del tiempo y conserva su reloj', () => {
        const [mark] = tramoCuts([tryAt('a', 1, 43 * 60)], rules, types, 'ALL');

        expect([mark.minute, mark.label]).toEqual([40, 'Try 43:00']);
      });

      it('ordena cronológicamente, respeta el filtro de tiempo e ignora eventos sin tiempo válido', () => {
        const events = [tryAt('b', 2, 50 * 60), tryAt('a', 1, 5 * 60), tryAt('sin', 3, 600)];

        expect(tramoCuts(events, rules, types, 'ALL').map(c => c.eventId)).toEqual(['a', 'b']);
        expect(tramoCuts(events, rules, types, 2).map(c => c.eventId)).toEqual(['b']);
      });

      it('un Kick H o un drop convertidos cortan; errados no', () => {
        const events = [kickAt('convertido', 600, true), kickAt('errado', 900, false)];

        expect(tramoCuts(events, rules, types, 'ALL').map(c => c.eventId)).toEqual(['convertido']);
      });

      it('un Kick H sin el resultado cargado todavía cuenta como tanteo, igual que el marcador', () => {
        expect(tramoCuts([kickAt('a', 600, undefined)], rules, types, 'ALL').map(c => c.eventId)).toEqual(['a']);
      });

      it('un tipo ausente del catálogo cuenta como tanteo: se conserva el corte que declara su regla', () => {
        expect(tramoCuts([tryAt('a', 1, 600)], rules, new Map(), 'ALL').map(c => c.eventId)).toEqual(['a']);
      });

      it('guarda quién ejecutó el tanteo', () => {
        expect(tramoCuts([tryAt('rival', 1, 600, { teamPossession: 'OPPONENT' })], rules, types, 'ALL').map(c => c.possession)).toEqual(['OPPONENT']);
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
        expect(findTramoCut({ period: 1, startMinute: 20, endMinute: 25 }, [tryAt('a', 1, 22 * 60 + 30)], rules, types)?.message)
          .toBe("El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'");
      });

      it('en el segundo tiempo usa el tiempo acumulado y el nombre del tipo', () => {
        const kick = rev('k', 'kick', 'Kick H (Penal a palos)', 2, 65 * 60);

        expect(findTramoCut({ period: 2, startMinute: 60, endMinute: 70 }, [kick], rules, types)?.message)
          .toBe("El tramo 2T 60'–70' no puede seguir después del Kick H (Penal a palos) (2T 65:00): terminalo en 66'");
      });

      it('sin corte adentro no hay problema', () => {
        expect(findTramoCut({ period: 1, startMinute: 20, endMinute: 23 }, [tryAt('a', 1, 22 * 60 + 30)], rules, types)).toBeNull();
      });

      it('un Kick H errado dentro del rango no es un problema', () => {
        expect(findTramoCut({ period: 1, startMinute: 20, endMinute: 25 }, [kickAt('a', 22 * 60 + 30, false)], rules, types)).toBeNull();
      });
    });

    describe('clampToCut', () => {
      it('lleva el fin del rango al corte que cruza y dice cuál es', () => {
        const mark = cut(23);

        expect(clampToCut({ period: 1, startMinute: 20, endMinute: 25 }, [mark])).toEqual({ endMinute: 23, cut: mark });
      });

      it('un rango que termina en el corte, empieza después de él o es de otro tiempo no se toca', () => {
        expect(clampToCut({ period: 1, startMinute: 20, endMinute: 23 }, [cut(23)])).toBeNull();
        expect(clampToCut({ period: 1, startMinute: 23, endMinute: 30 }, [cut(23)])).toBeNull();
        expect(clampToCut({ period: 2, startMinute: 40, endMinute: 60 }, [cut(23)])).toBeNull();
      });

      it('con varios cortes adentro lo lleva al primero', () => {
        expect(clampToCut({ period: 1, startMinute: 20, endMinute: 30 }, [cut(25, 'Try 24:00'), cut(22, 'Try 21:00')])?.endMinute).toBe(22);
      });

      it('sin cortes no hace nada', () => {
        expect(clampToCut({ period: 1, startMinute: 0, endMinute: 40 }, [])).toBeNull();
      });
    });

    describe('kickoffCell', () => {
      it('después de un tanteo propio saca el rival y recibimos: campo propio, lateral centro', () => {
        expect(kickoffCell(cut(23, 'Try 22:30', 1, 'OWN'))).toEqual({ row: 2, col: 3 });
      });

      it('después de un tanteo del rival sacamos nosotros: campo rival, lateral centro', () => {
        expect(kickoffCell(cut(23, 'Try 22:30', 1, 'OPPONENT'))).toEqual({ row: 2, col: 4 });
      });

      it('con posesión neutral no se sabe quién saca y no propone nada', () => {
        expect(kickoffCell(cut(23, 'Try 22:30', 1, 'NEUTRAL'))).toBeNull();
      });
    });

    describe('cutGlyph', () => {
      it('T para el try y el try penal, P para el Kick H y D para el drop goal, según el código del catálogo', () => {
        expect([
          cutGlyph('TRY', 'Try'), cutGlyph('PENALTY_TRY', 'Try penal'), cutGlyph('PENALTY_KICK', 'Kick H (Penal a palos)'), cutGlyph('DROP_GOAL', 'Drop goal')
        ]).toEqual(['T', 'T', 'P', 'D']);
      });

      it('un código desconocido o ausente usa la inicial del nombre', () => {
        expect([cutGlyph('OTRO', 'Salida'), cutGlyph(undefined, 'penal')]).toEqual(['S', 'P']);
      });
    });

    describe('tramoCuts: la letra de la tira', () => {
      it('sale del código del tipo en el catálogo', () => {
        const events = [tryAt('a', 1, 600), kickAt('b', 900, true)];

        expect(tramoCuts(events, rules, types, 'ALL').map(c => c.glyph)).toEqual(['T', 'P']);
      });
    });

    describe('boundingCuts', () => {
      const at = (minute: number, period: 1 | 2 = 1): TramoCutMark => cut(minute, `Try ${minute}`, period);
      const minutes = (range: { period: 1 | 2; startMinute: number; endMinute: number }, cuts: TramoCutMark[]): number[] =>
        boundingCuts(range, cuts).map(c => c.minute);

      it('devuelve el corte anterior y el siguiente al rango, no los lejanos', () => {
        expect(minutes({ period: 1, startMinute: 20, endMinute: 25 }, [at(5), at(12), at(30), at(38)])).toEqual([12, 30]);
      });

      it('un corte justo en el borde del rango cuenta como vecino', () => {
        expect(minutes({ period: 1, startMinute: 20, endMinute: 25 }, [at(20), at(25)])).toEqual([20, 25]);
      });

      it('incluye los cortes que el rango cruza (tramos viejos que siguen después de un tanto)', () => {
        expect(minutes({ period: 1, startMinute: 20, endMinute: 30 }, [at(10), at(22), at(26), at(35)])).toEqual([10, 22, 26, 35]);
      });

      it('ignora los cortes del otro tiempo', () => {
        expect(minutes({ period: 2, startMinute: 50, endMinute: 55 }, [at(23), at(60, 2)])).toEqual([60]);
      });

      it('sin cortes o sin vecinos de un lado devuelve solo lo que hay', () => {
        expect(minutes({ period: 1, startMinute: 0, endMinute: 5 }, [])).toEqual([]);
        expect(minutes({ period: 1, startMinute: 0, endMinute: 5 }, [at(12)])).toEqual([12]);
      });

      it('los devuelve en orden cronológico', () => {
        expect(minutes({ period: 1, startMinute: 20, endMinute: 25 }, [at(30), at(12)])).toEqual([12, 30]);
      });
    });

    describe('clusterMarks', () => {
      const mark = (id: string, left: number): { id: string; left: number } => ({ id, left });
      const ids = (clusters: { items: { id: string }[] }[]): string[][] => clusters.map(c => c.items.map(item => item.id));

      it('junta las marcas a menos de 12 px y deja separadas las demás', () => {
        // 1000 px de ancho: 1 % = 10 px
        expect(ids(clusterMarks([mark('a', 20), mark('b', 20.5), mark('c', 40)], 1000))).toEqual([['a', 'b'], ['c']]);
      });

      it('exactamente a 12 px no se juntan', () => {
        expect(ids(clusterMarks([mark('a', 20), mark('b', 21.2)], 1000))).toEqual([['a'], ['b']]);
      });

      it('encadena: tres marcas a 8 px una de otra forman un solo grupo', () => {
        expect(ids(clusterMarks([mark('a', 10), mark('b', 10.8), mark('c', 11.6)], 1000))).toEqual([['a', 'b', 'c']]);
      });

      it('la posición del grupo es el promedio de sus marcas', () => {
        expect(clusterMarks([mark('a', 20), mark('b', 21)], 1000)[0].left).toBe(20.5);
      });

      it('ordena por posición aunque lleguen desordenadas', () => {
        expect(ids(clusterMarks([mark('c', 60), mark('a', 10), mark('b', 30)], 1000))).toEqual([['a'], ['b'], ['c']]);
      });

      it('sin ancho medido no agrupa nada', () => {
        expect(ids(clusterMarks([mark('a', 20), mark('b', 20.01)], 0))).toEqual([['a'], ['b']]);
      });

      it('sin marcas no hay grupos', () => {
        expect(clusterMarks([], 1000)).toEqual([]);
      });

      it('con menos ancho se juntan más: la misma separación en 300 px es 3 px', () => {
        expect(ids(clusterMarks([mark('a', 20), mark('b', 24)], 300))).toEqual([['a', 'b']]);
        expect(ids(clusterMarks([mark('a', 20), mark('b', 24)], 1000))).toEqual([['a'], ['b']]);
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
