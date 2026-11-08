export type UserRole =
  | 'ADMIN_OVALTRACK'
  | 'ADMIN_CLUB'
  | 'COACH_ANALYST'
  | 'PLAYER'
  | 'NO_ROLE';

export type FilterCategory = 'ALL' | 'STAFF' | 'PLAYER' | 'NO_ROLE';
export type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface Member {
  id: string;
  personId?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  active: boolean;
  jersey?: number;
  isProtected: boolean;
  userId?: string;
}

export interface RolePermissionMeta {
  icon: 'shield' | 'pencil';
  tip: string;
}

export interface RoleMetadata {
  label: string;
  color: string;
  tint: string;
  cssClass: string;
  perm: RolePermissionMeta | null;
}

export const ROLE_META: Record<UserRole, RoleMetadata> = {
  ADMIN_CLUB: {
    label: 'Administrador de club',
    color: 'var(--navy)',
    tint: 'var(--navy-tint)',
    cssClass: '',
    perm: {
      icon: 'shield',
      tip: 'Acceso total: gestión de miembros, roles y configuración del club.'
    }
  },
  COACH_ANALYST: {
    label: 'Entrenador / Analista',
    color: 'var(--blue-mid)',
    tint: 'var(--blue-mid-tint)',
    cssClass: '',
    perm: {
      icon: 'pencil',
      tip: 'Acceso de carga: puede registrar eventos y estadísticas de partido. No accede a la configuración del club.'
    }
  },
  PLAYER: {
    label: 'Jugador/a',
    color: 'var(--player)',
    tint: 'var(--player-tint)',
    cssClass: '',
    perm: null
  },
  NO_ROLE: {
    label: 'Sin rol asignado',
    color: 'var(--text-muted)',
    tint: 'var(--player-tint)',
    cssClass: 'norole',
    perm: null
  },
  ADMIN_OVALTRACK: {
    label: 'Super Admin OvalTrack',
    color: 'var(--navy)',
    tint: 'var(--navy-tint)',
    cssClass: '',
    perm: {
      icon: 'shield',
      tip: 'Acceso total a la plataforma OvalTrack.'
    }
  }
};

export const SELECTABLE_ROLES: UserRole[] = [
  'ADMIN_CLUB',
  'COACH_ANALYST',
  'PLAYER',
  'NO_ROLE'
];

export function bucketOf(role: UserRole): FilterCategory {
  if (role === 'ADMIN_CLUB' || role === 'COACH_ANALYST' || role === 'ADMIN_OVALTRACK') {
    return 'STAFF';
  }
  if (role === 'PLAYER') {
    return 'PLAYER';
  }
  return 'NO_ROLE';
}

export function getMemberInitials(firstName: string, lastName: string, email: string): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l) {
    return (f[0] + l[0]).toUpperCase();
  }
  if (f) {
    return f.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}

export function matchesStatus(member: Member, filter: StatusFilter): boolean {
  if (filter === 'ACTIVE') return member.active;
  if (filter === 'INACTIVE') return !member.active;
  return true;
}

export function getMemberDisplayName(member: Member): string {
  const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
  return fullName || member.email || '';
}

export function matchesSearchQuery(member: Member, query: string): boolean {
  if (!query) return true;
  const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
  const email = (member.email || '').toLowerCase();
  const jerseyStr = member.jersey != null ? `#${member.jersey}` : '';
  const textToSearch = `${fullName} ${email} ${jerseyStr}`;
  return textToSearch.includes(query);
}

export interface ClubInfo {
  id?: string;
  name: string;
  logoUrl?: string;
  status?: string;
}

export interface BackendUserResponse {
  id: string;
  loginEmail?: string;
  email?: string;
  role: UserRole;
  active: boolean;
  createdAt?: string;
  personId?: string;
  firstName?: string;
  lastName?: string;
  person?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
}
