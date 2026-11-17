import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { ResultsPage } from '../features/pagination/results-page';
import { PersonResponse, PersonCreationRequest, PersonUpdateRequest } from '../features/person/types/person.types';
import { MessageResponse } from '../shared/types/shared-types';

@Injectable({
  providedIn: 'root'
})
export class PersonService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/person`;

  getPersons(): Observable<PersonResponse[]> {
    return this.http.get<PersonResponse[]>(this.apiUrl);
  }

  getPersonById(id: string): Observable<PersonResponse> {
    return this.http.get<PersonResponse>(`${this.apiUrl}/${id}`);
  }

  getPagedInactivePlayersByClubAndDivision(
    clubId: string, divisionId: string, page: number, size: number, search = ''
  ): Observable<ResultsPage> {
    const params = new HttpParams()
      .set('clubId', clubId)
      .set('divisionId', divisionId)
      .set('page', page - 1)
      .set('size', size)
      .set('search', search);
    return this.http.get<ResultsPage>(`${this.apiUrl}/club`, { params });
  }
  
  findAllPlayersByDivision(divisionId: string, page: number, size: number): Observable<ResultsPage> {
    const params = new HttpParams()
      .set('divisionId', divisionId)
      .set('page', page - 1)
      .set('size', size);
    return this.http.get<ResultsPage>(`${this.apiUrl}/division`, { params });
  }

  createPerson(person: PersonCreationRequest): Observable<PersonResponse> {
    return this.http.post<PersonResponse>(this.apiUrl, person);
  }

  updatePerson(id: string, person: PersonUpdateRequest): Observable<PersonResponse> {
    return this.http.put<PersonResponse>(`${this.apiUrl}/${id}`, person);
  }

  deletePerson(id: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/${id}`);
  }
}