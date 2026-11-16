import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FocusInput, FocusView, focusRows } from '../../domain/focus-rows';
import { WidgetState, dataOf } from '../../types/home.types';
import { HomeTileComponent } from '../tile/home-tile.component';
import { SparklineComponent } from '../ui/sparkline.component';

/** «Qué trabajar esta semana»: hasta 3 filas con la variación del último partido contra el promedio de la temporada. */
@Component({
  selector: 'app-focus-card',
  standalone: true,
  imports: [RouterLink, HomeTileComponent, SparklineComponent],
  templateUrl: './focus-card.component.html',
  styleUrl: './focus-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FocusCardComponent {
  readonly state = input.required<WidgetState<FocusInput>>();
  readonly seasonYear = input.required<number>();
  readonly divisionId = input.required<string>();
  readonly online = input.required<boolean>();
  readonly retry = output<void>();

  readonly view = computed<FocusView | null>(() => {
    const data = dataOf(this.state());
    return data ? focusRows(data) : null;
  });
  readonly rowsOf = computed(() => {
    const view = this.view();
    return view?.status === 'rows' ? view.rows : [];
  });
  readonly statisticsRoute = computed(() => `/divisions/${this.divisionId()}/statistics`);
  readonly stableFoot = computed(() => {
    const view = this.view();
    return view && view.status !== 'not-enough' && view.stable.length > 0 ? `Estables: ${view.stable.join(', ').toLowerCase()}.` : null;
  });
}
