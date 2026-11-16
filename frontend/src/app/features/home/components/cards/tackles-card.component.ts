import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { StatColumnsComponent } from '../../../../shared/components/stat-columns/stat-columns.component';
import { TackleColumns } from '../../domain/tackle-columns';
import { WidgetState, dataOf } from '../../types/home.types';
import { HomeTileComponent } from '../tile/home-tile.component';

/** «Tus tackles» del jugador: columnas de los tackles completados en sus últimos partidos y el promedio del plantel. */
@Component({
  selector: 'app-tackles-card',
  standalone: true,
  imports: [HomeTileComponent, StatColumnsComponent],
  templateUrl: './tackles-card.component.html',
  styleUrl: './tackles-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TacklesCardComponent {
  readonly state = input.required<WidgetState<TackleColumns>>();
  readonly retry = output<void>();

  readonly columns = computed(() => dataOf(this.state()));
  /** «Últimos 8 partidos»; con menos, la cantidad que haya. */
  readonly label = computed(() => {
    const count = this.columns()?.chart.groups.length ?? 0;
    return count === 1 ? 'Último partido' : count > 1 && count < 8 ? `Últimos ${count} partidos` : 'Últimos 8 partidos';
  });
}
