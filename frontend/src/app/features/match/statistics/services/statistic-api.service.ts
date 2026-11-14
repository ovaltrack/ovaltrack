import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AdvancedMatchStatistics, PeriodStatisticDTO } from '../types/statistic.types';

const STATISTICS_MATCH_PATH = 'statistics/match';

@Injectable({ providedIn: 'root' })
export class StatisticApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/${STATISTICS_MATCH_PATH}`;

  getPeriodStatistics(matchId: string, period: number = 1): Observable<PeriodStatisticDTO> {
    const sanitizedMatchId = matchId?.trim();
    if (!sanitizedMatchId) {
      throw new Error('matchId es requerido para consultar estadísticas');
    }

    const params = new HttpParams().set('period', period.toString());
    return this.http.get<PeriodStatisticDTO>(`${this.baseUrl}/${encodeURIComponent(sanitizedMatchId)}`, { params });
  }

  /** Estadísticas de segundo nivel del post-partido (requiere el partido FINISHED). */
  getAdvancedStatistics(matchId: string): Observable<AdvancedMatchStatistics> {
    return this.http.get<AdvancedMatchStatistics>(`${this.baseUrl}/${encodeURIComponent(matchId)}/advanced`);
  }
}
