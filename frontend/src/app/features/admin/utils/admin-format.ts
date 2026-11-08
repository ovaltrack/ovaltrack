import { UserRole } from 'src/app/features/auth/types/auth.types';
import { UserResponseDTO } from 'src/app/features/user/types/user.types';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_OVALTRACK: 'Admin. OvalTrack',
  ADMIN_CLUB: 'Admin. de club',
  COACH_ANALYST: 'Entrenador/analista',
  PLAYER: 'Jugador',
  NO_ROLE: 'Sin rol',
};

export type RoleClass = 'role-admin' | 'role-coach' | 'role-player';

/** Nombre visible de una cuenta; si no tiene nombre ni apellido, el email. */
export function userName(user: UserResponseDTO): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

/** Hasta dos iniciales; también sirve con un email ("ana.diaz@x" → "AD"). */
export function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function roleClass(role: UserRole): RoleClass {
  return role === 'ADMIN_CLUB' ? 'role-admin' : role === 'COACH_ANALYST' ? 'role-coach' : 'role-player';
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function formatDate(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

export interface HttpErrorLike {
  error?: { message?: string } | null;
}

/** Mensaje del backend (`{ message }`) o el texto de respaldo. */
export function errorMessage(err: HttpErrorLike, fallback: string): string {
  return err?.error?.message ?? fallback;
}
