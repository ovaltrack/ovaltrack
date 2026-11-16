import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ClubAgendaSection } from '../../types/home.types';

/** Agenda del club sobre el tablero: filas por partido agrupadas con separadores («Ahora», «Hoy», «Mañana»). */
@Component({
  selector: 'app-club-agenda',
  standalone: true,
  templateUrl: './club-agenda.component.html',
  styleUrl: './club-agenda.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubAgendaComponent {
  readonly sections = input.required<ClubAgendaSection[]>();
}
