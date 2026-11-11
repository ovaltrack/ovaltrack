import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DexieOfflineMatchReader } from '../../data/dexie-offline-match-reader';
import { OfflineMatchReader } from '../../data/offline-match-reader';
import { dataOf } from '../../types/home.types';
import { HomeBoardComponent } from '../../components/board/home-board.component';
import { HomeHudComponent } from '../../components/hud/home-hud.component';
import { HomeTileComponent } from '../../components/tile/home-tile.component';
import { ResultPillComponent } from '../../components/ui/result-pill.component';
import { AdminHomeDataService } from './admin-home-data.service';
import { AdminHomeStore } from './admin-home.store';

/** Inicio del administrador del club: tablero del día, Bandeja y Divisiones. */
@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [RouterLink, HomeHudComponent, HomeBoardComponent, HomeTileComponent, ResultPillComponent],
  providers: [AdminHomeStore, AdminHomeDataService, { provide: OfflineMatchReader, useClass: DexieOfflineMatchReader }],
  templateUrl: './admin-home.component.html',
  styleUrls: ['../styles/home-views.css', './admin-home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminHomeComponent {
  readonly store = inject(AdminHomeStore);

  readonly inbox = computed(() => dataOf(this.store.inboxState()) ?? []);
  readonly cards = computed(() => dataOf(this.store.divisionsState()) ?? []);
  readonly divisionCount = computed(() => this.store.divisions().length);

  /** El botón "Asignar" es el primario solo para la división que eligen las reglas; el resto, outline. */
  isPrimaryAssign(route: string): boolean {
    const primary = this.store.primary();
    return primary?.target === 'inbox-tile' && primary.route === route;
  }

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
