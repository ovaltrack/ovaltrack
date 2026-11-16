import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { HomeBoardComponent } from '../../components/board/home-board.component';
import { HomeHudComponent } from '../../components/hud/home-hud.component';
import { SeasonCardComponent } from '../../components/cards/season-card.component';
import { SquadComparisonCardComponent } from '../../components/cards/squad-comparison-card.component';
import { PlayerHomeDataService } from './player-home-data.service';
import { PlayerHomeStore } from './player-home.store';

/** Inicio del jugador: su último partido, su temporada y cómo se compara con el plantel. */
@Component({
  selector: 'app-player-home',
  standalone: true,
  imports: [HomeHudComponent, HomeBoardComponent, SeasonCardComponent, SquadComparisonCardComponent],
  providers: [PlayerHomeStore, PlayerHomeDataService],
  templateUrl: './player-home.component.html',
  styleUrls: ['../styles/home-views.css', './player-home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerHomeComponent {
  readonly store = inject(PlayerHomeStore);

  readonly boardStatus = computed(() => {
    const status = this.store.summaryState().status;
    return status === 'empty' ? 'ready' : status;
  });

  constructor() {
    this.store.start();

    let wasOnline = this.store.online();
    effect(() => {
      const online = this.store.online();
      if (online && !wasOnline) untracked(() => this.store.reload());
      wasOnline = online;
    });
  }
}
