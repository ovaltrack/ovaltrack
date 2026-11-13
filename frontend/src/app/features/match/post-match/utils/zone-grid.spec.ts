import {
  ZONE_COLUMN_METERS, ZONE_FIELD_LENGTH_M, ZONE_FIELD_WIDTH_M, ZONE_ROW_METERS,
  IN_GOAL_COLUMNS, columnRangeLabel, describeCount, describeZone, formatEventCount, isInGoalColumn, rowRangeLabel, shortTeamName, zoneLabel, zoneName
} from './zone-grid';

describe('zone-grid', () => {
  it('las proporciones suman la cancha reglamentaria de 120 x 70 m', () => {
    expect(ZONE_COLUMN_METERS).toEqual([10, 22, 28, 28, 22, 10]);
    expect(ZONE_ROW_METERS).toEqual([15, 40, 15]);
    expect(ZONE_FIELD_LENGTH_M).toBe(120);
    expect(ZONE_FIELD_WIDTH_M).toBe(70);
  });

  describe('describeCount', () => {
    it('cuenta eventos en singular y plural', () => {
      expect(describeCount(0, 'events')).toBe('0 eventos');
      expect(describeCount(1, 'events')).toBe('1 evento');
      expect(describeCount(12, 'events')).toBe('12 eventos');
    });

    it('cuenta minutos abreviados, sin plural', () => {
      expect(describeCount(1, 'minutes')).toBe('1 min');
      expect(describeCount(35, 'minutes')).toBe('35 min');
    });
  });

  it('el in-goal son las columnas de los extremos: 1 (propio) y 6 (rival)', () => {
    expect(IN_GOAL_COLUMNS).toEqual([1, 6]);
    expect([1, 2, 3, 4, 5, 6].filter(isInGoalColumn)).toEqual([1, 6]);
  });

  it('las filas respetan las líneas de 15 m desde cada touch', () => {
    expect(ZONE_ROW_METERS[0]).toBe(15);
    expect(ZONE_ROW_METERS[2]).toBe(15);
  });

  it('etiqueta cada zona con letra de fila y número de columna', () => {
    expect(zoneLabel({ row: 1, col: 1 })).toBe('I1');
    expect(zoneLabel({ row: 2, col: 3 })).toBe('C3');
    expect(zoneLabel({ row: 3, col: 6 })).toBe('D6');
  });

  it('calcula los rangos en metros de filas y columnas', () => {
    expect([1, 2, 3].map(rowRangeLabel)).toEqual(['0–15 m', '15–55 m', '55–70 m']);
    expect([1, 2, 3, 4, 5, 6].map(columnRangeLabel)).toEqual(['', '0–22 m', '22–50 m', '50–78 m', '78–100 m', '']);
  });

  it('describe una zona de juego y una de in-goal', () => {
    expect(describeZone({ row: 3, col: 5 })).toBe('D5 · Derecha (55–70 m) · 22 rival (78–100 m)');
    expect(describeZone({ row: 1, col: 1 })).toBe('I1 · Izquierda (0–15 m) · In-goal propio');
  });

  it('zoneName da el lateral y la franja para tooltips', () => {
    expect(zoneName({ row: 2, col: 4 })).toBe('Centro · Campo rival');
    expect(zoneName({ row: 3, col: 6 })).toBe('Derecha · In-goal rival');
  });

  describe('formatEventCount', () => {
    it('muestra el número tal cual hasta 999', () => {
      expect(formatEventCount(1)).toBe('1');
      expect(formatEventCount(118)).toBe('118');
      expect(formatEventCount(999)).toBe('999');
    });

    it('abrevia desde 1000 a miles', () => {
      expect(formatEventCount(1000)).toBe('1k');
      expect(formatEventCount(1999)).toBe('1k');
      expect(formatEventCount(12500)).toBe('12k');
    });
  });

  describe('shortTeamName', () => {
    it('quita "Rugby Club" y "RC" del nombre', () => {
      expect(shortTeamName('Trelew Rugby Club')).toBe('Trelew');
      expect(shortTeamName('Trelew RC')).toBe('Trelew');
      expect(shortTeamName('Club Atlético Madryn')).toBe('Atlético Madr…');
    });

    it('acota los nombres largos a 14 caracteres con una elipsis', () => {
      const short = shortTeamName('Asociación Deportiva Universitaria');

      expect(short.length).toBe(14);
      expect(short.endsWith('…')).toBeTrue();
    });

    it('si no queda nada tras limpiar, conserva el nombre original', () => {
      expect(shortTeamName('Rugby Club')).toBe('Rugby Club');
      expect(shortTeamName('  ')).toBe('');
    });
  });
});
