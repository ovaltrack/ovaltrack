import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { StatsViewMode } from './view-mode';

/** Botón para cambiar cómo se ven las estadísticas de la pantalla (lista o gráficos). Se usa con `[(mode)]`. */
@Component({
  selector: 'app-view-mode-toggle',
  standalone: true,
  templateUrl: './view-mode-toggle.component.html',
  styleUrl: './view-mode-toggle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewModeToggleComponent {
  readonly mode = model.required<StatsViewMode>();
  readonly listLabel = input('Lista');
  readonly listIcon = input('bi-list-ul');
  readonly chartLabel = input('Gráficos');
  readonly chartIcon = input('bi-pie-chart');
  /** En celular muestra solo los íconos (para barras de filtros con poco lugar). */
  readonly compact = input(false);
}
