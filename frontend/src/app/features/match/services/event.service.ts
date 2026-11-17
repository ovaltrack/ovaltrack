import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BackendEventCreationRequest, BackendEventUpdateRequest, BackendEventResponse, LocalMatchEvent, MatchCoverage, MatchTimelineEventResponse } from '../types/event.types';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/event`;

  getByMatch(matchId: string): Observable<BackendEventResponse[]> {
    return this.http.get<BackendEventResponse[]>(`${this.apiUrl}/match?matchId=${matchId}`);
  }

  getByMatchPostMatch(matchId: string): Observable<MatchTimelineEventResponse[]> {
    return this.http.get<MatchTimelineEventResponse[]>(`${this.apiUrl}/match/post-match?matchId=${matchId}`);
  }

  /** % de análisis de varios partidos en una sola llamada, sin descargar sus eventos. */
  getCoverage(matchIds: readonly string[]): Observable<MatchCoverage[]> {
    return this.http.get<MatchCoverage[]>(`${this.apiUrl}/match/coverage?matchIds=${matchIds.join(',')}`);
  }

  create(request: BackendEventCreationRequest): Observable<BackendEventResponse> {
    return this.http.post<BackendEventResponse>(this.apiUrl, request);
  }

  createFromLocal(event: LocalMatchEvent): Observable<BackendEventResponse> {
    const request: BackendEventCreationRequest = {
      eventTypeId: event.eventTypeId,
      matchId: event.matchId,
      clientEventId: event.id,
      playerId: event.playerId,
      teamPossession: event.teamPossession,
      matchTime: event.matchTime,
      absoluteMatchTime: event.absoluteMatchTime,
      realTime: event.realTime,
      period: event.period,
      origin: event.origin,
      attributes: event.attributes ?? undefined,
      synchronizedAt: event.synchronizedAt,
    };

    return this.create(request);
  }

  update(eventId: string, request: BackendEventUpdateRequest): Observable<BackendEventResponse> {
    return this.http.patch<BackendEventResponse>(`${this.apiUrl}/${eventId}`, request);
  }

  delete(eventId: string): Observable<BackendEventResponse> {
    return this.http.delete<BackendEventResponse>(`${this.apiUrl}/${eventId}`);
  }
}