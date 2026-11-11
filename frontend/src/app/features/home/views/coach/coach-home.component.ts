import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DexieOfflineMatchReader } from '../../data/dexie-offline-match-reader';
import { OfflineMatchReader } from '../../data/offline-match-reader';
import { analysisTone } from '../../domain/analysis-coverage';
import { dataOf } from '../../types/home.types';
import { HomeBoardComponent } from '../../components/board/home-board.component';
import { HomeHudComponent } from '../../components/hud/home-hud.component';
import { HomeTileComponent } from '../../components/tile/home-tile.component';
import { ResultPillComponent } from '../../components/ui/result-pill.component';
import { CoachHomeDataService } from './coach-home-data.service';
import { CoachHomeStore } from './coach-home.store';

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Inicio del entrenador / analista: tablero y tarjetas Deuda, Pendientes y Forma. */
@Component({
  selector: 'app-coach-home',
  standalone: true,
  imports: [RouterLink, HomeHudComponent, HomeBoardComponent, HomeTileComponent, ResultPillComponent],
  providers: [CoachHomeStore, CoachHomeDataService, { provide: OfflineMatchReader, useClass: DexieOfflineMatchReader }],
  templateUrl: './coach-home.component.html',
  styleUrls: ['../styles/home-views.css', './coach-home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachHomeComponent {
  readonly store = inject(CoachHomeStore);

  readonly ringRadius = RING_RADIUS;
  readonly ringLength = RING_LENGTH;

  readonly debt = computed(() => dataOf(this.store.debtState()));
  readonly form = computed(() => dataOf(this.store.formState()));
  readonly pending = computed(() => dataOf(this.store.pendingState()) ?? []);
  readonly debtTone = computed(() => analysisTone(this.debt()?.percent ?? 100));
  readonly ringDash = computed(() => `${((this.debt()?.percent ?? 0) / 100) * RING_LENGTH} ${RING_LENGTH}`);
  /** El botón de Deuda es el primario solo si las reglas lo eligen; si no, es outline. */
  readonly debtIsPrimary = computed(() => this.store.primary()?.target === 'debt-tile');
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
