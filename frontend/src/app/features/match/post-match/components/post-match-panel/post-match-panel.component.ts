import { Component, ElementRef, NgZone, ViewChild, computed, effect, inject, signal, untracked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, merge, of, timer } from 'rxjs';
import { catchError, debounce, filter, switchMap, tap } from 'rxjs/operators';
import { MatchReviewStore } from '../../store/match-review.store';
import { EventService } from '../../../services/event.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { Possession } from '../../../types/live-capture.types';
import { MatchTimelineEventResponse } from '../../../types/event.types';
import { ReviewEventViewModel } from '../../types/match-review.types';
import { ModalComponent } from '../../../../modal/modal.component';
import { EventFormComponent, EventFormData } from '../event-form/event-form.component';
import { TemplateField } from '../../../types/event-type.types';
import { ZoneCellRef } from '../../../types/zone.types';
import { EventZoneLink, describeEventZone, resolveEventZoneLink } from '../../utils/zone-event-link';
import { displayAttributeLabel } from '../../utils/attribute-labels';
import { OverflowMetrics, overflowCapacity, visibleWithOverflow } from '../../utils/list-overflow';
import { observeHeight } from '../../utils/observe-height';
import { zoneDeepLinkParams } from '../../utils/zone-deep-link';
import { zoneLabel } from '../../utils/zone-grid';
import { fromMatchTimeSeconds, toMatchTimeSeconds } from '../../utils/event-time';
import { ZoneMiniMapComponent } from '../zone-mini-map/zone-mini-map.component';

/** Alturas fijas de la cola (las fija el CSS del panel): ítem, separación y aviso «+N más en la tabla». */
const QUEUE_METRICS: OverflowMetrics = { itemHeight: 34, itemSpacing: 5, hintHeight: 26 };

/** La cola nunca muestra menos de dos ítems (el CSS reserva ese lugar). */
const QUEUE_MIN_ITEMS = 2;

/** Sin alto acotado (hoja inferior en tablet y móvil) no hay qué medir: se listan estos y el resto va a la tabla. */
const QUEUE_UNBOUNDED_PREVIEW = 6;

/** Desde este ancho el inspector es una columna de alto fijo y la cola se ajusta al espacio libre. */
const DESKTOP_QUERY = '(min-width: 1121px)';

/** Espera del autoguardado: más larga si cambió el tiempo, porque mover el evento lo reubica en tabla y línea de tiempo. */
const FIELD_SAVE_DELAY_MS = 400;
const TIME_SAVE_DELAY_MS = 2000;

interface PendingSave {
  id: string;
  payload: Partial<MatchTimelineEventResponse>;
  timeChanged: boolean;
}

@Component({
  selector: 'app-post-match-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ModalComponent, EventFormComponent, ZoneMiniMapComponent],
  templateUrl: './post-match-panel.component.html',
  styleUrl: './post-match-panel.component.css'
})
export class PostMatchPanelComponent implements OnDestroy {
  readonly store = inject(MatchReviewStore);
  private readonly ngZone = inject(NgZone);
  private readonly eventService = inject(EventService);
  private readonly toastService = inject(ToastService);

  // Solapas de Inspección: Ver o Editar
  readonly activeTab = signal<'view' | 'edit'>('view');

  // Estado del Autoguardado ('pending' = esperando la pausa del usuario; todavía no se envió)
  readonly saveStatus = signal<'pending' | 'saved' | 'saving' | 'error' | 'idle'>('idle');
  /** null = el formulario quedó inválido: se descarta lo que estuviera esperando. */
  private readonly saveSubject = new Subject<PendingSave | null>();
  /** Guarda ya lo que esté esperando (sale de los campos de tiempo, cambia el evento seleccionado). */
  private readonly flushRequests = new Subject<void>();
  private pendingSave: PendingSave | null = null;
  private lastSentKey: string | null = null;
  private saveTimer: any = null;

  /** Datos del formulario de edición; el formulario ignora los que lleguen mientras tenga cambios sin confirmar. */
  readonly editFormData = computed<EventFormData | null>(() => {
    const ev = this.store.selectedEvent();
    if (!ev) return null;
    const { minute, second } = fromMatchTimeSeconds(ev.matchTime);
    return {
      eventId: ev.id,
      eventTypeId: ev.eventTypeId,
      teamPossession: ev.teamPossession,
      playerId: ev.playerId,
      period: ev.period === 2 ? 2 : 1,
      minute,
      second,
      attributes: ev.attributes ?? null
    };
  });

  // Estado del Bottom Sheet en Tablet/Mobile (< 1121px)
  readonly sheetState = signal<'peek' | 'open'>('peek');

  // Estados de Modales
  readonly showDeleteModal = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  // Cola de revisión: solo los ítems que entran completos en el alto libre (null = alto sin acotar)
  private readonly queueRegionHeight = signal<number | null>(null);
  private stopObservingQueue?: () => void;

  readonly queueView = computed(() => {
    const queue = this.store.pendingQueue();
    const height = this.queueRegionHeight();
    const capacity = height === null
      ? Math.min(queue.length, QUEUE_UNBOUNDED_PREVIEW)
      : overflowCapacity(height, queue.length, QUEUE_METRICS, QUEUE_MIN_ITEMS);
    return visibleWithOverflow(queue, capacity);
  });

  @ViewChild('queueRegion')
  set queueRegion(ref: ElementRef<HTMLElement> | undefined) {
    this.stopObservingQueue?.();
    this.stopObservingQueue = undefined;
    const region = ref?.nativeElement;
    if (!region) return;
    this.stopObservingQueue = observeHeight(region, height => {
      const bounded = typeof matchMedia === 'function' && matchMedia(DESKTOP_QUERY).matches;
      const next = bounded ? height : null;
      if (next !== this.queueRegionHeight()) this.ngZone.run(() => this.queueRegionHeight.set(next));
    });
  }

  // Detalle de "Ver": si los atributos no entran, scrollea y un degradado avisa que hay más abajo
  readonly detailHasMore = signal<boolean>(false);
  private detailScrollEl: HTMLElement | null = null;
  private detailObserver?: ResizeObserver;

  @ViewChild('detailScroll')
  set detailScroll(ref: ElementRef<HTMLElement> | undefined) {
    const el = ref?.nativeElement ?? null;
    if (el === this.detailScrollEl) return;
    this.detailObserver?.disconnect();
    this.detailScrollEl = el;
    if (el && typeof ResizeObserver !== 'undefined') {
      // El contenedor cambia con el alto de la ventana; su contenido, con los atributos del evento
      this.detailObserver = new ResizeObserver(() => this.updateDetailOverflow());
      this.detailObserver.observe(el);
      if (el.firstElementChild) this.detailObserver.observe(el.firstElementChild);
    }
    // Se mide al terminar el ciclo de detección, con el DOM ya actualizado
    queueMicrotask(() => this.updateDetailOverflow());
  }

  constructor() {
    this.saveSubject.pipe(
      debounce(req => merge(timer(req?.timeChanged ? TIME_SAVE_DELAY_MS : FIELD_SAVE_DELAY_MS), this.flushRequests)),
      filter((req): req is PendingSave => req !== null),
      filter(req => this.isNewSave(req)),
      tap(() => {
        this.pendingSave = null;
        this.saveStatus.set('saving');
      }),
      switchMap(({ id, payload, timeChanged }) =>
        this.eventService.update(id, payload).pipe(
          tap(() => this.onSaveConfirmed(id, payload, timeChanged)),
          catchError(err => {
            this.onSaveFailed(err);
            return of(null);
          })
        )
      ),
      takeUntilDestroyed()
    ).subscribe();

    // Cada evento nuevo se muestra desde el principio del detalle
    effect(() => {
      this.store.selectedEventId();
      untracked(() => queueMicrotask(() => {
        // Lo que quedó esperando del evento anterior se guarda ya (el pedido lleva su propio id)
        this.flushRequests.next();
        if (this.detailScrollEl) this.detailScrollEl.scrollTop = 0;
        this.updateDetailOverflow();
      }));
    });
  }

  updateDetailOverflow(): void {
    const el = this.detailScrollEl;
    this.detailHasMore.set(!!el && el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }

  onFormChange(formData: EventFormData): void {
    const ev = this.store.selectedEvent();
    if (!ev) return;
    if (formData.isValid === false || formData.minute == null) {
      // Un valor intermedio inválido (p. ej. 45 en el 1T) no se guarda, ni lo que esperaba antes de él
      this.pendingSave = null;
      this.saveStatus.set('idle');
      this.saveSubject.next(null);
      return;
    }

    const payload: Partial<MatchTimelineEventResponse> = {
      eventTypeId: formData.eventTypeId,
      teamPossession: formData.teamPossession,
      playerId: formData.playerId,
      attributes: formData.attributes
    };

    // Se compara con lo que mostró el formulario al cargarse: un tiempo guardado no se reescribe si no se tocó
    const period = formData.period ?? 1;
    const saved = fromMatchTimeSeconds(ev.matchTime);
    const timeChanged = period !== ev.period || formData.minute !== saved.minute || (formData.second ?? 0) !== saved.second;
    if (timeChanged) {
      const matchTime = toMatchTimeSeconds(period, formData.minute, formData.second);
      payload.period = period;
      payload.matchTime = matchTime;
      payload.absoluteMatchTime = this.store.estimateAbsoluteTime(matchTime, period, ev.id);
    }

    this.pendingSave = { id: ev.id, payload, timeChanged };
    this.saveStatus.set('pending');
    this.saveSubject.next(this.pendingSave);
  }

  onTimeCommit(): void {
    this.flushRequests.next();
  }

  /** Evita repetir el último PATCH enviado (p. ej. tocar de nuevo el mismo botón de posesión). */
  private isNewSave(req: PendingSave): boolean {
    const key = JSON.stringify(req);
    if (key === this.lastSentKey) {
      this.pendingSave = null;
      this.saveStatus.set('idle');
      return false;
    }
    this.lastSentKey = key;
    return true;
  }

  private onSaveConfirmed(id: string, payload: Partial<MatchTimelineEventResponse>, timeChanged: boolean): void {
    this.store.updateEvent(id, payload);
    // Con otro tiempo el evento cambia de lugar: la tabla lo sigue, salvo que ya se haya pasado a otro evento
    if (timeChanged && this.store.selectedEventId() === id) {
      this.store.revealEvent(id);
    }
    this.saveStatus.set('saved');
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveStatus.set('idle');
    }, 2500);
  }

  private onSaveFailed(err: unknown): void {
    this.lastSentKey = null;
    this.saveStatus.set('error');
    this.toastService.error(errorMessage(err, 'Error al autoguardar la jugada'));
  }

  readonly zoneLabel = zoneLabel;

  /**
   * A dónde lleva el evento en Zonas, calculado con los tramos cargados. Si no se pudieron cargar, no se ofrece hueco
   * ni tramo (el enlace va a Zonas sin parámetros). Null si el evento no tiene un tiempo válido: la fila no se muestra.
   */
  zoneLinkFor(ev: ReviewEventViewModel): EventZoneLink | null {
    const loaded = this.store.zonesStatus() === 'loaded';
    const link = resolveEventZoneLink(ev, loaded ? this.store.zoneAssignments() : []);
    return link && !loaded ? { ...link, segment: null, gap: null } : link;
  }

  zoneLinkParamsFor(link: EventZoneLink): Record<string, string> {
    return zoneDeepLinkParams(link);
  }

  zoneDescription(ev: ReviewEventViewModel, link: EventZoneLink): string {
    const zone: ZoneCellRef | null = ev.zone ?? null;
    return describeEventZone(zone, link, ev.zoneFixed === true);
  }

  getEnrichedAttributesDisplay(ev: ReviewEventViewModel): { label: string; value: string }[] {
    if (!ev.attributes || Object.keys(ev.attributes).length === 0) {
      return [];
    }

    const type = this.store.eventTypesList().find(t => t.id === ev.eventTypeId);
    const fields = type?.templateEventFields || [];
    const fieldsMap = new Map<string, TemplateField>();
    fields.forEach(f => fieldsMap.set(f.key, f));

    const result: { label: string; value: string }[] = [];

    for (const [key, val] of Object.entries(ev.attributes)) {
      if (val === null || val === undefined || val === '') continue;

      const field = fieldsMap.get(key);
      const label = field ? displayAttributeLabel(type?.code, key, field.label) : key;
      let displayVal = String(val);

      if (field) {
        if (field.type === 'select' && field.options) {
          const opt = field.options.find(o => o.value === val);
          if (opt) displayVal = opt.label;
        } else if (field.type === 'boolean') {
          displayVal = val === true ? (field.trueLabel || 'Sí') : (field.falseLabel || 'No');
        }
      }

      result.push({ label, value: displayVal });
    }

    return result;
  }

  readonly currentPendingIndex = computed<number | null>(() => {
    const selectedId = this.store.selectedEventId();
    if (!selectedId) return null;
    const queue = this.store.pendingQueue();
    const index = queue.findIndex(e => e.id === selectedId);
    return index >= 0 ? index + 1 : null;
  });

  toggleSheet(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.sheetState.update(s => s === 'peek' ? 'open' : 'peek');
  }

  openSheet(): void {
    this.sheetState.set('open');
  }

  closeSheet(): void {
    this.sheetState.set('peek');
  }

  onPrevPendingClick(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.store.selectPrevPending();
  }

  onNextPendingClick(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.store.selectNextPending();
  }

  openEditMode(): void {
    this.sheetState.set('open');
    this.activeTab.set('edit');
  }

  openEditModal(): void {
    this.openEditMode();
  }

  onEditModalFromPeek(event: MouseEvent): void {
    event.stopPropagation();
    this.openEditMode();
  }

  ngOnDestroy(): void {
    this.stopObservingQueue?.();
    this.detailObserver?.disconnect();
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    // Al salir de la pantalla no se pierde lo que esperaba la pausa: se envía fuera del flujo, que ya se cierra
    const pending = this.pendingSave;
    if (pending) {
      this.pendingSave = null;
      this.eventService.update(pending.id, pending.payload).subscribe({
        next: () => this.store.updateEvent(pending.id, pending.payload),
        error: err => this.toastService.error(errorMessage(err, 'Error al autoguardar la jugada'))
      });
    }
  }

  // --- Asignación Rápida desde el Panel ---
  onQuickPlayerSelectChange(event: Event, ev: ReviewEventViewModel): void {
    const select = event.target as HTMLSelectElement;
    const playerId = select.value.trim() || null;
    if (!playerId) return;
    this.onQuickPlayerModelChange(playerId, ev);
  }

  onQuickPlayerModelChange(newPlayerId: string, ev: ReviewEventViewModel): void {
    const finalPlayerId = newPlayerId.trim() || null;
    this.isSubmitting.set(true);
    this.store.selectEvent(ev.id);
    this.saveStatus.set('saving');
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.eventService.update(ev.id, {
      playerId: finalPlayerId,
      teamPossession: ev.teamPossession
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.store.updateEvent(ev.id, { playerId: finalPlayerId });
        this.saveStatus.set('saved');
        this.saveTimer = setTimeout(() => {
          this.saveStatus.set('idle');
        }, 2500);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.saveStatus.set('error');
        this.saveTimer = setTimeout(() => {
          this.saveStatus.set('idle');
        }, 3000);
        this.toastService.error('Error al actualizar el jugador');
      }
    });
  }

  // --- Apertura y Manejo de Modal de Eliminación ---
  openDeleteModal(): void {
    if (!this.store.selectedEvent()) return;
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
  }

  confirmDelete(): void {
    const ev = this.store.selectedEvent();
    if (!ev) return;

    this.isSubmitting.set(true);
    this.eventService.delete(ev.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.store.removeEvent(ev.id);
        this.closeDeleteModal();
        this.toastService.success('Evento eliminado correctamente');
      },
      error: () => {
        this.isSubmitting.set(false);
        this.toastService.error('Error al eliminar el evento');
      }
    });
  }
}

/** Mensaje del servidor (`{ message }` de un 409) o el genérico. */
function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === 'string' && message.trim() !== '' ? message : fallback;
}
