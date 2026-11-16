import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DexieOfflineMatchReader } from '../../data/dexie-offline-match-reader';
import { OfflineMatchReader } from '../../data/offline-match-reader';
import { formAverages } from '../../domain/form-record';
import { dataOf } from '../../types/home.types';
import { HomeBoardComponent } from '../../components/board/home-board.component';
import { HomeHudComponent } from '../../components/hud/home-hud.component';
import { FocusCardComponent } from '../../components/cards/focus-card.component';
import { HomeTileComponent } from '../../components/tile/home-tile.component';
import { ResultPillComponent } from '../../components/ui/result-pill.component';
import { CoachHomeDataService } from './coach-home-data.service';
import { CoachHomeStore } from './coach-home.store';

/** Inicio del entrenador / analista: tablero (con la semana de juego y el análisis pendiente) y tarjetas Qué trabajar, Forma y Pendientes. */
@Component({
  selector: 'app-coach-home',
  standalone: true,
  imports: [RouterLink, FocusCardComponent, HomeHudComponent, HomeBoardComponent, HomeTileComponent, ResultPillComponent],
  providers: [CoachHomeStore, CoachHomeDataService, { provide: OfflineMatchReader, useClass: DexieOfflineMatchReader }],
  templateUrl: './coach-home.component.html',
  styleUrls: ['../styles/home-views.css', './coach-home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachHomeComponent {
  readonly store = inject(CoachHomeStore);

  readonly form = computed(() => dataOf(this.store.formState()));
  readonly averages = computed(() => {
    const form = this.form();
    return form ? formAverages(form.record) : null;
  });
  readonly pending = computed(() => dataOf(this.store.pendingState()) ?? []);
  readonly seasonYear = computed(() => this.store.now().getFullYear());

  constructor() {
    this.store.start();

    let wasOnline = this.store.online();
    effect(() => {
      const online = this.store.online();
      if (online && !wasOnline) untracked(() => this.store.reload());
      wasOnline = online;
    });

    // Cuando este dispositivo empieza o deja de capturar un partido, el tablero cambia de variante.
    effect(() => {
      this.store.captureMatchId();
      untracked(() => {
        if (this.store.matchesState().status !== 'loading') this.store.refreshDerived();
      });
    });
  }
}
