import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { dataOf } from '../../types/home.types';
import { HomeBoardComponent } from '../../components/board/home-board.component';
import { HomeHudComponent } from '../../components/hud/home-hud.component';
import { HomeTileComponent } from '../../components/tile/home-tile.component';
import { ResultPillComponent } from '../../components/ui/result-pill.component';
import { PlayerHomeDataService } from './player-home-data.service';
import { PlayerHomeStore } from './player-home.store';

/** Inicio del jugador: su último partido y su temporada. */
@Component({
  selector: 'app-player-home',
  standalone: true,
  imports: [HomeHudComponent, HomeBoardComponent, HomeTileComponent, ResultPillComponent],
  providers: [PlayerHomeStore, PlayerHomeDataService],
  templateUrl: './player-home.component.html',
  styleUrls: ['../styles/home-views.css', './player-home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerHomeComponent {
  readonly store = inject(PlayerHomeStore);

  readonly season = computed(() => this.store.summary()?.season ?? null);
  /** Sin partidos jugados en el año la tarjeta se muestra vacía aunque haya un último partido de otra temporada. */
  readonly seasonState = computed(() => {
    const state = this.store.summaryState();
    return state.status === 'ready' && state.data.season.matches === 0 ? { status: 'empty' as const } : state;
  });
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
