import { Injectable, Injector, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TokenService } from '../../../core/services/token.service';
import { UserContextService } from '../../../core/services/user-context.service';
import { UserRole } from '../../auth/types/auth.types';
import { SCREEN_HELP, screenHelpFor } from '../screen-help';
import { TOUR_STEPS, helpStepsFor, resolveTourSteps } from '../tour-steps';
import { ResolvedTourStep, TourMode, TourProgress, TourState } from '../types/tour.types';
import { TourContextService } from './tour-context.service';

/** Roles que recorren la guía: las pantallas que muestra son del staff del club. */
export const TOUR_ROLES: readonly UserRole[] = ['ADMIN_CLUB', 'COACH_ANALYST'];

/** Pantalla donde arranca sola la primera vez. */
const AUTO_START_URL = '/home';

const INACTIVE: TourState = { active: false, index: 0, mode: 'tour' };

const pathOf = (url: string): string => url.split(/[?#]/)[0];

/** Estado y navegación de la guía: el recorrido completo por las pantallas reales o la ayuda de la pantalla actual. */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);
  private readonly steps = inject(TOUR_STEPS);
  private readonly screenHelp = SCREEN_HELP;
  // Se resuelve al arrancar: así la guía no arrastra el stack HTTP de partidos al iniciar la app.
  private readonly injector = inject(Injector);
  private readonly userContext = inject(UserContextService);
  private readonly tokenService = inject(TokenService);

  private readonly stateSignal = signal<TourState>(INACTIVE);
  private readonly resolvedSteps = signal<readonly ResolvedTourStep[]>([]);
  private returnUrl: string | null = null;
  private starting = false;
  /** Usuario para el que ya se evaluó el arranque automático en esta sesión de la app. */
  private autoStartCheckedFor: string | null = null;

  readonly state: Signal<TourState> = this.stateSignal.asReadonly();
  readonly mode: Signal<TourMode> = computed(() => this.stateSignal().mode);
  readonly currentStep: Signal<ResolvedTourStep | null> = computed(() => {
    const { active, index } = this.stateSignal();
    return active ? this.resolvedSteps()[index] ?? null : null;
  });
  readonly isFirst: Signal<boolean> = computed(() => this.stateSignal().index === 0);
  readonly isLast: Signal<boolean> = computed(() => this.stateSignal().index === this.resolvedSteps().length - 1);
  readonly progress: Signal<TourProgress> = computed(() => ({
    current: this.stateSignal().index + 1,
    total: this.resolvedSteps().length
  }));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(event => {
        this.syncWithUrl(event.urlAfterRedirects);
        this.maybeAutoStart();
      });

    // Con una cuenta nueva (`tutorialPending` del backend), la guía arranca sola al llegar al inicio, una única vez.
    // Se evalúa al tener el contexto y en cada navegación: después del login, cualquiera de los dos puede llegar primero.
    effect(() => {
      const context = this.userContext.userContext();
      if (!context) {
        // Sin sesión (logout): el próximo usuario que entre vuelve a evaluarse.
        this.autoStartCheckedFor = null;
        return;
      }
      untracked(() => this.maybeAutoStart());
    });
  }

  /**
   * Arranca el recorrido completo desde un paso (por defecto el primero) y recuerda de dónde se lanzó.
   * Desde la ayuda de una pantalla, la cierra y abre el recorrido. Devuelve `false` si no hay ningún paso para mostrar.
   */
  async start(fromIndex = 0): Promise<boolean> {
    if (this.stateSignal().active && this.stateSignal().mode === 'tour') {
      return this.goTo(fromIndex);
    }
    if (this.starting) {
      return false;
    }
    this.starting = true;
    try {
      const returnUrl = this.router.url;
      this.stateSignal.set(INACTIVE);
      const steps = resolveTourSteps(this.steps, await this.injector.get(TourContextService).load());
      if (steps.length === 0) {
        return false;
      }
      const index = this.isValidIndex(fromIndex, steps.length) ? fromIndex : 0;
      this.returnUrl = returnUrl;
      this.resolvedSteps.set(steps);
      this.stateSignal.set({ active: true, index, mode: 'tour' });
      await this.router.navigateByUrl(steps[index].url);
      return true;
    } finally {
      this.starting = false;
    }
  }

  /**
   * Botón «?»: explica la pantalla actual. Las del recorrido usan sus pasos; las demás, su ayuda escrita
   * (o un aviso que ofrece el recorrido completo). Nunca navega.
   */
  help(): boolean {
    if (this.starting) {
      return false;
    }
    const path = pathOf(this.router.url);
    const own = helpStepsFor(this.steps, path);
    const steps = own.length > 0 ? own : [screenHelpFor(this.screenHelp, path)];
    this.returnUrl = null;
    this.resolvedSteps.set(steps);
    this.stateSignal.set({ active: true, index: 0, mode: 'help' });
    return true;
  }

  async next(): Promise<void> {
    if (this.isLast()) {
      this.exit();
      return;
    }
    await this.goTo(this.stateSignal().index + 1);
  }

  async prev(): Promise<void> {
    await this.goTo(this.stateSignal().index - 1);
  }

  /** Va a un paso; devuelve `false` si la guía no está activa o el índice no existe. */
  async goTo(index: number): Promise<boolean> {
    const steps = this.resolvedSteps();
    const { active, mode } = this.stateSignal();
    if (!active || !this.isValidIndex(index, steps.length)) {
      return false;
    }
    this.stateSignal.set({ active: true, index, mode });
    if (pathOf(this.router.url) !== steps[index].url) {
      await this.router.navigateByUrl(steps[index].url);
    }
    return true;
  }

  /** Termina (o salta) la guía; el recorrido completo vuelve a la pantalla desde donde se lanzó. */
  exit(): void {
    if (!this.stateSignal().active) {
      return;
    }
    const target = this.stateSignal().mode === 'tour' ? this.returnUrl ?? AUTO_START_URL : null;
    this.finish();
    if (target && this.router.url !== target) {
      void this.router.navigateByUrl(target);
    }
  }

  /**
   * Atrás/adelante del navegador mueve la guía al paso de esa pantalla;
   * salir a una pantalla que no es de la guía la termina sin redirigir.
   */
  private syncWithUrl(url: string): void {
    if (!this.stateSignal().active) {
      return;
    }
    const path = pathOf(url);
    if (this.currentStep()?.url === path) {
      return;
    }
    const index = this.resolvedSteps().findIndex(step => step.url === path);
    if (index >= 0) {
      this.stateSignal.set({ ...this.stateSignal(), index });
    } else {
      this.finish();
    }
  }

  /**
   * Arranque automático, solo para cuentas nuevas: en el inicio, con el contexto cargado y la guía pendiente.
   * Se marca vista apenas arranca: aunque la cierre a mitad, no vuelve a aparecer sola en cada inicio de sesión.
   */
  private maybeAutoStart(): void {
    const context = this.userContext.userContext();
    if (!context || pathOf(this.router.url) !== AUTO_START_URL) {
      return;
    }
    const userId = context.userId || this.tokenService.getPayload()?.userId || null;
    if (!userId || this.autoStartCheckedFor === userId) {
      return;
    }
    this.autoStartCheckedFor = userId;
    if (!context.tutorialPending || !context.club?.id || !TOUR_ROLES.includes(context.role) || this.stateSignal().active) {
      return;
    }
    this.userContext.markTutorialSeen().subscribe();
    void this.start();
  }

  private finish(): void {
    this.stateSignal.set(INACTIVE);
    this.returnUrl = null;
  }

  private isValidIndex(index: number, length: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < length;
  }
}
