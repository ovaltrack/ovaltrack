import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { PlayerStatsApiService } from '../../../player-statistics/services/player-stats-api.service';
import { MetricComparison, PlayerMatchSummary, PlayerMetrics } from '../../../player-statistics/types/player-stats-api.types';
import { PlayerStatisticsService } from '../../../player-statistics/services/player-statistics.service';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { toWidgetState } from '../../data/to-widget-state';
import { activeTypeIdsOf } from '../../../match/post-match/utils/review-coverage';
import { analysisCoverage } from '../../domain/analysis-coverage';
import { PlayerSummary, buildPlayerSummary, newestFirst } from '../../domain/player-summary';
import { WidgetState } from '../../types/home.types';

/** Temporada del jugador según el backend: totales, un resumen por partido y su comparación con el plantel. */
export interface PlayerSeasonData {
  totals: PlayerMetrics;
  matches: PlayerMatchSummary[];
  /** Las 7 métricas frente al promedio del plantel; los snapshots guardados antes de la Fase 12 no la traen. */
  comparisons: MetricComparison[];
}

/** Lecturas del Inicio del jugador: reutiliza `PlayerStatisticsService` sin escrituras nuevas en Dexie. */
@Injectable()
export class PlayerHomeDataService {
  private readonly statistics = inject(PlayerStatisticsService);
  private readonly statsApi = inject(PlayerStatsApiService);
  private readonly cache = inject(DashboardSnapshotCache);
  private readonly userContext = inject(UserContextService);
  private readonly connectivity = inject(ConnectivityService);

  /** Último partido y temporada del jugador; vacío si todavía no jugó ninguno. */
  summary(): Observable<WidgetState<PlayerSummary>> {
    const userId = this.userContext.userContext()?.userId;
    return this.statistics.loadAllMatchStatistics().pipe(
      switchMap(unordered => {
        const stats = newestFirst(unordered);
        const latest = stats[0];
        if (!latest) return of(buildPlayerSummary(stats, 100));
        // El % de análisis es del partido completo (no solo de las jugadas del jugador).
        return this.statistics.loadMatchSource(latest.match.matchId).pipe(
          map(source => analysisCoverage(source.events, activeTypeIdsOf(source.eventTypes)).percent),
          catchError(() => of(100)),
          map(percent => buildPlayerSummary(stats, percent))
        );
      }),
      toWidgetState<PlayerSummary | null>({
        offline: !this.connectivity.online(),
        snapshot: userId
          ? {
              read: () => this.cache.read<PlayerSummary | null>(userId, 'player.summary'),
              write: (data, fetchedAt) => this.cache.write(userId, 'player.summary', data, fetchedAt)
            }
          : undefined
      })
    ) as Observable<WidgetState<PlayerSummary>>;
  }

  /** Temporada del año en curso (`GET /statistics/player/{personId}`); vacía si no jugó partidos o no hay persona asociada. */
  season(now: Date): Observable<WidgetState<PlayerSeasonData>> {
    const userId = this.userContext.userContext()?.userId;
    const personId = this.userContext.personId();
    if (!personId) return of<WidgetState<PlayerSeasonData>>({ status: 'empty' });
    const divisionId = this.userContext.activeDivisions()[0]?.id ?? null;
    const key = `player.season.${now.getFullYear()}`;
    return this.statsApi.getGeneral(personId, { divisionId, season: now.getFullYear() }).pipe(
      map((response): PlayerSeasonData => ({ totals: response.totals, matches: response.matches, comparisons: response.comparisons })),
      toWidgetState<PlayerSeasonData>({
        isEmpty: data => data.matches.length === 0,
        offline: !this.connectivity.online(),
        snapshot: userId
          ? {
              read: () => this.cache.read<PlayerSeasonData>(userId, key),
              write: (data, fetchedAt) => this.cache.write(userId, key, data, fetchedAt)
            }
          : undefined
      })
    );
  }
}
