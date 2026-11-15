import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DonutChart, describeDonut, donutSegments, isEmptyDonut } from '../../utils/donut';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Con más caracteres que esto («12 – 14», «15/22») el centro no entra en el hueco del anillo más chico. */
const LONG_CENTER = 5;

/** Dona (torta con hueco) en SVG puro: anillo con el total o el porcentaje al centro y leyenda con valor y %. */
@Component({
  selector: 'app-stat-donut',
  standalone: true,
  templateUrl: './stat-donut.component.html',
  styleUrl: './stat-donut.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'chart().title', '[class.donut--untitled]': '!showTitle()' },
})
export class StatDonutComponent {
  readonly chart = input.required<DonutChart>();
  /** `false` dentro de un par: el título lo pone la celda una sola vez. */
  readonly showTitle = input(true);

  readonly radius = RADIUS;
  readonly segments = computed(() => donutSegments(this.chart().slices, CIRCUMFERENCE, this.chart().max));
  readonly isEmpty = computed(() => isEmptyDonut(this.chart()));
  readonly description = computed(() => describeDonut(this.chart()));
  readonly showLegend = computed(() => this.chart().variant === 'share' && !this.isEmpty());
  readonly centerValue = computed(() => (this.isEmpty() && this.chart().variant === 'share' ? '—' : this.chart().center.value));
  readonly longCenter = computed(() => this.centerValue().length > LONG_CENTER);
}
