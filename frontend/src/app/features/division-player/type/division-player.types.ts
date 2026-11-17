export interface DivisionPlayerResponse {
  id: string;
  personId: string;
  divisionId: string;
  jerseyNumber: number;
  position: string;
  startDate: string;
  endDate: string | null;
  firstName?: string;
  lastName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface DivisionPlayerPersonUserResponse {
  divisionPlayerId: string;
  personId: string;
  divisionId: string;
  jerseyNumber: number;
  position: string;
  startDate: string;
  endDate: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  userId: string | null;
  loginEmail: string | null;
  role: string | null;
  accountStatus: string | null;
  active: boolean | null;
}