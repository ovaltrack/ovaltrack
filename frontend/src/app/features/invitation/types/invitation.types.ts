/** Debe coincidir con PlayerAccountStatus del backend. */
export type PlayerAccountStatus = 'LINKED' | 'INVITED' | 'EXPIRED' | 'NOT_INVITED' | 'NO_EMAIL' | 'EMAIL_IN_USE';

export interface DivisionSummary {
  id: string;
  name: string;
}

/** Fila de GET /api/invitation/players. */
export interface ClubPlayer {
  personId: string;
  firstName: string;
  lastName: string;
  contactEmail: string | null;
  divisions: DivisionSummary[];
  status: PlayerAccountStatus;
  /** Último envío de la invitación (ISO); null si nunca se lo invitó. */
  invitedAt: string | null;
  invitationExpiresAt: string | null;
}

/** Body de POST /api/invitation. */
export interface InvitePlayerRequest {
  personId: string;
}

/** Respuesta de POST /api/invitation/validate: lo que muestra el formulario de alta. */
export interface InvitationSummary {
  firstName: string;
  lastName: string;
  email: string;
  clubName: string;
  divisionName: string;
}

/** Body de POST /api/auth/register/invitation (crear cuenta). */
export interface RegisterFromInvitationRequest {
  token: string;
  password: string;
  /** Aceptación de los Términos y la Política de Privacidad vigentes. */
  termsAccepted: boolean;
}
