import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EventCategoryGroup,
  EventVariant,
  HistoryItem,
  LiveCapturePersistedState,
  Possession,
} from '../types/live-capture.types';
import { FollowUpChoice, LiveCaptureEventType, PossessionAfter, TemplateField } from '../types/event-type.types';
import { LocalMatchEvent } from '../types/event.types';
import { MatchRosterPlayer } from '../types/roster.types';
import {
  Team, countsAsScoring, followUpChoices, liveFields, opposite, possessionRule, resolveActor, scoringTeam,
} from '../statistics/calculators/event-rules';
import { LiveCaptureService } from '../services/live-capture.service';
import { MatchService } from '../services/match.service';
import { StatisticCalculationService } from '../statistics/services/statistic-calculation.service';
import { MatchStatistics } from '../statistics/types/statistic.types';
import { CurrentStatsModalComponent } from './components/current-stats-modal/current-stats-modal.component';
import { buildInitialLineup, currentLineup, Lineup } from './lineup';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
import { ThemeService } from 'src/app/core/services/theme.service';
import { SyncStatusSource } from 'src/app/core/navigation/sync-status.source';
import { readSyncErrorMessage } from 'src/app/core/synchronization/sync-errors';

type CaptureTeam = Team;

/** Un paso del modal: elegir jugador, o completar un campo `live` de la plantilla. */
interface CaptureStep {
  kind: 'team' | 'player' | 'field';
  field?: TemplateField;
}

/**
 * Sesión del modal de captura. Los pasos se arman a partir del Fono:
 * `[jugador si requiresPlayer] + [un paso por cada campo con phase = 'live']`.
 * Cada toque en una opción avanza; el último paso guarda el evento.
 */
interface CaptureSession {
  event: LiveCaptureEventType;
  eventId: string;
  steps: CaptureStep[];
  stepIndex: number;
  team: CaptureTeam;
  /** Con actor CHOOSE o posesión NEUTRAL el analista elige entre Propio y Rival. */
  canChooseTeam: boolean;
  /** Indica si el analista ya confirmó el equipo del evento. */
  teamSelected: boolean;
  /** Posesión vigente al abrir el modal. */
  possession: Possession;
  playerNumber: number | null;
  values: Record<string, unknown>;
}

/** Botonera para elegir el evento siguiente (p. ej. cómo se juega un penal). */
interface FollowUpChooser {
  title: string;
  originTeam: CaptureTeam | null;
  mandatory: boolean;
  choices: {
    type: LiveCaptureEventType;
    label: string;
    preset?: Record<string, unknown>;
    team?: FollowUpChoice['team'];
  }[];
}

/** Botón de jugador en la cuadrícula del modal. */
interface SlotView {
  number: number;
  name: string;
  fieldSlot: number;
}

/**
 * La vista breve de un evento que se muestra en el historial de la pantalla.
 */
type SelectablePossession = 'OWN' | 'OPPONENT';
const POSSESSIONS: readonly SelectablePossession[] = ['OWN', 'OPPONENT'] as const;
/**
 * Pantalla de captura en vivo del partido.
 *
 * Permite al usuario registrar eventos (tries, penales, cambios de
 * posesión, etc.) a medida que ocurren durante el partido, asociando un
 * número de jugador a los eventos que lo requieran, y deshaciendo el
 * último evento o uno específico del historial.
 *
 * ### Flujo de captura (modal por pasos)
 * 1. {@link onEventTap} abre una {@link CaptureSession} con los pasos del evento
 *    (jugador y/o campos `live` de su plantilla). Si no tiene pasos, lo guarda directo.
 * 2. Cada toque en una opción avanza al paso siguiente; el último guarda con
 *    {@link commitWithFollowUp}. Si el tipo define un evento de seguimiento
 *    (p. ej. Try → Conversión), se abre otra sesión justo después.
 */
@Component({
  selector: 'ot-live-capture',
  standalone: true,
  imports: [CommonModule, CurrentStatsModalComponent, FormsModule],
  templateUrl: './carga-en-vivo.component.html',
  styleUrl: './carga-en-vivo.component.css'
})
export class CargaEnVivoComponent implements OnInit, OnDestroy {

  private readonly liveCaptureService = inject(LiveCaptureService);
  private readonly matchService = inject(MatchService);
  private readonly statisticCalculationService = inject(StatisticCalculationService);
  private readonly toastService = inject(ToastService);
  private readonly themeService = inject(ThemeService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });

  /** Estado real de sincronización (pendientes en Dexie + conexión), el mismo que muestra la barra de navegación. */
  readonly syncStatus = inject(SyncStatusSource).status;
  /** Tema global de la app: lo comparten el navbar, el menú de usuario y esta pantalla. */
  readonly theme = this.themeService.theme;
  readonly syncLabel = computed(() => {
    const { state, pendingCount } = this.syncStatus();
    switch (state) {
      case 'synced':
        return 'Sincronizado';
      case 'offline':
        return 'Sin conexión, guardando local';
      case 'syncing':
        return 'Sincronizando…';
      case 'pending':
        return `${pendingCount} sin sincronizar`;
    }
  });
  private matchId = '';

  /** Estados de posesión, en el orden en que se renderizan en la barra de posesión. */
  readonly possessions = POSSESSIONS;

  /** Jugadores indexados por su número permanente del partido. */
  private initialLineup: Lineup = { onField: new Map(), bench: new Map() };
  private onField = new Map<number, MatchRosterPlayer>();
  private bench = new Map<number, MatchRosterPlayer>();

  /** Los 15 titulares en cancha, agrupados para la cuadrícula del modal. */
  forwardSlots: SlotView[] = [];
  backSlots: SlotView[] = [];
  substituteSlots: SlotView[] = [];
  /** El rival solo se registra por número (1 a 23). */
  readonly rivalNumbers: number[] = Array.from({ length: 23 }, (_, index) => index + 1);

  readonly periods = ['inicio', '1er tiempo', '2do tiempo'];

  homeTeam = '';
  awayTeam = '';
  scoreboard = { home: 0, away: 0 };
  gameClock = '--:--';
  period = 1;
  periodLabel = '';
  isStarted = false;
  isStartingMatch = false;
  synchronized = false;
  clockPaused = false;
  historyVisible = false;

  isHalftime = false;
  showConfirmHalftime = false;
  showConfirmFinish = false;
  isFinished = false;
  showCurrentStatisticsModal = false;
  isCalculatingStats = false;
  isOfflineMode = false;
  currentStats: MatchStatistics | null = null;

  /** Sesión del modal de captura; `null` si no hay modal abierto. */
  capture: CaptureSession | null = null;
  /** Botonera de eventos siguientes; `null` si no hay ninguna abierta. */
  followUpChooser: FollowUpChooser | null = null;

  private clockElapsedSeconds = 0;
  private clockStartedAt: number | null = null;
  private matchStartedAt: number | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private pausedEventConfirmationId: string | null = null;


  currentPossession: Possession = 'OWN';
  /** Catálogo completo (incluye tipos ocultos de la botonera). Se usa para lookups. */
  eventTypes: LiveCaptureEventType[] = [];
  /** Solo lo que se dibuja en la botonera (showInPalette). */
  categories: EventCategoryGroup[] = [];
  history: HistoryItem[] = [];
  isLoading = true;
  private events: LocalMatchEvent[] = [];
  private readonly eventVariantRotation: EventVariant[] = ['success', 'danger', 'warning', 'primary'];
  private readonly eventVariants = new Map<string, EventVariant>();
  private readonly missingFieldSlotWarnings = new Set<string>();
  private nextEventVariantIndex = 0;

  /** Inicializa la pantalla, carga el partido y restaura su estado guardado. */
  ngOnInit(): void {
    const matchId = this.route?.snapshot.paramMap.get('matchId');
    if (!matchId) {
      this.showError('No se indicó un partido válido.');
      this.isLoading = false;
      return;
    }
    const query = { matchId };
    this.matchId = matchId;

    this.liveCaptureService.getLiveCaptureBootstrap(query).subscribe({
      next: response => {
        const state = response.state;
        this.homeTeam = state.homeTeam;
        this.awayTeam = state.awayTeam;
        this.matchStartedAt = response.match.startedAt
          ? this.parseBackendTimestamp(response.match.startedAt)
          : null;
        this.scoreboard = { ...state.scoreboard };
        this.gameClock = state.gameClock;
        this.period = state.period ?? 1;
        this.isHalftime = state.isHalftime ?? false;
        this.isStarted = response.match.status !== 'not_started';
        this.periodLabel = this.isStarted
          ? (state.periodLabel || (this.isHalftime ? 'Entretiempo' : (this.period === 2 ? '2T' : '1T')))
          : 'Iniciar partido';
        this.synchronized = state.synchronized;
        // Durante el entretiempo el reloj debe estar detenido aunque el estado
        // recibido tenga clockPaused=false por una persistencia anterior.
        this.clockPaused = state.clockPaused || this.isHalftime;
        this.clockElapsedSeconds = this.parseClock(state.gameClock);
        if (!this.clockPaused && state.clockUpdatedAt) {
          const updatedAt = this.parseBackendTimestamp(state.clockUpdatedAt);
          if (Number.isFinite(updatedAt)) {
            const elapsedSinceUpdate = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
            this.clockElapsedSeconds += elapsedSinceUpdate;
            this.gameClock = this.formatClock(this.clockElapsedSeconds);
          }
        }
        this.currentPossession = state.currentPossession;
        this.eventTypes = response.eventTypes;
        this.eventVariants.clear();
        this.nextEventVariantIndex = 0;
        this.categories = this.groupEventTypes(response.eventTypes.filter(e => e.showInPalette !== false));
        this.initialLineup = buildInitialLineup(response.rosterPlayers);
        this.onField = new Map(this.initialLineup.onField);
        this.bench = new Map(this.initialLineup.bench);
        this.buildSlots();
        this.events = response.recentEvents;
        this.rebuildStateFromEvents();
        this.liveCaptureService.syncPendingEvents(this.matchId).subscribe();

        if (!this.restorePersistedState(response.persistedState)) {
          if (!this.clockPaused && !this.isHalftime) {
            this.startClock();
          }
          this.persistState();
        }
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.showError(this.readBackendError(error) ?? 'Ocurrió un error inesperado.');
        this.isLoading = false;
      },
    });
  }

  /** Detiene el temporizador cuando el componente deja de existir. */
  ngOnDestroy(): void {
    this.stopClock();
  }

  /** Etiqueta accesible para el botón de pausa/reanudar del reloj, según el estado actual. */
  get pausaLabel(): string {
    return this.clockPaused ? 'Reanudar reloj' : 'Pausar reloj';
  }

  /** Clase del ícono Tabler para el botón de pausa/reanudar del reloj, según el estado actual. */
  get pausaIcon(): string {
    return this.clockPaused ? 'ti ti-player-play' : 'ti ti-player-pause';
  }

  get periodLabelAction(): string {
    if (!this.isStarted) {
      return 'Empezar partido.';
    }
    return this.period === 1 ? 'Cerrar primer tiempo' : 'Finalizar partido';
  }

  toggleHistory(): void {
    this.historyVisible = !this.historyVisible;
  }

  /** Cambia el tema de toda la app (mismo selector que el menú de usuario). */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Define qué equipo tiene la posesión actualmente.
  * Cambia la posesión manualmente; los eventos guardan la posesión que tenían
  * al momento de registrarse.
   */
  selectPossession(possession: SelectablePossession): void {
    if (!this.isStarted) {
      return;
    }

    this.currentPossession = possession;
    this.synchronized = false;
    this.persistState();
  }

  /** Maneja el toque sobre un chip de evento: abre el modal de captura (o guarda directo). */
  onEventTap(event: LiveCaptureEventType): void {
    if (!this.isStarted || this.capture) {
      return;
    }

    if (this.clockPaused) {
      if (this.pausedEventConfirmationId !== event.id) {
        this.pausedEventConfirmationId = event.id;
        this.toastService.warning('Toca de nuevo para ignorar', 'Tiempo parado', 2000);
        return;
      }
      this.toastService.clear();
      this.pausedEventConfirmationId = null;
    }

    this.openCapture(event, this.createHistoryId(), this.currentPossession, null);
  }

  /** Crea y persiste un evento asociado al partido actual. */
  private commitEvent(
    event: LiveCaptureEventType,
    eventId: string,
    player: MatchRosterPlayer | null,
    customAttributes?: Record<string, unknown>,
    onSuccess?: () => void,
    teamPossessionOverride?: Possession,
  ): void {
    const timestamp = new Date().toISOString();

    let finalAttributes: Record<string, unknown> | null = customAttributes ? { ...customAttributes } : null;
    if (player !== null && finalAttributes?.['playerNumber'] === undefined) {
      finalAttributes = { ...(finalAttributes ?? {}), playerNumber: player.number };
    }

    const localEvent: LocalMatchEvent = {
      id: eventId,
      eventTypeId: event.id,
      matchId: this.matchId,
      playerId: player?.id ?? null,
      teamPossession: teamPossessionOverride ?? this.currentPossession,
      matchTime: this.parseClock(this.gameClock),
      absoluteMatchTime: this.matchStartedAt === null
        ? null
        : Math.max(0, Math.floor((Date.now() - this.matchStartedAt) / 1000)),
      realTime: timestamp,
      period: this.period,
      origin: 'live-capture',
      attributes: finalAttributes,
      createdAt: timestamp,
      synchronizedAt: null,
      active: true,
      backendEventId: null,
      localSequence: this.nextEventSequence(),
    };

    this.liveCaptureService.saveEvent(localEvent).subscribe({
      next: savedEvent => {
        this.events = [...this.events, savedEvent];
        this.rebuildStateFromEvents();
        this.synchronized = savedEvent.synchronizedAt !== null;
        this.persistState();
        onSuccess?.();
        this.liveCaptureService.syncPendingEvents(this.matchId).subscribe();
      },
      error: (error: HttpErrorResponse) => {
        this.showError(this.readBackendError(error) ?? 'Ocurrió un error inesperado.');
      },
    });
  }

  /** Cancela una selección pendiente o elimina el último evento persistido. */
  undoLastEvent(): void {
    if (!this.isStarted) {
      return;
    }

    if (this.capture) {
      this.capture = null;
      return;
    }

    const lastEvent = this.latestEvent();
    if (lastEvent) {
      this.deleteEventAndRebuild(lastEvent);
    }
  }

  /** Elimina un evento específico y revierte sus efectos. */
  undoHistoryEvent(historyId: string): void {
    if (!this.isStarted) {
      return;
    }

    const event = this.events.find(currentEvent => currentEvent.id === historyId);
    if (event) {
      this.deleteEventAndRebuild(event);
    }
  }

  removeHistoryEvent(historyId: string): void {
    this.undoHistoryEvent(historyId);
  }

  /** Descarta un evento rechazado localmente sin volver a enviarlo al servidor. */
  discardRejectedEvent(historyId: string): void {
    const event = this.events.find(currentEvent => currentEvent.id === historyId);
    if (event?.syncFailedAt) {
      this.deleteEventAndRebuild(event);
    }
  }

  /** Pausa o reanuda el reloj del partido sin afectar el historial de deshacer. */
  toggleClock(): void {
    if (!this.isStarted || this.isHalftime) {
      return;
    }

    if (!this.clockPaused) {
      this.updateClock();
      this.stopClock();
      this.clockElapsedSeconds = this.parseClock(this.gameClock);
    }

    this.clockPaused = !this.clockPaused;

    if (!this.clockPaused) {
      this.pausedEventConfirmationId = null;
      this.startClock();
    }

    this.synchronized = false;
    this.persistState();
  }

  /** Decide qué acción ejecutar al pulsar el botón de cambio de periodo. */
  onPeriodButtonClick(): void {
    if (!this.isStarted) {
      this.startMatch();
      return;
    }

    if (this.isFinished) {
      return;
    }

    if (this.period === 1 && !this.isHalftime) {
      this.showConfirmHalftime = true;
    } else if (this.period === 2 && !this.isHalftime) {
      this.showConfirmFinish = true;
    } else if (this.isHalftime) {
      this.router?.navigate(['/live-capture', this.matchId, 'halftime']);
    }
  }

  /** Inicia el partido en backend y habilita la captura de eventos. */
  startMatch(): void {
    if (this.isStartingMatch || this.isStarted) {
      return;
    }

    this.isStartingMatch = true;
    this.matchService.startMatch(this.matchId).subscribe({
      next: response => {
        this.isStarted = true;
        this.matchStartedAt = response.startedAt
          ? this.parseBackendTimestamp(response.startedAt)
          : this.matchStartedAt;
        this.periodLabel = '1T';
        this.clockPaused = false;
        this.isStartingMatch = false;
        this.startClock();
        this.synchronized = true;
        this.persistState();
      },
      error: (error: unknown) => {
        this.isStartingMatch = false;
        this.showError(readSyncErrorMessage(error) ?? 'No se pudo iniciar el partido. Inténtalo nuevamente.');
      },
    });
  }

  /** Oculta el diálogo de confirmación del entretiempo. */
  cancelConfirmHalftime(): void {
    this.showConfirmHalftime = false;
  }

  /** Oculta el diálogo de confirmación de finalización. */
  cancelConfirmFinish(): void {
    this.showConfirmFinish = false;
  }

  /** Detiene el reloj y solicita al backend finalizar el partido previa sincronización de eventos pendientes. */
  async confirmFinishMatch(): Promise<void> {
    this.showConfirmFinish = false;
    this.stopClock();
    this.clockPaused = true;
    this.clockElapsedSeconds = this.parseClock(this.gameClock);
    this.periodLabel = 'Finalizado';
    this.persistState();

    try {
      // 1. Asegurar sincronización de eventos pendientes antes de cerrar el partido
      await firstValueFrom(this.liveCaptureService.syncPendingEvents(this.matchId));

      // 2. Cerrar el partido en backend una vez persistidos todos los eventos
      await firstValueFrom(this.matchService.finishMatch(this.matchId));

      this.isFinished = true;
      this.synchronized = true;
      this.isOfflineMode = false;
      this.router?.navigate(['/post-match/', this.matchId]);
    } catch (error) {
      this.synchronized = false;
      this.toastService.error((error instanceof HttpErrorResponse ? this.readBackendError(error) : null)
        ?? 'Ocurrió un error al finalizar el partido.');
    }
  }

  /** Cierra el primer tiempo, guarda el estado y navega a sus estadísticas. */
  async confirmCloseFirstHalf(): Promise<void> {
    this.showConfirmHalftime = false;
    this.isHalftime = true;
    this.periodLabel = 'Entretiempo';

    // 1. Pausar el reloj inmediatamente
    this.stopClock();
    this.clockPaused = true;
    this.clockElapsedSeconds = this.parseClock(this.gameClock);

    // 2. Persistir localmente
    this.persistState();

    // 3. Sincronizar en segundo plano con el backend
    this.matchService.closeFirstHalf(this.matchId).subscribe({
      next: () => {
        this.synchronized = true;
        this.isOfflineMode = false;
      },
      error: () => {
        // En offline la experiencia continúa sin interrupciones
        this.synchronized = false;
        this.isOfflineMode = true;
      },
    });

    // 4. Redirigir a la pantalla dedicada de estadísticas de entretiempo
    this.router?.navigate(['/live-capture', this.matchId, 'halftime']);
  }

  async openCurrentStatisticsModal(): Promise<void> {
    this.showCurrentStatisticsModal = true;
    this.isCalculatingStats = true;

    try {
      await firstValueFrom(this.liveCaptureService.syncPendingEvents(this.matchId));
      this.events = await firstValueFrom(this.liveCaptureService.getLocalEvents(this.matchId));
      this.currentStats = await this.statisticCalculationService.calculateMatchStatistics(
        this.matchId,
        'basic',
        undefined,
        { events: this.events, eventTypes: this.eventTypes },
      );
    } catch (error) {
      console.error('Error al calcular estadísticas tácticas:', error);
    } finally {
      this.isCalculatingStats = false;
    }
  }

  closeCurrentStatisticsModal(): void {
    this.showCurrentStatisticsModal = false;
  }

  /** Inicia un intervalo que actualiza el reloj periódicamente. */
  private startClock(): void {
    this.stopClock();
    this.clockStartedAt = Date.now();
    this.clockTimer = setInterval(() => this.updateClock(), 250);
  }

  /** Cancela el intervalo del reloj y limpia su instante de inicio. */
  private stopClock(): void {
    if (this.clockTimer !== null) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    this.clockStartedAt = null;
  }

  /** Calcula el tiempo transcurrido y actualiza el texto del reloj. */
  private updateClock(): void {
    if (this.clockPaused || this.clockStartedAt === null) {
      return;
    }

    const elapsedSinceStart = Math.floor((Date.now() - this.clockStartedAt) / 1000);
    const nextClock = this.formatClock(this.clockElapsedSeconds + elapsedSinceStart);

    if (nextClock !== this.gameClock) {
      this.gameClock = nextClock;
      // this.persistState(false);
    }
  }

  /** Construye y guarda una copia del estado actual de la pantalla. */
  private persistState(updateClock = true): void {
    if (updateClock && !this.clockPaused) {
      this.updateClock();
    }

    const state: LiveCapturePersistedState = {
      matchId: this.matchId,
      isStarted: this.isStarted,
      gameClock: this.gameClock,
      periodLabel: this.periodLabel,
      period: this.period,
      isHalftime: this.isHalftime,
      synchronized: this.synchronized,
      clockPaused: this.clockPaused,
      pendingSelection: null,
      clockElapsedSeconds: this.parseClock(this.gameClock),
      savedAt: Date.now(),
      currentPossession: this.currentPossession,
      scoreboard: { ...this.scoreboard },
    };

    this.liveCaptureService.saveLiveCaptureState(state).subscribe({
      error: (error: HttpErrorResponse) => {
        this.showError(this.readBackendError(error) ?? 'Ocurrió un error inesperado.');
      },
    });
  }

  /** Restaura el estado persistido y reanuda el reloj si correspondía. */
  private restorePersistedState(state: LiveCapturePersistedState | undefined): boolean {
    if (!state || state.matchId !== this.matchId || !this.isValidPersistedState(state)) {
      return false;
    }

    this.period = state.period;
    this.periodLabel = this.isStarted ? state.periodLabel : 'Iniciar partido';
    this.isHalftime = state.isHalftime ?? (state.periodLabel === 'Entretiempo');
    this.synchronized = state.synchronized;
    // El entretiempo siempre tiene prioridad sobre un valor antiguo del reloj.
    this.clockPaused = state.clockPaused || this.isHalftime;
    this.clockElapsedSeconds = state.clockElapsedSeconds;
    if (state.currentPossession) {
      this.currentPossession = state.currentPossession;
    }
    if (state.scoreboard) {
      this.scoreboard = { ...state.scoreboard };
    }

    if (!this.isStarted || this.clockPaused) {
      this.clockPaused = true;
      this.gameClock = this.formatClock(this.clockElapsedSeconds);
      this.stopClock();
    } else {
      const elapsedSinceSave = Math.max(0, Math.floor((Date.now() - state.savedAt) / 1000));
      this.clockElapsedSeconds += elapsedSinceSave;
      this.gameClock = this.formatClock(this.clockElapsedSeconds);
      this.startClock();
    }

    return true;
  }

  /** Verifica que los datos recuperados tengan el formato esperado. */
  private isValidPersistedState(state: LiveCapturePersistedState): boolean {
    return Number.isInteger(state.period)
      && state.period > 0
      && Number.isFinite(state.clockElapsedSeconds)
      && Number.isFinite(state.savedAt)
      && typeof state.isStarted === 'boolean'
      && typeof state.gameClock === 'string'
      && typeof state.periodLabel === 'string'
      && typeof state.clockPaused === 'boolean'
      && typeof state.synchronized === 'boolean';
  }

  /** Convierte un reloj con formato mm:ss a una cantidad de segundos. */
  private parseClock(clock: string | undefined): number {
    if (!clock) {
      return 0;
    }

    const [minutes, seconds] = clock.split(':').map(Number);
    return Number.isFinite(minutes) && Number.isFinite(seconds)
      ? Math.max(0, minutes * 60 + seconds)
      : 0;
  }

  /** Convierte una cantidad de segundos al formato mm:ss. */
  private formatClock(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /** Interpreta como UTC los LocalDateTime del backend que no incluyen zona horaria. */
  private parseBackendTimestamp(timestamp: string): number {
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp);
    return Date.parse(hasTimezone ? timestamp : `${timestamp}Z`);
  }

  /** Devuelve el último evento de la lista, si existe. */
  private latestEvent(): LocalMatchEvent | undefined {
    return this.events[this.events.length - 1];
  }

  /** Genera el siguiente número de secuencia para un evento local. */
  private nextEventSequence(): number {
    return this.events.reduce((highest, event) => Math.max(highest, event.localSequence), 0) + 1;
  }

  /** Genera un identificador único para una entrada del historial. */
  private createHistoryId(): string {
    return crypto.randomUUID();
  }

  /** Elimina un evento y vuelve a calcular el estado derivado del partido. */
  private deleteEventAndRebuild(event: LocalMatchEvent): void {
    const deletingLatestEvent = this.latestEvent()?.id === event.id;
    this.liveCaptureService.deleteEvent(event).subscribe({
      next: () => {
        this.events = this.events.filter(currentEvent => currentEvent.id !== event.id);
        this.rebuildStateFromEvents(!deletingLatestEvent);
        this.synchronized = false;
        this.persistState();
        this.liveCaptureService.syncPendingEvents(this.matchId).subscribe();
      },
      error: (error: HttpErrorResponse) => {
        this.showError(this.readBackendError(error) ?? 'Ocurrió un error inesperado.');
      },
    });
  }

  /** Reconstruye marcador, posesión e historial recorriendo los eventos. */
  private rebuildStateFromEvents(preservePossession = false): void {
    this.rebuildRosterFromEvents();
    const scoreboard = { home: 0, away: 0 };
    const history: HistoryItem[] = [];

    for (const event of this.events) {
      const eventType = this.eventTypeById(event.eventTypeId);
      if (!eventType) {
        continue;
      }

      if (event.syncFailedAt) {
        history.unshift({
          id: event.id,
          minute: this.formatEventMinute(event.matchTime),
          description: `${eventType.name} — Rechazado`,
          rejected: true,
          syncErrorMessage: event.syncErrorMessage,
        });
        continue;
      }

      const counts = countsAsScoring(eventType, event.attributes);
      const team = counts ? scoringTeam(event) : null;
      if (team === 'OPPONENT') {
        scoreboard.away += eventType.points ?? 0;
      } else if (team === 'OWN') {
        scoreboard.home += eventType.points ?? 0;
      }

      const playerNumber = this.readPlayerNumber(event);
      history.unshift({
        id: event.id,
        minute: this.formatEventMinute(event.matchTime),
        description: this.buildEventDescription(
          eventType,
          playerNumber,
          event.teamPossession,
          `${scoreboard.home}-${scoreboard.away}`,
          counts,
        ),
      });

    }

    this.scoreboard = scoreboard;
    if (!preservePossession) {
      const derived = this.derivePossession();
      if (derived) {
        this.currentPossession = derived;
      }
    }
    this.history = history.slice(0, 12);
  }

  /** Aplica los cambios cargados sobre la formación inicial (ver `currentLineup`). */
  private rebuildRosterFromEvents(): void {
    const { onField, bench } = currentLineup(
      this.initialLineup,
      this.events,
      eventTypeId => this.eventTypeById(eventTypeId),
    );

    this.onField = onField;
    this.bench = bench;
    this.buildSlots();
  }

  /** Busca un tipo de evento por su identificador. */
  private eventTypeById(eventTypeId: string): LiveCaptureEventType | undefined {
    return this.eventTypes.find(eventType => eventType.id === eventTypeId);
  }

  /** Lee el número de jugador almacenado en los atributos del evento. */
  private readPlayerNumber(event: LocalMatchEvent): number | null {
    const value = event.attributes?.['playerNumber'];
    return typeof value === 'number' ? value : null;
  }

  /** Formatea el instante del evento para mostrarlo en el historial. */
  private formatEventMinute(matchTime: number | null): string {
    return this.formatClock(matchTime ?? 0);
  }

  /**
   * Arma la descripción legible del historial para un evento, incluyendo
   * el número de jugador (si tiene) y, para eventos de anotación, el
   * marcador resultante.
   */
  private buildEventDescription(
    event: LiveCaptureEventType,
    player: number | null,
    possession: Possession = this.currentPossession,
    score = `${this.scoreboard.home}-${this.scoreboard.away}`,
    counts = true,
  ): string {
    const playerTag = player != null ? ` #${player}` : '';

    if (event.isScoring) {
      const name = counts ? event.name : `${event.name} (errado)`;
      return `${name}${playerTag} — ${this.teamForPossession(possession)} ${score}`;
    }

    if (possession === 'NEUTRAL') {
      return `${event.name}${playerTag}`;
    }

    return `${event.name}${playerTag} — ${this.teamForPossession(possession)}`;
  }

  private teamForPossession(possession: Possession): string {
    switch (possession) {
      case 'OPPONENT':
        return this.awayTeam;
      case 'NEUTRAL':
        return 'Neutro';
      case 'OWN':
      default:
        return this.homeTeam;
    }
  }

  /**
   * Posesión resultante del último evento que informa quién tiene la pelota.
   * `teamPossession` guarda el equipo que ejecutó el evento; la regla del tipo
   * (o de la opción elegida) dice si la pelota queda en él, pasa al rival o no cambia.
   */
  private derivePossession(): Possession | null {
    for (let index = this.events.length - 1; index >= 0; index--) {
      const event = this.events[index];
      const type = this.eventTypeById(event.eventTypeId);
      if (!type || event.teamPossession === 'NEUTRAL') {
        continue;
      }

      const actor = event.teamPossession as Team;
      switch (possessionRule(type, event.attributes)) {
        case 'ACTOR':
          return actor;
        case 'OTHER':
          return opposite(actor);
        default:
          if (type.actor === 'ATTACKING') {
            return actor;
          }
          if (type.actor === 'DEFENDING') {
            return opposite(actor);
          }
        // CHOOSE sin cambio (tarjetas, lesión, cambio): no informa quién tiene la pelota.
      }
    }
    return null;
  }

  /**
   * Mapea un tipo de evento a la variante visual (color) que debe usar su
   * chip. Se usa desde el template vía `eventVariant(event)`.
   */
  eventVariant(event: LiveCaptureEventType): EventVariant {
    const assignedVariant = this.eventVariants.get(event.id);
    if (assignedVariant) {
      return assignedVariant;
    }

    const variant = this.eventVariantRotation[
      this.nextEventVariantIndex % this.eventVariantRotation.length
    ];
    this.nextEventVariantIndex += 1;
    this.eventVariants.set(event.id, variant);
    return variant;
  }

  /**
   * Agrupa la lista plana de tipos de evento que llega del backend en
   * {@link EventCategoryGroup}s por `groupName`, descartando los eventos inactivos.
   */
  private groupEventTypes(eventTypes: LiveCaptureEventType[]): EventCategoryGroup[] {
    return eventTypes
      .filter(event => event.isActive !== false)
      .reduce<EventCategoryGroup[]>((categories, event) => {
        const category = categories.find(item => item.name === event.groupName);

        if (category) {
          category.events.push({ ...event });
        } else {
          categories.push({ name: event.groupName, events: [{ ...event }] });
        }

        return categories;
      }, [])
      .sort((firstCategory, secondCategory) =>
        secondCategory.name.localeCompare(firstCategory.name, 'es', {
          sensitivity: 'base',
        }),
      );
  }

  togglePeriod() {
    if (this.period >= this.periods.length) {
      return;
    }

    this.period += 1;
    this.periodLabel = this.periods[this.period - 1];
    this.capture = null;
    this.synchronized = false;

    if (this.period === this.periods.length) {
      this.clockPaused = true;
      this.stopClock();
    }

    this.persistState();
  }

  private showError(message: string): void {
    this.toastService.error(message, 'Error', 0);
  }

  private readBackendError(error: HttpErrorResponse): string | null {
    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    return null;
  }

  // ───────────────────────── Captura de eventos (modal por pasos) ─────────────────────────

  private buildSlots(): void {
    const starters = [...this.onField.entries()]
      .filter(([, player]) => {
        if (player.fieldSlot != null) {
          return true;
        }
        const warningKey = `${this.matchId}:${player.id}`;
        if (!this.missingFieldSlotWarnings.has(warningKey)) {
          this.missingFieldSlotWarnings.add(warningKey);
          this.toastService.warning(
            `No se pudo ubicar al jugador #${player.number} porque no tiene casilla de cancha.`,
            'Alineación incompleta',
          );
        }
        return false;
      })
      .sort(([, left], [, right]) => left.fieldSlot! - right.fieldSlot!);
    const slot = (number: number, player: MatchRosterPlayer): SlotView => ({
      number,
      name: this.shortName(player.fullName),
      fieldSlot: player.fieldSlot!,
    });
    this.forwardSlots = starters
      .filter(([, player]) => player.fieldSlot! <= 8)
      .map(([number, player]) => slot(number, player));
    this.backSlots = starters
      .filter(([, player]) => player.fieldSlot! >= 9)
      .map(([number, player]) => slot(number, player));
    this.substituteSlots = [...this.bench.entries()]
      .sort(([, left], [, right]) => (left.slotOrder ?? 0) - (right.slotOrder ?? 0))
      .map(([number, player]) => slot(number, player));
  }

  /** Apellido para el botón: «Apellido, Nombre» → Apellido; «Nombre Apellido» → Apellido. */
  private shortName(fullName: string | undefined): string {
    if (!fullName) {
      return '';
    }
    const comma = fullName.indexOf(',');
    if (comma > 0) {
      return fullName.slice(0, comma).trim();
    }
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1];
  }

  get captureStep(): CaptureStep | null {
    return this.capture ? this.capture.steps[this.capture.stepIndex] ?? null : null;
  }

  get captureField(): TemplateField | null {
    return this.captureStep?.kind === 'field' ? this.captureStep.field ?? null : null;
  }

  /**
   * Abre el modal con los pasos del evento, o lo guarda directo si no tiene ninguno.
   * El equipo sale del `actor` del tipo y la posesión; `preset` pre-llena campos en
   * vivo y salta esos pasos.
   */
  private openCapture(
    event: LiveCaptureEventType,
    eventId: string,
    possession: Possession,
    lockedTeam: CaptureTeam | null,
    preset: Record<string, unknown> = {},
  ): void {
    const resolved = lockedTeam ?? resolveActor(event, possession);
    const steps: CaptureStep[] = [];
    if (resolved === null && !event.requiresPlayer) {
      steps.push({ kind: 'team' });
    }
    if (event.requiresPlayer && resolved !== 'OPPONENT') {
      steps.push({ kind: 'player' });
    }
    liveFields(event)
      .filter(field => !(field.key in preset))
      .filter(field => resolved !== 'OPPONENT' || !this.isPlayerField(field))
      .forEach(field => steps.push({ kind: 'field', field }));

    const team: CaptureTeam = resolved ?? 'OWN';
    if (steps.length === 0) {
      this.commitWithFollowUp(event, eventId, null, null, { ...preset }, possession, team);
      return;
    }

    this.capture = {
      event,
      eventId,
      steps,
      stepIndex: 0,
      team,
      canChooseTeam: resolved === null,
      teamSelected: resolved !== null,
      possession,
      playerNumber: null,
      values: { ...preset },
    };
  }

  /** Paso «equipo» (eventos sin jugador con posesión neutral). */
  pickTeam(team: CaptureTeam): void {
    if (!this.capture) {
      return;
    }
    this.capture.team = team;
    this.advanceCapture();
  }

  /** En un cambio propio los números se eligen de la formación actual; el del rival va por número. */
  isSubstitutionField(field: TemplateField): boolean {
    return this.capture?.event.code === 'SUBSTITUTION'
      && this.capture.team === 'OWN'
      && (field.key === 'playerOutNumber' || field.key === 'playerInNumber');
  }

  private isPlayerField(field: TemplateField): boolean {
    return field.key === 'playerOutNumber'
      || field.key === 'playerInNumber'
      || field.key === 'playerNumber';
  }

  substitutionPlayers(field: TemplateField): SlotView[] {
    return field.key === 'playerOutNumber'
      ? [...this.forwardSlots, ...this.backSlots]
      : this.substituteSlots;
  }

  chooseSubstitutionPlayer(field: TemplateField, number: number): void {
    this.chooseOption(field, number);
  }

  chooseTeam(team: CaptureTeam): void {
    if (!this.capture?.canChooseTeam) {
      return;
    }
    this.capture.team = team;
    this.capture.teamSelected = true;
    this.capture.playerNumber = null;

    const playerStepIndex = this.capture.steps.findIndex(step => step.kind === 'player');
    if (team === 'OPPONENT' && playerStepIndex >= 0) {
      this.capture.steps.splice(playerStepIndex, 1);
      if (this.capture.stepIndex > playerStepIndex) {
        this.capture.stepIndex -= 1;
      }
      if (this.capture.steps.length === 0 || this.capture.stepIndex >= this.capture.steps.length) {
        this.advanceCapture();
      }
    } else if (team === 'OWN' && playerStepIndex < 0) {
      this.capture.steps.unshift({ kind: 'player' });
    }
  }

  captureHeaderPossession(capture: CaptureSession): Possession {
    if (!capture.teamSelected) {
      return 'NEUTRAL';
    }

    return capture.team;
  }

  /** `null` = «Sin jugador». */
  pickPlayer(number: number | null): void {
    if (!this.capture) {
      return;
    }
    this.capture.playerNumber = number;
    this.advanceCapture();
  }

  chooseOption(field: TemplateField, value: unknown): void {
    if (!this.capture) {
      return;
    }
    this.capture.values[field.key] = value;
    this.advanceCapture();
  }

  optionPossessionEffect(
    possession: PossessionAfter | null | undefined,
  ): 'favorable' | 'unfavorable' | null {
    if (!this.capture || possession == null || this.currentPossession === 'NEUTRAL') {
      return null;
    }

    const resultingPossession = possession === 'KEEP'
      ? this.currentPossession
      : possession === 'ACTOR'
        ? this.capture.team
        : opposite(this.capture.team);

    return resultingPossession === this.currentPossession ? 'favorable' : 'unfavorable';
  }

  sliderValue(field: TemplateField): number {
    const current = this.capture?.values[field.key];
    if (typeof current === 'number') {
      return current;
    }
    return typeof field.default === 'number' ? field.default : field.min ?? 0;
  }

  onSlider(field: TemplateField, raw: string): void {
    if (this.capture) {
      this.capture.values[field.key] = Math.round(Number(raw));
    }
  }

  confirmSlider(field: TemplateField): void {
    if (!this.capture) {
      return;
    }
    this.capture.values[field.key] = this.sliderValue(field);
    this.advanceCapture();
  }

  skipField(field: TemplateField): void {
    if (!this.capture) {
      return;
    }
    delete this.capture.values[field.key];
    this.advanceCapture();
  }

  captureBack(): void {
    if (this.capture && this.capture.stepIndex > 0) {
      this.capture.stepIndex -= 1;
    }
  }

  /** Cierra el modal sin guardar: descarta el evento, o solo omite el seguimiento si lo era. */
  cancelCapture(): void {
    this.capture = null;
  }

  private advanceCapture(): void {
    const session = this.capture;
    if (!session) {
      return;
    }

    if (session.stepIndex < session.steps.length - 1) {
      session.stepIndex += 1;
      return;
    }

    this.capture = null;
    const player = session.team === 'OWN' && session.playerNumber != null
      ? this.onField.get(session.playerNumber) ?? null
      : null;
    this.commitWithFollowUp(
      session.event,
      session.eventId,
      player,
      session.playerNumber,
      session.values,
      session.possession,
      session.team,
    );
  }

  /**
   * Guarda el evento (asignado al equipo que lo ejecutó) y abre lo que siga: el evento de
   * seguimiento único (Try → Conversión) o la botonera de eventos siguientes (penal, etc.).
   */
  private commitWithFollowUp(
    event: LiveCaptureEventType,
    eventId: string,
    player: MatchRosterPlayer | null,
    playerNumber: number | null,
    values: Record<string, unknown>,
    possession: Possession,
    team: CaptureTeam,
  ): void {
    const attributes: Record<string, unknown> = {
      ...values,
      ...(team === 'OWN' && playerNumber != null ? { playerNumber } : {}),
    };
    if (event.code === 'SUBSTITUTION' && team === 'OWN') {
      const outgoing = this.onField.get(Number(values['playerOutNumber']));
      const incoming = this.bench.get(Number(values['playerInNumber']));
      if (!outgoing || !incoming || outgoing.id === incoming.id) {
        this.toastService.error('Selecciona un jugador saliente y uno entrante válidos.');
        return;
      }
      attributes['playerOutId'] = outgoing.id;
      attributes['playerInId'] = incoming.id;
      attributes['playerOutNumber'] = outgoing.number;
      attributes['playerInNumber'] = incoming.number;
    }
    const followUp = event.followUpEventTypeId
      ? this.eventTypeById(event.followUpEventTypeId)
      : undefined;
    const choices = followUp ? [] : followUpChoices(event, attributes);

    let onSuccess: (() => void) | undefined;
    if (followUp) {
      onSuccess = () => this.openCapture(followUp, this.createHistoryId(), possession, team);
    } else if (choices.length > 0) {
      onSuccess = () => this.openChooser(event, choices, team);
    }

    this.commitEvent(
      event,
      eventId,
      player,
      Object.keys(attributes).length > 0 ? attributes : undefined,
      onSuccess,
      team,
    );
  }

  // ───────────────────────── Evento siguiente a elección ─────────────────────────

  private openChooser(event: LiveCaptureEventType, choices: FollowUpChoice[], originTeam: CaptureTeam | null): void {
    const resolved = choices.flatMap(choice => {
      const type = this.eventTypes.find(candidate => candidate.code === choice.code);
      return type
        ? [{ type, label: choice.label ?? type.name, preset: choice.preset, team: choice.team }]
        : [];
    });

    if (resolved.length === 1) {
      this.launchFollowUp(resolved[0], originTeam);
      return;
    }

    if (resolved.length > 1) {
      this.followUpChooser = {
        title: event.name,
        originTeam,
        mandatory: event.code === 'PENALTY_CONCEDED',
        choices: resolved,
      };
    }
  }

  private launchFollowUp(
    choice: FollowUpChooser['choices'][number],
    originTeam: CaptureTeam | null,
  ): void {
    const lockedTeam = originTeam === null || choice.team === undefined
      ? null
      : choice.team === 'SAME'
        ? originTeam
        : opposite(originTeam);
    this.openCapture(
      choice.type,
      this.createHistoryId(),
      this.currentPossession,
      lockedTeam,
      choice.preset ?? {},
    );
  }

  pickFollowUp(choice: FollowUpChooser['choices'][number]): void {
    const originTeam = this.followUpChooser?.originTeam ?? null;
    this.followUpChooser = null;
    this.launchFollowUp(choice, originTeam);
  }

  closeChooser(): void {
    if (this.followUpChooser?.mandatory) {
      return;
    }
    this.followUpChooser = null;
  }

  goToMatchSelection() {
    this.router?.navigate(['/match-selection']);
  }
}