import { Club } from '../../club/types/club.types';

export type UserRole = 'ADMIN_OVALTRACK' | 'ADMIN_CLUB' | 'COACH_ANALYST' | 'PLAYER' | 'NO_ROLE';


export interface RegistroRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate: string; // Formato YYYY-MM-DD
  role: UserRole;
  clubName?: string;     // Obligatorio si es ADMIN_CLUB
  clubRegion?: string;   // Obligatorio si es ADMIN_CLUB
  clubContactPhone?: string;
  clubId?: string;       // Obligatorio si es COACH_ANALYST
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}

export interface RegistrationResponse {
  message: string;
}

export interface TokenPayload {
  sub: string;
  userId: string;
  role: UserRole;
  exp: number;
  iat: number;
}
export interface CurrentUserSession {
  id: string;
  email: string;
  role: UserRole;
}

export interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
  personId?: string;
  firstName?: string;
  lastName?: string;
  club: import('../../division/types/division.types').ClubSummary | null;
  activeDivisions: import('../../division/types/division.types').Division[];
}


export interface ApplicantData {
  email: string;
  password: string;
  requestedRole: UserRole;
  firstName: string;
  lastName: string;
  birthDate: string;
}
 
/** Cuerpo de POST /register (jugador o coach + club existente al que se une). */
export interface MemberRegistrationDTO {
  applicant: ApplicantData;
  club: Pick<Club, 'id'>;
  /** Aceptación de los Términos y la Política de Privacidad vigentes. */
  termsAccepted: boolean;
}
 
export interface AdminData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Formato ISO: yyyy-MM-dd */
  birthDate: string;
}
 
/** Datos del club a crear. */
export interface ClubData {
  name: string;
  city: string;
  contactEmail?: string;
  contactPhone?: string;
}
 
/** Cuerpo de POST /register-club (administrador + club nuevo). */
export interface ClubRegistrationDTO {
  admin: AdminData;
  club: ClubData;
  /** Aceptación de los Términos y la Política de Privacidad vigentes. */
  termsAccepted: boolean;
}
