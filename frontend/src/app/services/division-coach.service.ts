import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DivisionCoachResponse,
  DivisionCoachCreationRequest
} from '../features/division-coach/types/division-coach.types';
import { MessageResponse } from '../shared/types/shared-types';

export interface DivisionHistoryPerson {
  personId: string;
  firstName: string;
  lastName: string;
  contactEmail: string | null;
  active: boolean;
  firstStartDate: string;
  lastEndDate: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DivisionCoachService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/coaches`;

  getByDivisionId(divisionId: string): Observable<DivisionCoachResponse[]> {
    const params = new HttpParams().set('divisionId', divisionId);
    return this.http.get<DivisionCoachResponse[]>(this.apiUrl, { params });
  }

  getById(divisionCoachId: string): Observable<DivisionCoachResponse> {
    return this.http.get<DivisionCoachResponse>(`${this.apiUrl}/${divisionCoachId}`);
  }

  getHistoryByDivisionIdAndPersonId(divisionId: string, personId: string): Observable<DivisionCoachResponse[]> {
    const params = new HttpParams({
      fromObject: {
        divisionId,
        personId
      }
    });
    return this.http.get<DivisionCoachResponse[]>(`${this.apiUrl}/history`, { params });
  }

  getHistoryPeople(divisionId: string, search = ''): Observable<DivisionHistoryPerson[]> {
    let params = new HttpParams().set('divisionId', divisionId);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<DivisionHistoryPerson[]>(`${this.apiUrl}/history/people`, { params });
  }

  create(request: DivisionCoachCreationRequest): Observable<DivisionCoachResponse> {
    return this.http.post<DivisionCoachResponse>(this.apiUrl, request);
  }

  remove(divisionCoachId: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/${divisionCoachId}`);
  }
}