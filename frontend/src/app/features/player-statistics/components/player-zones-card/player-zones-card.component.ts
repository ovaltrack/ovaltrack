import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RugbyFieldComponent } from '../../../match/post-match/components/rugby-field/rugby-field.component';
import { PlayerZoneMap } from '../../types/player-stats-api.types';
import { toFieldCells, topZones } from '../../utils/player-comparison';

/** Dónde juega el jugador: calor por zona en la cancha (siempre se ataca a la derecha) y las zonas más frecuentes. */
@Component({
  selector: 'app-player-zones-card',
  standalone: true,
  imports: [RugbyFieldComponent],
  templateUrl: './player-zones-card.component.html',
  styleUrl: './player-zones-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerZonesCardComponent {
  readonly zones = input.required<PlayerZoneMap>();
  readonly ownClubName = input<string>('Mi club');
  readonly opponentName = input<string>('Rival');
  /** Texto de alcance, por ejemplo "Temporada 2026" o "Este partido". */
  readonly scopeLabel = input<string>('');

  readonly cells = computed(() => toFieldCells(this.zones()));
  readonly top = computed(() => topZones(this.zones()));
  readonly totalEvents = computed(() => this.zones().zonedEvents + this.zones().unzonedEvents);
}
