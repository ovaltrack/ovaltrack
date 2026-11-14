import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DonutChart } from '../../utils/donut';
import { StatDonutComponent } from '../stat-donut/stat-donut.component';

/** Grilla responsive de donas: tantas columnas como entren con un mínimo de 220 px por dona. */
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
}
