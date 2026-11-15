/** Campos de la planilla del plantel (mismos nombres que el lote del backend). */
export type RosterField =
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'position'
  | 'jerseyNumber'
  | 'contactEmail'
  | 'contactPhone';

/** Valor de una celda tal como lo entrega SheetJS (sin cellDates: las fechas de Excel llegan como número). */
export type SheetCell = string | number | boolean | Date | null | undefined;

export interface RosterColumn {
  field: RosterField;
  header: string;
  required: boolean;
  aliases: readonly string[];
}

export interface RosterIssue {
  field: RosterField | null;
  column: string | null;
  message: string;
}

/** Fila lista para enviar: es la forma de DivisionPlayerImportRowDTO. */
export interface RosterImportRowRequest {
  rowNumber: number;
  firstName: string;
  lastName: string;
  birthDate: string;
  position: string;
  jerseyNumber: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface ParsedRosterRow {
  rowNumber: number;
  /** Nombre y apellido para mostrar en la vista previa, aunque la fila sea inválida. */
  displayName: string;
  issues: RosterIssue[];
  /** Solo presente si la fila no tiene problemas de formato. */
  request: RosterImportRowRequest | null;
}

export interface RosterParseResult {
  /** Error de la planilla completa (sin encabezados, falta una columna obligatoria...). */
  fileError: string | null;
  rows: ParsedRosterRow[];
}

export type RosterImportStatus = 'IMPORTED' | 'READY' | 'DUPLICATE' | 'INVALID';

export interface RosterImportRequest {
  divisionId: string;
  dryRun: boolean;
  rows: RosterImportRowRequest[];
}

export interface RosterImportRowResult {
  rowNumber: number;
  status: RosterImportStatus;
  field: RosterField | null;
  message: string | null;
  personId: string | null;
}

export interface RosterImportResult {
  imported: number;
  skipped: number;
  rows: RosterImportRowResult[];
}
