import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SeasonKpi } from '../../domain/season-kpis';
import { WidgetState, dataOf } from '../../types/home.types';
import { HomeTileComponent } from '../tile/home-tile.component';

/** «Mi temporada» del jugador: cinco KPIs en Mono, con un aviso si incluye un partido con el análisis incompleto. */
@Component({
  selector: 'app-season-card',
  standalone: true,
  imports: [HomeTileComponent],
  templateUrl: './season-card.component.html',
  styleUrl: './season-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SeasonCardComponent {
  readonly state = input.required<WidgetState<SeasonKpi[]>>();
  /** «M18 · 2026». */
  readonly label = input.required<string>();
  readonly year = input.required<number>();
  /** Incluye un partido cuyo análisis todavía no está completo. */
  readonly provisional = input(false);
  readonly retry = output<void>();

  readonly kpis = computed(() => dataOf(this.state()) ?? []);
}
