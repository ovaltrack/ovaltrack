import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DivisionStatusRow } from '../../domain/division-status';
import { WidgetState, dataOf } from '../../types/home.types';
import { HomeTileComponent } from '../tile/home-tile.component';
import { ResultPillComponent } from '../ui/result-pill.component';

/** «Estado de las divisiones»: una fila por división; solo se marca lo que no está bien, con ícono y texto. */
@Component({
  selector: 'app-division-status-table',
  standalone: true,
  imports: [RouterLink, HomeTileComponent, ResultPillComponent],
  templateUrl: './division-status-table.component.html',
  styleUrl: './division-status-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DivisionStatusTableComponent {
  readonly state = input.required<WidgetState<DivisionStatusRow[]>>();
  readonly online = input.required<boolean>();
  readonly retry = output<void>();

  readonly rows = computed(() => dataOf(this.state()) ?? []);
}
