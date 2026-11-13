import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { EventService } from '../../services/event.service';
import { EventTypeService } from '../../services/event-type.service';
import { ZoneService } from '../../services/zone.service';
import { MatchTimelineEventResponse } from '../../types/event.types';
import { ZONE_MOTION_MS } from '../utils/zone-motion';
import { ZoneRulesByType, isFixedZone } from '../utils/zone-rule';
import { TramoCutMark, tramoCuts } from '../utils/zone-track-layout';
import { ZoneAssignmentResponse, ZoneAssignmentRequest, ZoneCellRef, ZonePeriod } from '../../types/zone.types';

/**
 * Estado de las zonas del partido en revisión: tramos asignados y eventos con su zona.
 * La zona de cada evento la calcula el backend; los conteos de la pantalla se derivan de estos eventos,
 * así hay una única fuente de verdad. Sin UX: los errores los maneja quien lo consume.
 */
@Injectable({ providedIn: 'root' })
export class MatchZonesStore {
  private readonly zoneService = inject(ZoneService);
  private readonly eventService = inject(EventService);
  private readonly eventTypeService = inject(EventTypeService);

  readonly assignments = signal<ZoneAssignmentResponse[]>([]);
  private readonly rawEvents = signal<MatchTimelineEventResponse[]>([]);
  private readonly activeTypeIds = signal<Set<string> | null>(null);
  /** Regla de zona de cada tipo de evento (catálogo): define qué eventos tienen zona fija y no dependen de un tramo. */
  readonly zoneRules = signal<ZoneRulesByType>(new Map());
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  /** Tramo que choca con el rango en edición; lo resaltan la lista y la timeline (estado de UI compartido). */
  readonly conflictId = signal<string | null>(null);
  /** Tramo que se está editando en el formulario (null al crear uno nuevo); la grilla le dibuja un anillo. */
  readonly editingId = signal<string | null>(null);
  /** Celda y tramo bajo el cursor o el foco: vinculan cancha, timeline y lista (estado de UI compartido). */
  /** Rango válido que está cargado en el formulario; la timeline lo dibuja como vista previa. */
  readonly formRange = signal<{ period: ZonePeriod; startMinute: number; endMinute: number } | null>(null);
  /** Celda recién guardada: la cancha le hace un pulso breve y se apaga sola. */
  readonly pulseCell = signal<ZoneCellRef | null>(null);
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  readonly hoverCell = signal<ZoneCellRef | null>(null);
  readonly hoverSegmentId = signal<string | null>(null);

  /** Mismos eventos que la revisión: se ocultan los de tipos dados de baja en el catálogo. */
  readonly events = computed<MatchTimelineEventResponse[]>(() => {
    const active = this.activeTypeIds();
    const raw = this.rawEvents();
    return active === null ? raw : raw.filter(event => active.has(event.eventTypeId));
  });

  /** Los mismos eventos, marcados si su zona la da la regla del tipo (`zonePoint`) y ningún tramo se la da ni se la quita. */
  readonly zoneEvents = computed(() => {
    const rules = this.zoneRules();
    return this.events().map(event => ({ ...event, zonePoint: isFixedZone(rules.get(event.eventTypeId), event.attributes) && !!event.zone }));
  });

  /** Cortes por try (y tanteos que reinician el juego): el tramo que los contiene termina en su minuto. */
  readonly cuts = computed<TramoCutMark[]>(() => tramoCuts(this.events(), this.zoneRules(), 'ALL'));

  load(matchId: string): Observable<void> {
    this.isLoading.set(true);
    return forkJoin({
      zones: this.zoneService.list(matchId),
      events: this.eventService.getByMatchPostMatch(matchId),
      types: this.eventTypeService.getAll()
    }).pipe(
      tap(({ zones, events, types }) => {
        this.assignments.set(zones.assignments);
        this.rawEvents.set(events);
        this.activeTypeIds.set(types.length > 0 ? new Set(types.map(type => type.id)) : null);
        this.zoneRules.set(new Map(types.map(type => [type.id, type.zoneRule ?? null])));
      }),
      map(() => undefined),
      finalize(() => this.isLoading.set(false))
    );
  }

  /** Crea el tramo o, si se indica `zoneId`, lo modifica; luego refresca tramos y eventos. */
  save(matchId: string, request: ZoneAssignmentRequest, zoneId?: string): Observable<void> {
    const write$ = zoneId
      ? this.zoneService.update(matchId, zoneId, request)
      : this.zoneService.create(matchId, request);
    return this.runAndReload(matchId, write$);
  }

  remove(matchId: string, zoneId: string): Observable<void> {
    return this.runAndReload(matchId, this.zoneService.remove(matchId, zoneId));
  }

  pulse(cell: ZoneCellRef): void {
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.pulseCell.set({ row: cell.row, col: cell.col });
    this.pulseTimer = setTimeout(() => this.pulseCell.set(null), ZONE_MOTION_MS + 50);
  }

  reset(): void {
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.pulseTimer = null;
    this.pulseCell.set(null);
    this.conflictId.set(null);
    this.editingId.set(null);
    this.formRange.set(null);
    this.hoverCell.set(null);
    this.hoverSegmentId.set(null);
    this.assignments.set([]);
    this.rawEvents.set([]);
    this.activeTypeIds.set(null);
    this.zoneRules.set(new Map());
  }

  private runAndReload(matchId: string, write$: Observable<unknown>): Observable<void> {
    this.isSaving.set(true);
    return write$.pipe(
      switchMap(() => forkJoin({
        zones: this.zoneService.list(matchId),
        // Si solo falla la recarga de eventos, el cambio ya se guardó: se conservan los que había.
        events: this.eventService.getByMatchPostMatch(matchId).pipe(catchError(() => of(this.rawEvents())))
      })),
      tap(({ zones, events }) => {
        this.assignments.set(zones.assignments);
        this.rawEvents.set(events);
      }),
      map(() => undefined),
      finalize(() => this.isSaving.set(false))
    );
  }
}
