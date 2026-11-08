import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { LandingScreen } from '../landing-content';

/** Grados que gira el cubo para pasar de una cara a la contigua. */
const TURN = 90;
/** Lo que dura el giro (igual que la transición del CSS). */
const SETTLE_MS = 750;
/** Fracción del giro a partir de la cual soltar el arrastre completa el paso a la cara siguiente. */
const COMMIT_RATIO = 0.15;
/** Píxeles de movimiento antes de decidir si el gesto es un arrastre horizontal o un scroll vertical. */
const DRAG_THRESHOLD = 8;

type Direction = 1 | -1;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  /** Ángulo de la cara activa al empezar: el giro se mide desde ahí. */
  base: number;
  width: number;
  direction: Direction | 0;
  moving: boolean;
}

export interface CubeFace {
  visible: boolean;
  transform: string;
  /** Oscurecimiento de la cara según cuánto se aleja del frente (0 de frente, más al girar). */
  shade: number;
}

/**
 * Carrusel con forma de cubo: cada pantalla es una cara y pasar a la siguiente gira el cubo 90°.
 * Se gira arrastrando (dedo o mouse), con las flechas (solo escritorio), los puntos o el teclado.
 * Las caras se ubican a demanda junto a la activa, así el cubo admite cualquier cantidad de pantallas
 * y da la vuelta completa. Sin autoplay.
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

  private readonly scene = viewChild.required<ElementRef<HTMLElement>>('scene');

  readonly activeIndex = signal(0);
  /** Giro acumulado del cubo en grados: queda de frente la cara cuyo ángulo coincide. */
  readonly rotation = signal(0);
  readonly dragging = signal(false);
  /** Ángulo de cada cara alrededor del eje vertical; se asigna al traerla junto a la activa. */
  private readonly faceAngles = signal<Readonly<Record<number, number>>>({ 0: 0 });
  /** Cara que sigue visible mientras termina el giro: la que se va o la que se asomó al arrastrar. */
  private readonly lingering = signal<number | null>(null);

  readonly cubeTransform = computed(() => `translateZ(calc(var(--half) * -1)) rotateY(${-this.rotation()}deg)`);

  readonly faces = computed<CubeFace[]>(() => {
    const angles = this.faceAngles();
    const rotation = this.rotation();
    const active = this.activeIndex();
    const lingering = this.lingering();
    return this.screens().map((_, index) => {
      const angle = angles[index] ?? 0;
      const visible = index === active || index === lingering;
      const offset = Math.min(Math.abs(angle - rotation) / TURN, 1);
      return {
        visible,
        transform: `rotateY(${angle}deg) translateZ(var(--half))`,
        shade: visible ? offset * 0.45 : 0
      };
    });
  });

  /** Lo que anuncia el lector de pantalla al cambiar de cara. */
  readonly status = computed(() => {
    const screen = this.screens()[this.activeIndex()];
    return screen ? `Pantalla ${this.activeIndex() + 1} de ${this.screens().length}: ${screen.tab}` : '';
  });

  private drag: DragState | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearSettle());
  }

  next(): void {
    this.turnTo(this.wrap(this.activeIndex() + 1), 1);
  }

  previous(): void {
    this.turnTo(this.wrap(this.activeIndex() - 1), -1);
  }

  /** Puntos, Inicio y Fin: gira hacia el lado en que está la pantalla pedida. */
  goTo(index: number): void {
    const target = Math.min(Math.max(index, 0), this.screens().length - 1);
    this.turnTo(target, target > this.activeIndex() ? 1 : -1);
  }

  onKeydown(event: KeyboardEvent): void {
    const actions: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      ArrowLeft: () => this.previous(),
      Home: () => this.goTo(0),
      End: () => this.goTo(this.screens().length - 1)
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base: this.angleOf(this.activeIndex()),
      width: this.scene().nativeElement.clientWidth || 1,
      direction: 0,
      moving: false
    };
  }

  /** El cubo sigue al dedo: arrastrar a la izquierda asoma la cara siguiente por la derecha. */
  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const dx = event.clientX - drag.startX;
    if (!drag.moving) {
      if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(event.clientY - drag.startY)) {
        return;
      }
      drag.moving = true;
      this.dragging.set(true);
      this.clearSettle();
      this.scene().nativeElement.setPointerCapture?.(event.pointerId);
    }
    const direction: Direction = dx < 0 ? 1 : -1;
    if (direction !== drag.direction) {
      drag.direction = direction;
      const neighbour = this.wrap(this.activeIndex() + direction);
      this.placeFace(neighbour, drag.base + direction * TURN);
      this.lingering.set(neighbour);
    }
    const delta = Math.max(-TURN, Math.min(TURN, (-dx / drag.width) * TURN * 1.1));
    this.rotation.set(drag.base + delta);
  }

  /** Al soltar, completa el giro si pasó el umbral; si no, el cubo vuelve a su cara. */
  onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    this.drag = null;
    if (!drag.moving || drag.direction === 0) {
      return;
    }
    this.dragging.set(false);
    const from = this.activeIndex();
    const neighbour = this.wrap(from + drag.direction);
    if (Math.abs(this.rotation() - drag.base) / TURN > COMMIT_RATIO) {
      this.activeIndex.set(neighbour);
      this.rotation.set(drag.base + drag.direction * TURN);
      this.settle(from);
    } else {
      this.rotation.set(drag.base);
      this.settle(neighbour);
    }
  }

  /** Ubica la cara destino al costado de la activa y gira el cubo hacia ella. */
  private turnTo(target: number, direction: Direction): void {
    const from = this.activeIndex();
    if (target === from) {
      return;
    }
    const base = this.angleOf(from);
    this.placeFace(target, base + direction * TURN);
    this.activeIndex.set(target);
    this.rotation.set(base + direction * TURN);
    this.settle(from);
  }

  private settle(lingering: number): void {
    this.clearSettle();
    this.lingering.set(lingering);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.lingering.set(null);
    }, this.reducedMotion() ? 0 : SETTLE_MS);
  }

  private clearSettle(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private placeFace(index: number, angle: number): void {
    this.faceAngles.update(angles => ({ ...angles, [index]: angle }));
  }

  private angleOf(index: number): number {
    return this.faceAngles()[index] ?? 0;
  }

  private wrap(index: number): number {
    const total = this.screens().length;
    return ((index % total) + total) % total;
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
