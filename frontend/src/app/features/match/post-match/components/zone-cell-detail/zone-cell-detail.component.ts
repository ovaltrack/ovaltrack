import { Component, computed, input, output } from '@angular/core';
import { ZoneAssignmentResponse, ZoneCellRef } from '../../../types/zone.types';
import { CellEventRow, CellTramoRow } from '../../utils/zone-cell-detail';
import { zoneLabel, zoneName } from '../../utils/zone-grid';
import { ZoneMapMode } from '../../utils/zone-stats';
import { GapGroup, UnzonedItem, describeGapGroup } from '../../utils/zone-unzoned';

/** Qué muestra el detalle: la celda que se señala o la lista de jugadas sin zona. */
export type ZoneDetailView = 'cell' | 'unzoned';

/**
 * Detalle al costado de la cancha: las jugadas (o los tramos, en Minutos) de la celda señalada, o las jugadas sin zona:
 * las que caen en huecos en una línea que lleva a «Huecos sin zona», y el resto una por una con su motivo y cómo
 * arreglarla. Presentacional: avisa qué se pidió y no cambia nada.
 */
@Component({
  selector: 'app-zone-cell-detail',
  standalone: true,
  templateUrl: './zone-cell-detail.component.html',
  styleUrl: './zone-cell-detail.component.css'
})
export class ZoneCellDetailComponent {
  readonly view = input<ZoneDetailView>('cell');
  readonly cell = input<ZoneCellRef | null>(null);
  readonly mode = input<ZoneMapMode>('EVENTS');
  readonly eventRows = input<CellEventRow[]>([]);
  readonly tramoRows = input<CellTramoRow[]>([]);
  /** Jugadas sin zona que los huecos no explican (celda prohibida o sin tiempo). */
  readonly unzoned = input<UnzonedItem[]>([]);
  /** Jugadas sin zona que caen en huecos: se resumen en una línea. */
  readonly inGaps = input<GapGroup>({ events: 0, gaps: 0 });

  readonly unzonedTotal = computed(() => this.unzoned().length + this.inGaps().events);
  /** "22 jugadas en 3 huecos", o null si ninguna cae en un hueco. */
  readonly gapSummary = computed(() => this.inGaps().events > 0 ? describeGapGroup(this.inGaps()) : null);

  /** Nombre de la celda señalada, ej. "C5 · Campo rival" (null si no hay). */
  readonly cellTitle = computed(() => {
    const cell = this.cell();
    return cell ? `${zoneLabel(cell)} · ${zoneName(cell)}` : null;
  });

  /** Volver del listado de jugadas sin zona al detalle de la celda. */
  readonly closed = output<void>();
  /** Ir a «Huecos sin zona» del panel, donde se completan las jugadas que caen en huecos. */
  readonly gapsRequested = output<void>();
  /** Abrir el tramo que no admite la jugada. */
  readonly tramoRequested = output<ZoneAssignmentResponse>();
  /** Ver la jugada en la pantalla de Eventos. */
  readonly eventRequested = output<string>();
}
