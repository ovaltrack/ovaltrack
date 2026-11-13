import { ZONE_GRID_COLS, ZONE_GRID_ROWS, ZoneCellRef } from '../../types/zone.types';

/**
 * Geometría de la cancha en metros. Es la única fuente de las proporciones y de los nombres de zona:
 * el dibujo, los ejes, las etiquetas y la línea de lectura salen de acá.
 *
 * Vista relativa al equipo: se ataca siempre hacia la derecha (también en el 2T, sin espejar).
 * Columna 1 = in-goal propio, columna 6 = in-goal rival; fila 1 = izquierda, 3 = derecha, mirando al ataque.
 */
export const ZONE_COLUMN_METERS = [10, 22, 28, 28, 22, 10] as const;
export const ZONE_ROW_METERS = [15, 40, 15] as const;

export const ZONE_FIELD_LENGTH_M = ZONE_COLUMN_METERS.reduce((sum, m) => sum + m, 0);
export const ZONE_FIELD_WIDTH_M = ZONE_ROW_METERS.reduce((sum, m) => sum + m, 0);

export const ZONE_ROW_LETTERS = ['I', 'C', 'D'] as const;
export const ZONE_ROW_NAMES = ['Izquierda', 'Centro', 'Derecha'] as const;
export const ZONE_ROW_SHORT_NAMES = ['Izq.', 'Centro', 'Der.'] as const;
export const ZONE_COLUMN_NAMES = ['In-goal propio', '22 propio', 'Campo propio', 'Campo rival', '22 rival', 'In-goal rival'] as const;

/** Columnas de in-goal (propio y rival): admiten puntos, no tramos nuevos. */
export const IN_GOAL_COLUMNS: readonly number[] = [1, ZONE_GRID_COLS];

export function isInGoalColumn(col: number): boolean {
  return IN_GOAL_COLUMNS.includes(col);
}

/** Etiqueta fija de una zona: letra de fila + número de columna (I1 … D6). */
export function zoneLabel(cell: ZoneCellRef): string {
  return `${ZONE_ROW_LETTERS[cell.row - 1]}${cell.col}`;
}

/** Rango en metros de la fila, medido desde la touch izquierda (ej. "55–70 m"). */
export function rowRangeLabel(row: number): string {
  const start = ZONE_ROW_METERS.slice(0, row - 1).reduce((sum, m) => sum + m, 0);
  return `${start}–${start + ZONE_ROW_METERS[row - 1]} m`;
}

/** Rango en metros de la columna desde la línea de gol propia (0–100 m); vacío para los in-goals. */
export function columnRangeLabel(col: number): string {
  if (isInGoalColumn(col)) return '';
  const start = ZONE_COLUMN_METERS.slice(1, col - 1).reduce((sum, m) => sum + m, 0);
  return `${start}–${start + ZONE_COLUMN_METERS[col - 1]} m`;
}

/** Nombre de una zona para tooltips y lectores de pantalla, ej. "Derecha · 22 rival" (lateral y franja). */
export function zoneName(cell: ZoneCellRef): string {
  return `${ZONE_ROW_NAMES[cell.row - 1]} · ${ZONE_COLUMN_NAMES[cell.col - 1]}`;
}

/** Texto completo de una zona, ej. "D5 · Derecha (55–70 m) · 22 rival (78–100 m)". */
export function describeZone(cell: ZoneCellRef): string {
  const column = columnRangeLabel(cell.col);
  return [
    zoneLabel(cell),
    `${ZONE_ROW_NAMES[cell.row - 1]} (${rowRangeLabel(cell.row)})`,
    column ? `${ZONE_COLUMN_NAMES[cell.col - 1]} (${column})` : ZONE_COLUMN_NAMES[cell.col - 1]
  ].join(' · ');
}

/** Qué cuenta una celda: jugadas (Eventos) o minutos cubiertos por los tramos (Minutos). */
export type ZoneCountUnit = 'events' | 'minutes';

/** Cantidad con su unidad para lecturas y lectores de pantalla, ej. "1 evento", "12 eventos", "35 min". */
export function describeCount(count: number, unit: ZoneCountUnit): string {
  if (unit === 'minutes') return `${count} min`;
  return count === 1 ? '1 evento' : `${count} eventos`;
}

/** Todas las celdas de la grilla, fila por fila. */
export function allZoneCells(): ZoneCellRef[] {
  const cells: ZoneCellRef[] = [];
  for (let row = 1; row <= ZONE_GRID_ROWS; row++) {
    for (let col = 1; col <= ZONE_GRID_COLS; col++) {
      cells.push({ row, col });
    }
  }
  return cells;
}

/** Conteo para la burbuja de la celda: desde 1000 se abrevia ("1k") para que no se salga de la píldora. */
export function formatEventCount(count: number): string {
  return count > 999 ? `${Math.floor(count / 1000)}k` : String(count);
}

const TEAM_NAME_NOISE = /\b(rugby\s*club|rugby|club|r\.?\s?c\.?)\b/gi;
const SHORT_TEAM_NAME_MAX = 14;

/** Nombre corto para el in-goal: sin "Rugby Club" / "RC" y acotado a 14 caracteres. */
export function shortTeamName(name: string): string {
  const trimmed = name.trim();
  const core = trimmed.replace(TEAM_NAME_NOISE, ' ').replace(/\s+/g, ' ').trim() || trimmed;
  return core.length > SHORT_TEAM_NAME_MAX ? `${core.slice(0, SHORT_TEAM_NAME_MAX - 1).trimEnd()}…` : core;
}
