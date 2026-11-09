import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ComparisonRow, toneCounts } from '../../utils/player-comparison';

/** Métricas del jugador frente al promedio del plantel: valor, barras y si está por encima o por debajo. */
@Component({
  selector: 'app-player-comparison-card',
  standalone: true,
  templateUrl: './player-comparison-card.component.html',
  styleUrl: './player-comparison-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComparisonCardComponent {
  readonly rows = input.required<ComparisonRow[]>();
  readonly title = input<string>('Comparación con el plantel');
  readonly subtitle = input<string>('');
  readonly squadLabel = input<string>('Plantel');

  readonly counts = computed(() => toneCounts(this.rows()));
}
