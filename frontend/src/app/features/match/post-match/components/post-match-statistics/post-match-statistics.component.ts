import { CommonModule } from '@angular/common';
import { Component, Directive, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LayoutService } from 'src/app/core/services/layout.service';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { EventTypeService } from '../../../services/event-type.service';
import { EventService } from '../../../services/event.service';
import { RosterService } from '../../../services/roster.service';
import { LiveCaptureService } from '../../../services/live-capture.service';
import { StatisticCalculationService } from '../../../statistics/services/statistic-calculation.service';
import { StatisticApiService } from '../../../statistics/services/statistic-api.service';
import { BackendEventResponse } from '../../../types/event.types';
import { LiveCaptureEventType } from '../../../types/event-type.types';
import { AdvancedMatchStatistics, MatchStatistics, PlayerStatistic, PlayerStatistics } from '../../../statistics/types/statistic.types';
import { AdvancedSection, presentAdvancedStatistics } from '../../../statistics/presentation/advanced-presentation';
import { RosterPlayerInfo } from '../../../statistics/calculators';
import {
  ChartCard,
  advancedCard,
  indicatorCard,
  measurementCard,
  opponentPossessionOf,
  playerActionCharts,
  scoreCard,
} from '../../../statistics/presentation/chart-presentation';
import {
  advancedBars,
  indicatorBars,
  measurementBars,
  playerActionBars,
  scoreBars,
} from '../../../statistics/presentation/bar-presentation';
import {
  formatMetric,
  formatPlayerValue,
  GroupStatPresentation,
  presentGroups,
  scoringLines,
  StatLine,
} from '../../../statistics/presentation/stat-presentation';
import { shortTeamName } from '../../utils/zone-grid';
import { PostMatchShellStore } from '../../store/post-match-shell.store';
import { LoadingGate } from '../../../../../shared/utils/loading-gate';
import { RugbyBallLoaderComponent } from '../../../../../shared/components/rugby-ball-loader/rugby-ball-loader.component';
import { oneOf, persistedSignal } from '../../../../../shared/utils/persisted-signal';
import { DonutChart } from '../../../../../shared/utils/donut';
import { BarChart } from '../../../../../shared/utils/bars';
import { DonutGridComponent } from '../../../../../shared/components/donut-grid/donut-grid.component';
import { BarGridComponent } from '../../../../../shared/components/bar-grid/bar-grid.component';
import { ViewModeToggleComponent } from '../../../../../shared/components/view-mode-toggle/view-mode-toggle.component';
import { statsViewModeSignal } from '../../../../../shared/components/view-mode-toggle/view-mode';

export type StatsPeriodFilter = 'ALL' | 1 | 2;
export type StatsTab = 'team' | 'players';
/** Qué tarjetas muestra la pestaña Equipo: todo, solo el análisis (indicadores y segundo nivel) o solo las mediciones. */
export type StatsContent = 'all' | 'analysis' | 'measurements';

/** Tarjeta de la grilla de detalle, en el orden en que se muestran; `key` es la identidad para el `track`. */
export type DetailCardRef =
  | { kind: 'indicators'; key: string }
  | { kind: 'unavailable'; key: string }
  | { kind: 'advanced'; key: string; section: AdvancedSection }
  | { kind: 'measurement'; key: string; section: GroupStatPresentation };

/** Solo tipa el contexto del `<ng-template #detailCard>`: un ng-template no infiere el tipo de `let-card`. */
@Directive({ selector: 'ng-template[detailCard]', standalone: true })
export class DetailCardTemplateDirective {
  static ngTemplateContextGuard(_directive: DetailCardTemplateDirective, _context: unknown): _context is { $implicit: DetailCardRef } {
    return true;
  }
}

interface StatTile { label: string; value: string; empty: boolean; }
interface StatGroup { title: string; icon: string; tiles: StatTile[]; }
interface RosterGroup { label: string; players: PlayerStatistic[]; }

@Component({
  selector: 'app-post-match-statistics',
  standalone: true,
  imports: [CommonModule, DetailCardTemplateDirective, RugbyBallLoaderComponent, DonutGridComponent, BarGridComponent, ViewModeToggleComponent],
  templateUrl: './post-match-statistics.component.html',
  styleUrl: './post-match-statistics.component.css',
})
export class PostMatchStatisticsComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);
  private readonly shell = inject(PostMatchShellStore);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly rosterService = inject(RosterService);
  private readonly eventService = inject(EventService);
  private readonly liveCaptureService = inject(LiveCaptureService);
  private readonly statisticService = inject(StatisticCalculationService);
  private readonly statisticApi = inject(StatisticApiService);
  private readonly userContext = inject(UserContextService);

  readonly matchId = signal<string>('');
  /** La pelota aparece solo si la carga tarda (ver LoadingGate). */
  readonly loading = new LoadingGate();
  readonly errorMessage = signal<string>('');
  readonly opponent = computed(() => this.shell.match()?.opponent?.name || 'Rival');
  readonly ownClubName = computed(() => this.userContext.currentClub()?.name || 'Mi Club');

  readonly activeTab = signal<StatsTab>('team');
  /** Se recuerda por partido en la pestaña: la clave se asigna al conocer el partido (ngOnInit). */
  readonly period = persistedSignal<StatsPeriodFilter>(null, 'ALL', { isValid: oneOf<StatsPeriodFilter>(['ALL', 1, 2]) });
  readonly selectedPlayerId = signal<string | null>(null);
  /** Preferencia de vista: la misma en todos los partidos. */
  readonly content = persistedSignal<StatsContent>('post-match.statistics.content', 'all', {
    isValid: oneOf<StatsContent>(['all', 'analysis', 'measurements']),
  });
  /** Lista (filas), donas o barras: preferencia de la pantalla, la misma en todos los partidos. */
  readonly viewMode = statsViewModeSignal('post-match.statistics.view');
  /** Donas y barras comparten el diseño de tarjetas: alto automático en vez del fijo con scroll de la lista. */
  readonly isGraphic = computed(() => this.viewMode() !== 'list');
  readonly showAnalysis = computed(() => this.content() !== 'measurements');
  readonly showMeasurements = computed(() => this.content() !== 'analysis');

  private readonly events = signal<BackendEventResponse[]>([]);
  private readonly eventTypes = signal<LiveCaptureEventType[]>([]);
  private readonly roster = signal<RosterPlayerInfo[]>([]);
  /**
   * Estadísticas de segundo nivel del backend (posesiones, zona roja, etc.). Se piden una vez al entrar: los eventos
   * se editan en otra pantalla. `null` si no se pudieron obtener; el resto de la página se muestra igual.
   */
  private readonly advanced = signal<AdvancedMatchStatistics | null>(null);
  readonly advancedUnavailable = signal(false);

  /** Eventos de tipos activos: los de tipos dados de baja no se muestran ni cuentan. */
  private readonly visibleEvents = computed(() => {
    const typeIds = new Set(this.eventTypes().map(type => type.id));
    return typeIds.size === 0 ? this.events() : this.events().filter(event => typeIds.has(event.eventTypeId));
  });

  readonly hasEvents = computed(() => this.visibleEvents().length > 0);

  /** Período elegido para el cálculo; `undefined` es el partido completo. */
  private readonly selectedPeriod = computed<number | undefined>(() => {
    const period = this.period();
    return period === 'ALL' ? undefined : period;
  });

  /** Vista `full`: todos los tipos del catálogo y todos sus campos (live y post). */
  readonly stats = computed<MatchStatistics | null>(() => {
    const types = this.eventTypes();
    if (types.length === 0) return null;
    return this.statisticService.computeMatchStatistics(this.visibleEvents(), types, 'full', this.selectedPeriod());
  });

  /** Bloques de segundo nivel del período elegido (el backend informa 1T, 2T y el partido completo). */
  readonly advancedSections = computed<AdvancedSection[]>(() => {
    const period = this.selectedPeriod() ?? null;
    const stats = this.advanced()?.periods.find(candidate => candidate.period === period);
    return stats ? presentAdvancedStatistics(stats) : [];
  });

  readonly scoreLines = computed<StatLine[]>(() => scoringLines(this.stats()?.groups ?? []));

  /** Un bloque por `groupName` del catálogo, solo con los grupos que tienen eventos. */
  readonly detailSections = computed<GroupStatPresentation[]>(() =>
    presentGroups(this.stats()?.groups ?? [], { includePoints: true })
      .map(group => ({ ...group, types: group.types.filter(type => type.hasData) }))
      .filter(group => group.hasData)
  );

  /** Tarjetas de detalle visibles, en el orden de la pantalla: indicadores, aviso o análisis del juego y mediciones. */
  readonly detailCardList = computed<DetailCardRef[]>(() => {
    const analysis = this.showAnalysis();
    const hasIndicators = (this.stats()?.derived.length ?? 0) > 0;
    const indicators: DetailCardRef[] = analysis && hasIndicators ? [{ kind: 'indicators', key: 'indicators' }] : [];
    const unavailable: DetailCardRef[] = analysis && this.advancedUnavailable() ? [{ kind: 'unavailable', key: 'unavailable' }] : [];
    const advanced = analysis
      ? this.advancedSections().map<DetailCardRef>(section => ({ kind: 'advanced', key: `advanced-${section.id}`, section }))
      : [];
    const measurements = this.showMeasurements()
      ? this.detailSections().map<DetailCardRef>(section => ({ kind: 'measurement', key: `measurement-${section.name}`, section }))
      : [];
    return [...indicators, ...unavailable, ...advanced, ...measurements];
  });

  /** En las donas los equipos van con nombre corto («Puerto Madryn», sin «Rugby Club»): los completos ya están en la tarjeta. */
  private readonly teamNames = computed(() => ({
    own: shortTeamName(this.ownClubName()),
    opponent: shortTeamName(this.opponent()),
  }));

  /** Vista de gráficos: se calculan a partir de lo ya presentado, solo cuando se muestran. */
  readonly scoreCard = computed<ChartCard>(() => {
    const stats = this.stats();
    return stats ? scoreCard(stats, this.teamNames()) : { charts: [], rest: [] };
  });
  readonly indicatorCard = computed<ChartCard>(() => indicatorCard(this.stats()?.derived ?? [], this.teamNames()));
  readonly advancedCards = computed<Record<string, ChartCard>>(() =>
    Object.fromEntries(this.advancedSections().map(section => [section.id, advancedCard(section, this.teamNames())]))
  );
  readonly detailCards = computed<Record<string, ChartCard>>(() =>
    Object.fromEntries(this.detailSections().map(section => [section.name, measurementCard(section, this.teamNames())]))
  );

  /** Vista de barras: mismos datos que las donas, partidos de la misma forma (adaptadores en bar-presentation.ts). */
  readonly scoreBars = computed<BarChart[]>(() => {
    const stats = this.stats();
    return stats ? scoreBars(stats, this.teamNames()) : [];
  });
  readonly indicatorBarCard = computed<ChartCard<BarChart>>(() => indicatorBars(this.stats()?.derived ?? [], this.teamNames()));
  readonly advancedBarCards = computed<Record<string, ChartCard<BarChart>>>(() =>
    Object.fromEntries(this.advancedSections().map(section => [section.id, advancedBars(section, this.teamNames())]))
  );
  readonly detailBarCards = computed<Record<string, ChartCard<BarChart>>>(() =>
    Object.fromEntries(this.detailSections().map(section => [section.name, measurementBars(section, this.teamNames())]))
  );

  private readonly playerStatistics = computed<PlayerStatistics>(() => {
    if (this.eventTypes().length === 0) return { columns: [], players: [] };
    return this.statisticService.computePlayerStatistics(
      this.visibleEvents(), this.roster(), this.eventTypes(), 'full', this.selectedPeriod()
    );
  });

  /** Plantel completo del partido con las estadísticas del período (sin actividad figuran en cero). */
  readonly players = computed<PlayerStatistic[]>(() => this.playerStatistics().players);

  readonly rosterGroups = computed<RosterGroup[]>(() => {
    const all = this.players();
    return [
      { label: 'Titulares', players: all.filter(p => p.isStarter) },
      { label: 'Suplentes', players: all.filter(p => !p.isStarter) },
    ].filter(g => g.players.length > 0);
  });

  /** Se recalcula con el período, por eso la selección se mantiene al cambiar de tiempo. */
  readonly selectedPlayer = computed<PlayerStatistic | null>(() => {
    const id = this.selectedPlayerId();
    return id ? this.players().find(p => p.playerId === id) ?? null : null;
  });

  readonly selectedPlayerPoints = computed<StatGroup | null>(() => {
    const p = this.selectedPlayer();
    return p && {
      title: 'Puntos',
      icon: 'bi-trophy',
      tiles: [{ label: 'Puntos conseguidos', value: p.totalPoints > 0 ? `${p.totalPoints}` : '—', empty: p.totalPoints === 0 }],
    };
  });

  /** Una tarjeta por `groupName` con los tipos que requieren jugador, después de la de puntos. */
  readonly selectedPlayerGroups = computed<StatGroup[]>(() => {
    const p = this.selectedPlayer();
    const points = this.selectedPlayerPoints();
    if (!p || !points) return [];
    const groups: StatGroup[] = [points];
    for (const column of this.playerStatistics().columns) {
      let group = groups.find(candidate => candidate.title === column.groupName);
      if (!group) {
        group = { title: column.groupName, icon: 'bi-bar-chart', tiles: [] };
        groups.push(group);
      }
      const value = p.values[column.eventTypeId];
      group.tiles.push({
        label: column.label,
        value: formatPlayerValue(column, value),
        empty: (value?.count ?? 0) === 0,
      });
    }
    return groups;
  });

  readonly selectedPlayerCharts = computed<DonutChart[]>(() => {
    const p = this.selectedPlayer();
    return p ? playerActionCharts(this.playerStatistics().columns, p) : [];
  });

  readonly selectedPlayerBars = computed<BarChart[]>(() => {
    const p = this.selectedPlayer();
    return p ? playerActionBars(this.playerStatistics().columns, p) : [];
  });

  readonly opponentPossession = computed(() => opponentPossessionOf(this.stats()?.ownPossessionPercentage ?? 50));

  readonly formatMetric = formatMetric;

  readonly periodLabel = computed(() => {
    const p = this.period();
    return p === 'ALL' ? 'Partido completo' : p === 1 ? 'Primer tiempo' : 'Segundo tiempo';
  });

  async ngOnInit(): Promise<void> {
    this.layoutService.setWide(true);
    const id = this.shell.matchId();
    this.matchId.set(id);
    if (!id) {
      this.errorMessage.set('No se indicó el partido.');
      return;
    }
    this.period.useKey(`post-match.${id}.statistics.period`);
    await this.load(id);
  }

  ngOnDestroy(): void {
    this.layoutService.setWide(null);
    this.loading.dispose();
  }

  setPeriod(period: StatsPeriodFilter): void {
    this.period.set(period);
  }

  selectPlayer(playerId: string): void {
    this.selectedPlayerId.set(playerId);
  }

  setContent(content: StatsContent): void {
    this.content.set(content);
  }

  switchTab(tab: StatsTab): void {
    this.activeTab.set(tab);
  }

  goBack(): void {
    this.router.navigate(['/post-match', this.matchId()]);
  }

  private async load(matchId: string): Promise<void> {
    this.loading.start();
    this.errorMessage.set('');

    try {
      const [events] = await Promise.all([
        this.loadEvents(matchId),
        this.loadEventTypes(),
      ]);
      // Después de los eventos: loadEvents primero sincroniza lo capturado en este dispositivo.
      await this.loadAdvanced(matchId);

      this.events.set(events);
      this.roster.set(await this.loadRoster(matchId));
    } catch (err) {
      console.error('Error al cargar las estadísticas del partido:', err);
      this.errorMessage.set('No se pudieron cargar las estadísticas del partido.');
    } finally {
      await this.loading.finish();
    }
  }

  /**
   * Eventos del backend, sin pasar por IndexedDB: las estadísticas del post-partido no funcionan sin conexión.
   * Antes envía lo capturado en este dispositivo, para que el backend tenga el partido completo.
   */
  private async loadEvents(matchId: string): Promise<BackendEventResponse[]> {
    try {
      await firstValueFrom(this.liveCaptureService.syncPendingEvents(matchId));
    } catch { /* no bloqueante: se envían en la próxima sincronización */ }
    return firstValueFrom(this.eventService.getByMatch(matchId));
  }

  private async loadAdvanced(matchId: string): Promise<void> {
    try {
      this.advanced.set(await firstValueFrom(this.statisticApi.getAdvancedStatistics(matchId)));
      this.advancedUnavailable.set(false);
    } catch (err) {
      console.error('Error al cargar las estadísticas avanzadas del partido:', err);
      this.advanced.set(null);
      this.advancedUnavailable.set(true);
    }
  }

  /**
   * Usa solo los tipos activos del catálogo: los eventos de tipos dados de baja no se muestran ni
   * cuentan en las estadísticas del post-partido.
   */
  private async loadEventTypes(): Promise<void> {
    const eventTypes = await firstValueFrom(this.eventTypeService.getAll());
    this.eventTypes.set(eventTypes.filter(eventType => eventType.isActive !== false));
  }

  /**
   * Plantel simplificado: jugadores disponibles del partido (incluye a los que no registraron acciones).
   * Si querés titulares/suplentes exactos, extraé `resolveRoster` del resumen de entretiempo a un servicio compartido.
   */
  private async loadRoster(matchId: string): Promise<RosterPlayerInfo[]> {
    try {
      const players = await firstValueFrom(this.rosterService.getRosterOrDivisionPlayers(matchId));
      return (Array.isArray(players) ? players : [])
        .filter(p => p.number != null)
        .map(p => ({
          playerId: p.id,
          jerseyNumber: p.number,
          playerName: p.fullName,
          position: p.position ?? undefined,
          isStarter: p.role === 'TITULAR',
        }));
    } catch {
      return [];
    }
  }

  barWidth(value: number, other: number): number {
    const total = value + other;
    return total === 0 ? 50 : Math.round((value / total) * 100);
  }
}