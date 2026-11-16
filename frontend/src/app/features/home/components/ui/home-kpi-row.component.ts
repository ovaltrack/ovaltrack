import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ClubKpi } from '../../domain/club-kpis';
import { WidgetState, dataOf } from '../../types/home.types';
import { HomeTileComponent } from '../tile/home-tile.component';

/** Franja de KPIs del club: números en Mono con su rótulo y una línea de contexto. */
@Component({
  selector: 'app-home-kpi-row',
  standalone: true,
  imports: [HomeTileComponent],
  templateUrl: './home-kpi-row.component.html',
  styleUrl: './home-kpi-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeKpiRowComponent {
  readonly state = input.required<WidgetState<ClubKpi[]>>();
  readonly seasonYear = input.required<number>();
  readonly retry = output<void>();

  readonly kpis = computed(() => dataOf(this.state()) ?? []);
}
