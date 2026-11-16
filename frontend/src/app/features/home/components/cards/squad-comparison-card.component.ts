import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ComparisonListComponent } from '../../../player-statistics/components/comparison-list/comparison-list.component';
import { SquadComparison } from '../../domain/squad-comparison';
import { WidgetState, dataOf } from '../../types/home.types';
import { HomeTileComponent } from '../tile/home-tile.component';

/** «Vos contra el plantel» del jugador: sus métricas por partido frente al promedio de la división. */
@Component({
  selector: 'app-squad-comparison-card',
  standalone: true,
  imports: [HomeTileComponent, ComparisonListComponent],
  templateUrl: './squad-comparison-card.component.html',
  styleUrl: './squad-comparison-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SquadComparisonCardComponent {
  readonly state = input.required<WidgetState<SquadComparison>>();
  readonly retry = output<void>();

  readonly comparison = computed(() => dataOf(this.state()));
}
