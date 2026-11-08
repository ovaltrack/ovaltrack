import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, from, map, of, switchMap, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BackendMatchResponse, LiveMatchStateRequest, Match, MatchStatus, MatchTransitionRequest, NewMatchDraft, PendingMatchAction, HALF_DURATION_SECONDS } from '../types/match.types';
import { PeriodStatisticDTO } from '../statistics/types/statistic.types';
import { LiveCaptureBootstrapResponse } from '../types/live-capture.types';
import { StatisticApiService } from '../statistics/services/statistic-api.service';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { isRetryableSyncError } from '../../../core/synchronization/sync-errors';

/** Pasado este tiempo la transición se da por perdida y se encola para reintentarla. */
const TRANSITION_TIMEOUT_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalDatabaseService);
  private readonly statisticApiService = inject(StatisticApiService);
  private readonly apiUrl = `${environment.apiUrl}/matches`;

  getAllMatchesByDivisionId(divisionId: string): Observable<Match[]> {
    return this.http.get<BackendMatchResponse[]>(`${this.apiUrl}/division?divisionId=${divisionId}`).pipe(
      map(matches => matches.map(match => this.normalizeMatch(match))),
      switchMap(matches => from(this.cache.syncOfflineMatches(matches)).pipe(map(() => matches))),
      catchError(() => from(this.cache.getMatchesByDivision(divisionId)).pipe(
        switchMap(matches => matches.length > 0
          ? from([matches])
          : throwError(() => new Error(`No hay partidos almacenados para la división ${divisionId}`)))
      ))
    );
  }

  /** Partidos de todas las divisiones del club; sin conexión, los de las divisiones cacheadas. */
  getMatchesByClub(clubId: string): Observable<Match[]> {
    return this.http.get<BackendMatchResponse[]>(`${this.apiUrl}/club?clubId=${clubId}`).pipe(
      map(matches => matches.map(match => this.normalizeMatch(match))),
      switchMap(matches => from(this.cache.syncOfflineMatches(matches)).pipe(map(() => matches))),
      catchError(() => from(this.readCachedClubMatches(clubId)).pipe(
        switchMap(matches => matches.length > 0
          ? of(matches)
          : throwError(() => new Error(`No hay partidos almacenados para el club ${clubId}`)))
      ))
    );
  }

  private async readCachedClubMatches(clubId: string): Promise<Match[]> {
    const divisions = await this.cache.getDivisionsByClub(clubId);
    const byDivision = await Promise.all(divisions.map(division => this.cache.getMatchesByDivision(division.id)));
    return byDivision.flat();
  }

  createMatch(draft: NewMatchDraft, divisionId: string): Observable<Match> {
    const formattedDate = draft.date.includes('T')
      ? draft.date
      : `${draft.date}T00:00:00`;

    const payload = {
      date: formattedDate,
      divisionId: divisionId,
      opponentId: draft.opponentId.trim()
    };

    return this.http.post<BackendMatchResponse>(this.apiUrl, payload).pipe(
      map(match => this.normalizeMatch(match)),
      // Un partido nuevo nace sin plantel (empty_roster): no queda en IndexedDB (ver syncOfflineMatches).
      switchMap(match => from(this.cache.syncOfflineMatches([match])).pipe(
        map(() => match)
      ))
    );
  }

  closeFirstHalf(matchId: string): Observable<Match> {
    return this.transitionMatch(matchId, 'close-first-half', 'halftime');
  }

  startSecondHalf(matchId: string): Observable<Match> {
    return this.transitionMatch(matchId, 'start-second-half', 'in_progress');
  }

  getPeriodStatistics(matchId: string, period: number = 1): Observable<PeriodStatisticDTO> {
    return this.statisticApiService.getPeriodStatistics(matchId, period);
  }

  private normalizeMatch(match: BackendMatchResponse): Match {
    return {
      ...match,
      status: this.normalizeStatus(match.status),
      opponent: match.opponent ?? {
        id: '',
        name: '',
        alias: '',
        city: null,
      },
      date: match.date ?? ''
    };
  }

  private normalizeStatus(status: BackendMatchResponse['status']): MatchStatus {
    return status.toLowerCase() as MatchStatus;
  }

  startMatch(matchId: string): Observable<Match> {
    return this.transitionMatch(matchId, 'start', 'in_progress');
  }

  finishMatch(matchId: string): Observable<Match> {
    return this.transitionMatch(matchId, 'finish', 'finished');
  }

  /**
   * Envía la transición al backend sin tocar la caché ni encolarla offline.
   * La usa el flush de mutaciones pendientes, que decide por sí mismo qué persistir.
   */
  sendTransition(matchId: string, action: PendingMatchAction, occurredAt?: string): Observable<Match> {
    const body: MatchTransitionRequest = occurredAt ? { occurredAt } : {};
    return this.http.put<BackendMatchResponse>(`${this.apiUrl}/${matchId}/${action}`, body).pipe(
      timeout(TRANSITION_TIMEOUT_MS),
      map(match => this.normalizeMatch(match)),
    );
  }

  private transitionMatch(
    matchId: string,
    action: PendingMatchAction,
    nextLocalStatus: MatchStatus,
  ): Observable<Match> {
    return this.sendTransition(matchId, action).pipe(
      switchMap(normalizedMatch => from(this.cache.saveMatches([normalizedMatch])).pipe(map(() => normalizedMatch))),
      catchError((error: unknown) => {
        if (!isRetryableSyncError(error)) {
          return throwError(() => error);
        }

        return from(this.queueOfflineTransition(matchId, action, nextLocalStatus));
      })
    );
  }

  private async queueOfflineTransition(
    matchId: string,
    action: PendingMatchAction,
    nextLocalStatus: MatchStatus,
  ): Promise<Match> {
    const cachedMatch = await this.cache.getMatch(matchId);
    const occurredAt = Date.now();
    const occurredAtIso = new Date(occurredAt).toISOString();

    let currentPeriod = cachedMatch?.currentPeriod ?? 1;
    let clockPaused = cachedMatch?.clockPaused ?? true;
    let clockElapsedSeconds = cachedMatch?.clockElapsedSeconds ?? 0;

    if (action === 'start-second-half') {
      currentPeriod = 2;
      clockPaused = false;
      clockElapsedSeconds = Math.max(HALF_DURATION_SECONDS, clockElapsedSeconds);
    } else if (action === 'close-first-half') {
      clockPaused = true;
      clockElapsedSeconds = Math.max(HALF_DURATION_SECONDS, clockElapsedSeconds);
    } else if (action === 'start') {
      currentPeriod = 1;
      clockPaused = false;
      clockElapsedSeconds = clockElapsedSeconds > 0 ? clockElapsedSeconds : 0;
    } else if (action === 'finish') {
      clockPaused = true;
    }

    const baseMatch: Match = cachedMatch ?? {
      id: matchId,
      status: nextLocalStatus,
      opponent: { id: '', name: '', alias: '', city: null },
      date: '',
      divisionId: '',
      currentPeriod,
      clockElapsedSeconds,
      clockPaused,
      currentPossession: 'OWN',
      homeScore: 0,
      awayScore: 0,
    };
    const nextMatch: Match = {
      ...baseMatch,
      status: nextLocalStatus,
      currentPeriod,
      clockPaused,
      clockElapsedSeconds,
      clockUpdatedAt: occurredAtIso,
      startedAt: action === 'start' ? (baseMatch.startedAt ?? occurredAtIso) : baseMatch.startedAt,
      finishedAt: action === 'finish' ? occurredAtIso : baseMatch.finishedAt,
    };

    await this.cache.saveMatches([nextMatch]);

    const mutationId = `${matchId}-latest`;
    await this.cache.savePendingMatchMutation({
      id: mutationId,
      matchId,
      action,
      createdAt: occurredAt,
    });

    return nextMatch;
  }

  deleteMatch(matchId: string): Observable<BackendMatchResponse> {
    return this.http.delete<BackendMatchResponse>(`${this.apiUrl}/${matchId}/cancel`).pipe(
      // Un partido cancelado deja de capturarse: se quita de IndexedDB junto con su nómina (ver syncOfflineMatches).
      switchMap(response => from(this.cache.syncOfflineMatches([this.normalizeMatch(response)])).pipe(
        map(() => response)
      )),
    );
  }

  getMatchById(matchId: string): Observable<Match> {
    return this.http.get<BackendMatchResponse>(`${this.apiUrl}/${matchId}`).pipe(
      map(match => this.normalizeMatch(match)),
      // Misma regla que los listados: solo queda en IndexedDB si se captura sin conexión (ver syncOfflineMatches).
      switchMap(match => from(this.cache.syncOfflineMatches([match])).pipe(
        map(() => match)
      )),
      catchError(error => from(this.cache.getMatch(matchId)).pipe(
        switchMap(cachedMatch => {
          if (cachedMatch) {
            return of(cachedMatch);
          }
          return throwError(() => error);
        })
      ))
    );
  }

  getLiveMatchState(matchId: string): Observable<Match> {
    return this.http.get<BackendMatchResponse>(`${this.apiUrl}/${matchId}/live-state`).pipe(
      map(match => this.normalizeMatch(match)),
    );
  }

  getLiveMatchBootstrap(matchId: string): Observable<LiveCaptureBootstrapResponse> {
    return this.http.get<{
      match: BackendMatchResponse;
      events: LiveCaptureBootstrapResponse['events'];
      eventTypes: LiveCaptureBootstrapResponse['eventTypes'];
    }>(`${this.apiUrl}/${matchId}/live-bootstrap`).pipe(
      map(response => ({
        ...response,
        match: this.normalizeMatch(response.match),
      })),
    );
  }

  updateLiveMatchState(matchId: string, state: LiveMatchStateRequest): Observable<Match> {
    return this.http.put<BackendMatchResponse>(`${this.apiUrl}/${matchId}/live-state`, state).pipe(
      map(match => this.normalizeMatch(match))
    );
  }

}