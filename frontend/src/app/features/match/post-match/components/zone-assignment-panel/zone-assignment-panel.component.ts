import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, Input, NgZone, OnInit, ViewChild, inject, model } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'src/app/core/services/toast.service';
import { MatchZonesStore } from '../../store/match-zones.store';
import { HALFTIME_SPLIT_MESSAGE, deduceZonePeriod, rangeCrossesHalftime, validateZoneForm } from '../../utils/zone-form.utils';
import { ZONE_COLUMN_NAMES, ZONE_ROW_NAMES, ZONE_ROW_SHORT_NAMES, columnRangeLabel, zoneLabel } from '../../utils/zone-grid';
import { describeSegment, eventsLinkedByRange, eventsReleasedByEdit, findOverlap } from '../../utils/zone-stats';
import { findZoneRuleConflict } from '../../utils/zone-rule';
import { ListOverflow, OverflowMetrics, overflowCapacity, visibleWithOverflow } from '../../utils/list-overflow';
import { observeHeight } from '../../utils/observe-height';
import { GapWithEvents, TRACK_MINUTES, TramoCut, findTramoCut, gapsWithEventCount, suggestNextRange } from '../../utils/zone-track-layout';
import { ZONE_HALF_MINUTES, ZoneAssignmentRequest, ZoneAssignmentResponse, ZoneCellRef, ZonePeriod } from '../../../types/zone.types';

type RangeField = 'start' | 'end';

interface UsableRange {
  period: ZonePeriod;
  startMinute: number;
  endMinute: number;
}

/** Instrucción de inicio: vive solo en el campo Franja (y en el resumen de la hoja móvil) mientras falta elegirla. */
export const PICK_FRANJA_HELP = 'Tocá la grilla o la cancha';

/** Regla del rango: se muestra en el tooltip de "Hasta" y en la ayuda general de la pantalla. */
export const RANGE_RULE_HELP = 'Inicio incluido, fin excluido: 20′–25′ y 25′–30′ no se pisan.';

/** Alturas fijas de «Huecos sin zona» (las fija el CSS del panel): ítem, separación y aviso «+N más en la grilla». */
const GAP_LIST_METRICS: OverflowMetrics = { itemHeight: 44, itemSpacing: 8, hintHeight: 28 };

/** Sin alto acotado (una columna, hoja móvil) no hay qué medir: se listan estos huecos y el resto va a la grilla. */
const GAPS_UNBOUNDED_PREVIEW = 4;

/** Desde este ancho el panel ocupa el alto de la fila y la lista de huecos se ajusta a lo que queda libre. */
const DESKTOP_QUERY = '(min-width: 1122px)';

/** Cuánto tiempo queda disponible el "Deshacer" tras borrar un tramo. */
const UNDO_WINDOW_MS = 6000;

/**
 * Formulario de tramos (rango de tiempo + zona). La franja se elige tocando la grilla o la cancha; el lateral y los
 * minutos, acá. El tiempo (1T/2T) no se elige: se deduce de los minutos acumulados (1T 0–40, 2T 40–80).
 * Vocabulario: "tramo" = rango de tiempo con una zona; "zona" = celda de la cancha; "franja" = columna de la cancha.
 */
@Component({
  selector: 'app-zone-assignment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zone-assignment-panel.component.html',
  styleUrl: './zone-assignment-panel.component.css'
})
export class ZoneAssignmentPanelComponent implements OnInit, AfterViewInit {
  readonly store = inject(MatchZonesStore);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  @Input() matchId = '';

  /** Zona elegida en la grilla o la cancha (enlace bidireccional con la página). */
  readonly selectedCell = model<ZoneCellRef | null>(null);

  readonly laterals = ZONE_ROW_NAMES.map((name, index) => ({ row: index + 1, name, short: ZONE_ROW_SHORT_NAMES[index] }));
  /** Alto libre para la lista de huecos; null cuando el panel no tiene alto acotado (una columna, hoja móvil). */
  private gapsRegionHeight: number | null = null;
  private stopObservingGaps?: () => void;
  @ViewChild('gapsRegion') private gapsRegion?: ElementRef<HTMLElement>;
  readonly pickFranjaHelp = PICK_FRANJA_HELP;
  readonly rangeRuleHelp = RANGE_RULE_HELP;

  // Estado del formulario: nada se guarda sin que el usuario lo decida.
  startMinute: number | null = null;
  endMinute: number | null = null;
  editingId: string | null = null;
  /** En móvil el formulario es una hoja inferior: compacta (resumen, lateral y Guardar) o expandida con todos los campos. */
  sheetOpen = false;
  serverError: string | null = null;
  /** Se intentó guardar sin elegir franja (atajo de teclado): el campo Franja lo marca como error. */
  pickAttempted = false;

  ngAfterViewInit(): void {
    const region = this.gapsRegion?.nativeElement;
    if (!region) return;

    this.stopObservingGaps = observeHeight(region, regionHeight => {
      const bounded = typeof matchMedia === 'function' && matchMedia(DESKTOP_QUERY).matches;
      const height = bounded ? regionHeight : null;
      if (height !== this.gapsRegionHeight) this.ngZone.run(() => { this.gapsRegionHeight = height; });
    });
  }

  ngOnInit(): void {
    this.applySuggestion();
    this.destroyRef.onDestroy(() => {
      this.stopObservingGaps?.();
      this.store.conflictId.set(null);
      this.store.editingId.set(null);
      this.store.formRange.set(null);
      this.store.hoverSegmentId.set(null);
    });
  }

  /** Precarga el formulario con un rango (ej. al tocar un hueco de la grilla). */
  prefill(range: { startMinute: number; endMinute: number }): void {
    this.editingId = null;
    this.serverError = null;
    this.startMinute = range.startMinute;
    this.endMinute = range.endMinute;
    this.syncSharedState();
  }

  /** Cambia el rango sin tocar el tramo en edición (ej. al estirarlo con las manijas de la grilla). */
  setRange(range: { startMinute: number; endMinute: number }): void {
    this.serverError = null;
    this.startMinute = range.startMinute;
    this.endMinute = range.endMinute;
    this.syncSharedState();
  }

  toggleSheet(): void {
    this.sheetOpen = !this.sheetOpen;
  }

  /** Cerrar la hoja inferior equivale a Esc: deselecciona (como Cancelar) y, sin nada elegido, solo la compacta. */
  closeSheet(): void {
    if (this.hasSelection()) this.cancel();
    else this.sheetOpen = false;
  }

  onRangeChange(): void {
    this.serverError = null;
    this.syncSharedState();
  }

  /** Botones − y + junto a cada minuto: minutos acumulados de 0 a 80. */
  adjust(field: RangeField, delta: number): void {
    const current = field === 'start' ? this.startMinute : this.endMinute;
    const base = current ?? (field === 'start' ? 0 : (this.startMinute ?? 0));
    const next = Math.min(Math.max(base + delta, 0), TRACK_MINUTES);

    if (field === 'start') this.startMinute = next;
    else this.endMinute = next;
    this.serverError = null;
    this.syncSharedState();
  }

  /** Cambia el lateral de la zona elegida; sin franja elegida no hay nada que cambiar. */
  setLateral(row: number): void {
    this.selectedCell.update(cell => cell ? { row, col: cell.col } : cell);
  }

  /** Franja elegida, para mostrarla en el formulario (null si todavía no se eligió). */
  get franja(): { label: string; name: string; range: string } | null {
    const cell = this.selectedCell();
    return cell ? { label: zoneLabel(cell), name: ZONE_COLUMN_NAMES[cell.col - 1], range: columnRangeLabel(cell.col) || 'in-goal' } : null;
  }

  /** Zona elegida en una línea, ej. "22 rival · Centro"; null si todavía no se eligió. */
  get zoneSummary(): string | null {
    const cell = this.selectedCell();
    return cell ? `${ZONE_COLUMN_NAMES[cell.col - 1]} · ${ZONE_ROW_NAMES[cell.row - 1]}` : null;
  }

  /** El tiempo (1T/2T) que se deduce del rango; null mientras el rango no sea utilizable. */
  get period(): ZonePeriod | null {
    return this.usableRange()?.period ?? null;
  }

  /** Ayuda mientras falta la franja (null cuando ya hay una). */
  get pickHelp(): string | null {
    return this.selectedCell() ? null : PICK_FRANJA_HELP;
  }

  /**
   * Problema del rango, para mostrarlo junto a los minutos: cruce del entretiempo, minutos inválidos o choque con
   * otro tramo. Null si el rango es válido. Las reglas replican las del backend, que sigue siendo la fuente de verdad.
   */
  get rangeProblem(): string | null {
    const { startMinute, endMinute } = this;
    if (startMinute !== null && endMinute !== null && Number.isInteger(startMinute) && Number.isInteger(endMinute)
        && startMinute < endMinute && rangeCrossesHalftime(startMinute, endMinute)) {
      return HALFTIME_SPLIT_MESSAGE;
    }

    const formError = validateZoneForm({
      period: (startMinute ?? 0) >= ZONE_HALF_MINUTES ? 2 : 1,
      startMinute,
      endMinute,
      row: 1,
      col: 1
    });
    if (formError) return formError;

    const range = this.usableRange();
    const clash = range ? findOverlap(range, this.store.assignments(), this.editingId) : null;
    return clash ? `Choca con el tramo ${describeSegment(clash)}.` : this.tramoCut(range)?.message ?? this.zoneRuleProblem(range);
  }

  /** Minuto donde tiene que terminar el rango porque sigue después de un try; null si no cruza ningún corte. */
  get cutEnd(): number | null {
    return this.tramoCut(this.usableRange())?.cut.minute ?? null;
  }

  /** «Terminar en N′»: lleva el fin del rango al corte (sirve también para cortar un tramo guardado que cruza un try). */
  endAtCut(minute: number): void {
    this.endMinute = minute;
    this.onRangeChange();
  }

  private tramoCut(range: UsableRange | null): TramoCut | null {
    return range ? findTramoCut(range, this.store.events(), this.store.zoneRules()) : null;
  }

  /** Primer evento que la celda elegida dejaría en una zona que su tipo prohíbe; el 409 del backend dice lo mismo. */
  private zoneRuleProblem(range: UsableRange | null): string | null {
    const cell = this.selectedCell();
    return range && cell
      ? findZoneRuleConflict({ ...range, row: cell.row, col: cell.col }, this.store.events(), this.store.zoneRules())?.message ?? null
      : null;
  }

  /** Motivo por el que no se puede guardar todavía (null = listo). */
  get blockReason(): string | null {
    return this.pickHelp ?? this.rangeProblem;
  }

  /** Eventos que quedarían vinculados con el rango actual; null mientras el rango no sea válido. */
  get linkedEventCount(): number | null {
    const range = this.usableRange();
    return range ? eventsLinkedByRange(range, this.store.zoneEvents()).length : null;
  }

  /** Al editar: eventos que hoy tienen zona gracias a este tramo y la perderían con el nuevo rango. */
  get releasedEventCount(): number {
    const original = this.editingId ? this.store.assignments().find(a => a.id === this.editingId) : undefined;
    const range = this.usableRange();
    return original && range ? eventsReleasedByEdit(original, range, this.store.zoneEvents()).length : 0;
  }

  /** Huecos sin zona de ambos tiempos, con los eventos que hoy caen en cada uno. */
  get gaps(): GapWithEvents[] {
    return gapsWithEventCount(this.store.assignments(), this.store.events());
  }

  /**
   * Huecos listados y cuántos quedan para la grilla: los que entran completos en el alto libre, en orden cronológico,
   * con el hueco precargado en el formulario en lugar del último visible si no entra.
   */
  get gapView(): ListOverflow<GapWithEvents> {
    const gaps = this.gaps;
    const capacity = this.gapsRegionHeight === null ? GAPS_UNBOUNDED_PREVIEW : overflowCapacity(this.gapsRegionHeight, gaps.length, GAP_LIST_METRICS);
    return visibleWithOverflow(gaps, capacity, gap => this.isGapLoaded(gap));
  }

  /** El hueco ya está cargado en el formulario. */
  isGapLoaded(gap: GapWithEvents): boolean {
    return this.editingId === null && this.startMinute === gap.start && this.endMinute === gap.end;
  }

  /** Tocar un hueco precarga el formulario con ese rango; la franja elegida se conserva. */
  selectGap(gap: GapWithEvents): void {
    this.prefill({ startMinute: gap.start, endMinute: gap.end });
  }

  /** Resumen del rango para la hoja compacta, ej. "26′–31′ · 1T · 3 eventos". */
  get rangeSummary(): string {
    const range = this.usableRange();
    if (!range) return 'Definí el rango';
    const events = this.linkedEventCount ?? 0;
    return `${range.startMinute}′–${range.endMinute}′ · ${range.period}T · ${events} ${events === 1 ? 'evento' : 'eventos'}`;
  }

  startEdit(zone: ZoneAssignmentResponse): void {
    this.serverError = null;
    this.editingId = zone.id;
    this.startMinute = zone.startMinute;
    this.endMinute = zone.endMinute;
    this.selectedCell.set({ row: zone.row, col: zone.col });
    this.syncSharedState();
  }

  /** Descarta lo cargado: vuelve a la sugerencia del próximo hueco y deja la franja sin elegir. */
  cancel(): void {
    this.resetForm();
  }

  /** Hay un tramo en edición o una franja elegida (o un hueco precargado): Esc y Cancelar tienen algo que deshacer. */
  hasSelection(): boolean {
    return this.editingId !== null || this.selectedCell() !== null;
  }

  /**
   * Ctrl/Cmd + Enter: guarda con lo que está escrito en Desde/Hasta (no solo con el último valor confirmado). Si el
   * formulario no es válido no guarda: el error ya se muestra inline junto al rango o en el campo Franja.
   */
  saveFromShortcut(target: EventTarget | null): void {
    this.commitTypedMinute(target);
    this.save();
  }

  save(): void {
    const cell = this.selectedCell();
    const range = this.usableRange();
    if (!cell) this.pickAttempted = true;
    if (!cell || !range || this.blockReason || this.store.isSaving()) return;

    const request: ZoneAssignmentRequest = { row: cell.row, col: cell.col, ...range };
    const wasEditing = this.editingId !== null;

    this.store.save(this.matchId, request, this.editingId ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.store.pulse(cell);
          this.toastService.success(wasEditing ? 'Tramo actualizado' : 'Tramo guardado');
          this.resetForm(request.endMinute);
        },
        // El formulario se conserva: el error queda inline junto al botón y además se avisa con un toast.
        error: err => {
          this.serverError = this.messageFrom(err, 'No se pudo guardar el tramo');
          this.toastService.error(this.serverError);
          this.syncSharedState();
        }
      });
  }

  /** Elimina el tramo en edición; "Deshacer" lo vuelve a crear con un POST con los mismos datos. */
  deleteEditing(): void {
    const zone = this.editingId ? this.store.assignments().find(a => a.id === this.editingId) : undefined;
    if (!zone || this.store.isSaving()) return;

    const released = eventsLinkedByRange(zone, this.store.zoneEvents()).length;
    const restore: ZoneAssignmentRequest = {
      row: zone.row, col: zone.col, period: zone.period, startMinute: zone.startMinute, endMinute: zone.endMinute
    };

    this.store.remove(this.matchId, zone.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resetForm();
          this.toastService.success(
            released > 0
              ? `${released} ${released === 1 ? 'evento pasa' : 'eventos pasan'} a "Sin zona".`
              : 'El rango vuelve a ser un hueco.',
            `Tramo ${zoneLabel(zone)} · ${zone.startMinute}′–${zone.endMinute}′ eliminado`,
            UNDO_WINDOW_MS,
            { label: 'Deshacer', handler: () => this.undoDelete(restore) }
          );
        },
        // El formulario conserva lo cargado y la grilla no cambia.
        error: err => this.toastService.error(this.messageFrom(err, 'No se pudo eliminar el tramo'))
      });
  }

  /**
   * Corre desde el toast, que puede sobrevivir al panel: no se cancela si el usuario navega. Si el rango ya lo ocupa
   * otro tramo, avisa sin enviar nada; si lo ocupó otro analista, el 409 del backend llega al mismo aviso.
   */
  private undoDelete(restore: ZoneAssignmentRequest): void {
    const clash = findOverlap(restore, this.store.assignments());
    if (clash) {
      this.toastService.error(`El rango ya está ocupado por el tramo ${describeSegment(clash)}.`, 'No se pudo deshacer');
      return;
    }

    this.store.save(this.matchId, restore).subscribe({
      next: () => this.toastService.success('El tramo volvió al partido.', 'Tramo restaurado'),
      error: err => this.toastService.error(
        this.messageFrom(err, 'No se pudo restaurar el tramo.'),
        'No se pudo deshacer'
      )
    });
  }

  /** Si el foco está en Desde o Hasta y lo escrito aún no llegó al modelo, lo toma antes de validar. */
  private commitTypedMinute(target: EventTarget | null): void {
    if (!(target instanceof HTMLInputElement) || (target.id !== 'zone-start' && target.id !== 'zone-end')) return;
    if (target.value.trim() === '') return;

    const typed = Number(target.value);
    if (!Number.isFinite(typed)) return;
    if (target.id === 'zone-start') this.startMinute = typed;
    else this.endMinute = typed;
    this.serverError = null;
    this.syncSharedState();
  }

  /** El rango cargado si es utilizable: enteros, dentro de 0–80, sin cruzar el entretiempo; con su tiempo deducido. */
  private usableRange(): UsableRange | null {
    const { startMinute, endMinute } = this;
    const period = deduceZonePeriod(startMinute, endMinute);
    if (period === null || startMinute === null || endMinute === null) return null;
    return startMinute >= 0 && endMinute <= TRACK_MINUTES ? { period, startMinute, endMinute } : null;
  }

  /** Propone los próximos 5 minutos libres (o continúa desde `afterMinute`); sin rango si el partido está completo. */
  private applySuggestion(afterMinute?: number): void {
    const range = suggestNextRange(this.store.assignments(), afterMinute, this.store.cuts());
    this.startMinute = range?.start ?? null;
    this.endMinute = range?.end ?? null;
    this.syncSharedState();
  }

  /**
   * Publica en el store lo que otras vistas necesitan del formulario: el tramo que se pisa con el rango actual
   * (null si no hay choque), el tramo en edición y el rango cargado, que la grilla dibuja como vista previa.
   */
  private syncSharedState(): void {
    const range = this.usableRange();
    const clash = range ? findOverlap(range, this.store.assignments(), this.editingId) : null;
    this.store.conflictId.set(clash?.id ?? null);
    this.store.editingId.set(this.editingId);
    this.store.formRange.set(range);
  }

  /** Tras guardar, eliminar o cancelar: la franja queda sin elegir y el rango continúa donde terminó el anterior. */
  private resetForm(afterMinute?: number): void {
    this.sheetOpen = false;
    this.pickAttempted = false;
    this.editingId = null;
    this.serverError = null;
    this.selectedCell.set(null);
    this.applySuggestion(afterMinute);
  }

  private messageFrom(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
