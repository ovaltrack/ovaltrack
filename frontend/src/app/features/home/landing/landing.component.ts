import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScreenCarouselComponent } from './screen-carousel/screen-carousel.component';
import { OviAvatarComponent } from '../../tour/ovi-avatar/ovi-avatar.component';
import {
  LANDING_AUDIENCES,
  LANDING_FEATURES,
  LANDING_HIGHLIGHTS,
  LANDING_SCREENS,
  LANDING_STEPS
} from './landing-content';
import { ThemeService } from '../../../core/services/theme.service';
import { themedScreenshot } from '../../../shared/utils/screenshot';

/** Landing pública: presenta el objetivo de OvalTrack y sus funcionalidades a quien todavía no tiene cuenta. */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, ScreenCarouselComponent, OviAvatarComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingComponent {
  readonly highlights = LANDING_HIGHLIGHTS;
  readonly steps = LANDING_STEPS;
  readonly features = LANDING_FEATURES;
  readonly audiences = LANDING_AUDIENCES;
  readonly screens = LANDING_SCREENS;
  readonly year = new Date().getFullYear();

  private readonly theme = inject(ThemeService).theme;
  /** Capturas del hero en el tema activo: estadísticas detrás y carga en vivo adelante. */
  readonly heroBack = computed(() => themedScreenshot('assets/landing/statistics', this.theme()));
  readonly heroFront = computed(() => themedScreenshot('assets/landing/live-capture', this.theme()));

  private readonly featuresSection = viewChild.required<ElementRef<HTMLElement>>('featuresSection');

  /**
   * Lleva a la sección de funcionalidades. Un `href="#features"` no sirve: con `<base href="/">`
   * navega a `/#features`, el router redirige a `/home` y se pierde el ancla.
   */
  showFeatures(): void {
    const section = this.featuresSection().nativeElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }
}
