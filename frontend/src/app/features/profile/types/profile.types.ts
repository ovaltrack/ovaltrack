import { UserRole } from '../../auth/types/auth.types';
import { Division } from '../../division/types/division.types';

export type AccountStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';
export type ClubStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

/** Cuenta de inicio de sesión. */
export interface ProfileAccount {
  userId: string;
  loginEmail: string;
  role: UserRole;
  status: AccountStatus;
  memberSince: string;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
}

/** Identidad deportiva de la persona. */
export interface ProfilePerson {
  personId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface ProfileClub {
  id: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  status: ClubStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  adminName: string | null;
}

/** Respuesta de GET /api/me/profile. */
export interface UserProfile {
  account: ProfileAccount;
  person: ProfilePerson | null;
  club: ProfileClub | null;
  divisions: Division[];
}

/** Cuerpo de PATCH /api/me/profile/contact. */
export interface UpdateContactRequest {
  contactEmail: string;
  contactPhone: string | null;
}

/** Cuerpo de PATCH /api/me/profile/login-email. */
export interface ChangeLoginEmailRequest {
  newEmail: string;
  currentPassword: string;
}
