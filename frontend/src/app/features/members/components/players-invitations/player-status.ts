import { ClubPlayer, PlayerAccountStatus } from '../../../invitation/types/invitation.types';

export type StatusTone = 'ok' | 'info' | 'warn' | 'muted' | 'error';

interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** Texto de la acción; null si no se puede invitar. */
  action: 'Invitar' | 'Reenviar' | null;
}

export const PLAYER_STATUS_META: Record<PlayerAccountStatus, StatusMeta> = {
  LINKED: { label: 'Con cuenta', tone: 'ok', action: null },
  INVITED: { label: 'Invitado', tone: 'info', action: 'Reenviar' },
  EXPIRED: { label: 'Invitación vencida', tone: 'warn', action: 'Reenviar' },
  NOT_INVITED: { label: 'Sin invitar', tone: 'muted', action: 'Invitar' },
  NO_EMAIL: { label: 'Sin correo', tone: 'error', action: null },
  EMAIL_IN_USE: { label: 'Correo en uso', tone: 'error', action: null },
};

export type PlayerFilter = 'ALL' | 'PENDING' | 'INVITED' | 'LINKED' | 'BLOCKED';

/** Filtros de la tabla: "Para invitar" junta a los que todavía no tienen enlace vigente. */
export const PLAYER_FILTERS: ReadonlyArray<{ key: PlayerFilter; label: string; matches: (s: PlayerAccountStatus) => boolean }> = [
  { key: 'ALL', label: 'Todos', matches: () => true },
  { key: 'PENDING', label: 'Para invitar', matches: (s) => s === 'NOT_INVITED' || s === 'EXPIRED' },
  { key: 'INVITED', label: 'Invitados', matches: (s) => s === 'INVITED' },
  { key: 'LINKED', label: 'Con cuenta', matches: (s) => s === 'LINKED' },
  { key: 'BLOCKED', label: 'Revisar datos', matches: (s) => s === 'NO_EMAIL' || s === 'EMAIL_IN_USE' },
];

const DATE_FORMAT = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function formatDateTime(iso: string | null): string {
  return iso ? DATE_FORMAT.format(new Date(iso)) : '';
}

/** Aclaración bajo el estado: vencimiento, motivo del bloqueo o fecha del último envío. */
export function statusDetail(player: ClubPlayer): string {
  switch (player.status) {
    case 'INVITED':
      return `Vence el ${formatDateTime(player.invitationExpiresAt)}`;
    case 'EXPIRED':
      return `Venció el ${formatDateTime(player.invitationExpiresAt)}`;
    case 'NO_EMAIL':
      return 'Cargá su correo de contacto para invitarlo.';
    case 'EMAIL_IN_USE':
      return 'Su correo ya es de otra cuenta: actualizalo para invitarlo.';
    default:
      return '';
  }
}

export function playerName(player: ClubPlayer): string {
  return `${player.firstName} ${player.lastName}`;
}

export function matchesPlayerSearch(player: ClubPlayer, query: string): boolean {
  if (!query) return true;
  const haystack = `${player.firstName} ${player.lastName} ${player.contactEmail ?? ''} ${player.divisions.map((d) => d.name).join(' ')}`;
  return haystack.toLowerCase().includes(query);
}
