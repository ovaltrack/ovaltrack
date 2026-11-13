import { ZoneRule } from '../../types/event-type.types';
import { ZoneAssignmentResponse } from '../../types/zone.types';
import { ZoneRulesByType } from './zone-rule';
import { CellDetailEvent, cellEventRows, cellTramoRows } from './zone-cell-detail';

describe('zone-cell-detail', () => {
  const tramo = (id: string, period: 1 | 2, startMinute: number, endMinute: number, row = 2, col = 5): ZoneAssignmentResponse =>
    ({ id, matchId: 'm', period, startMinute, endMinute, row, col });
  const event = (id: string, typeId: string, name: string, period: number, seconds: number, zone: { row: number; col: number } | null,
                 extra: Partial<CellDetailEvent> = {}): CellDetailEvent =>
    ({ id, eventTypeId: typeId, eventTypeName: name, period, matchTime: seconds, teamPossession: 'OWN', attributes: {}, zone, ...extra });
  const rules: ZoneRulesByType = new Map<string, ZoneRule | null>([
    ['try', { columns: [6], rowFrom: 'zone', closesTramo: true }],
    ['scrum', { columns: [2, 3, 4, 5] }]
  ]);
  const cell = { row: 2, col: 5 };

  describe('cellEventRows', () => {
    const tramos = [tramo('a', 1, 20, 25), tramo('b', 2, 60, 70)];

    it('lista solo las jugadas de la celda, en orden cronológico', () => {
      const events = [
        event('tarde', 'scrum', 'Scrum', 1, 24 * 60, cell),
        event('otra', 'scrum', 'Scrum', 1, 21 * 60, { row: 1, col: 5 }),
        event('temprano', 'scrum', 'Scrum', 1, 21 * 60, cell),
        event('segundo', 'scrum', 'Scrum', 2, 65 * 60, cell)
      ];

      expect(cellEventRows(events, cell, tramos, rules, 'ALL').map(row => row.id)).toEqual(['temprano', 'tarde', 'segundo']);
    });

    it('respeta el tiempo elegido', () => {
      const events = [event('a', 'scrum', 'Scrum', 1, 21 * 60, cell), event('b', 'scrum', 'Scrum', 2, 65 * 60, cell)];

      expect(cellEventRows(events, cell, tramos, rules, 2).map(row => row.id)).toEqual(['b']);
    });

    it('lleva el reloj, el tipo y el equipo', () => {
      const [row] = cellEventRows([event('a', 'scrum', 'Scrum', 1, 22 * 60 + 30, cell, { teamPossession: 'OPPONENT' })], cell, tramos, rules, 'ALL');

      expect([row.clock, row.typeName, row.team]).toEqual(['1T 22:30', 'Scrum', 'Rival']);
    });

    it('el equipo es Propio, Rival o Neutral', () => {
      const teams = (['OWN', 'OPPONENT', 'NEUTRAL'] as const).map(teamPossession =>
        cellEventRows([event('a', 'scrum', 'Scrum', 1, 22 * 60, cell, { teamPossession })], cell, tramos, rules, 'ALL')[0].team);

      expect(teams).toEqual(['Propio', 'Rival', 'Neutral']);
    });

    it('una jugada cuya zona fija el tipo lo dice; una que viene del tramo nombra el tramo', () => {
      const fixed = event('try', 'try', 'Try', 1, 22 * 60, { row: 3, col: 6 }, { attributes: { zone: 'right' } });
      const fromTramo = event('scrum', 'scrum', 'Scrum', 1, 22 * 60, cell);

      expect(cellEventRows([fixed], { row: 3, col: 6 }, tramos, rules, 'ALL')[0].origin).toBe('Zona fija por el tipo');
      expect(cellEventRows([fromTramo], cell, tramos, rules, 'ALL')[0].origin).toBe("Tramo 1T 20'–25'");
    });

    it('un Try sin lado toma la fila del tramo: su origen es el tramo', () => {
      const noSide = event('try', 'try', 'Try', 1, 22 * 60, { row: 2, col: 6 });

      expect(cellEventRows([noSide], { row: 2, col: 6 }, [tramo('c', 1, 20, 25, 2, 6)], rules, 'ALL')[0].origin).toBe("Tramo 1T 20'–25'");
    });

    it('sin jugadas en la celda devuelve una lista vacía', () => {
      expect(cellEventRows([event('a', 'scrum', 'Scrum', 1, 600, { row: 1, col: 1 })], cell, tramos, rules, 'ALL')).toEqual([]);
    });
  });

  describe('cellTramoRows', () => {
    const tramos = [tramo('b', 2, 60, 70), tramo('a', 1, 20, 25), tramo('otra', 1, 0, 5, 1, 1), tramo('c', 1, 30, 31)];

    it('lista los tramos de la celda en orden cronológico con su duración', () => {
      expect(cellTramoRows(tramos, cell, 'ALL')).toEqual([
        { id: 'a', label: "1T 20'–25'", minutes: 5 },
        { id: 'c', label: "1T 30'–31'", minutes: 1 },
        { id: 'b', label: "2T 60'–70'", minutes: 10 }
      ]);
    });

    it('respeta el tiempo elegido', () => {
      expect(cellTramoRows(tramos, cell, 1).map(row => row.id)).toEqual(['a', 'c']);
    });

    it('una celda sin tramos devuelve una lista vacía', () => {
      expect(cellTramoRows(tramos, { row: 3, col: 3 }, 'ALL')).toEqual([]);
    });
  });
});
