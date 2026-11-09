import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  PlayerMatchStatisticsResponse,
  PlayerStatisticsQuery,
  PlayerStatisticsResponse,
} from '../types/player-stats-api.types';

/** Estadísticas de un jugador calculadas en el backend, comparadas con el promedio del plantel de su división. */
@Injectable({ providedIn: 'root' })
export class PlayerStatsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/statistics/player`;

  getGeneral(personId: string, query: PlayerStatisticsQuery = {}): Observable<PlayerStatisticsResponse> {
    let params = new HttpParams();
    if (query.divisionId) params = params.set('divisionId', query.divisionId);
    if (query.season) params = params.set('season', query.season);
    return this.http.get<PlayerStatisticsResponse>(`${this.apiUrl}/${personId}`, { params });
  }

  getMatch(personId: string, matchId: string): Observable<PlayerMatchStatisticsResponse> {
    return this.http.get<PlayerMatchStatisticsResponse>(`${this.apiUrl}/${personId}/match/${matchId}`);
  }
}
