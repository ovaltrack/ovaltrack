import { AccountStatus, ClubStatus } from '../../types/profile.types';

export type Tone = 'ok' | 'warn' | 'error' | 'muted';

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Activa', tone: 'ok' },
  PENDING_APPROVAL: { label: 'Pendiente de aprobación', tone: 'warn' },
  SUSPENDED: { label: 'Suspendida', tone: 'warn' },
  REJECTED: { label: 'Rechazada', tone: 'error' },
  DEACTIVATED: { label: 'Desactivada', tone: 'muted' },
};

export const CLUB_STATUS: Record<ClubStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Activo', tone: 'ok' },
  PENDING: { label: 'Pendiente de aprobación', tone: 'warn' },
  REJECTED: { label: 'Rechazado', tone: 'error' },
};

const CATEGORY: Record<string, string> = {
  U14: 'M14', U15: 'M15', U16: 'M16', U18: 'M18', U20: 'M20', SENIOR: 'Primera', VETERAN: 'Veteranos',
};
const GENDER: Record<string, string> = { MALE: 'Masculino', FEMALE: 'Femenino', MIXED: 'Mixto' };

export const categoryLabel = (category: string): string => CATEGORY[category] ?? category;
export const genderLabel = (gender: string): string => GENDER[gender] ?? gender;

const DATE = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

/** "2026-11-08" o "2026-11-08T10:00:00" → "8 de noviembre de 2026". Fechas sin hora se leen como locales. */
export function formatLongDate(value: string | null): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE.format(date);
}

/** Edad cumplida a hoy a partir de una fecha "yyyy-mm-dd". */
export function ageFrom(birthDate: string | null, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}
