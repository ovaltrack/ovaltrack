import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GameWeekStep } from '../../domain/game-week';

/** Los 4 pasos de la semana de juego sobre el tablero: hecho (check), actual (borde de acento) o pendiente. */
@Component({
  selector: 'app-board-steps',
  standalone: true,
  templateUrl: './board-steps.component.html',
  styleUrl: './board-steps.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardStepsComponent {
  /** "Semana de juego · Superior · paso 3 de 4". */
  readonly label = input.required<string>();
  readonly steps = input.required<readonly GameWeekStep[]>();
}
