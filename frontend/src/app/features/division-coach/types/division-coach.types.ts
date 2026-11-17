export interface DivisionCoachResponse {
  id: string;
  personId: string;
  divisionId: string;
  startDate: string;
  endDate: string | null;
  firstName?: string;
  lastName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface DivisionCoachCreationRequest {
  divisionId: string;
  personId: string;
}
