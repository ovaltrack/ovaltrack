import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DonutGridComponent } from '../../../../shared/components/donut-grid/donut-grid.component';
import { StatsViewMode } from '../../../../shared/components/view-mode-toggle/view-mode';
import { ActionGroup, toActionDonuts } from '../../utils/player-comparison';

/** Todas las acciones registradas del jugador, agrupadas como en el catálogo de eventos. */
@Component({
  selector: 'app-player-actions-card',
  standalone: true,
  imports: [DonutGridComponent],
  templateUrl: './player-actions-card.component.html',
  styleUrl: './player-actions-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerActionsCardComponent {
  readonly groups = input.required<ActionGroup[]>();
  readonly viewMode = input<StatsViewMode>('list');

  readonly charts = computed(() => toActionDonuts(this.groups()));
}
