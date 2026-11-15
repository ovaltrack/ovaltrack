import type * as XLSX from 'xlsx';
import {
  ParsedRosterRow,
  RosterColumn,
  RosterField,
  RosterImportRowRequest,
  RosterIssue,
  RosterParseResult,
  SheetCell
} from './roster-import.types';

/**
 * Lectura y validación de la planilla del plantel.
 * Funciones puras: SheetJS se recibe por parámetro para cargarlo en diferido desde el componente.
 * Las reglas replican las del backend (POST /players/import), que vuelve a validar todo.
 */

export const ROSTER_MAX_ROWS = 300;
export const ROSTER_TEMPLATE_FILE_NAME = 'plantilla-plantel.xlsx';

export const ROSTER_COLUMNS: readonly RosterColumn[] = [
  { field: 'firstName', header: 'Nombre', required: true, aliases: ['nombre', 'nombres', 'firstname'] },
  { field: 'lastName', header: 'Apellido', required: true, aliases: ['apellido', 'apellidos', 'lastname'] },
  {
    field: 'birthDate',
    header: 'Fecha de nacimiento',
    required: true,
    aliases: ['fechadenacimiento', 'fechanacimiento', 'nacimiento', 'fnac', 'fechanac', 'birthdate']
  },
  { field: 'position', header: 'Puesto', required: true, aliases: ['puesto', 'posicion', 'position'] },
  {
    field: 'jerseyNumber',
    header: 'Dorsal',
    required: false,
    aliases: ['dorsal', 'camiseta', 'numero', 'nro', 'ncamiseta', 'numerodecamiseta', 'jerseynumber']
  },
  {
    field: 'contactEmail',
    header: 'Correo',
    required: false,
    aliases: ['correo', 'email', 'mail', 'correoelectronico', 'contactemail']
  },
  {
    field: 'contactPhone',
    header: 'Teléfono',
    required: false,
    aliases: ['telefono', 'celular', 'tel', 'movil', 'phone', 'contactphone']
  }
];

const COLUMN_BY_FIELD = new Map<RosterField, RosterColumn>(ROSTER_COLUMNS.map(column => [column.field, column]));
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_NAME_LENGTH = 2;
const MAX_TEXT_LENGTH = 255;
const ADULT_AGE = 18;
/** Día 0 de las fechas de Excel (sistema 1900, ya corregido el falso 29/02/1900). */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;
const MAX_EXCEL_SERIAL = 2_958_465; // 31/12/9999

// <==================== Lectura del archivo ====================>

export function isCsvFile(fileName: string): boolean {
  return /\.csv$/i.test(fileName.trim());
}

export function isSupportedRosterFile(fileName: string): boolean {
  return /\.(xlsx|xls|csv)$/i.test(fileName.trim());
}

/**
 * Devuelve la primera hoja como matriz de celdas.
 * En CSV se desactiva la interpretación de valores (raw) para que "05/03/2001" no se lea como fecha de EE. UU.
 */
export function readRosterSheet(xlsx: typeof XLSX, data: ArrayBuffer | string, fileName: string): SheetCell[][] {
  const csv = isCsvFile(fileName);
  // El CSV se decodifica como UTF-8 (sin BOM) para conservar acentos y eñes
  const content = csv && typeof data !== 'string' ? new TextDecoder('utf-8').decode(data).replace(/^﻿/, '') : data;
  const workbook = typeof content === 'string'
    ? xlsx.read(content, { type: 'string', raw: csv })
    : xlsx.read(content, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  return xlsx.utils.sheet_to_json<SheetCell[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true
  });
}

/** Plantilla descargable: encabezados y una fila de ejemplo (la fecha como texto, en formato argentino). */
export function buildRosterTemplate(xlsx: typeof XLSX): XLSX.WorkBook {
  const sheet = xlsx.utils.aoa_to_sheet([
    ROSTER_COLUMNS.map(column => column.header),
    ['Juan', 'Pérez', '15/03/2000', 'Pilar', 1, 'juan.perez@correo.com', '2231234567']
  ]);
  sheet['!cols'] = ROSTER_COLUMNS.map(column => ({ wch: Math.max(column.header.length + 2, 14) }));
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, 'Plantel');
  return workbook;
}

// <==================== Encabezados y filas ====================>

/** Minúsculas, sin acentos ni signos: "Fecha de Nacimiento" → "fechadenacimiento". */
export function normalizeHeader(value: SheetCell): string {
  return cellToText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function parseRosterSheet(matrix: SheetCell[][], today: Date = new Date()): RosterParseResult {
  const headerIndex = matrix.findIndex(row => !isBlankRow(row));
  if (headerIndex < 0) {
    return { fileError: 'La planilla está vacía.', rows: [] };
  }

  const columnIndexes = mapHeaders(matrix[headerIndex]);
  const missing = ROSTER_COLUMNS.filter(column => column.required && !columnIndexes.has(column.field));
  if (missing.length > 0) {
    const names = missing.map(column => `«${column.header}»`).join(', ');
    return {
      fileError: `Faltan columnas obligatorias: ${names}. Usá la plantilla para ver los encabezados esperados.`,
      rows: []
    };
  }

  const rows: ParsedRosterRow[] = [];
  for (let index = headerIndex + 1; index < matrix.length; index++) {
    const cells = matrix[index] ?? [];
    if (isBlankRow(cells)) {
      continue;
    }
    const valueOf = (field: RosterField): SheetCell => {
      const columnIndex = columnIndexes.get(field);
      return columnIndex === undefined ? null : cells[columnIndex];
    };
    rows.push(validateRosterRow(index + 1, valueOf, today));
  }

  if (rows.length === 0) {
    return { fileError: 'La planilla no tiene jugadores debajo de los encabezados.', rows: [] };
  }
  if (rows.length > ROSTER_MAX_ROWS) {
    return {
      fileError: `La planilla tiene ${rows.length} jugadores; el máximo por importación es ${ROSTER_MAX_ROWS}.`,
      rows: []
    };
  }
  return { fileError: null, rows };
}

function mapHeaders(headerRow: SheetCell[]): Map<RosterField, number> {
  const indexes = new Map<RosterField, number>();
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    const column = ROSTER_COLUMNS.find(candidate => candidate.aliases.includes(normalized));
    if (column && !indexes.has(column.field)) {
      indexes.set(column.field, index);
    }
  });
  return indexes;
}

function isBlankRow(row: SheetCell[] | undefined): boolean {
  return !row || row.every(cell => cellToText(cell) === '');
}

// <==================== Validación de una fila ====================>

export function validateRosterRow(
  rowNumber: number,
  valueOf: (field: RosterField) => SheetCell,
  today: Date = new Date()
): ParsedRosterRow {
  const issues: RosterIssue[] = [];
  const issue = (field: RosterField, message: string) =>
    issues.push({ field, column: COLUMN_BY_FIELD.get(field)?.header ?? null, message });

  const firstName = cellToText(valueOf('firstName'));
  const lastName = cellToText(valueOf('lastName'));
  checkName(firstName, 'firstName', 'nombre', issue);
  checkName(lastName, 'lastName', 'apellido', issue);

  const birthDateCell = valueOf('birthDate');
  const birthDate = parseBirthDate(birthDateCell);
  if (cellToText(birthDateCell) === '') {
    issue('birthDate', 'La fecha de nacimiento es obligatoria.');
  } else if (!birthDate) {
    issue('birthDate', `«${cellToText(birthDateCell)}» no es una fecha válida. Usá dd/mm/aaaa.`);
  } else if (birthDate >= toIsoDate(today)) {
    issue('birthDate', 'La fecha de nacimiento debe ser en el pasado.');
  }

  const position = cellToText(valueOf('position'));
  if (position === '') {
    issue('position', 'El puesto es obligatorio.');
  } else if (position.length > MAX_TEXT_LENGTH) {
    issue('position', 'El puesto no puede superar los 255 caracteres.');
  }

  const jerseyCell = valueOf('jerseyNumber');
  const jerseyNumber = parseJerseyNumber(jerseyCell);
  if (cellToText(jerseyCell) !== '' && jerseyNumber === null) {
    issue('jerseyNumber', 'El dorsal debe ser un número entero entre 1 y 99.');
  }

  const contactEmail = cellToText(valueOf('contactEmail'));
  if (contactEmail !== '' && (contactEmail.length > MAX_TEXT_LENGTH || !EMAIL_PATTERN.test(contactEmail))) {
    issue('contactEmail', `«${contactEmail}» no es un correo válido.`);
  }

  const contactPhone = cellToText(valueOf('contactPhone'));
  if (contactPhone.length > MAX_TEXT_LENGTH) {
    issue('contactPhone', 'El teléfono no puede superar los 255 caracteres.');
  }

  if (birthDate && birthDate < toIsoDate(today) && ageOn(birthDate, today) < ADULT_AGE) {
    if (contactEmail === '') {
      issue('contactEmail', 'Es menor de 18: el correo es obligatorio.');
    }
    if (contactPhone === '') {
      issue('contactPhone', 'Es menor de 18: el teléfono es obligatorio.');
    }
  }

  const displayName = `${firstName} ${lastName}`.trim();
  const request: RosterImportRowRequest | null = issues.length > 0 || !birthDate
    ? null
    : {
        rowNumber,
        firstName,
        lastName,
        birthDate,
        position,
        jerseyNumber,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null
      };

  return { rowNumber, displayName, issues, request };
}

function checkName(
  value: string,
  field: RosterField,
  label: string,
  issue: (field: RosterField, message: string) => void
): void {
  if (value === '') {
    issue(field, `El ${label} es obligatorio.`);
  } else if (value.length < MIN_NAME_LENGTH) {
    issue(field, `El ${label} debe tener al menos 2 caracteres.`);
  } else if (value.length > MAX_TEXT_LENGTH) {
    issue(field, `El ${label} no puede superar los 255 caracteres.`);
  }
}

// <==================== Conversión de celdas ====================>

export function cellToText(value: SheetCell): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : toIsoDate(value);
  }
  if (typeof value === 'number') {
    // Teléfonos y dorsales numéricos: sin notación científica ni ".0"
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  return String(value).trim();
}

/**
 * Acepta un número de serie de Excel, un Date, dd/mm/aaaa (también con "-" o "."), d/m/aaaa o aaaa-mm-dd.
 * Devuelve aaaa-mm-dd o null si no es una fecha real.
 */
export function parseBirthDate(value: SheetCell): string | null {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : buildIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') {
    return excelSerialToIsoDate(value);
  }

  const text = value.trim();
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (dayFirst) {
    return buildIsoDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  }
  const yearFirst = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (yearFirst) {
    return buildIsoDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  }
  // Una fecha de Excel guardada como texto en un CSV
  if (/^\d{4,5}$/.test(text)) {
    return excelSerialToIsoDate(Number(text));
  }
  return null;
}

export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > MAX_EXCEL_SERIAL) {
    return null;
  }
  const date = new Date(EXCEL_EPOCH_UTC + Math.floor(serial) * MS_PER_DAY);
  return buildIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function parseJerseyNumber(value: SheetCell): number | null {
  const text = cellToText(value);
  if (!/^\d{1,2}$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return number >= 1 && number <= 99 ? number : null;
}

function buildIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || month < 1 || month > 12 || day < 1) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Edad cumplida en `today` para una fecha aaaa-mm-dd (comparación de calendario, sin husos horarios). */
export function ageOn(isoBirthDate: string, today: Date): number {
  const [year, month, day] = isoBirthDate.split('-').map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) {
    age--;
  }
  return age;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
