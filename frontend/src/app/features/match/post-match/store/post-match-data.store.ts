import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, defer, forkJoin, of, switchMap, tap } from 'rxjs';
import { EventService } from '../../services/event.service';
import { EventTypeService } from '../../services/event-type.service';
import { LiveCaptureService } from '../../services/live-capture.service';
import { RosterService } from '../../services/roster.service';
import { ZoneService } from '../../services/zone.service';
import { AdvancedMatchStatistics } from '../../statistics/types/statistic.types';
import { StatisticApiService } from '../../statistics/services/statistic-api.service';
import { MatchTimelineEventResponse } from '../../types/event.types';
import { LiveCaptureEventType } from '../../types/event-type.types';
import { MatchRosterPlayer } from '../../types/roster.types';
import { MatchZonesResponse } from '../../types/zone.types';
import { cached } from '../utils/cached';

/**
 * Datos del partido compartidos por las vistas del post-partido (Eventos, Zonas y Estadísticas). Se provee en el shell:
 * vive una visita y un partido. Cada recurso se pide una vez y las pestañas lo leen de memoria; lo que una edición
 * deja desactualizado se invalida y la próxima vista que lo necesite lo vuelve a pedir. Los datos son de solo lectura.
 */
@Injectable()
export class PostMatchDataStore {
  private readonly eventService = inject(EventService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly zoneService = inject(ZoneService);
  private readonly rosterService = inject(RosterService);
  private readonly statisticApi = inject(StatisticApiService);
  private readonly liveCaptureService = inject(LiveCaptureService);
  private readonly destroyRef = inject(DestroyRef);

  private matchId = '';
  /** Lo capturado en este dispositivo se envía una sola vez por visita, antes del primer pedido de eventos. */
  private pendingEventsSynced = false;

  private readonly eventTypesResource = cached(() => this.eventTypeService.getAll());
  private readonly eventsResource = cached(() => this.syncPendingEventsOnce().pipe(
    switchMap(() => this.eventService.getByMatchPostMatch(this.matchId))
  ));
  private readonly zonesResource = cached(() => this.zoneService.list(this.matchId));
  private readonly rosterResource = cached(() => this.rosterService.getRosterOrDivisionPlayers(this.matchId));
  private readonly advancedResource = cached(() => this.statisticApi.getAdvancedStatistics(this.matchId));

  eventTypes(): Observable<LiveCaptureEventType[]> { return this.eventTypesResource.get(); }
  events(): Observable<MatchTimelineEventResponse[]> { return this.eventsResource.get(); }
  zones(): Observable<MatchZonesResponse> { return this.zonesResource.get(); }
  roster(): Observable<MatchRosterPlayer[]> { return this.rosterResource.get(); }
  advanced(): Observable<AdvancedMatchStatistics> { return this.advancedResource.get(); }

  /**
   * Pide en paralelo lo que usan las vistas y, cuando termina, precarga las estadísticas avanzadas en segundo plano
   * para que Estadísticas abra sin esperar. Los errores no se muestran acá: cada vista los ve al leer el recurso.
   */
  load(matchId: string): void {
    this.matchId = matchId;
    this.pendingEventsSynced = false;
    this.invalidateAll();
    if (!matchId) return;
    const ignoreError = <T>() => catchError((): Observable<T | null> => of(null));
    forkJoin([
      this.eventTypes().pipe(ignoreError()),
      this.events().pipe(ignoreError()),
      this.zones().pipe(ignoreError()),
      this.roster().pipe(ignoreError())
    ])
      .pipe(
        switchMap(() => this.advanced().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  /** Alta, edición o baja de un evento: el servidor recalcula zona, tramos y marcador. */
  invalidateAfterEventChange(): void {
    this.eventsResource.invalidate();
    this.zonesResource.invalidate();
    this.advancedResource.invalidate();
  }

  /** Guardar o borrar un tramo cambia los tramos, la zona derivada de los eventos y las estadísticas de segundo nivel. */
  invalidateAfterZoneChange(): void {
    this.zonesResource.invalidate();
    this.eventsResource.invalidate();
    this.advancedResource.invalidate();
  }

  private invalidateAll(): void {
    this.eventTypesResource.invalidate();
    this.eventsResource.invalidate();
    this.zonesResource.invalidate();
    this.rosterResource.invalidate();
    this.advancedResource.invalidate();
  }

  /** No bloquea: si falla, los eventos se envían en la próxima sincronización y se reintenta en el próximo pedido. */
  private syncPendingEventsOnce(): Observable<unknown> {
    if (this.pendingEventsSynced) return of(null);
    return defer(() => this.liveCaptureService.syncPendingEvents(this.matchId)).pipe(
      tap(() => this.pendingEventsSynced = true),
      catchError(() => of(null))
    );
  }
}
