import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatchService } from '../services/match.service';
import { RosterService } from '../services/roster.service';
import { StatisticCalculationService } from '../statistics/services/statistic-calculation.service';
import { MatchStatistics, PlayerStatColumn, PlayerStatistic, PlayerStatistics } from '../statistics/types/statistic.types';
import {
  formatMetric,
  formatPlayerValue,
  hasPlayerValue,
  presentGroups,
  scoringLines,
} from '../statistics/presentation/stat-presentation';
import { LiveCapturePersistedState } from '../types/live-capture.types';
import { LiveCaptureService } from '../services/live-capture.service';

import { RosterPlayerInfo } from '../statistics/calculators';
import { LocalDatabaseService } from '../../local-database/services/local-database.service';
import { HALF_DURATION_SECONDS } from '../types/match.types';
import { UserContextService } from '../../../core/services/user-context.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'ot-halftime-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './halftime-summary.component.html',
  styleUrls: ['../styles/match-stats.css', './halftime-summary.component.css'],
})
export class HalftimeSummaryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly matchService = inject(MatchService);
  private readonly rosterService = inject(RosterService);
  private readonly statisticCalculationService = inject(StatisticCalculationService);
  private readonly cacheService = inject(LocalDatabaseService);
  private readonly liveCaptureService = inject(LiveCaptureService);
  private readonly userContextService = inject(UserContextService);

  readonly matchId = signal<string>('');
  readonly activeTab = signal<'general' | 'players'>('general');
  private readonly themeService = inject(ThemeService);
  /** Tema global de la app: el botón de esta pantalla lo cambia para todas. */
  readonly currentTheme = this.themeService.theme;
  readonly isLoading = signal<boolean>(true);
  readonly isOffline = signal<boolean>(!navigator.onLine);
  readonly homeTeam = computed(() => this.userContextService.currentClub()?.name || 'Mi Club');
  readonly opponent = signal<string>('Rival');
  /** Vista `intermediate`: tipos marcados con `stat_view` "intermediate" en el catálogo. */
  readonly generalStats = signal<MatchStatistics | null>(null);
  private readonly playerStatistics = signal<PlayerStatistics>({ columns: [], players: [] });
  readonly playerStats = computed<PlayerStatistic[]>(() => this.playerStatistics().players);
  readonly playerColumns = computed<PlayerStatColumn[]>(() => this.playerStatistics().columns);
  readonly isConfirmingSecondHalf = signal<boolean>(false);
  readonly isStartingSecondHalf = signal<boolean>(false);

  readonly playerFilter = signal<'all' | 'starters' | 'subs' | 'active'>('all');

  readonly startersCount = computed(() => this.playerStats().filter(p => p.isStarter).length);
  readonly subsCount = computed(() => this.playerStats().filter(p => !p.isStarter).length);
  readonly activeCount = computed(() => this.playerStats().filter(p => p.hasActivity).length);

  readonly filteredPlayerStats = computed(() => {
    const stats = this.playerStats();
    switch (this.playerFilter()) {
      case 'starters':
        return stats.filter(p => p.isStarter);
      case 'subs':
        return stats.filter(p => !p.isStarter);
      case 'active':
        return stats.filter(p => p.hasActivity);
      default:
        return stats;
    }
  });

  readonly opponentPossessionPercentage = computed(() => {
    const own = this.generalStats()?.ownPossessionPercentage ?? 0;
    // Redondeo a un decimal: evita restos de coma flotante (ej. 16.200000000000003)
    return Math.round(Math.max(0, 100 - own) * 10) / 10;
  });

  /** Desglose del marcador: los tipos que suman. */
  readonly scoringLines = computed(() => scoringLines(this.generalStats()?.groups ?? []));

  /** Un bloque por `groupName` con los tipos que no suman (los que suman ya están en el marcador). */
  readonly groupCards = computed(() => {
    const groups = (this.generalStats()?.groups ?? [])
      .map(group => ({ ...group, types: group.types.filter(type => !type.isScoring) }))
      .filter(group => group.types.length > 0);
    return presentGroups(groups, { includePoints: false });
  });

  readonly formatMetric = formatMetric;
  readonly formatPlayerValue = formatPlayerValue;
  readonly hasPlayerValue = hasPlayerValue;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('matchId') || '';
    this.matchId.set(id);

    const handleOnline = () => this.isOffline.set(false);
    const handleOffline = () => this.isOffline.set(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });

    await this.loadSummaryData();
    this.liveCaptureService.syncPendingEvents(id).subscribe();
  }

  async loadSummaryData(): Promise<void> {
    this.isLoading.set(true);
    const id = this.matchId();

    try {
      // 1. Resolver información del partido (Rival / Local)
      await this.resolveMatchInfo(id);

      // Mantener IndexedDB actualizado antes de calcular estadísticas locales.
      await firstValueFrom(this.liveCaptureService.hydrateMatchEvents(id)).catch(() => []);

      // 2. Calcular estadísticas generales del 1° Tiempo
      const general = await this.statisticCalculationService.calculateMatchStatistics(id, 'intermediate', 1);
      this.generalStats.set(general);

      // 3. Resolver plantel y calcular estadísticas individuales de jugadores
      const roster = await this.resolveRoster(id);
      this.playerStatistics.set(
        await this.statisticCalculationService.calculatePlayerStatistics(id, roster, 'intermediate', 1),
      );
    } catch (err) {
      console.error('Error al calcular el resumen de entretiempo:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async resolveMatchInfo(matchId: string): Promise<void> {
    try {
      const match = await firstValueFrom(this.matchService.getMatchById(matchId));
      if (match?.opponent) {
        this.opponent.set(match.opponent.alias);
        return;
      }
    } catch {
      // Fallback a almacenamiento local mediante servicio de caché
    }

    const localMatch = await this.cacheService.getMatch(matchId);
    if (localMatch?.opponent) {
      this.opponent.set(localMatch.opponent.alias);
    }
  }

  private async resolveRoster(matchId: string): Promise<RosterPlayerInfo[]> {
    const rosterPlayers = await firstValueFrom(this.rosterService.getRosterOrDivisionPlayers(matchId));
    return rosterPlayers
      .map(player => ({
        playerId: player.id,
        jerseyNumber: player.number,
        playerName: player.fullName,
        position: player.position ?? undefined,
        isStarter: player.role === 'TITULAR',
      }))
      .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  }

  setPlayerFilter(filter: 'all' | 'starters' | 'subs' | 'active'): void {
    this.playerFilter.set(filter);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  switchTab(tab: 'general' | 'players'): void {
    this.activeTab.set(tab);
  }

  goBackToLiveCapture(): void {
    this.router.navigate(['/live-capture', this.matchId()]);
  }


  openSecondHalfConfirmation(): void {
    this.isConfirmingSecondHalf.set(true);
  }

  closeSecondHalfConfirmation(): void {
    if (!this.isStartingSecondHalf()) {
      this.isConfirmingSecondHalf.set(false);
    }
  }

  async confirmStartSecondHalf(): Promise<void> {
    this.isStartingSecondHalf.set(true);
    const id = this.matchId();

    try {
      // 1. Actualizar estado local para el 2° Tiempo (Minuto 40:00 acumulado)
      const { state: currentState } = await this.cacheService.getStatusData(id);
      const secondHalfState = this.buildSecondHalfState(id, currentState);
      await this.cacheService.saveState(secondHalfState);

      // 2. Notificar al backend
      await firstValueFrom(this.matchService.startSecondHalf(id)).catch(err => {
        console.warn('Backend offline o no disponible al iniciar 2° Tiempo:', err);
      });

      // 3. Redirigir a la pantalla de captura en vivo
      this.router.navigate(['/live-capture', id]);
    } catch (err) {
      console.error('Error al iniciar el 2° Tiempo:', err);
      this.isStartingSecondHalf.set(false);
      this.isConfirmingSecondHalf.set(false);
    }
  }

  private buildSecondHalfState(
    matchId: string,
    currentState?: LiveCapturePersistedState
  ): LiveCapturePersistedState {
    return {
      matchId,
      gameClock: '40:00',
      period: 2,
      periodLabel: '2T',
      synchronized: true,
      isStarted: true,
      clockPaused: false,
      isHalftime: false,
      pendingSelection: null,
      clockElapsedSeconds: Math.max(HALF_DURATION_SECONDS, currentState?.clockElapsedSeconds ?? HALF_DURATION_SECONDS),
      savedAt: Date.now(),
      currentPossession: currentState?.currentPossession ?? 'OWN',
      scoreboard: {
        home: this.generalStats()?.score.own ?? 0,
        away: this.generalStats()?.score.opponent ?? 0,
      },
    };
  }

  goToMatchSelection() {
    this.router?.navigate(['/match-selection']);
  }
}
