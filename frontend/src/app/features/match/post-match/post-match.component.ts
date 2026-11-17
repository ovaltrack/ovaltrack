import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, throwError } from 'rxjs';
import { LayoutService } from 'src/app/core/services/layout.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { HidingFilter, MatchReviewStore } from './store/match-review.store';
import { MatchTimelineEventResponse } from '../types/event.types';
import { PENDING_QUERY_PARAM, pendingOnlyFilters, wantsPendingOnly } from './utils/pending-deep-link';
import { PostMatchDataStore } from './store/post-match-data.store';
import { PostMatchShellStore } from './store/post-match-shell.store';
import { RugbyBallLoaderComponent } from '../../../shared/components/rugby-ball-loader/rugby-ball-loader.component';
import { LoadingGate } from '../../../shared/utils/loading-gate';
import { PostMatchKpiStripComponent } from './components/post-match-kpi-strip/post-match-kpi-strip.component';
import { PostMatchTimelineComponent } from './components/post-match-timeline/post-match-timeline.component';
import { PostMatchTableComponent } from './components/post-match-table/post-match-table.component';
import { PostMatchPanelComponent } from './components/post-match-panel/post-match-panel.component';
import { PostMatchCreateModalComponent } from './components/post-match-create-modal/post-match-create-modal.component';

/** Desde esta cantidad de eventos, dibujar la vista traba el hilo un rato: la pelota se muestra antes de empezar. */
const HEAVY_RENDER_EVENTS = 200;

const HIDING_FILTER_LABELS: Record<HidingFilter, string> = {
  period: 'período',
  team: 'equipo',
  unassigned: 'solo sin jugador',
  search: 'búsqueda',
  lane: 'jugada oculta'
};

@Component({
  selector: 'app-post-match',
  standalone: true,
  imports: [
    CommonModule,
    RugbyBallLoaderComponent,
    PostMatchKpiStripComponent,
    PostMatchTimelineComponent,
    PostMatchTableComponent,
    PostMatchPanelComponent,
    PostMatchCreateModalComponent
  ],
  templateUrl: './post-match.component.html',
  styleUrl: './post-match.component.css'
})
export class PostMatchComponent implements OnInit, OnDestroy {

  private readonly shell = inject(PostMatchShellStore);
  private readonly data = inject(PostMatchDataStore);
  private readonly toastService = inject(ToastService);
  private readonly layoutService = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(MatchReviewStore);

  @ViewChild(PostMatchPanelComponent) panel!: PostMatchPanelComponent;

  matchId = '';
  private eventToRestore: string | null = null;

  readonly errorMessage = signal<string>('');
  /** La pelota aparece solo si la carga tarda (ver LoadingGate). */
  readonly loading = new LoadingGate();
  readonly eventTypesDiccionario = signal<{ [id: string]: string }>({});
  readonly showCreateModal = signal<boolean>(false);

  openCreateModal(): void {
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  /** Si los filtros activos esconden el evento recién creado, avisa por qué y ofrece mostrarlo. */
  onEventCreated(event: MatchTimelineEventResponse): void {
    const hiding = this.store.hiddenByFilters(event.id);
    if (hiding.length === 0) return;

    const reasons = hiding.map(filter => HIDING_FILTER_LABELS[filter]).join(', ');
    this.toastService.info(
      `Se guardó, pero no se ve por los filtros activos (${reasons}).`,
      'Evento agregado',
      8000,
      { label: 'Mostrar evento', handler: () => this.store.revealEvent(event.id) },
      { label: 'Limpiar filtros', handler: () => this.store.clearFilters() }
    );
  }

  onEditRequested(): void {
    if (this.panel) {
      this.panel.openEditModal();
    }
  }

  onDeleteRequested(): void {
    if (this.panel) {
      this.panel.openDeleteModal();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isEditingField = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (this.showCreateModal() || this.panel?.showDeleteModal()) {
      if (event.key === 'Escape') {
        if (this.showCreateModal()) {
          this.closeCreateModal();
        } else if (this.panel?.showDeleteModal()) {
          this.panel.closeDeleteModal();
        }
      }
      return;
    }

    if (event.key === 'Escape') {
      if (this.panel?.sheetState() === 'open') {
        this.panel.closeSheet();
        return;
      }
      if (this.store.selectedEventId()) {
        this.store.selectEvent(null);
        return;
      }
    }

    if (!isEditingField) {
      // 0. Alta de evento (la acción primaria de la vista)
      if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        this.openCreateModal();
        return;
      }

      // 1. Atajos de Triage dedicados (saltar entre pendientes sin importar qué está visible)
      if (event.key === ']' || (event.shiftKey && event.key === 'ArrowRight')) {
        event.preventDefault();
        this.store.selectNextPending();
        return;
      }
      if (event.key === '[' || (event.shiftKey && event.key === 'ArrowLeft')) {
        event.preventDefault();
        this.store.selectPrevPending();
        return;
      }

      // 2. Navegación fluida por Eventos Visibles (siguiente / anterior en orden cronológico)
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.store.selectNextVisible();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.store.selectPrevVisible();
        return;
      }
    }
  }

  ngOnInit(): void {
    this.layoutService.setWide(true);
    this.shell.bindLiveScore(this.store.scoreboard, this.store.scoreDelta);
    this.store.confirmedChange$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.shell.refresh();
      this.data.invalidateAfterEventChange();
    });
    this.matchId = this.shell.matchId();
    if (this.matchId) {
      this.eventToRestore = this.shell.lastSelectedEventId();
      this.store.resetSession();
      this.store.setMatchId(this.matchId);
      this.applyPendingDeepLink();
      this.applyMatchDetails();
      this.loading.start();
      this.loadZones();
      this.loadRoster();
      this.loadEventTypesAndEvents();
    }
  }

  ngOnDestroy(): void {
    this.shell.lastSelectedEventId.set(this.store.selectedEventId());
    this.shell.unbindLiveScore();
    this.layoutService.setWide(null);
    this.store.resetSession();
    this.loading.dispose();
  }

  /** `?pendientes=1`: abre con «Solo sin jugador» y consume el enlace (la URL queda limpia, recargar no lo repite). */
  private applyPendingDeepLink(): void {
    if (this.route.snapshot.queryParamMap.get(PENDING_QUERY_PARAM) === null) return;
    if (wantsPendingOnly(this.route.snapshot.queryParamMap.get(PENDING_QUERY_PARAM))) this.store.filters.set(pendingOnlyFilters());
    this.router.navigate([], { relativeTo: this.route, queryParams: { [PENDING_QUERY_PARAM]: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /**
   * Vuelve a seleccionar el evento que había al irse a Zonas o Estadísticas; la tabla scrollea hasta él. Si ya no existe
   * (se eliminó mientras tanto) no se selecciona nada. Se aplica una sola vez, con la tabla ya dibujada.
   */
  private restoreSelection(): void {
    const id = this.eventToRestore;
    this.eventToRestore = null;
    if (!id) return;
    setTimeout(() => {
      if (this.store.rawEvents().some(event => event.id === id)) this.store.selectEvent(id);
    });
  }

  /**
   * Tramos del partido, solo para mostrar rango y enlace de la zona de cada evento. No bloquea la pantalla: si falla,
   * la zona se sigue viendo (viene en el evento) pero sin el rango del tramo.
   */
  private loadZones(): void {
    this.data.zones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ assignments }) => this.store.setZoneAssignments(assignments),
      error: () => this.store.setZonesFailed()
    });
  }

  loadRoster(): void {
    this.data.roster().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (players) => {
        this.store.setAvailablePlayers(players.map(player => ({
          id: player.id,
          fullName: player.fullName,
          jerseyNumber: player.number,
          position: player.position,
        })));
      },
      error: () => {
      }
    });
  }

  private applyMatchDetails(): void {
    const match = this.shell.match();
    if (!match) return;
    if (match.startedAt) {
      this.store.matchStartTime.set(match.startedAt);
    }
    this.store.setInitialScores(match.homeScore ?? 0, match.awayScore ?? 0);
  }

  /** Tipos y eventos en paralelo (la caché del shell ya envió lo capturado en este dispositivo antes de pedir los eventos). */
  loadEventTypesAndEvents(): void {
    this.loading.start();
    this.errorMessage.set('');

    let typesFailed = false;
    const types$ = this.data.eventTypes().pipe(catchError(error => {
      typesFailed = true;
      return throwError(() => error);
    }));

    forkJoin({ types: types$, events: this.data.events() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ types, events }) => {
          const dict: { [id: string]: string } = {};
          types.forEach(type => {
            dict[type.id] = type.name;
          });
          this.eventTypesDiccionario.set(dict);
          this.store.setEventTypesList(types);
          this.store.setEvents(events);
          void this.revealEvents();
        },
        error: (error: { status?: number; error?: string | { message?: string } }) => {
          this.showLoadError(error, typesFailed);
          void this.loading.finish();
        }
      });
  }

  private showLoadError(error: { status?: number; error?: string | { message?: string } }, typesFailed: boolean): void {
    if (typesFailed) {
      const msg = 'No se pudieron cargar los tipos de evento.';
      this.errorMessage.set(msg);
      this.toastService.error(msg);
      return;
    }
    const body = error?.error;
    if (error?.status === 409 || (typeof body === 'string' && body.includes('cerrado'))) {
      const msg = typeof body === 'string' ? body : (body?.message || 'El partido aún no se encuentra cerrado.');
      this.errorMessage.set(msg);
      this.toastService.warning(msg);
      return;
    }
    const msg = 'No se pudieron cargar los eventos del partido.';
    this.errorMessage.set(msg);
    this.toastService.error(msg);
  }

  /**
   * Con cientos de eventos, dibujar la vista traba el hilo un rato: la pelota se pinta antes de empezar y el navegador
   * la sigue mostrando (girando) hasta que la vista está lista, en lugar de quedar en blanco.
   */
  private async revealEvents(): Promise<void> {
    if (this.store.rawEvents().length >= HEAVY_RENDER_EVENTS) await this.loading.showNow();
    await this.loading.finish();
    this.restoreSelection();
  }

}
