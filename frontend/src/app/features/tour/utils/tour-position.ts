import { AnchorRect, BoxSize, BubblePosition, TourPlacement } from '../types/tour.types';

/** Margen mínimo entre el globo y el borde de la ventana. */
const EDGE = 12;

const FALLBACKS: Record<Exclude<TourPlacement, 'center'>, readonly Exclude<TourPlacement, 'center'>[]> = {
  top: ['top', 'bottom', 'right', 'left'],
  bottom: ['bottom', 'top', 'right', 'left'],
  left: ['left', 'right', 'bottom', 'top'],
  right: ['right', 'left', 'bottom', 'top']
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fits(placement: Exclude<TourPlacement, 'center'>, anchor: AnchorRect, bubble: BoxSize, viewport: BoxSize, gap: number): boolean {
  switch (placement) {
    case 'top':
      return anchor.top - gap - bubble.height >= EDGE;
    case 'bottom':
      return anchor.top + anchor.height + gap + bubble.height <= viewport.height - EDGE;
    case 'left':
      return anchor.left - gap - bubble.width >= EDGE;
    case 'right':
      return anchor.left + anchor.width + gap + bubble.width <= viewport.width - EDGE;
  }
}

function centered(bubble: BoxSize, viewport: BoxSize): BubblePosition {
  return {
    top: Math.max(EDGE, (viewport.height - bubble.height) / 2),
    left: Math.max(EDGE, (viewport.width - bubble.width) / 2),
    placement: 'center'
  };
}

/**
 * Posición del globo (coordenadas de ventana, para `position: fixed`).
 * Prueba el lado pedido, después el opuesto y después los otros dos; si no entra en ninguno, lo apoya abajo.
 */
export function computeBubblePosition(
  anchor: AnchorRect,
  bubble: BoxSize,
  viewport: BoxSize,
  preferred: TourPlacement,
  gap = 14
): BubblePosition {
  if (preferred === 'center') {
    return centered(bubble, viewport);
  }
  const placement = FALLBACKS[preferred].find(side => fits(side, anchor, bubble, viewport, gap));
  if (!placement) {
    // El ancla ocupa casi toda la ventana: el globo va abajo para tapar lo menos posible.
    return {
      top: Math.max(EDGE, viewport.height - bubble.height - EDGE),
      left: Math.max(EDGE, (viewport.width - bubble.width) / 2),
      placement: 'center'
    };
  }

  const maxLeft = viewport.width - bubble.width - EDGE;
  const maxTop = viewport.height - bubble.height - EDGE;
  const centerX = anchor.left + anchor.width / 2 - bubble.width / 2;
  const centerY = anchor.top + anchor.height / 2 - bubble.height / 2;

  switch (placement) {
    case 'top':
      return { top: anchor.top - gap - bubble.height, left: clamp(centerX, EDGE, maxLeft), placement };
    case 'bottom':
      return { top: anchor.top + anchor.height + gap, left: clamp(centerX, EDGE, maxLeft), placement };
    case 'left':
      return { top: clamp(centerY, EDGE, maxTop), left: anchor.left - gap - bubble.width, placement };
    case 'right':
      return { top: clamp(centerY, EDGE, maxTop), left: anchor.left + anchor.width + gap, placement };
  }
}
