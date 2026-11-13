import { CommonModule } from '@angular/common';
import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { ZONE_GRID_COLS, ZONE_GRID_ROWS, ZoneCellRef, ZoneCellSummary } from '../../../types/zone.types';
import { CountTweenDirective } from './count-tween.directive';
import { heatScale } from '../../utils/zone-heat';
import {
  ZONE_COLUMN_METERS, ZONE_FIELD_LENGTH_M, ZONE_FIELD_WIDTH_M, ZONE_ROW_METERS,
  ZONE_ROW_LETTERS, ZONE_ROW_SHORT_NAMES, ZoneCountUnit, describeCount, describeZone, formatEventCount, rowRangeLabel, shortTeamName, zoneLabel
} from '../../utils/zone-grid';

interface FieldCell extends ZoneCellRef {
  label: string;
  count: number;
  countLabel: string;
  /** Posición 0–1 en la escala ámbar → naranja (0 sin relleno). */
  heat: number;
  heatLevel: number;
}

const PX_PER_METER = 10;

/**
 * Cancha de rugby: fondo SVG (solo dibujo) + grilla 3x6 de celdas HTML encima (interacción y accesibilidad).
 * Es presentacional: pinta lo que recibe y avisa qué celda se tocó. Vista relativa: siempre se ataca a la derecha.
 */
@Component({
  selector: 'app-rugby-field',
  standalone: true,
  imports: [CommonModule, CountTweenDirective],
  templateUrl: './rugby-field.component.html',
  styleUrl: './rugby-field.component.css'
})
export class RugbyFieldComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Cantidad por celda (`eventCount`); lo que cuenta —jugadas o minutos— lo dice `unit`. */
  readonly cells = input<ZoneCellSummary[]>([]);
  /** Qué cuentan las celdas: jugadas (por defecto) o minutos cubiertos por los tramos. */
  readonly unit = input<ZoneCountUnit>('events');
  readonly selectedCell = input<ZoneCellRef | null>(null);
  readonly ownClubName = input<string>('Mi club');
  readonly opponentName = input<string>('Rival');
  readonly selectable = input<boolean>(true);
  /** Franjas (columnas) que se leen pero no se eligen: el in-goal solo admite puntos, no tramos. */
  readonly lockedCols = input<readonly number[]>([]);
  /** Celda recién guardada: hace un pulso breve. */
  readonly pulseCell = input<ZoneCellRef | null>(null);

  /** Celda que corresponde al tramo bajo el cursor en la timeline o la lista (se resalta como el hover). */
  readonly linkedCell = input<ZoneCellRef | null>(null);

  readonly cellSelected = output<ZoneCellRef>();
  /** Se tocó una celda (también las bloqueadas o en solo lectura): la pantalla fija su detalle. */
  readonly cellInspected = output<ZoneCellRef>();
  /** Celda bajo el cursor o el foco (null al salir): la página resalta sus tramos. */
  readonly cellHover = output<ZoneCellRef | null>();

  // --- Geometría (todo sale de zone-grid) ---
  readonly width = ZONE_FIELD_LENGTH_M * PX_PER_METER;
  readonly height = ZONE_FIELD_WIDTH_M * PX_PER_METER;
  readonly columnTemplate = ZONE_COLUMN_METERS.map(m => `${m}fr`).join(' ');
  readonly rowMeters = ZONE_ROW_METERS;
  readonly rows = Array.from({ length: ZONE_GRID_ROWS }, (_, i) => i + 1);
  readonly cols = Array.from({ length: ZONE_GRID_COLS }, (_, i) => i + 1);
  readonly stripes = Array.from({ length: ZONE_FIELD_LENGTH_M / 10 }, (_, i) => i);

  /** Posición X (px del viewBox) de las líneas de la cancha. */
  readonly goalLineLeft = ZONE_COLUMN_METERS[0] * PX_PER_METER;
  readonly goalLineRight = this.width - ZONE_COLUMN_METERS[5] * PX_PER_METER;
  readonly line22Left = this.goalLineLeft + ZONE_COLUMN_METERS[1] * PX_PER_METER;
  readonly line22Right = this.goalLineRight - ZONE_COLUMN_METERS[4] * PX_PER_METER;
  readonly halfway = this.width / 2;
  readonly line10Left = this.halfway - 10 * PX_PER_METER;
  readonly line10Right = this.halfway + 10 * PX_PER_METER;
  /** Posición Y de las líneas de 5 y 15 m desde cada touch. */
  readonly line5Top = 5 * PX_PER_METER;
  readonly line5Bottom = this.height - 5 * PX_PER_METER;
  readonly line15Top = ZONE_ROW_METERS[0] * PX_PER_METER;
  readonly line15Bottom = this.height - ZONE_ROW_METERS[2] * PX_PER_METER;
  readonly postTop = this.height / 2 - 28;
  readonly postBottom = this.height / 2 + 28;

  // --- Ejes ---
  /** Solo el número de cada columna: nombres y metros ya figuran en las filas de la grilla de territorio. */
  readonly columnAxis = this.cols.map(col => ({ number: col }));
  readonly rowAxis = this.rows.map(row => ({ letter: ZONE_ROW_LETTERS[row - 1], name: ZONE_ROW_SHORT_NAMES[row - 1], range: rowRangeLabel(row), meters: ZONE_ROW_METERS[row - 1] }));

  // --- Estado interno de foco/lectura ---
  private readonly activeCell = signal<ZoneCellRef | null>(null);
  private readonly focusCell = signal<ZoneCellRef | null>(null);

  /** Escala relativa al máximo que se está mostrando (jugadas o minutos): los tonos se reparten entre los valores reales. */
  readonly scale = computed(() => heatScale(this.cells().map(cell => cell.eventCount)));

  readonly fieldRows = computed<FieldCell[][]>(() => {
    const counts = new Map(this.cells().map(c => [`${c.row}-${c.col}`, c.eventCount]));
    const scale = this.scale();

    return this.rows.map(row => this.cols.map(col => {
      const count = counts.get(`${row}-${col}`) ?? 0;
      const level = scale.levelOf(count);
      return { row, col, label: zoneLabel({ row, col }), count, countLabel: formatEventCount(count), heat: scale.steps[level].mix, heatLevel: level };
    }));
  });

  readonly rivalShortName = computed(() => shortTeamName(this.opponentName()) || 'Rival');

  readonly reading = computed(() => {
    const cell = this.activeCell();
    if (!cell) return 'Pasá el cursor o tocá una zona';
    const count = this.cells().find(c => c.row === cell.row && c.col === cell.col)?.eventCount ?? 0;
    return `${describeZone(cell)} · ${describeCount(count, this.unit())}`;
  });

  readonly legendTitle = computed(() => this.unit() === 'minutes' ? 'Minutos por zona' : 'Eventos por zona');

  readonly gridLabel = computed(() => this.selectable()
    ? 'Cancha: elegí la franja y el lateral del tramo'
    : 'Cancha: eventos por zona');

  isLocked(cell: ZoneCellRef): boolean {
    return this.lockedCols().includes(cell.col);
  }

  isSelected(cell: ZoneCellRef): boolean {
    const selected = this.selectedCell();
    return !!selected && selected.row === cell.row && selected.col === cell.col;
  }

  isPulsing(cell: ZoneCellRef): boolean {
    const pulse = this.pulseCell();
    return !!pulse && pulse.row === cell.row && pulse.col === cell.col;
  }

  /** Identidad estable por fila y celda: así el DOM (y la animación del conteo) sobrevive a cada recálculo. */
  trackRow = (index: number): number => index;
  trackCell = (_: number, cell: FieldCell): string => `${cell.row}-${cell.col}`;

  isLinked(cell: ZoneCellRef): boolean {
    const linked = this.linkedCell();
    return !!linked && linked.row === cell.row && linked.col === cell.col;
  }

  /** Tabindex móvil: solo una celda es parada de Tab; las demás se recorren con las flechas. */
  isTabStop(cell: ZoneCellRef): boolean {
    const stop = this.focusCell() ?? this.selectedCell() ?? { row: 1, col: 1 };
    return stop.row === cell.row && stop.col === cell.col;
  }

  select(cell: ZoneCellRef): void {
    if (this.selectable() && !this.isLocked(cell)) {
      this.cellSelected.emit({ row: cell.row, col: cell.col });
      return;
    }
    // Solo lectura: tocar una celda muestra su lectura, igual que el hover (en táctil no hay hover).
    this.onEnter(cell);
  }

  onEnter(cell: ZoneCellRef): void {
    const ref = { row: cell.row, col: cell.col };
    this.activeCell.set(ref);
    this.cellHover.emit(ref);
  }

  onLeave(): void {
    this.activeCell.set(null);
    this.cellHover.emit(null);
  }

  onFocus(cell: ZoneCellRef): void {
    this.focusCell.set({ row: cell.row, col: cell.col });
    this.onEnter(cell);
  }

  onKeydown(event: KeyboardEvent, cell: ZoneCellRef): void {
    const target = this.nextCell(event.key, cell);
    if (target) {
      event.preventDefault();
      this.focusCell.set(target);
      this.host.nativeElement
        .querySelector<HTMLElement>(`[data-row="${target.row}"][data-col="${target.col}"]`)
        ?.focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(cell);
    }
  }

  ariaLabel(cell: FieldCell): string {
    return `${describeZone(cell)}: ${describeCount(cell.count, this.unit())}${this.isLocked(cell) ? '. Solo puntos: no admite tramos' : ''}`;
  }

  private nextCell(key: string, cell: ZoneCellRef): ZoneCellRef | null {
    const clamp = (value: number, max: number) => Math.min(Math.max(value, 1), max);
    switch (key) {
      case 'ArrowRight': return { row: cell.row, col: clamp(cell.col + 1, ZONE_GRID_COLS) };
      case 'ArrowLeft': return { row: cell.row, col: clamp(cell.col - 1, ZONE_GRID_COLS) };
      case 'ArrowDown': return { row: clamp(cell.row + 1, ZONE_GRID_ROWS), col: cell.col };
      case 'ArrowUp': return { row: clamp(cell.row - 1, ZONE_GRID_ROWS), col: cell.col };
      case 'Home': return { row: cell.row, col: 1 };
      case 'End': return { row: cell.row, col: ZONE_GRID_COLS };
      default: return null;
    }
  }
}
