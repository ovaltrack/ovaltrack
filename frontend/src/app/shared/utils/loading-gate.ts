import { signal } from '@angular/core';

/** Tiempos de carga comunes a las vistas que esperan datos (post-partido, selección de partidos). */
export const LOADING_INDICATOR_DELAY_MS = 100;
export const LOADING_INDICATOR_MIN_VISIBLE_MS = 400;

/**
 * Carga sin parpadeos, compartida por las vistas que esperan datos. `pending` sigue en true mientras la vista espera
 * datos (no se dibuja el contenido); `showIndicator` (la pelota) se enciende solo si la carga supera `delayMs` y, una
 * vez encendido, queda al menos `minVisibleMs`: hasta entonces `pending` tampoco se apaga, así la pelota no aparece y
 * desaparece en un parpadeo. Una carga más rápida que `delayMs` pasa directo al contenido.
 */
export class LoadingGate {
  readonly pending = signal<boolean>(false);
  readonly showIndicator = signal<boolean>(false);

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  constructor(
    private readonly delayMs = LOADING_INDICATOR_DELAY_MS,
    private readonly minVisibleMs = LOADING_INDICATOR_MIN_VISIBLE_MS,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Empieza (o continúa) una carga. Llamarlo de nuevo con la carga en curso no reinicia la espera. */
  start(): void {
    this.clearHideTimer();
    this.pending.set(true);
    if (this.showTimer || this.showIndicator()) return;
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      this.reveal();
    }, this.delayMs);
  }

  /**
   * Muestra el indicador ya, sin esperar `delayMs`, y resuelve cuando quedó pintado. Sirve antes de un trabajo que
   * traba el hilo principal (dibujar cientos de eventos): una animación CSS ya pintada sigue corriendo mientras tanto.
   */
  showNow(): Promise<void> {
    if (!this.pending() || this.showIndicator()) return Promise.resolve();
    this.clearShowTimer();
    this.reveal();
    return afterNextPaint();
  }

  /** Termina la carga. La promesa se resuelve cuando la vista ya puede mostrar el contenido. */
  finish(): Promise<void> {
    this.clearShowTimer();
    const remaining = this.showIndicator() ? this.minVisibleMs - (this.now() - this.shownAt) : 0;
    return new Promise(resolve => {
      const done = () => {
        this.hideTimer = null;
        this.showIndicator.set(false);
        this.pending.set(false);
        resolve();
      };
      if (remaining > 0) {
        this.hideTimer = setTimeout(done, remaining);
      } else {
        done();
      }
    });
  }

  /** Cancela los temporizadores (al destruir la vista). */
  dispose(): void {
    this.clearShowTimer();
    this.clearHideTimer();
  }

  private reveal(): void {
    this.shownAt = this.now();
    this.showIndicator.set(true);
  }

  private clearShowTimer(): void {
    if (this.showTimer) clearTimeout(this.showTimer);
    this.showTimer = null;
  }

  private clearHideTimer(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }
}

/** Resuelve después del próximo cuadro pintado (doble `requestAnimationFrame`). Sin rAF (tests en Node), en el próximo turno. */
export function afterNextPaint(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
