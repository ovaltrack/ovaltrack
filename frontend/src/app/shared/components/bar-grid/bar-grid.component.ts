import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BarChart } from '../../utils/bars';
import { StatBarsComponent } from '../stat-bars/stat-bars.component';
import { StatColumnsComponent } from '../stat-columns/stat-columns.component';

/** Grilla responsive de gráficos de barras: tantas columnas como entren con un mínimo de 280 px por gráfico. */
@Component({
  selector: 'app-bar-grid',
  standalone: true,
  imports: [StatBarsComponent, StatColumnsComponent],
  templateUrl: './bar-grid.component.html',
  styleUrl: './bar-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarGridComponent {
  readonly charts = input.required<BarChart[]>();
}
