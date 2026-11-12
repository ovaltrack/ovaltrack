import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { NavStop, rowStops, stepMinute, stepRow, stopAt } from '../../utils/zone-nav';
import { ZONE_GRID_COLS, ZONE_HALF_MINUTES, ZoneAssignmentResponse, ZoneCellRef, ZonePeriod } from '../../../types/zone.types';
import { DragRange, dragNewRange, minuteAtPosition, resizeRange } from '../../utils/zone-drag';
import { ZONE_COLUMN_NAMES, zoneLabel } from '../../utils/zone-grid';
import { ZoneEvent, ZonePeriodFilter, eventsInRange } from '../../utils/zone-stats';
import {
  BlockLayout, FixedZoneMark, PeriodGap, TramoCutMark, TRACK_MINUTES, allGaps, blockLabel, blockLayout, countByFranja, describeFixedMark, gapAtMinute, isInWindow, minuteAtOffset,
  minuteToPercent, territoryRows, trackWindow
} from '../../utils/zone-track-layout';

/** Tramo o hueco elegido en una fila de la grilla: `col` es la franja (fila de la grilla) sobre la que se hizo clic. */
export interface TerritoryGapSelection {
  period: ZonePeriod;
  startMinute: number;
  endMinute: number;
  col: number;
}

interface BlockView {
  assignment: ZoneAssignmentResponse;
  left: number;
  width: number;
  label: string;
  aria: string;
}

/** Marca de solo lectura de un evento de zona fija: posición horizontal en % del eje y texto para tooltip y lectores. */
interface MarkView {
  eventId: string;
  left: number;
  aria: string;
}

interface RowView {
  col: number;
  name: string;
  range: string;
  count: number;
  blocks: BlockView[];
  marks: MarkView[];
}

interface Tick {
  minute: number;
  left: number;
  label: string;
}

const TICK_STEP = 10;

/** Desplazamiento horizontal mínimo para que un toque sobre un hueco sea un arrastre y no un clic. */
const DRAG_THRESHOLD_PX = 4;
/** Separación entre el tooltip del arrastre y la fila; el tooltip se mantiene a este margen del borde de la pantalla. */
const TIP_GAP_PX = 8;
const TIP_EDGE_PX = 110;

type ResizeSegment = Pick<ZoneAssignmentResponse, 'id' | 'period' | 'startMinute' | 'endMinute' | 'row' | 'col'>;

/** Estiramiento de un tramo desde una manija: `origin` es el rango al apoyar la manija, para volver con Esc. */
interface ResizeTarget {
  segment: ResizeSegment;
  edge: 'start' | 'end';
  origin: DragRange;
}

/** Posición del cursor del teclado: una franja (fila) y un minuto de partido. */
interface GridCursor {
  col: number;
  minute: number;
}

/** Gesto en curso: crear sobre un hueco (`anchor` es el minuto donde se apoyó el puntero) o estirar un tramo (`resize`). */
interface DragState {
  pointerId: number;
  col: number;
  period: ZonePeriod;
  anchor: number;
  startX: number;
  moved: boolean;
  range: DragRange | null;
  notice: string | null;
  tipX: number;
  tipY: number;
  resize: ResizeTarget | null;
}

/**
 * Grilla de territorio en el tiempo: eje horizontal de 0' a 80' (igual al de Eventos) y una fila por franja de la
 * cancha, con el in-goal rival arriba. Cada tramo es un bloque en su fila; los huecos sin zona se ven rayados a lo
 * alto de toda la grilla. Presentacional: avisa qué se tocó y no guarda nada.
 */
@Component({
  selector: 'app-zone-territory-grid',
  standalone: true,
  templateUrl: './zone-territory-grid.component.html',
  styleUrl: './zone-territory-grid.component.css'
})
export class ZoneTerritoryGridComponent {
  readonly assignments = input<ZoneAssignmentResponse[]>([]);
  /** Eventos de zona fija: se dibujan como marcas de solo lectura sobre la fila de su franja, sin ocupar rango. */
  readonly fixedMarks = input<FixedZoneMark[]>([]);
  /** Cortes por try: línea vertical sobre todas las franjas; el arrastre frena ahí y un tramo que los cruza se marca. */
  readonly cuts = input<TramoCutMark[]>([]);
  /** Eventos ya filtrados por posesión: sus conteos por franja aparecen en cada fila. */
  readonly events = input<ZoneEvent[]>([]);
  /** Todos los eventos del partido: el tooltip del arrastre cuenta los que entran en el rango, sin filtros. */
  readonly allEvents = input<ZoneEvent[]>([]);
  /** El tiempo elegido en los filtros: la otra mitad de la grilla se atenúa y los conteos solo cuentan este tiempo. */
  readonly periodFilter = input<ZonePeriodFilter>('ALL');
  /**
   * Pantalla angosta: con 1T o 2T la grilla muestra solo ese tiempo, para que los bloques tengan ancho tocable. Con
   * "Todo" tocar la grilla no crea ni selecciona: pide cambiar al tiempo tocado (`periodRequested`).
   */
  readonly compact = input(false);
  /** Tramo que se está editando: su bloque lleva un anillo. */
  readonly selectedId = input<string | null>(null);
  /** Franja elegida en el formulario: su fila se resalta y el rango cargado se dibuja ahí. */
  readonly selectedCol = input<number | null>(null);
  /** Tramo que choca con el rango en edición. */
  readonly conflictId = input<string | null>(null);
  /** Celda bajo el cursor en la cancha: sus tramos se destacan y el resto se atenúa. */
  readonly highlightCell = input<ZoneCellRef | null>(null);
  /** Rango cargado en el formulario (minutos acumulados): se dibuja como vista previa. */
  readonly previewRange = input<{ period: ZonePeriod; startMinute: number; endMinute: number } | null>(null);

  readonly segmentSelected = output<ZoneAssignmentResponse>();
  /** Rango del tramo en edición mientras se estira con las manijas: el formulario lo toma, pero no se guarda solo. */
  readonly rangeResized = output<{ startMinute: number; endMinute: number }>();
  /** Tramo bajo el cursor o el foco (null al salir): la cancha resalta su celda. */
  readonly segmentHover = output<string | null>();
  /** Con "Todo" en pantalla angosta: el tiempo (1T o 2T) del minuto tocado, para que la página cambie el filtro. */
  readonly periodRequested = output<ZonePeriod>();
  /** Clic en una fila dentro de un hueco: propone ese hueco y esa franja. */
  readonly gapSelected = output<TerritoryGapSelection>();

  private readonly tracks = viewChild<ElementRef<HTMLElement>>('tracks');

  readonly rowCount = territoryRows().length;

  /** Tramo de partido que se ve en el eje: los 80 minutos o, en pantalla angosta con 1T/2T, un solo tiempo. */
  readonly view = computed(() => trackWindow(this.periodFilter(), this.compact()));
  /** Con "Todo" en pantalla angosta los bloques son chicos: tocar la grilla elige el tiempo en vez de un hueco. */
  readonly pickingPeriod = computed(() => this.compact() && this.periodFilter() === 'ALL');

  /** Divisor del entretiempo; fuera del eje cuando solo se ve un tiempo (queda en el borde). */
  readonly halfMark = computed(() => {
    const mark = minuteToPercent(ZONE_HALF_MINUTES, this.view());
    return mark > 0 && mark < 100 ? mark : null;
  });

  /** Separación de las guías verticales: cada 10 minutos. */
  readonly guideStep = computed(() => `${(TICK_STEP / (this.view().end - this.view().start)) * 100}%`);

  readonly ticks = computed<Tick[]>(() => {
    const { start, end } = this.view();
    return Array.from({ length: (end - start) / TICK_STEP + 1 }, (_, i) => start + i * TICK_STEP).map(minute => ({
      minute,
      left: minuteToPercent(minute, this.view()),
      // En pantalla angosta las etiquetas largas (INICIO, E.T.) no entran: solo el minuto.
      label: this.compact() ? `${minute}′`
        : minute === 0 ? 'INICIO' : minute === ZONE_HALF_MINUTES ? 'E.T.' : minute === TRACK_MINUTES ? 'FIN' : `${minute}′`
    }));
  });

  /** Hueco y franja bajo el puntero (null si está sobre un tramo o fuera de un hueco). */
  private readonly pointed = signal<{ col: number; gap: PeriodGap } | null>(null);

  /** Arrastre en curso (null si no hay). Soltar precarga el formulario; nada se guarda solo. */
  private readonly drag = signal<DragState | null>(null);
  /** Un arrastre ya consumió el gesto: el clic que le sigue no debe precargar el hueco entero. */
  private suppressClick = false;
  /** Cursor del teclado (null hasta que se usa) y si se dibuja: solo con el foco puesto por el teclado. */
  private readonly cursor = signal<GridCursor | null>(null);
  private readonly cursorVisible = signal(false);
  /** Elemento que tiene la captura del puntero durante el gesto (la pista o una manija). */
  private captureElement: HTMLElement | null = null;

  readonly isEmpty = computed(() => this.assignments().length === 0);

  /** Dónde se dibuja el cursor: la parada que lo contiene (tramo o hueco) y, dentro de un hueco, el minuto. */
  readonly cursorView = computed(() => {
    const cursor = this.cursor();
    if (!cursor || !this.cursorVisible()) return null;

    const stop = stopAt(rowStops(this.assignments(), cursor.col), cursor.minute);
    // El tramo en edición se dibuja con el rango del formulario, igual que su bloque.
    const shown = stop?.kind === 'block' ? this.currentRange(stop.assignment) : stop && { startMinute: stop.start, endMinute: stop.end };
    return {
      col: cursor.col,
      rowIndex: this.rows().findIndex(row => row.col === cursor.col),
      stop: shown ? this.layoutOf(shown) : null,
      onBlock: stop?.kind === 'block',
      minute: this.layoutOf({ startMinute: cursor.minute, endMinute: cursor.minute + 1 })
    };
  });

  /** Lo que lee un lector de pantalla al mover el cursor. */
  readonly cursorStatus = computed(() => {
    const cursor = this.cursor();
    if (!cursor || !this.cursorVisible()) return '';

    const franja = ZONE_COLUMN_NAMES[cursor.col - 1];
    const stop = stopAt(rowStops(this.assignments(), cursor.col), cursor.minute);
    if (stop?.kind === 'block') {
      return `${franja}: tramo ${zoneLabel(stop.assignment)}, ${stop.assignment.period}T de ${stop.start}′ a ${stop.end}′. Enter para editar`;
    }
    if (stop?.kind === 'gap') {
      return `${franja}, minuto ${cursor.minute}: hueco sin zona de ${stop.start}′ a ${stop.end}′. Enter para completar desde acá`;
    }
    return `${franja}, minuto ${cursor.minute}: ocupado por un tramo de otra franja`;
  });

  /** Lo que se dibuja mientras se arrastra: el rango en su fila, el tooltip en vivo y el tope si se frenó. */
  readonly dragView = computed(() => {
    const drag = this.drag();
    if (!drag?.moved) return null;
    const range = drag.range;
    const events = range ? eventsInRange(range, this.allEvents()).length : 0;
    return {
      rowIndex: this.rows().findIndex(row => row.col === drag.col),
      layout: range && !drag.resize ? this.layoutOf(range) : null,
      text: range
        ? `${range.startMinute}′–${range.endMinute}′ · ${range.period}T · ${events} ${events === 1 ? 'evento' : 'eventos'}`
        : 'Arrastrá dentro del hueco',
      notice: drag.notice,
      tipX: drag.tipX,
      tipY: drag.tipY
    };
  });

  readonly rows = computed<RowView[]>(() => {
    const counts = countByFranja(this.events(), this.periodFilter());
    const compact = this.compact();
    const blocks = this.assignments().flatMap<BlockView>(assignment => {
      // El bloque que se edita toma el rango del formulario: así las manijas lo mueven en vivo.
      const shown = { ...assignment, ...this.currentRange(assignment) };
      const layout = this.layoutOf(shown);
      if (!layout) return [];
      return [{
        assignment,
        ...layout,
        label: blockLabel(shown, compact),
        aria: `Tramo ${assignment.period}T ${assignment.startMinute}′ a ${assignment.endMinute}′, zona ${zoneLabel(assignment)}. `
          + (this.pickingPeriod() ? `Tocá para ver el ${assignment.period}T` : 'Tocá para editar')
      }];
    });
    const marks = this.fixedMarks().flatMap(mark => {
      const left = minuteToPercent(mark.minute, this.view());
      return left < 0 || left > 100 ? [] : [{ col: mark.cell.col, eventId: mark.eventId, left, aria: describeFixedMark(mark) }];
    });
    return territoryRows().map(row => ({
      ...row,
      count: counts.get(row.col) ?? 0,
      blocks: blocks.filter(block => block.assignment.col === row.col),
      marks: marks.filter(mark => mark.col === row.col)
    }));
  });

  readonly gaps = computed(() => allGaps(this.assignments()).flatMap(gap => {
    const layout = this.layoutOf({ startMinute: gap.start, endMinute: gap.end });
    return layout ? [{ ...gap, ...layout }] : [];
  }));

  /** Mitad que no está en el filtro de tiempo: se cubre con un velo. */
  readonly dimmedHalf = computed<'first' | 'second' | null>(() => {
    const filter = this.periodFilter();
    // Con un solo tiempo a la vista no hay otra mitad que cubrir.
    if (filter === 'ALL' || this.view().end - this.view().start < TRACK_MINUTES) return null;
    return filter === 1 ? 'second' : 'first';
  });

  readonly hoverGap = computed(() => {
    const target = this.pointed();
    if (!target) return null;
    const layout = this.layoutOf({ startMinute: target.gap.start, endMinute: target.gap.end });
    return layout && { rowIndex: this.rows().findIndex(row => row.col === target.col), ...layout };
  });

  /** Vista previa del formulario: en la fila de la franja elegida o, sin franja (`rowIndex` -1), como barra sobre el eje. */
  readonly preview = computed(() => {
    const range = this.previewRange();
    // Al editar, el propio bloque muestra el rango del formulario: no se dibuja una vista previa aparte.
    const layout = range && this.layoutOf(range);
    if (!range || !layout || this.selectedId()) return null;
    const rowIndex = this.rows().findIndex(row => row.col === this.selectedCol());
    return {
      rowIndex,
      ...layout,
      aria: `Rango en edición: ${range.period}T de ${range.startMinute}′ a ${range.endMinute}′`
    };
  });

  /** Posición del rango en el eje que se ve; null si cae en el tiempo que no se muestra. */
  private layoutOf(range: { startMinute: number; endMinute: number }): BlockLayout | null {
    return isInWindow(range, this.view()) ? blockLayout(range, this.view()) : null;
  }

  /** Rango con el que se dibuja un tramo: el del formulario si es el que se está editando, si no el guardado. */
  private currentRange(assignment: ZoneAssignmentResponse): DragRange {
    const live = this.previewRange();
    return assignment.id === this.selectedId() && live
      ? live
      : { period: assignment.period, startMinute: assignment.startMinute, endMinute: assignment.endMinute };
  }

  isLinked(assignment: ZoneAssignmentResponse): boolean {
    const cell = this.highlightCell();
    return !!cell && assignment.row === cell.row && assignment.col === cell.col;
  }

  selectSegment(event: Event, assignment: ZoneAssignmentResponse): void {
    event.stopPropagation();
    // Con "Todo" en pantalla angosta el bloque es demasiado chico para tocarlo: primero se elige el tiempo.
    if (this.pickingPeriod()) {
      this.periodRequested.emit(assignment.period);
      return;
    }
    this.cursor.set({ col: assignment.col, minute: assignment.startMinute });
    this.tracks()?.nativeElement.focus({ preventScroll: true });
    this.segmentSelected.emit(assignment);
  }

  onTracksClick(event: MouseEvent): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (this.pickingPeriod()) {
      this.requestPeriodAt(event);
      return;
    }
    const target = this.targetAt(event);
    if (target) {
      this.cursor.set({ col: target.col, minute: target.gap.start });
      this.gapSelected.emit({ period: target.gap.period, startMinute: target.gap.start, endMinute: target.gap.end, col: target.col });
    }
  }

  onTracksMove(event: MouseEvent): void {
    if (this.drag() || this.pickingPeriod()) return;
    const target = this.targetAt(event);
    const current = this.pointed();
    if (target?.col === current?.col && target?.gap.start === current?.gap.start && target?.gap.period === current?.gap.period) return;
    this.pointed.set(target);
  }

  /** Entra el foco: solo con el teclado se dibuja el cursor; con el mouse la grilla se usa como siempre. */
  onTracksFocus(event: FocusEvent): void {
    if (event.target !== event.currentTarget) return;
    this.cursorVisible.set((event.target as HTMLElement).matches(':focus-visible'));
    if (this.cursor() === null) this.cursor.set(this.initialCursor());
  }

  onTracksBlur(): void {
    this.cursorVisible.set(false);
  }

  /**
   * Teclado: ↑/↓ cambian de franja, ←/→ de tramo o de minuto y Enter abre el tramo o precarga el hueco desde el minuto
   * del cursor. Ctrl/Cmd + Enter y Esc los resuelve la página. Con el foco en un campo de la página no llega nada acá.
   */
  onTracksKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;

    const cursor = this.cursor() ?? this.initialCursor();
    switch (event.key) {
      case 'ArrowUp': this.cursor.set({ ...cursor, col: stepRow(cursor.col, 1) }); break;
      case 'ArrowDown': this.cursor.set({ ...cursor, col: stepRow(cursor.col, -1) }); break;
      case 'ArrowRight': this.cursor.set({ ...cursor, minute: stepMinute(rowStops(this.assignments(), cursor.col), cursor.minute, 1) }); break;
      case 'ArrowLeft': this.cursor.set({ ...cursor, minute: stepMinute(rowStops(this.assignments(), cursor.col), cursor.minute, -1) }); break;
      case 'Enter': this.activate(cursor); break;
      default: return;
    }
    event.preventDefault();
    this.cursorVisible.set(true);
  }

  /** Devuelve el foco a la grilla (ej. al salir de un campo con Esc): sobre el tramo en edición, si lo hay. */
  focusCursor(): void {
    const selected = this.assignments().find(assignment => assignment.id === this.selectedId());
    if (selected) this.cursor.set({ col: selected.col, minute: selected.startMinute });
    else if (this.cursor() === null) this.cursor.set(this.initialCursor());

    this.cursorVisible.set(true);
    this.tracks()?.nativeElement.focus({ preventScroll: true });
  }

  onTracksLeave(): void {
    this.pointed.set(null);
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary || (event.target as HTMLElement).closest('.block')) return;
    this.suppressClick = false;
    if (this.pickingPeriod()) return;

    const target = this.targetAt(event);
    const element = this.tracks()?.nativeElement;
    if (!target || !element) return;

    const rect = element.getBoundingClientRect();
    this.pointed.set(null);
    this.drag.set({
      pointerId: event.pointerId, col: target.col, period: target.gap.period,
      anchor: minuteAtPosition(event.clientX - rect.left, rect.width, this.view()),
      startX: event.clientX, moved: false, range: null, notice: null, tipX: 0, tipY: 0, resize: null
    });
    this.capture(element, event.pointerId);
  }

  /** Apoyar una manija del tramo en edición: empieza a estirarlo desde ese borde. */
  onHandleDown(event: PointerEvent, assignment: ZoneAssignmentResponse, edge: 'start' | 'end'): void {
    if (event.button !== 0 || !event.isPrimary) return;
    event.stopPropagation();
    event.preventDefault();

    const range = this.currentRange(assignment);
    this.pointed.set(null);
    this.suppressClick = false;
    this.drag.set({
      pointerId: event.pointerId, col: assignment.col, period: range.period, anchor: 0, startX: event.clientX,
      moved: false, range: null, notice: null, tipX: 0, tipY: 0,
      resize: { segment: { ...assignment, ...range }, edge, origin: range }
    });
    this.capture(event.currentTarget as HTMLElement, event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag();
    const element = this.tracks()?.nativeElement;
    if (!drag || !element || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD_PX) return;

    const rect = element.getBoundingClientRect();
    const current = minuteAtPosition(event.clientX - rect.left, rect.width, this.view());
    const { range, notice } = drag.resize
      ? resizeRange(this.assignments(), drag.resize.segment, drag.resize.edge, current)
      : dragNewRange(this.assignments(), drag.period, drag.anchor, current);

    // El tooltip es `fixed` (la grilla recorta lo que sobresale): se ubica sobre el centro del rango, encima de su fila.
    const rowIndex = this.rows().findIndex(row => row.col === drag.col);
    const centerMinute = range ? (range.startMinute + range.endMinute) / 2 : current;
    this.drag.set({
      ...drag, moved: true, range, notice,
      tipX: Math.min(Math.max(rect.left + (minuteToPercent(centerMinute, this.view()) / 100) * rect.width, TIP_EDGE_PX), window.innerWidth - TIP_EDGE_PX),
      tipY: rect.top + (rect.height / this.rowCount) * rowIndex - TIP_GAP_PX
    });

    const changed = range && (range.startMinute !== drag.range?.startMinute || range.endMinute !== drag.range?.endMinute);
    if (drag.resize && range && changed) this.rangeResized.emit({ startMinute: range.startMinute, endMinute: range.endMinute });
  }

  /** Soltar precarga el formulario con el rango arrastrado; el guardado lo decide el usuario. */
  onPointerUp(event: PointerEvent): void {
    const drag = this.drag();
    if (!drag || event.pointerId !== drag.pointerId) return;

    this.endDrag();
    // Al estirar, el rango ya viajó al formulario en cada movimiento: soltar no hace nada más.
    if (!drag.moved || drag.resize) return;
    this.suppressClick = true;
    if (drag.range) this.gapSelected.emit({ ...drag.range, col: drag.col });
  }

  onPointerCancel(): void {
    this.cancelDrag();
  }

  /**
   * Cancela el gesto en curso: al crear no precarga nada; al estirar el tramo vuelve al rango que tenía al apoyar la
   * manija. Devuelve true si había un gesto. Lo llama la página con Esc, que decide el orden entre lo que se deshace.
   */
  cancelDrag(): boolean {
    const drag = this.drag();
    if (!drag) return false;

    this.endDrag();
    // Si se sigue sosteniendo el botón, el clic al soltar no debe precargar el hueco.
    this.suppressClick = true;
    if (drag.resize) this.rangeResized.emit({ startMinute: drag.resize.origin.startMinute, endMinute: drag.resize.origin.endMinute });
    return true;
  }

  /** Primera parada de la franja elegida o, sin franja, de la fila de arriba (el in-goal rival). */
  private initialCursor(): GridCursor {
    const col = this.selectedCol() ?? ZONE_GRID_COLS;
    return { col, minute: rowStops(this.assignments(), col)[0]?.start ?? 0 };
  }

  /** Enter: abre el tramo del cursor o precarga el hueco desde el minuto del cursor hasta su fin. */
  private activate(cursor: GridCursor): void {
    const stop: NavStop | null = stopAt(rowStops(this.assignments(), cursor.col), cursor.minute);
    if (stop?.kind === 'block') this.segmentSelected.emit(stop.assignment);
    else if (stop?.kind === 'gap') {
      this.gapSelected.emit({ period: stop.period, startMinute: cursor.minute, endMinute: stop.end, col: cursor.col });
    }
  }

  private capture(element: HTMLElement, pointerId: number): void {
    this.captureElement = element;
    element.setPointerCapture?.(pointerId);
  }

  private endDrag(): void {
    const drag = this.drag();
    if (drag) this.captureElement?.releasePointerCapture?.(drag.pointerId);
    this.captureElement = null;
    this.drag.set(null);
  }

  /** Con "Todo" en pantalla angosta: el tiempo (1T o 2T) del minuto tocado. */
  private requestPeriodAt(event: MouseEvent): void {
    const rect = this.tracks()?.nativeElement.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const minute = minuteAtOffset(event.clientX - rect.left, rect.width, this.view());
    this.periodRequested.emit(minute >= ZONE_HALF_MINUTES ? 2 : 1);
  }

  /** Franja (por la altura del puntero) y hueco (por el minuto) bajo el puntero; null si ese minuto ya tiene tramo. */
  private targetAt(event: MouseEvent): { col: number; gap: PeriodGap } | null {
    const rect = this.tracks()?.nativeElement.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    const rows = territoryRows();
    const rowIndex = Math.min(Math.max(Math.floor(((event.clientY - rect.top) / rect.height) * rows.length), 0), rows.length - 1);
    const gap = gapAtMinute(this.assignments(), minuteAtOffset(event.clientX - rect.left, rect.width, this.view()));
    return gap ? { col: rows[rowIndex].col, gap } : null;
  }
}
