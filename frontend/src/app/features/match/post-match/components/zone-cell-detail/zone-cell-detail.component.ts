import { Component, input, output } from '@angular/core';
import { ZoneAssignmentResponse, ZoneCellRef } from '../../../types/zone.types';
import { CellEventRow, CellTramoRow } from '../../utils/zone-cell-detail';
import { ZoneMapMode } from '../../utils/zone-stats';
import { UnzonedItem } from '../../utils/zone-unzoned';

/** Qué muestra el detalle: la celda que se señala o la lista de jugadas sin zona. */
export type ZoneDetailView = 'cell' | 'unzoned';

/**
 * Detalle al costado de la cancha: las jugadas (o los tramos, en Minutos) de la celda señalada, o la lista de jugadas
 * sin zona con el motivo de cada una y cómo arreglarla. Presentacional: avisa qué se pidió y no cambia nada.
 */
@Component({
  selector: 'app-zone-cell-detail',
  standalone: true,
  template: ''
})
export class ZoneCellDetailComponent {
  readonly view = input<ZoneDetailView>('cell');
  readonly cell = input<ZoneCellRef | null>(null);
  readonly mode = input<ZoneMapMode>('EVENTS');
  readonly eventRows = input<CellEventRow[]>([]);
  readonly tramoRows = input<CellTramoRow[]>([]);
  readonly unzoned = input<UnzonedItem[]>([]);

  /** Volver del listado de jugadas sin zona al detalle de la celda. */
  readonly closed = output<void>();
  /** Completar el hueco donde cae una jugada sin tramo. */
  readonly gapRequested = output<UnzonedItem>();
  /** Abrir el tramo que no admite la jugada. */
  readonly tramoRequested = output<ZoneAssignmentResponse>();
  /** Ver la jugada en la pantalla de Eventos. */
  readonly eventRequested = output<string>();
}
