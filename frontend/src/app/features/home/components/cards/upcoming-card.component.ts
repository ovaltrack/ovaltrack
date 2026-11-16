import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { UpcomingFixture } from '../../domain/upcoming-fixtures';
import { WidgetState, dataOf } from '../../types/home.types';
import { HomeTileComponent } from '../tile/home-tile.component';

/** «Próximas fechas»: hasta 3 partidos por jugar de la división, con el chip de nómina en el primero si está incompleta. */
@Component({
  selector: 'app-upcoming-card',
  standalone: true,
  imports: [HomeTileComponent],
  templateUrl: './upcoming-card.component.html',
  styleUrl: './upcoming-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpcomingCardComponent {
  readonly state = input.required<WidgetState<UpcomingFixture[]>>();
  readonly divisionName = input.required<string>();
  readonly retry = output<void>();

  readonly fixtures = computed(() => dataOf(this.state()) ?? []);
}
