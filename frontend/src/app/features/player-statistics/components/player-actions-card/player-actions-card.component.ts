import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ActionGroup } from '../../utils/player-comparison';

/** Todas las acciones registradas del jugador, agrupadas como en el catálogo de eventos. */
@Component({
  selector: 'app-player-actions-card',
  standalone: true,
  templateUrl: './player-actions-card.component.html',
  styleUrl: './player-actions-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerActionsCardComponent {
  readonly groups = input.required<ActionGroup[]>();
}
