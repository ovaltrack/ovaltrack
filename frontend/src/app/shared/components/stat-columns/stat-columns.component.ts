import { ChangeDetectionStrategy, Component, ElementRef, NgZone, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { observeWidth } from '../../../features/match/post-match/utils/observe-width';
import {
  BarChart,
  barPercent,
  describeBars,
  isEmptyBars,
  labeledColumns,
  scaleTicks,
  showsColumnValues,
} from '../../utils/bars';

/**
 * Columnas en HTML/CSS puro, solo para secuencias en el tiempo (bloques de 10', partidos de una división): una columna
 * por serie dentro de cada grupo, sobre una escala común. Los valores van sobre la columna mientras entren; el detalle
 * de cada grupo queda en su `title` y en el texto accesible.
 */
@Component({
  selector: 'app-stat-columns',
  standalone: true,
  templateUrl: './stat-columns.component.html',
  styleUrl: './stat-columns.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatColumnsComponent {
  readonly chart = input.required<BarChart>();

  private readonly area = viewChild<ElementRef<HTMLElement>>('area');
  private readonly ngZone = inject(NgZone);
  /** Ancho en píxeles del área de columnas (sin el eje Y): decide si entran todas las etiquetas del eje X. */
  private readonly plotWidth = signal(0);

  constructor() {
    effect(onCleanup => {
      const element = this.area()?.nativeElement;
      if (!element) return;
      const stop = observeWidth(element, width => this.ngZone.run(() => this.plotWidth.set(width)));
      onCleanup(stop);
    });
  }

  readonly ticks = computed(() => scaleTicks(this.chart()));
  readonly isEmpty = computed(() => isEmptyBars(this.chart()));
  readonly description = computed(() => describeBars(this.chart()));
  readonly showValues = computed(() => showsColumnValues(this.chart()));
  /** Alguna columna lleva una segunda línea (la sigla del rival): el eje X reserva dos renglones. */
  readonly twoLines = computed(() => this.chart().groups.some(group => !!group.sublabel));
  readonly groups = computed(() => {
    const { groups, max } = this.chart();
    const labeled = new Set(labeledColumns(groups.length, this.plotWidth()));
    return groups.map((group, index) => ({
      label: group.label,
      sublabel: group.sublabel ?? '',
      showLabel: labeled.has(index),
      title: `${group.detail ?? group.label}: ${group.values.map(value => `${value.series} ${value.display}`).join(', ')}`,
      columns: group.values.map(value => ({
        color: value.color,
        display: value.display,
        height: barPercent(value.value, max),
        muted: !value.value,
        drawn: value.value !== null,
      })),
    }));
  });
}
