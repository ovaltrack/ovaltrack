import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, NgZone, computed, effect, inject, signal, untracked, viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';
import { OviAvatarComponent } from '../ovi-avatar/ovi-avatar.component';
import { TourService } from '../services/tour.service';
import { AnchorRect, BubblePosition, ResolvedTourStep } from '../types/tour.types';
import { computeBubblePosition } from '../utils/tour-position';
import { waitForAnchor } from '../utils/wait-for-anchor';
import { ThemeService } from '../../../core/services/theme.service';
import { ScreenshotSources, themedScreenshot } from '../../../shared/utils/screenshot';

/** Debajo de este ancho el globo pasa a ser una hoja fija abajo. */
const SHEET_QUERY = '(max-width: 640px)';
/** Aire alrededor del elemento resaltado. */
const SPOT_PADDING = 8;

/** Globo de la guía con Ovi, anclado al elemento que explica cada paso. Se monta una vez en `AppComponent`. */
@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [OviAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tour-overlay.component.html',
  styleUrl: './tour-overlay.component.css'
})
export class TourOverlayComponent {
  private readonly tour = inject(TourService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService).theme;

  readonly step = this.tour.currentStep;
  readonly progress = this.tour.progress;
  readonly isFirst = this.tour.isFirst;
  readonly isLast = this.tour.isLast;
  readonly mode = this.tour.mode;

  readonly spot = signal<AnchorRect | null>(null);
  readonly position = signal<BubblePosition | null>(null);
  readonly isSheet = signal(false);
  readonly isReady = computed(() => this.isSheet() || this.position() !== null);
  readonly progressPercent = computed(() => (this.progress().current / this.progress().total) * 100);

  private readonly bubble = viewChild<ElementRef<HTMLElement>>('bubble');
  private anchor: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private run = 0;
  /** Mientras la pantalla carga el ancla, el globo no se dibuja (si no, aparece al centro y salta). */
  private waitingAnchor = false;

  constructor() {
    effect(() => {
      const step = this.step();
      untracked(() => void this.showStep(step));
    }, { allowSignalWrites: true });

    merge(fromEvent(window, 'resize'), fromEvent(window, 'scroll', { capture: true, passive: true }))
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.scheduleReposition());

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      cancelAnimationFrame(this.frame);
    });
  }

  next(): void {
    void this.tour.next();
  }

  prev(): void {
    void this.tour.prev();
  }

  exit(): void {
    this.tour.exit();
  }

  /** Desde la ayuda de una pantalla: pasa al recorrido completo. */
  fullTour(): void {
    void this.tour.start();
  }

  /** La captura de una vista previa cambia el alto del globo al cargar: se vuelve a centrar. */
  /** Vista previa en el tema activo. */
  shot(base: string): ScreenshotSources {
    return themedScreenshot(base, this.theme());
  }

  onShotLoad(): void {
    this.scheduleReposition();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.step()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (event.key === 'Escape') {
      event.preventDefault();
      this.exit();
    } else if (event.key === 'ArrowRight' && !typing) {
      event.preventDefault();
      this.next();
    } else if (event.key === 'ArrowLeft' && !typing) {
      event.preventDefault();
      this.prev();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private async showStep(step: ResolvedTourStep | null): Promise<void> {
    const run = ++this.run;
    this.waitingAnchor = false;
    this.resizeObserver?.disconnect();
    this.anchor = null;
    this.spot.set(null);
    this.position.set(null);
    if (!step) {
      return;
    }

    if (step.placement !== 'center') {
      this.waitingAnchor = true;
      // Fuera de la zona: si cada mutación disparara la detección de cambios, una pantalla que re-renderiza
      // nodos en cada ciclo (estadísticas) entraría en un bucle infinito y congelaría la página.
      const anchor = await this.zone.runOutsideAngular(() => waitForAnchor(`[data-tour="${step.anchor}"]`));
      if (run !== this.run) {
        return;
      }
      this.waitingAnchor = false;
      this.anchor = anchor;
      if (anchor) {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        // Se deja libre el lado donde va el globo: arriba del ancla si abre arriba; si no, abajo (y en teléfono, la hoja).
        const sheet = window.matchMedia?.(SHEET_QUERY).matches ?? false;
        anchor.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: !sheet && step.placement === 'top' ? 'end' : 'start'
        });
        this.resizeObserver = new ResizeObserver(() => this.scheduleReposition());
        this.resizeObserver.observe(anchor);
      }
    }

    requestAnimationFrame(() => {
      if (run !== this.run) {
        return;
      }
      this.reposition();
      this.bubble()?.nativeElement.focus({ preventScroll: true });
    });
  }

  private scheduleReposition(): void {
    if (!this.step() || this.waitingAnchor) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.reposition());
  }

  private reposition(): void {
    const step = this.step();
    const bubble = this.bubble()?.nativeElement;
    if (!step || !bubble) {
      return;
    }
    const sheet = window.matchMedia?.(SHEET_QUERY).matches ?? false;
    this.isSheet.set(sheet);

    const rect = this.anchor?.getBoundingClientRect() ?? null;
    const spot: AnchorRect | null = rect
      ? {
          top: rect.top - SPOT_PADDING,
          left: rect.left - SPOT_PADDING,
          width: rect.width + SPOT_PADDING * 2,
          height: rect.height + SPOT_PADDING * 2
        }
      : null;
    this.spot.set(spot);

    if (sheet) {
      this.position.set(null);
      return;
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const size = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    this.position.set(spot
      ? computeBubblePosition(spot, size, viewport, step.placement)
      : computeBubblePosition({ top: 0, left: 0, width: 0, height: 0 }, size, viewport, 'center'));
  }

  /** El foco no se escapa del globo mientras la guía está abierta. */
  private trapFocus(event: KeyboardEvent): void {
    const bubble = this.bubble()?.nativeElement;
    if (!bubble) {
      return;
    }
    const focusables = Array.from(bubble.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!bubble.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (active === first || active === bubble)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
