import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import {
  DivisionPlayerPersonUserResponse,
  DivisionPlayerResponse
} from '../features/division-player/type/division-player.types';
import { RosterImportRequest, RosterImportResult } from '../features/division-player/import/roster-import.types';
import { ResultsPage } from '../features/pagination/results-page';
import { MessageResponse } from '../shared/types/shared-types';
import { DivisionHistoryPerson } from './division-coach.service';

@Injectable({
  providedIn: 'root'
})
export class DivisionPlayerService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/players`; 

  registerPlayer(playerData: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, playerData);
  }

  /** Alta en lote del plantel; con dryRun solo valida (vista previa). */
  importRoster(request: RosterImportRequest): Observable<RosterImportResult> {
    return this.http.post<RosterImportResult>(`${this.apiUrl}/import`, request);
  }

  getByDivisionIdAndPersonId(divisionId: string, personId: string): Observable<DivisionPlayerResponse[]> {
    const params = new HttpParams({
      fromObject: {
        divisionId,
        personId
      }
    });
    return this.http.get<DivisionPlayerResponse[]>(`${this.apiUrl}/history`, { params });
  }

  getActiveByDivisionId(divisionId: string, page: number, size: number, search = ''): Observable<ResultsPage> {
    let params = new HttpParams()
      .set('divisionId', divisionId)
      .set('page', page - 1)
      .set('size', size);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ResultsPage>(this.apiUrl, { params });
  }

  getHistoryPeople(divisionId: string, page: number, size: number, search = ''): Observable<ResultsPage> {
    let params = new HttpParams().set('divisionId', divisionId).set('page', page - 1).set('size', size);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ResultsPage>(`${this.apiUrl}/history/people`, { params });
  }

  getWithPersonAndUserByDivisionId(divisionId: string): Observable<DivisionPlayerPersonUserResponse[]> {
    const params = new HttpParams().set('divisionId', divisionId);
    return this.http.get<DivisionPlayerPersonUserResponse[]>(`${this.apiUrl}/with-user`, { params });
  }

  remove(divisionPlayerId: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/${divisionPlayerId}`);
  }
}