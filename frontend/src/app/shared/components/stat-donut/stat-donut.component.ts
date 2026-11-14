import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DonutChart, describeDonut, donutSegments, isEmptyDonut } from '../../utils/donut';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Dona (torta con hueco) en SVG puro: anillo con el total o el porcentaje al centro y leyenda con valor y %. */
@Component({
  selector: 'app-stat-donut',
  standalone: true,
  templateUrl: './stat-donut.component.html',
  styleUrl: './stat-donut.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatDonutComponent {
  readonly chart = input.required<DonutChart>();

  readonly radius = RADIUS;
  readonly segments = computed(() => donutSegments(this.chart().slices, CIRCUMFERENCE, this.chart().max));
  readonly isEmpty = computed(() => isEmptyDonut(this.chart()));
  readonly description = computed(() => describeDonut(this.chart()));
  readonly showLegend = computed(() => this.chart().variant === 'share' && !this.isEmpty());
}
