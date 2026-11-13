import { Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LayoutService } from 'src/app/core/services/layout.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { ZoneAssignmentResponse, ZoneCellRef, ZoneCellSummary } from '../../../types/zone.types';
import { IN_GOAL_COLUMNS, isInGoalColumn } from '../../utils/zone-grid';
import { MatchZonesStore } from '../../store/match-zones.store';
import { PostMatchShellStore } from '../../store/post-match-shell.store';
import { watchCompactLayout } from '../../utils/zone-compact';
import { segmentAt, zonePoints } from '../../utils/zone-track-layout';
import { cellEventRows, cellTramoRows } from '../../utils/zone-cell-detail';
import { UnzonedItem, unzonedWithReason } from '../../utils/zone-unzoned';
import { LoadingGate } from '../../../../../shared/utils/loading-gate';
import { ZoneDeepLinkTarget, resolveZoneDeepLink } from '../../utils/zone-deep-link';
import { ZONE_SHORTCUT_HELP, isSaveShortcut, isTypingTarget, shortcutCell } from '../../utils/zone-shortcuts';
import {
  ZoneMapMode, ZonePeriodFilter, countByCell, eventFiltersFor, eventTypeOptions, filterEvents, minutesByCell, validTypeFilter,
  zoneCoveragePercent
} from '../../utils/zone-stats';
import { Possession } from '../../../types/live-capture.types';
import { RugbyFieldComponent } from '../rugby-field/rugby-field.component';
import { ZoneAssignmentPanelComponent } from '../zone-assignment-panel/zone-assignment-panel.component';
import { ZoneCellDetailComponent, ZoneDetailView } from '../zone-cell-detail/zone-cell-detail.component';
import { ZoneKpiStripComponent } from '../zone-kpi-strip/zone-kpi-strip.component';
import { RugbyBallLoaderComponent } from '../../../../../shared/components/rugby-ball-loader/rugby-ball-loader.component';
import { TerritoryGapSelection, ZoneTerritoryGridComponent } from '../zone-territory-grid/zone-territory-grid.component';
import { oneOf, persistedSignal } from '../../../../../shared/utils/persisted-signal';

/** Lateral que se propone al tocar una fila de la grilla: el centro de la cancha. */
const DEFAULT_LATERAL_ROW = 2;

/**
 * Pantalla de zonas: arma el layout, carga los datos y conecta KPI, filtros, grilla de territorio, cancha y formulario.
 * La grilla y la cancha eligen la franja (y la cancha también el lateral); el formulario guarda el tramo.
 */
/** Ancho máximo de la ayuda (el CSS usa el mismo) y margen mínimo contra el borde de la pantalla. */
const HELP_MAX_WIDTH = 560;
const HELP_VIEWPORT_MARGIN = 24;

@Component({
  selector: 'app-post-match-zones',
  standalone: true,
  imports: [RugbyFieldComponent, ZoneAssignmentPanelComponent, ZoneTerritoryGridComponent, ZoneKpiStripComponent, ZoneCellDetailComponent, RugbyBallLoaderComponent],
  templateUrl: './post-match-zones.component.html',
  styleUrls: ['../../styles/filter-pills.css', './post-match-zones.component.css']
})
export class PostMatchZonesComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly layoutService = inject(LayoutService);
  private readonly shell = inject(PostMatchShellStore);
  private readonly userContext = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);
  readonly zonesStore = inject(MatchZonesStore);

  private readonly panel = viewChild(ZoneAssignmentPanelComponent);
  private readonly grid = viewChild(ZoneTerritoryGridComponent);
  private readonly detail = viewChild(ZoneCellDetailComponent, { read: ElementRef });

  readonly matchId = signal<string>('');
  /** La pelota aparece solo si la carga tarda (ver LoadingGate). */
  readonly loading = new LoadingGate();
  readonly errorMessage = signal<string>('');
  readonly opponent = computed(() => this.shell.match()?.opponent?.name || 'Rival');
  readonly ownClubName = computed(() => this.userContext.currentClub()?.name || 'Mi Club');

  /** Zona elegida en la grilla o la cancha: la usa el formulario. */
  readonly selectedCell = signal<ZoneCellRef | null>(null);
  /** Se recuerdan por partido en la pestaña: la clave se asigna al conocer el partido (ngOnInit). */
  readonly periodFilter = persistedSignal<ZonePeriodFilter>(null, 'ALL', { isValid: oneOf<ZonePeriodFilter>(['ALL', 1, 2]) });
  readonly possessionFilter = persistedSignal<Possession | 'ALL'>(null, 'ALL', {
    isValid: oneOf<Possession | 'ALL'>(['ALL', 'OWN', 'OPPONENT']),
  });

  /** Tipo de jugada elegido ('ALL' = todos); un valor recordado que el partido ya no tiene se ignora (ver `typeFilter`). */
  readonly selectedType = persistedSignal<string>(null, 'ALL', { isValid: (value): value is string => typeof value === 'string' });
  /** Qué cuenta la cancha: jugadas por zona o minutos cubiertos por los tramos. */
  readonly mapMode = persistedSignal<ZoneMapMode>(null, 'EVENTS', { isValid: oneOf<ZoneMapMode>(['EVENTS', 'MINUTES']) });

  /** Pantalla angosta: la grilla muestra un tiempo por vez y el formulario es una hoja inferior. */
  readonly compact = watchCompactLayout(this.destroyRef);

  readonly periodOptions: { value: ZonePeriodFilter; label: string; short: string }[] = [
    { value: 'ALL', label: 'Todo el partido', short: 'Todo' }, { value: 1, label: '1T', short: '1T' }, { value: 2, label: '2T', short: '2T' }
  ];

  readonly possessionOptions: { value: Possession | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Todos' }, { value: 'OWN', label: 'Propios' }, { value: 'OPPONENT', label: 'Rival' }
  ];

  readonly minutesFilterNote = 'En «Minutos» no aplica: los tramos no tienen tipo de jugada';

  readonly modeOptions: { value: ZoneMapMode; label: string }[] = [
    { value: 'EVENTS', label: 'Eventos' }, { value: 'MINUTES', label: 'Minutos' }
  ];

  /** Enlace desde Eventos (`?tramo=` / `?minuto=`) ya interpretado, a la espera de que el formulario exista. */
  private readonly pendingDeepLink = signal<ZoneDeepLinkTarget | null>(null);

  readonly helpOpen = signal<boolean>(false);
  /** La ayuda se abre hacia la izquierda cuando, anclada al botón, se saldría por la derecha de la pantalla. */
  readonly helpAlignEnd = signal<boolean>(false);
  readonly shortcutHelp = ZONE_SHORTCUT_HELP;

  /** Tipos de jugada que tiene el partido: las opciones del filtro por tipo. */
  readonly typeOptions = computed(() => eventTypeOptions(this.zonesStore.events()));
  /** Tipo en vigor: el elegido si el partido lo tiene, si no todos. */
  readonly typeFilter = computed(() => validTypeFilter(this.selectedType(), this.typeOptions()));
  /** En Minutos la cancha cuenta tramos, que no tienen tipo: el filtro de tipo no aplica (la posesión sí, en la grilla). */
  readonly typeFilterApplies = computed(() => this.mapMode() === 'EVENTS');

  /** En Minutos la cancha suma tramos, que no tienen posesión: la leyenda lo aclara porque la grilla sí la filtra. */
  readonly legendNote = computed(() => this.mapMode() === 'MINUTES' ? 'Minutos: no se filtra por posesión' : null);

  /**
   * Eventos de la grilla de territorio: siempre siguen la posesión, también en Minutos (sus conteos por franja y sus
   * puntos son jugadas); el tipo de jugada cambia únicamente el mapa de la cancha.
   */
  readonly gridEvents = computed(() =>
    filterEvents(this.zonesStore.events(), { eventTypeId: 'ALL', possession: this.possessionFilter() }));

  /** Eventos del mapa de la cancha: la posesión y además el tipo de jugada elegido; el tiempo lo aplica `countByCell`. */
  readonly mapEvents = computed(() =>
    filterEvents(this.zonesStore.events(), eventFiltersFor(this.mapMode(), this.typeFilter(), this.possessionFilter())));

  /** Puntos (jugadas con zona propia) del tiempo y la posesión elegidos: la grilla los dibuja sobre su franja. */
  readonly points = computed(() => zonePoints(this.gridEvents(), this.zonesStore.zoneRules(), this.periodFilter()));

  // Todo se deriva de los eventos que ya traen su zona (una sola fuente de verdad) y, en Minutos, de los tramos.
  readonly cellCounts = computed<ZoneCellSummary[]>(() => this.mapMode() === 'MINUTES'
    ? minutesByCell(this.zonesStore.assignments(), this.periodFilter()).map(({ row, col, minutes }) => ({ row, col, eventCount: minutes }))
    : countByCell(this.mapEvents(), this.periodFilter()));

  // Indicadores del partido completo: no dependen de los filtros de la pantalla.
  readonly totalEvents = computed(() => this.zonesStore.events().length);
  /** Las jugadas sin zona del partido con su motivo: alimentan el KPI, el enlace del panel y la lista del detalle. */
  readonly unzonedItems = computed(() => unzonedWithReason(this.zonesStore.events(), this.zonesStore.assignments(), this.zonesStore.zoneRules()));
  readonly totalUnzoned = computed(() => this.unzonedItems().length);
  readonly coveragePercent = computed(() => zoneCoveragePercent(this.zonesStore.assignments()));

  /** Celda que se tocó en la cancha: su detalle queda fijo hasta que se toque otra. */
  readonly inspectedCell = signal<ZoneCellRef | null>(null);
  /** Qué muestra el detalle: la celda o la lista de jugadas sin zona. */
  readonly detailView = signal<ZoneDetailView>('cell');
  /** Celda del detalle: la que está bajo el puntero y, si no hay ninguna, la última que se tocó. */
  readonly shownCell = computed(() => this.zonesStore.hoverCell() ?? this.inspectedCell());

  /** Jugadas de la celda mostrada: siguen los mismos filtros que el mapa (tipo, posesión y tiempo). */
  readonly detailEventRows = computed(() => {
    const cell = this.shownCell();
    return cell && this.mapMode() === 'EVENTS'
      ? cellEventRows(this.mapEvents(), cell, this.zonesStore.assignments(), this.zonesStore.zoneRules(), this.periodFilter())
      : [];
  });

  /** Tramos de la celda mostrada, para el modo Minutos. */
  readonly detailTramoRows = computed(() => {
    const cell = this.shownCell();
    return cell && this.mapMode() === 'MINUTES' ? cellTramoRows(this.zonesStore.assignments(), cell, this.periodFilter()) : [];
  });

  /** Celda de la cancha bajo el cursor: la grilla destaca sus tramos y atenúa el resto. */
  readonly highlightedCell = this.zonesStore.hoverCell;

  /** Celda del tramo bajo el cursor en la grilla. */
  readonly linkedCell = computed<ZoneCellRef | null>(() => {
    const id = this.zonesStore.hoverSegmentId();
    const segment = id ? this.zonesStore.assignments().find(a => a.id === id) : undefined;
    return segment ? { row: segment.row, col: segment.col } : null;
  });

  constructor() {
    // El formulario recién existe cuando termina la carga: el enlace se aplica una sola vez, en ese momento
    effect(() => {
      const panel = this.panel();
      const target = this.pendingDeepLink();
      if (!panel || !target) return;
      untracked(() => {
        this.pendingDeepLink.set(null);
        this.applyDeepLink(panel, target);
      });
    });
  }

  ngOnInit(): void {
    this.layoutService.setWide(true);
    this.zonesStore.reset();
    // En pantalla angosta se arranca en el 1T: los bloques tienen ancho tocable. "Todo" sigue disponible.
    if (this.compact()) this.periodFilter.set(1);

    const id = this.shell.matchId();
    this.matchId.set(id);
    if (!id) {
      this.errorMessage.set('No se indicó el partido.');
      return;
    }
    this.possessionFilter.useKey(`post-match.${id}.zones.possession`);
    this.selectedType.useKey(`post-match.${id}.zones.type`);
    this.mapMode.useKey(`post-match.${id}.zones.mode`);
    // En pantalla angosta el período lo maneja la vista (arranca en 1T y sigue al cursor): no se recuerda.
    if (!this.compact()) this.periodFilter.useKey(`post-match.${id}.zones.period`);
    this.load(id);
  }

  ngOnDestroy(): void {
    this.layoutService.setWide(null);
    this.zonesStore.reset();
    this.loading.dispose();
  }

  toggleHelp(event?: Event): void {
    const opening = !this.helpOpen();
    if (opening) this.helpAlignEnd.set(this.helpOverflowsRight(event?.currentTarget));
    this.helpOpen.set(opening);
  }

  private helpOverflowsRight(trigger: EventTarget | null | undefined): boolean {
    if (!(trigger instanceof HTMLElement)) return false;
    const width = Math.min(HELP_MAX_WIDTH, window.innerWidth - HELP_VIEWPORT_MARGIN * 2);
    return trigger.getBoundingClientRect().left + width > window.innerWidth - HELP_VIEWPORT_MARGIN;
  }

  /**
   * Atajos de la página: Ctrl/Cmd + Enter guarda el tramo (también escribiendo un minuto: toma lo que está escrito),
   * Esc deshace una cosa por vez y las letras eligen la celda de la cancha (solo fuera de un campo de escritura).
   * Las flechas y Enter los resuelve la grilla cuando tiene el foco.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.loading.pending() || this.errorMessage()) return;

    if (isSaveShortcut(event)) {
      event.preventDefault();
      this.panel()?.saveFromShortcut(event.target);
      return;
    }

    if (event.key === 'Escape') {
      this.onEscape(event);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;

    const cell = shortcutCell(event.key);
    if (cell) this.onCellSelected(cell);
  }

  /**
   * Esc deshace una sola cosa por vez, en este orden: (a) arrastre o estiramiento en curso, que vuelve a su rango;
   * (b) foco en Desde/Hasta, que sale del campo hacia el tramo o la fila sin borrar lo escrito; (c) tramo seleccionado
   * o formulario precargado, que vuelve a "Nuevo tramo" vacío (igual que Cancelar). Sin confirmación.
   */
  private onEscape(event: KeyboardEvent): void {
    if (this.grid()?.cancelDrag()) {
      event.preventDefault();
      return;
    }

    if (isTypingTarget(event.target)) {
      (event.target as HTMLElement).blur();
      this.grid()?.focusCursor();
      event.preventDefault();
      return;
    }

    const panel = this.panel();
    if (panel?.hasSelection()) {
      panel.cancel();
      event.preventDefault();
    }
  }

  goBack(): void {
    this.router.navigate(['/post-match', this.matchId()]);
  }

  setPossessionFilter(value: Possession | 'ALL'): void {
    this.possessionFilter.set(value);
  }

  setTypeFilter(eventTypeId: string): void {
    this.selectedType.set(eventTypeId);
  }

  setMapMode(mode: ZoneMapMode): void {
    this.mapMode.set(mode);
  }

  /** Muestra al costado de la cancha las jugadas sin zona con su motivo. */
  openUnzoned(): void {
    this.detailView.set('unzoned');
    // En pantallas angostas el detalle queda debajo de la cancha: se lo acerca a la vista
    queueMicrotask(() => this.detail()?.nativeElement.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
  }

  closeUnzoned(): void {
    this.detailView.set('cell');
  }

  /** Tocar una celda de la cancha (también las del in-goal) fija su detalle y saca la lista de jugadas sin zona. */
  onCellInspected(cell: ZoneCellRef): void {
    this.inspectedCell.set(cell);
    this.detailView.set('cell');
  }

  /** Completar el hueco de una jugada sin tramo: precarga el segmento (entre cortes) que contiene su minuto. */
  onUnzonedGap(item: UnzonedItem): void {
    const panel = this.panel();
    const target = item.minute === null ? null : resolveZoneDeepLink({ minuto: String(item.minute) }, this.zonesStore.assignments());
    if (panel && target) this.applyDeepLink(panel, target);
  }

  /** Abrir el tramo que no admite la jugada para corregirlo. */
  onUnzonedTramo(tramo: ZoneAssignmentResponse): void {
    const panel = this.panel();
    if (panel) this.applyDeepLink(panel, { kind: 'segment', segment: tramo });
  }

  /** Llevar a Eventos con la jugada seleccionada. */
  onUnzonedEvent(eventId: string): void {
    this.shell.lastSelectedEventId.set(eventId);
    this.router.navigate(['/post-match', this.matchId()]);
  }

  setPeriodFilter(filter: ZonePeriodFilter): void {
    this.periodFilter.set(filter);
  }

  /** Franjas de la cancha que no se eligen para un tramo: el in-goal solo tiene puntos. */
  readonly lockedCols = IN_GOAL_COLUMNS;

  /** Tocar una zona de la cancha elige franja y lateral a la vez; el in-goal no admite tramos, así que no se elige. */
  onCellSelected(cell: ZoneCellRef): void {
    if (isInGoalColumn(cell.col)) {
      this.toastService.info('El in-goal solo tiene puntos: los tramos van de la franja 22 propio a la 22 rival.', 'Zonas');
      return;
    }
    this.selectedCell.set(cell);
  }

  /** Tocar un bloque de la grilla lo carga para editar. */
  onSegmentSelected(assignment: ZoneAssignmentResponse): void {
    this.panel()?.startEdit(assignment);
  }

  /** Estirar un tramo con las manijas cambia el rango del formulario; guardar sigue siendo una decisión del usuario. */
  onRangeResized(range: { startMinute: number; endMinute: number }): void {
    this.panel()?.setRange(range);
  }

  /** Tocar una fila dentro de un hueco precarga el rango y la franja; el lateral queda en Centro si no había uno. */
  onGapSelected(gap: TerritoryGapSelection): void {
    this.selectedCell.update(cell => ({ row: cell?.row ?? DEFAULT_LATERAL_ROW, col: gap.col }));
    this.panel()?.prefill(gap);
  }

  /** Interpreta `?tramo=` / `?minuto=` contra los tramos cargados; un enlace inválido se ignora y se avisa. */
  private readDeepLink(): void {
    const query = this.route.snapshot.queryParamMap;
    const target = resolveZoneDeepLink(
      { tramo: query.get('tramo'), minuto: query.get('minuto') },
      this.zonesStore.assignments()
    );
    if (target.kind === 'none') return;

    // El enlace se consume una vez: la URL queda limpia y recargar no vuelve a abrirlo
    this.router.navigate([], { relativeTo: this.route, queryParams: { tramo: null, minuto: null }, queryParamsHandling: 'merge', replaceUrl: true });

    if (target.kind === 'invalid') {
      this.toastService.info(
        target.reason === 'tramo' ? 'El tramo del enlace ya no existe.' : 'El minuto del enlace no es válido.',
        'Enlace a Zonas'
      );
      return;
    }
    this.pendingDeepLink.set(target);
  }

  /** Abre el tramo para editarlo o precarga el hueco; en pantalla angosta muestra el tiempo que corresponde. */
  private applyDeepLink(panel: ZoneAssignmentPanelComponent, target: ZoneDeepLinkTarget): void {
    if (target.kind === 'segment') {
      if (this.compact()) this.periodFilter.set(target.segment.period);
      panel.startEdit(target.segment);
    } else if (target.kind === 'gap') {
      if (this.compact()) this.periodFilter.set(target.gap.period);
      // Un tanto reinicia el juego: se propone el segmento entre cortes que contiene el minuto, no el hueco entero
      const segment = segmentAt(target.gap, target.minute, this.zonesStore.cuts());
      panel.prefill({ startMinute: segment.start, endMinute: segment.end });
    }
  }

  private load(matchId: string): void {
    this.loading.start();
    this.errorMessage.set('');

    this.zonesStore.load(matchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.readDeepLink();
          this.loading.finish();
        },
        error: err => {
          const message = err?.error?.message;
          this.errorMessage.set(typeof message === 'string' && message ? message : 'No se pudieron cargar las zonas del partido.');
          this.loading.finish();
        }
      });
  }
}
