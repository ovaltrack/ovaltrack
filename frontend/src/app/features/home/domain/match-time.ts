const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * `Match.date` es hora de pared (sin zona): se toma tal cual, sin convertir, aunque el navegador
 * esté en otra zona horaria. `null` si el texto no tiene ese formato.
 */
export function parseWallClock(date: string): Date | null {
  const match = WALL_CLOCK.exec(date);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(+year, +month - 1, +day, +hour, +minute, +(second ?? 0));
}

export function msUntil(start: Date, now: Date): number {
  return start.getTime() - now.getTime();
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Hora local de un instante (ms epoch) como "14:05"; alimenta el sello "Datos de hh:mm". */
export function formatLocalClock(epochMs: number): string {
  return hhmm(new Date(epochMs));
}

/** "Sáb 7 nov · mañana · 14:30"; desde pasado mañana se omite la palabra relativa. */
export function relativeMatchLabel(start: Date, now: Date): string {
  const days = calendarDaysBetween(now, start);
  const word = days === 0 ? 'hoy' : days === 1 ? 'mañana' : days === -1 ? 'ayer' : null;
  return [dayLabel(start), word, hhmm(start)].filter(Boolean).join(' · ');
}

/** "Sáb 7 nov". */
export function dayLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

/** "sábado": día de la semana en minúscula, para frases como "Cerrá el análisis del sábado". */
export function weekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()];
}

/** "Hoy", "Mañana" o "En 5 días": días de calendario hasta un partido (uno ya empezado cuenta como hoy). */
export function daysUntilLabel(start: Date, now: Date): string {
  const days = Math.max(0, calendarDaysBetween(now, start));
  return days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;
}

/** "Sáb 21": día de la semana y del mes, para los subtítulos de los pasos. */
export function weekdayDayLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

/** "15:30": hora de pared de una fecha de partido. */
export function clockLabel(date: Date): string {
  return hhmm(date);
}

/** "1 nov": fecha corta de un partido ya jugado. */
export function shortDateLabel(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "nov": mes abreviado, para el bloque de fecha de las tarjetas. */
export function monthLabel(date: Date): string {
  return MONTHS[date.getMonth()];
}

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Instante de un campo `LocalDateTime` del backend (`clockUpdatedAt`, `startedAt`, `finishedAt`): llega en UTC pero sin zona,
 * y `Date.parse` lo tomaría como hora local del navegador. Si ya trae `Z` u offset (Dexie guarda `toISOString()`) se respeta.
 * `null` si el texto no es una fecha.
 */
export function parseBackendInstant(value: string): Date | null {
  const text = value.trim();
  const instant = new Date(HAS_ZONE.test(text) ? text : `${text}Z`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** `clockUpdatedAt`, `startedAt` y `finishedAt` llegan en UTC y se muestran en hora de Argentina. */
export function formatUtcAsArgentina(iso: string): string | null {
  const instant = parseBackendInstant(iso);
  if (!instant) return null;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(instant);
}

/** La temporada es el año calendario: rango `from`/`to` (AAAA-MM-DD) para pedir estadísticas. */
export function seasonRange(now: Date): { from: string; to: string } {
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    from: `${now.getFullYear()}-01-01`,
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  };
}
