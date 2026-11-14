import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { STATS_VIEW_OPTIONS, StatsViewMode, ViewModeOption } from './view-mode';

/** Botón para cambiar cómo se ven las estadísticas de la pantalla (lista, donas o barras). Se usa con `[(mode)]`. */
@Component({
  selector: 'app-view-mode-toggle',
  standalone: true,
  templateUrl: './view-mode-toggle.component.html',
  styleUrl: './view-mode-toggle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewModeToggleComponent {
  readonly mode = model.required<StatsViewMode>();
  readonly options = input<readonly ViewModeOption[]>(STATS_VIEW_OPTIONS);
  /** En celular muestra solo los íconos (para barras de filtros con poco lugar). */
  readonly compact = input(false);
}
