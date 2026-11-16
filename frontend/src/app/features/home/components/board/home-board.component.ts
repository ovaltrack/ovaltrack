import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { formatCountdown } from '../../domain/countdown';
import { msUntil } from '../../domain/match-time';
import { isActionEnabled } from '../../domain/primary-action';
import { BoardModel, PrimaryAction, STARTERS_TARGET, SUBSTITUTES_TARGET } from '../../types/home.types';
import { BoardStepsComponent } from './board-steps.component';
import { ClubDayTimelineComponent } from './club-day-timeline.component';

const ONBOARDING_STEPS = ['Crear división', 'Programar partido', 'Capturar en vivo'] as const;

/** Tablero verde del Inicio: cáscara común y una variante por `model.kind`. */
@Component({
  selector: 'app-home-board',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, BoardStepsComponent, ClubDayTimelineComponent],
  templateUrl: './home-board.component.html',
  styleUrl: './home-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeBoardComponent {
  readonly model = input.required<BoardModel>();
  /** Acción primaria de la pantalla; el tablero solo la dibuja si su destino es el tablero. */
  readonly primary = input<PrimaryAction | null>(null);
  readonly online = input(true);
  readonly now = input.required<Date>();

  readonly startersTarget = STARTERS_TARGET;
  readonly substitutesTarget = SUBSTITUTES_TARGET;
  readonly onboardingSteps = ONBOARDING_STEPS;

  readonly boardAction = computed(() => {
    const action = this.primary();
    return action && action.target === 'board' ? action : null;
  });

  readonly actionEnabled = computed(() => {
    const action = this.boardAction();
    return action !== null && isActionEnabled(action, this.online());
  });

  /** Semana de juego del entrenador, si la variante la lleva. */
  readonly week = computed(() => {
    const model = this.model();
    return 'week' in model ? model.week : null;
  });

  /** Cajas de la cuenta regresiva: ["05", "07", "09"]. */
  readonly countdownParts = computed(() => {
    const model = this.model();
    return model.kind === 'match-day' ? formatCountdown(msUntil(model.startsAt, this.now())).split(':') : [];
  });

  /** Paso actual (1 a 3) del onboarding; 0 si no corresponde. */
  readonly onboardingStep = computed(() => {
    const model = this.model();
    if (model.kind !== 'onboarding') return 0;
    return model.step === 'create-division' ? 1 : model.step === 'schedule-match' ? 2 : 0;
  });
}
