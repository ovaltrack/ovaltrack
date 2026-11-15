import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DonutChart, donutCells } from '../../utils/donut';
import { StatDonutComponent } from '../stat-donut/stat-donut.component';

/**
 * Grilla responsive de donas: tantas columnas como entren con un mínimo de 220 px por dona. Las donas del mismo
 * `group` (propio y rival de un indicador) van en una celda de 280 px como mínimo, con el título una sola vez.
 */
@Component({
  selector: 'app-donut-grid',
  standalone: true,
  imports: [StatDonutComponent],
  templateUrl: './donut-grid.component.html',
  styleUrl: './donut-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonutGridComponent {
  readonly charts = input.required<DonutChart[]>();

  readonly cells = computed(() => donutCells(this.charts()));
  readonly hasPairs = computed(() => this.cells().some(cell => cell.paired));
}
