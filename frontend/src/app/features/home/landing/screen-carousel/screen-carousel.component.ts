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
import { ThemeService } from '../../../../core/services/theme.service';
import { ScreenshotSources, themedScreenshot } from '../../../../shared/utils/screenshot';

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

/** Botón para girar el cubo hacia arriba o hacia abajo: a qué pantalla lleva. */
export interface VerticalTurn {
  index: number;
  tab: string;
}

/**
 * Carrusel con forma de cubo: cada pantalla es una cara y pasar a la contigua gira el cubo 90°.
 * Las pantallas sin `face` forman el anillo horizontal (se gira arrastrando, con las flechas laterales o
 * ←/→); la de `face: 'top'` queda arriba y la de `face: 'bottom'` abajo (botones ↑/↓ o las flechas del
 * teclado). Arriba y abajo cuelgan de la cara del anillo desde la que se llegó y vuelven a ella.
 * Las caras del anillo se ubican a demanda junto a la activa, así el cubo da la vuelta completa. Sin autoplay.
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

  private readonly theme = inject(ThemeService).theme;
  private readonly scene = viewChild.required<ElementRef<HTMLElement>>('scene');
  private readonly cube = viewChild.required<ElementRef<HTMLElement>>('cube');

  readonly activeIndex = signal(0);
  /** Giro acumulado alrededor del eje vertical: queda de frente la cara del anillo cuyo ángulo coincide. */
  readonly yaw = signal(0);
  /** Giro alrededor del eje horizontal: 90 muestra la cara de arriba, -90 la de abajo, 0 el anillo. */
  readonly pitch = signal(0);
  readonly dragging = signal(false);
  /** Mitad del alto de las caras: la distancia al eje del giro vertical. */
  readonly halfHeight = signal(0);

  /** Ángulo de cada cara del anillo alrededor del eje vertical; se asigna al traerla junto a la activa. */
  private readonly faceAngles = signal<Readonly<Record<number, number>>>({ 0: 0 });
  /** Cara del anillo de la que cuelgan arriba y abajo: a ella se vuelve. */
  private readonly anchor = signal(0);
  /** Caras que siguen visibles mientras termina el giro: la que se va o la que se asomó al arrastrar. */
  private readonly lingering = signal<readonly number[]>([]);

  private readonly topIndex = computed(() => this.screens().findIndex(screen => screen.face === 'top'));
  private readonly bottomIndex = computed(() => this.screens().findIndex(screen => screen.face === 'bottom'));
  /** Índices de las pantallas del anillo horizontal, en orden. */
  private readonly ring = computed(() =>
    this.screens().flatMap((screen, index) => (screen.face ? [] : [index]))
  );

  readonly cubeTransform = computed(
    () =>
      'translateZ(calc(var(--half) * -1)) translateZ(var(--pivot)) ' +
      `rotateX(${-this.pitch()}deg) translateZ(calc(var(--pivot) * -1)) rotateY(${-this.yaw()}deg)`
  );

  readonly faces = computed<CubeFace[]>(() => {
    const angles = this.faceAngles();
    const yaw = this.yaw();
    const pitch = this.pitch();
    const active = this.activeIndex();
    const lingering = this.lingering();
    const anchorYaw = this.angleOf(this.anchor());
    return this.screens().map((screen, index) => {
      const tilt = screen.face === 'top' ? TURN : screen.face === 'bottom' ? -TURN : 0;
      const angle = tilt === 0 ? (angles[index] ?? 0) : anchorYaw;
      const visible = index === active || lingering.includes(index);
      const offset = Math.min((Math.abs(angle - yaw) + Math.abs(tilt - pitch)) / TURN, 1);
      return {
        visible,
        transform:
          tilt === 0
            ? `rotateY(${angle}deg) translateZ(var(--half))`
            : `rotateY(${angle}deg) translateZ(var(--pivot)) rotateX(${tilt}deg) translateZ(var(--half-h))`,
        shade: visible ? offset * 0.45 : 0
      };
    });
  });

  /** Capturas en el tema activo, una por pantalla. */
  readonly images = computed<ScreenshotSources[]>(() =>
    this.screens().map(screen => themedScreenshot(screen.image, this.theme()))
  );

  readonly upTurn = computed(() => this.verticalTurn('top'));
  readonly downTurn = computed(() => this.verticalTurn('bottom'));

  /** Lo que anuncia el lector de pantalla al cambiar de cara. */
  readonly status = computed(() => {
    const screen = this.screens()[this.activeIndex()];
    return screen ? `Pantalla ${this.activeIndex() + 1} de ${this.screens().length}: ${screen.tab}` : '';
  });

  private drag: DragState | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.clearSettle());
    afterNextRender(() => {
      const cube = this.cube().nativeElement;
      this.halfHeight.set(cube.offsetHeight / 2);
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.halfHeight.set(cube.offsetHeight / 2));
      observer.observe(cube);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Flecha derecha: la cara siguiente del anillo; desde arriba o abajo, vuelve al anillo. */
  next(): void {
    this.turnSideways(1);
  }

  previous(): void {
    this.turnSideways(-1);
  }

  up(): void {
    const turn = this.upTurn();
    if (turn) {
      this.goTo(turn.index);
    }
  }

  down(): void {
    const turn = this.downTurn();
    if (turn) {
      this.goTo(turn.index);
    }
  }

  /** Puntos, Inicio y Fin: gira el cubo hacia la pantalla pedida por el camino más corto. */
  goTo(index: number): void {
    const target = Math.min(Math.max(index, 0), this.screens().length - 1);
    const from = this.activeIndex();
    if (target === from) {
      return;
    }
    const targetTilt = this.tiltOf(target);
    if (this.tiltOf(from) === 0 && targetTilt === 0) {
      const ring = this.ring();
      const steps = (ring.indexOf(target) - ring.indexOf(from) + ring.length) % ring.length;
      this.turnTo(target, steps <= ring.length / 2 ? 1 : -1);
      return;
    }
    if (this.tiltOf(from) === 0) {
      this.anchor.set(from);
    } else if (targetTilt === 0) {
      // Vuelve al anillo: la pantalla pedida ocupa el lugar de la cara de la que colgaba la actual
      this.placeFace(target, this.angleOf(this.anchor()));
      this.anchor.set(target);
    }
    // De arriba a abajo (o al revés) pasa por la cara del anillo: también queda visible durante el giro
    const passing = this.tiltOf(from) !== 0 && targetTilt !== 0 ? [from, this.anchor()] : [from];
    this.activeIndex.set(target);
    this.pitch.set(targetTilt);
    this.settle(passing);
  }

  onKeydown(event: KeyboardEvent): void {
    const actions: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      ArrowLeft: () => this.previous(),
      ArrowUp: () => this.up(),
      ArrowDown: () => this.down(),
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

  /** En el anillo el cubo sigue al dedo: arrastrar a la izquierda asoma la cara siguiente por la derecha. */
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
    if (this.tiltOf(this.activeIndex()) !== 0) {
      // Arriba o abajo no giran de costado: soltar vuelve al anillo
      drag.direction = direction;
      return;
    }
    if (direction !== drag.direction) {
      drag.direction = direction;
      const neighbour = this.ringNeighbour(this.activeIndex(), direction);
      this.placeFace(neighbour, drag.base + direction * TURN);
      this.lingering.set([neighbour]);
    }
    const delta = Math.max(-TURN, Math.min(TURN, (-dx / drag.width) * TURN * 1.1));
    this.yaw.set(drag.base + delta);
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
    if (this.tiltOf(from) !== 0) {
      if (Math.abs(event.clientX - drag.startX) / drag.width > COMMIT_RATIO) {
        this.goTo(this.anchor());
      }
      return;
    }
    const neighbour = this.ringNeighbour(from, drag.direction);
    if (Math.abs(this.yaw() - drag.base) / TURN > COMMIT_RATIO) {
      this.activeIndex.set(neighbour);
      this.yaw.set(drag.base + drag.direction * TURN);
      this.settle([from]);
    } else {
      this.yaw.set(drag.base);
      this.settle([neighbour]);
    }
  }

  private turnSideways(direction: Direction): void {
    const active = this.activeIndex();
    if (this.tiltOf(active) !== 0) {
      this.goTo(this.anchor());
      return;
    }
    this.turnTo(this.ringNeighbour(active, direction), direction);
  }

  /** Ubica la cara destino del anillo al costado de la activa y gira el cubo hacia ella. */
  private turnTo(target: number, direction: Direction): void {
    const from = this.activeIndex();
    const base = this.angleOf(from);
    this.placeFace(target, base + direction * TURN);
    this.activeIndex.set(target);
    this.yaw.set(base + direction * TURN);
    this.settle([from]);
  }

  /** A qué pantalla lleva girar hacia arriba (`top`) o hacia abajo (`bottom`) desde la activa. */
  private verticalTurn(side: 'top' | 'bottom'): VerticalTurn | null {
    const active = this.activeIndex();
    const activeFace = this.screens()[active]?.face;
    const opposite = side === 'top' ? 'bottom' : 'top';
    const target =
      activeFace === undefined ? (side === 'top' ? this.topIndex() : this.bottomIndex())
      : activeFace === opposite ? this.anchor()
      : -1;
    const screen = this.screens()[target];
    return screen ? { index: target, tab: screen.tab } : null;
  }

  private settle(lingering: readonly number[]): void {
    this.clearSettle();
    this.lingering.set(lingering);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.lingering.set([]);
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

  /** Inclinación de la cara en su lugar del cubo: 90 arriba, -90 abajo, 0 en el anillo. */
  private tiltOf(index: number): number {
    const face = this.screens()[index]?.face;
    return face === 'top' ? TURN : face === 'bottom' ? -TURN : 0;
  }

  private ringNeighbour(index: number, direction: Direction): number {
    const ring = this.ring();
    const position = ring.indexOf(index);
    return ring[(((position + direction) % ring.length) + ring.length) % ring.length];
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
