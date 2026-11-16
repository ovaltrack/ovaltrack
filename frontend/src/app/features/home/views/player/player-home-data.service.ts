import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { ConnectivityService } from '../../../../core/services/connectivity.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { PlayerStatisticsService } from '../../../player-statistics/services/player-statistics.service';
import { DashboardSnapshotCache } from '../../data/dashboard-snapshot.cache';
import { toWidgetState } from '../../data/to-widget-state';
import { activeTypeIdsOf } from '../../../match/post-match/utils/review-coverage';
import { analysisCoverage } from '../../domain/analysis-coverage';
import { PlayerSummary, buildPlayerSummary, newestFirst } from '../../domain/player-summary';
import { WidgetState } from '../../types/home.types';

/** Lecturas del Inicio del jugador: reutiliza `PlayerStatisticsService` sin escrituras nuevas en Dexie. */
@Injectable()
export class PlayerHomeDataService {
  private readonly statistics = inject(PlayerStatisticsService);
  private readonly cache = inject(DashboardSnapshotCache);
  private readonly userContext = inject(UserContextService);
  private readonly connectivity = inject(ConnectivityService);

  /** Último partido y temporada del jugador; vacío si todavía no jugó ninguno. */
  summary(now: Date): Observable<WidgetState<PlayerSummary>> {
    const userId = this.userContext.userContext()?.userId;
    return this.statistics.loadAllMatchStatistics().pipe(
      switchMap(unordered => {
        const stats = newestFirst(unordered);
        const latest = stats[0];
        if (!latest) return of(buildPlayerSummary(stats, 100, now));
        // El % de análisis es del partido completo (no solo de las jugadas del jugador).
        return this.statistics.loadMatchSource(latest.match.matchId).pipe(
          map(source => analysisCoverage(source.events, activeTypeIdsOf(source.eventTypes)).percent),
          catchError(() => of(100)),
          map(percent => buildPlayerSummary(stats, percent, now))
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
}
