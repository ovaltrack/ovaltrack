import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComparisonRow } from '../../utils/player-comparison';

/** Lista de métricas del jugador frente al promedio del plantel: leyenda, valores, barras y veredicto de cada una. */
@Component({
  selector: 'app-comparison-list',
  standalone: true,
  templateUrl: './comparison-list.component.html',
  styleUrl: './comparison-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonListComponent {
  readonly rows = input.required<ComparisonRow[]>();
  readonly playerLabel = input<string>('Jugador');
  readonly squadLabel = input<string>('Plantel');
  /** El promedio se dibuja en gris neutro (`--text-muted`) en lugar de azul atenuado. */
  readonly neutralSquad = input(false);
}
