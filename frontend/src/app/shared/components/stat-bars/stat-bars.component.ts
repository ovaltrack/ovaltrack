import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BarChart, barPercent, describeBars, isEmptyBars, scaleTicks } from '../../utils/bars';

/**
 * Barras horizontales en HTML/CSS puro, para categorías: la etiqueta envuelve (nunca se corta), cada equipo tiene su
 * barra sobre una escala común con el valor como texto, y el eje marca el cero, la mitad y el máximo.
 */
@Component({
  selector: 'app-stat-bars',
  standalone: true,
  templateUrl: './stat-bars.component.html',
  styleUrl: './stat-bars.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatBarsComponent {
  readonly chart = input.required<BarChart>();

  readonly ticks = computed(() => scaleTicks(this.chart()));
  readonly isEmpty = computed(() => isEmptyBars(this.chart()));
  readonly description = computed(() => describeBars(this.chart()));
  /** Una sola serie por categoría (acciones de un jugador): barras un poco más gruesas. */
  readonly single = computed(() => this.chart().groups.every(group => group.values.length === 1));
  /** Ninguna fila lleva etiqueta (el título del gráfico ya la nombra): las barras ocupan todo el ancho. */
  readonly bare = computed(() => this.chart().groups.every(group => !group.label));
  readonly rows = computed(() => {
    const { groups, max } = this.chart();
    return groups.map(group => ({
      label: group.label,
      lines: group.values.map(value => ({
        series: value.series,
        color: value.color,
        display: value.display,
        width: barPercent(value.value, max),
        muted: !value.value,
        drawn: value.value !== null,
      })),
    }));
  });
}
