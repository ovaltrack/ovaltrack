import * as XLSX from 'xlsx';
import {
  ROSTER_MAX_ROWS,
  ageOn,
  buildRosterTemplate,
  cellToText,
  excelSerialToIsoDate,
  isSupportedRosterFile,
  normalizeHeader,
  parseBirthDate,
  parseJerseyNumber,
  parseRosterSheet,
  readRosterSheet,
  validateRosterRow
} from './roster-import';
import { RosterField, SheetCell } from './roster-import.types';

const TODAY = new Date(2026, 10, 15); // 15/11/2026
const HEADERS = ['Nombre', 'Apellido', 'Fecha de nacimiento', 'Puesto', 'Dorsal', 'Correo', 'Teléfono'];

function rowFrom(values: Partial<Record<RosterField, SheetCell>>): (field: RosterField) => SheetCell {
  return field => values[field] ?? null;
}

const ADULT: Partial<Record<RosterField, SheetCell>> = {
  firstName: 'Juan',
  lastName: 'Pérez',
  birthDate: '15/03/2000',
  position: 'Pilar',
  jerseyNumber: 1
};

describe('roster-import: conversión de celdas', () => {
  it('normaliza encabezados sin acentos, mayúsculas ni signos', () => {
    expect(normalizeHeader('Fecha de Nacimiento')).toBe('fechadenacimiento');
    expect(normalizeHeader(' Teléfono ')).toBe('telefono');
    expect(normalizeHeader('N° Camiseta')).toBe('ncamiseta');
    expect(normalizeHeader(null)).toBe('');
  });

  it('pasa números enteros a texto sin decimales ni notación científica', () => {
    expect(cellToText(5492231234567)).toBe('5492231234567');
    expect(cellToText(7)).toBe('7');
    expect(cellToText('  Ala  ')).toBe('Ala');
    expect(cellToText(undefined)).toBe('');
  });

  it('acepta solo planillas .xlsx, .xls y .csv', () => {
    expect(isSupportedRosterFile('plantel.XLSX')).toBeTrue();
    expect(isSupportedRosterFile('plantel.csv')).toBeTrue();
    expect(isSupportedRosterFile('plantel.pdf')).toBeFalse();
  });
});

describe('roster-import: fechas de nacimiento', () => {
  it('lee dd/mm/aaaa, d/m/aaaa y separadores - o .', () => {
    expect(parseBirthDate('15/03/2000')).toBe('2000-03-15');
    expect(parseBirthDate('5/3/2001')).toBe('2001-03-05');
    expect(parseBirthDate('05-03-2001')).toBe('2001-03-05');
    expect(parseBirthDate('05.03.2001')).toBe('2001-03-05');
  });

  it('lee aaaa-mm-dd', () => {
    expect(parseBirthDate('1998-12-01')).toBe('1998-12-01');
  });

  it('lee el número de serie de Excel, también como texto', () => {
    expect(excelSerialToIsoDate(36600)).toBe('2000-03-15');
    expect(parseBirthDate(36600)).toBe('2000-03-15');
    expect(parseBirthDate('36600')).toBe('2000-03-15');
  });

  it('rechaza fechas que no existen o con año de dos cifras', () => {
    expect(parseBirthDate('31/02/2000')).toBeNull();
    expect(parseBirthDate('15/13/2000')).toBeNull();
    expect(parseBirthDate('15/03/00')).toBeNull();
    expect(parseBirthDate('ayer')).toBeNull();
    expect(parseBirthDate(true)).toBeNull();
  });

  it('calcula la edad cumplida por calendario', () => {
    expect(ageOn('2008-11-15', TODAY)).toBe(18);
    expect(ageOn('2008-11-16', TODAY)).toBe(17);
  });
});

describe('roster-import: dorsal', () => {
  it('acepta enteros de 1 a 99, como número o texto', () => {
    expect(parseJerseyNumber(9)).toBe(9);
    expect(parseJerseyNumber('23')).toBe(23);
  });

  it('rechaza 0, más de 99, decimales y texto', () => {
    expect(parseJerseyNumber(0)).toBeNull();
    expect(parseJerseyNumber(100)).toBeNull();
    expect(parseJerseyNumber(7.5)).toBeNull();
    expect(parseJerseyNumber('diez')).toBeNull();
  });
});

describe('roster-import: validación de una fila', () => {
  it('arma el pedido de una fila válida de un mayor de edad', () => {
    const row = validateRosterRow(2, rowFrom(ADULT), TODAY);
    expect(row.issues).toEqual([]);
    expect(row.request).toEqual({
      rowNumber: 2,
      firstName: 'Juan',
      lastName: 'Pérez',
      birthDate: '2000-03-15',
      position: 'Pilar',
      jerseyNumber: 1,
      contactEmail: null,
      contactPhone: null
    });
  });

  it('informa cada campo obligatorio faltante con su columna', () => {
    const row = validateRosterRow(5, rowFrom({}), TODAY);
    expect(row.request).toBeNull();
    expect(row.issues.map(issue => issue.column)).toEqual(['Nombre', 'Apellido', 'Fecha de nacimiento', 'Puesto']);
  });

  it('pide nombre y apellido de al menos 2 caracteres', () => {
    const row = validateRosterRow(2, rowFrom({ ...ADULT, firstName: 'J' }), TODAY);
    expect(row.issues).toEqual([
      { field: 'firstName', column: 'Nombre', message: 'El nombre debe tener al menos 2 caracteres.' }
    ]);
  });

  it('rechaza fechas futuras, correos mal formados y dorsales fuera de rango', () => {
    const row = validateRosterRow(
      3,
      rowFrom({ ...ADULT, birthDate: '01/01/2030', contactEmail: 'juan@', jerseyNumber: 120 }),
      TODAY
    );
    expect(row.issues.map(issue => issue.field)).toEqual(['birthDate', 'jerseyNumber', 'contactEmail']);
  });

  it('exige correo y teléfono a los menores de 18', () => {
    const row = validateRosterRow(4, rowFrom({ ...ADULT, birthDate: '20/06/2012' }), TODAY);
    expect(row.issues).toEqual([
      { field: 'contactEmail', column: 'Correo', message: 'Es menor de 18: el correo es obligatorio.' },
      { field: 'contactPhone', column: 'Teléfono', message: 'Es menor de 18: el teléfono es obligatorio.' }
    ]);
  });

  it('acepta un menor con correo y teléfono', () => {
    const row = validateRosterRow(
      4,
      rowFrom({ ...ADULT, birthDate: '20/06/2012', contactEmail: 'tutor@club.com', contactPhone: 2231234567 }),
      TODAY
    );
    expect(row.issues).toEqual([]);
    expect(row.request?.contactPhone).toBe('2231234567');
  });
});

describe('roster-import: lectura de la hoja', () => {
  it('reconoce encabezados en otro orden y con sinónimos, y numera las filas como la planilla', () => {
    const result = parseRosterSheet([
      ['Apellidos', 'Nombres', 'Posición', 'F. Nac', 'E-mail'],
      ['Gómez', 'Ana', 'Wing', '02/02/1999', 'ana@club.com'],
      [null, '', null, null, null],
      ['Ruiz', 'Leo', 'Apertura', '1997-07-07', null]
    ], TODAY);

    expect(result.fileError).toBeNull();
    expect(result.rows.map(row => row.rowNumber)).toEqual([2, 4]);
    expect(result.rows[0].request?.firstName).toBe('Ana');
    expect(result.rows[0].request?.contactEmail).toBe('ana@club.com');
    expect(result.rows[1].request?.birthDate).toBe('1997-07-07');
  });

  it('salta filas vacías antes de los encabezados', () => {
    const result = parseRosterSheet([[], [null, null], HEADERS, ['Juan', 'Pérez', '15/03/2000', 'Pilar']], TODAY);
    expect(result.rows[0].rowNumber).toBe(4);
  });

  it('informa las columnas obligatorias que faltan', () => {
    const result = parseRosterSheet([['Nombre', 'Apellido', 'Dorsal'], ['Juan', 'Pérez', 3]], TODAY);
    expect(result.fileError).toContain('«Fecha de nacimiento»');
    expect(result.fileError).toContain('«Puesto»');
    expect(result.rows).toEqual([]);
  });

  it('informa una planilla vacía o sin jugadores', () => {
    expect(parseRosterSheet([], TODAY).fileError).toBe('La planilla está vacía.');
    expect(parseRosterSheet([HEADERS], TODAY).fileError).toBe('La planilla no tiene jugadores debajo de los encabezados.');
  });

  it(`rechaza más de ${ROSTER_MAX_ROWS} jugadores`, () => {
    const rows = Array.from({ length: ROSTER_MAX_ROWS + 1 }, (_, i) => ['Juan', `Pérez${i}`, '15/03/2000', 'Pilar']);
    expect(parseRosterSheet([HEADERS, ...rows], TODAY).fileError).toContain('máximo por importación es 300');
  });
});

describe('roster-import: archivos reales con SheetJS', () => {
  it('la plantilla descargable se vuelve a leer sin errores', () => {
    const data = XLSX.write(buildRosterTemplate(XLSX), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = parseRosterSheet(readRosterSheet(XLSX, data, 'plantilla-plantel.xlsx'), TODAY);

    expect(result.fileError).toBeNull();
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].request).toEqual(jasmine.objectContaining({
      firstName: 'Juan',
      birthDate: '2000-03-15',
      jerseyNumber: 1,
      contactPhone: '2231234567'
    }));
  });

  it('lee una fecha guardada como fecha de Excel', () => {
    const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ['Ana', 'Gómez', 36600, 'Wing']]);
    sheet['C2'].z = 'dd/mm/yyyy';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Plantel');
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const result = parseRosterSheet(readRosterSheet(XLSX, data, 'plantel.xlsx'), TODAY);
    expect(result.rows[0].request?.birthDate).toBe('2000-03-15');
  });

  it('lee un CSV separado por punto y coma sin confundir día y mes', () => {
    const csv = 'Nombre;Apellido;Fecha de nacimiento;Puesto;Dorsal\nLeo;Ruiz;05/03/2001;Apertura;10\n';
    const result = parseRosterSheet(readRosterSheet(XLSX, csv, 'plantel.csv'), TODAY);

    expect(result.fileError).toBeNull();
    expect(result.rows[0].request).toEqual(jasmine.objectContaining({ birthDate: '2001-03-05', jerseyNumber: 10 }));
  });

  it('lee un CSV en UTF-8 desde bytes, con acentos', () => {
    const csv = 'Nombre,Apellido,Fecha de nacimiento,Puesto\nMartín,Núñez,15/03/2000,Hooker\n';
    const bytes = new TextEncoder().encode(csv);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const result = parseRosterSheet(readRosterSheet(XLSX, data, 'plantel.csv'), TODAY);
    expect(result.rows[0].request?.firstName).toBe('Martín');
    expect(result.rows[0].request?.lastName).toBe('Núñez');
  });
});
