import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatchReviewStore } from '../../store/match-review.store';
import { RUGBY_HALF_TIME_MIN } from '../../utils/match-review.utils';
import { ReviewEventViewModel, ReviewPeriodFilter } from '../../types/match-review.types';

/** Ancho mínimo del campo de búsqueda visible (el CSS lo deja crecer hasta 250px). */
const SEARCH_INLINE_MIN = 220;
/** Ancho mínimo para abrir la búsqueda en la misma fila de los filtros; con menos, los filtros bajan a otra línea. */
const SEARCH_OPEN_MIN = 180;

/**
 * Cómo se muestra la búsqueda según el espacio libre de la barra: campo visible, lupa plegada, abierta en la fila
 * (crece sobre el espacio libre) o abierta con los filtros en una segunda línea.
 */
export type SearchMode = 'inline' | 'collapsed' | 'open' | 'wrapped';

@Component({
  selector: 'app-post-match-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-match-timeline.component.html',
  styleUrls: ['../../styles/filter-pills.css', './post-match-timeline.component.css']
})
export class PostMatchTimelineComponent implements AfterViewInit, OnDestroy {
  readonly store = inject(MatchReviewStore);
  readonly halfTimeMin = RUGBY_HALF_TIME_MIN;

  /** Acción primaria de la vista: abrir el alta de un evento post-partido. */
  readonly addEvent = output<void>();

  @ViewChild('allPeriodPill') private allPeriodPill?: ElementRef<HTMLButtonElement>;
  @ViewChild('filterBar') private filterBar?: ElementRef<HTMLElement>;
  private barObserver?: ResizeObserver;

  /** Espacio libre para la búsqueda: el ancho de la barra menos los filtros y la acción primaria. */
  private readonly searchSpace = signal<number>(Number.POSITIVE_INFINITY);
  /** Los filtros no entran en su lugar y se recortan con scroll horizontal (se marca con un degradado). */
  readonly filtersClipped = signal<boolean>(false);

  getTooltip(occ: ReviewEventViewModel): string {
    if (occ.isUnassigned) {
      return `${occ.matchTimeFormatted} • ${occ.eventTypeName} (Sin jugador asignado • Clic para inspeccionar)`;
    }
    const playerInfo = occ.hasPlayer ? ` • ${occ.playerName}` : (occ.teamPossession === 'OPPONENT' ? ' • Rival' : '');
    return `${occ.matchTimeFormatted} • ${occ.eventTypeName}${playerInfo}`;
  }

  // Eje de marcas en minutos calculado dinámicamente
  readonly timelineTicks = computed<number[]>(() => {
    const max = this.store.matchDurationScale();
    const ticks: number[] = [];
    for (let i = 0; i <= max; i += 10) {
      ticks.push(i);
    }
    // Asegurar que el entretiempo esté presente si el partido es de al menos dicha duración
    if (max >= this.halfTimeMin && !ticks.includes(this.halfTimeMin)) {
      ticks.push(this.halfTimeMin);
      ticks.sort((a, b) => a - b);
    }
    return ticks;
  });

  readonly selectedEventPct = computed<number | null>(() => {
    const selected = this.store.selectedEvent();
    return selected ? selected.pct : null;
  });

  /** La lupa se abrió (solo cuenta cuando la búsqueda no entra como campo visible). */
  readonly searchOpen = signal(false);

  /** Nunca se pliega con texto; sin lugar para abrirla en la fila, los filtros pasan a una segunda línea. */
  readonly searchMode = computed<SearchMode>(() => {
    const space = this.searchSpace();
    if (space >= SEARCH_INLINE_MIN) return 'inline';
    if (!this.searchOpen() && !this.store.filters().searchTerm) return 'collapsed';
    return space >= SEARCH_OPEN_MIN ? 'open' : 'wrapped';
  });

  ngAfterViewInit(): void {
    const bar = this.filterBar?.nativeElement;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    this.barObserver = new ResizeObserver(() => this.measureSearchSpace());
    // La barra cambia con la ventana; los filtros, con su texto (ej. el contador de "Solo sin jugador")
    this.barObserver.observe(bar);
    bar.querySelectorAll('.filter-left-group > *').forEach(item => this.barObserver?.observe(item));
  }

  ngOnDestroy(): void {
    this.barObserver?.disconnect();
  }

  /**
   * Mide con el ancho real: no depende del modo actual (cuenta los filtros por su contenido, incluido el lugar de
   * "Limpiar filtros", y la acción primaria), así que mostrar u ocultar la búsqueda no cambia el resultado.
   */
  private measureSearchSpace(): void {
    const bar = this.filterBar?.nativeElement;
    const left = bar?.querySelector<HTMLElement>('.filter-left-group');
    const right = bar?.querySelector<HTMLElement>('.filter-right-group');
    if (!bar || !left || !right) return;

    const barStyle = getComputedStyle(bar);
    const inner = bar.clientWidth - parseFloat(barStyle.paddingLeft) - parseFloat(barStyle.paddingRight);
    const barGap = parseFloat(barStyle.columnGap) || 0;
    const filters = this.rowWidth(Array.from(left.children) as HTMLElement[], left);

    const fixedItems = (Array.from(right.children) as HTMLElement[])
      .filter(item => !item.matches('.search-toggle, .search-wrapper') && item.offsetWidth > 0);
    const rightGap = parseFloat(getComputedStyle(right).columnGap) || 0;
    // Cada elemento fijo lleva su separación con el anterior, incluida la del lugar de la búsqueda
    const fixed = fixedItems.reduce((sum, item) => sum + this.outerWidth(item) + rightGap, 0);
    const toggle = parseFloat(getComputedStyle(right).getPropertyValue('--toolbar-ctl-h')) || 36;

    const space = Math.floor(inner - filters - barGap - fixed);
    this.searchSpace.set(space);
    // Con la lupa los filtros comparten la fila; con los filtros en otra línea, tienen toda la barra
    const available = this.searchMode() === 'wrapped' ? inner : inner - barGap - fixed - toggle - rightGap;
    this.filtersClipped.set(this.searchMode() !== 'inline' && this.searchMode() !== 'open' && filters > available + 1);
  }

  private rowWidth(items: HTMLElement[], row: HTMLElement): number {
    const visible = items.filter(item => item.offsetWidth > 0);
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    return visible.reduce((sum, item) => sum + this.outerWidth(item), 0) + gap * Math.max(visible.length - 1, 0);
  }

  private outerWidth(item: HTMLElement): number {
    const style = getComputedStyle(item);
    return item.getBoundingClientRect().width + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
  }

  openSearch(input: HTMLInputElement): void {
    this.searchOpen.set(true);
    setTimeout(() => input.focus());
  }

  closeSearchIfEmpty(): void {
    if (!this.store.filters().searchTerm) {
      this.searchOpen.set(false);
    }
  }

  /** Esc cierra la búsqueda solo si está vacía; con texto no hace nada (se borra con la ×). */
  onSearchEscape(event: Event, input: HTMLInputElement): void {
    event.stopPropagation();
    if (this.store.filters().searchTerm) return;
    input.blur();
    this.searchOpen.set(false);
  }

  /** La × interna borra el texto y deja el foco en el campo para seguir escribiendo. */
  clearSearch(input: HTMLInputElement): void {
    this.store.setSearchTerm('');
    input.focus();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.setSearchTerm(input.value);
  }

  /** Vuelve todos los filtros al estado por defecto (búsqueda incluida) y deja el foco en "Todo el partido". */
  clearAllFilters(): void {
    this.store.clearFilters();
    this.searchOpen.set(false);
    // Después del render: con la búsqueda abierta la píldora todavía no está visible
    setTimeout(() => this.allPeriodPill?.nativeElement.focus());
  }

  setPeriod(period: ReviewPeriodFilter): void {
    this.store.setPeriod(period);
  }

  getShortLabel(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('infracción') || lower.includes('penal')) {
      if (lower.includes('palos')) return 'Penal palos';
      return 'Infracción';
    }
    if (lower.includes('tackle')) {
      if (lower.includes('fallado')) return 'Tackle ✗';
      return 'Tackle ✓';
    }
    if (lower.includes('drop')) return 'Drop';
    return name;
  }
}

