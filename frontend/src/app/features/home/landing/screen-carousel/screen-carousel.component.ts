import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { LandingScreen } from '../landing-content';

/**
 * Carrusel de capturas de la app: una pantalla por vista, con pestañas (patrón "tabbed carousel" de WAI-ARIA),
 * flechas, deslizamiento nativo con scroll-snap y flechas del teclado. Sin autoplay: avanza cuando el usuario quiere.
 */
@Component({
  selector: 'app-screen-carousel',
  standalone: true,
  templateUrl: './screen-carousel.component.html',
  styleUrl: './screen-carousel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScreenCarouselComponent {
  readonly screens = input.required<readonly LandingScreen[]>();

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly tabList = viewChild.required<ElementRef<HTMLElement>>('tabList');

  readonly activeIndex = signal(0);
  readonly isFirst = computed(() => this.activeIndex() === 0);
  readonly isLast = computed(() => this.activeIndex() === this.screens().length - 1);
  readonly counter = computed(() => `${this.activeIndex() + 1} / ${this.screens().length}`);

  private readonly destroyRef = inject(DestroyRef);
  private frame = 0;
  /** Mientras dura un desplazamiento pedido por código, el scroll no cambia la pantalla activa. */
  private programmaticScroll: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      // Al cambiar el ancho, la pista se re-encastra en la pantalla activa
      const observer = new ResizeObserver(() => this.goTo(this.activeIndex(), 'auto'));
      observer.observe(this.track().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frame);
      this.clearProgrammaticScroll();
    });
  }

  previous(): void {
    this.goTo(this.activeIndex() - 1);
  }

  next(): void {
    this.goTo(this.activeIndex() + 1);
  }

  goTo(index: number, behavior: ScrollBehavior = this.scrollBehavior()): void {
    const target = Math.min(Math.max(index, 0), this.screens().length - 1);
    this.clearProgrammaticScroll();
    this.programmaticScroll = setTimeout(() => (this.programmaticScroll = null), 700);
    this.track().nativeElement.scrollTo({ left: target * this.step(), behavior });
    this.setActive(target);
  }

  /** Agrupa los eventos de scroll (deslizar con el dedo o el trackpad) en un cálculo por cuadro. */
  onScroll(): void {
    if (this.programmaticScroll !== null) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const step = this.step();
      if (step > 0) {
        this.setActive(Math.round(this.track().nativeElement.scrollLeft / step));
      }
    });
  }

  /** Flechas, Inicio y Fin recorren las pantallas, tanto desde la pista como desde las pestañas. */
  onKeydown(event: KeyboardEvent): void {
    const moves: Record<string, () => number> = {
      ArrowRight: () => this.activeIndex() + 1,
      ArrowLeft: () => this.activeIndex() - 1,
      Home: () => 0,
      End: () => this.screens().length - 1
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    this.goTo(move());
    if ((event.target as HTMLElement).getAttribute('role') === 'tab') {
      this.focusActiveTab();
    }
  }

  private clearProgrammaticScroll(): void {
    if (this.programmaticScroll !== null) {
      clearTimeout(this.programmaticScroll);
      this.programmaticScroll = null;
    }
  }

  private setActive(index: number): void {
    const clamped = Math.min(Math.max(index, 0), this.screens().length - 1);
    if (clamped === this.activeIndex()) {
      return;
    }
    this.activeIndex.set(clamped);
    this.revealActiveTab();
  }

  /** En celular las pestañas desbordan: se desplaza la fila para que la activa quede a la vista. */
  private revealActiveTab(): void {
    const tab = this.tabList().nativeElement.children.item(this.activeIndex()) as HTMLElement | null;
    tab?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: this.scrollBehavior() });
  }

  private focusActiveTab(): void {
    queueMicrotask(() => {
      const tab = this.tabList().nativeElement.children.item(this.activeIndex()) as HTMLElement | null;
      tab?.focus({ preventScroll: true });
    });
  }

  /** Ancho de una pantalla más el espacio entre pantallas. */
  private step(): number {
    const element = this.track().nativeElement;
    const first = element.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    return first ? first.getBoundingClientRect().width + gap : 0;
  }

  private scrollBehavior(): ScrollBehavior {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }
}
