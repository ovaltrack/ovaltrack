import { computeBubblePosition } from './tour-position';

describe('computeBubblePosition', () => {
  const viewport = { width: 1000, height: 800 };
  const bubble = { width: 300, height: 200 };

  it('abre debajo del ancla, centrado en X', () => {
    const anchor = { top: 100, left: 400, width: 200, height: 50 };
    expect(computeBubblePosition(anchor, bubble, viewport, 'bottom', 10))
      .toEqual({ top: 160, left: 350, placement: 'bottom' });
  });

  it('abre arriba cuando se pide y entra', () => {
    const anchor = { top: 500, left: 400, width: 200, height: 50 };
    expect(computeBubblePosition(anchor, bubble, viewport, 'top', 10))
      .toEqual({ top: 290, left: 350, placement: 'top' });
  });

  it('si abajo no entra, pasa al lado opuesto', () => {
    const anchor = { top: 650, left: 400, width: 200, height: 50 };
    expect(computeBubblePosition(anchor, bubble, viewport, 'bottom', 10).placement).toBe('top');
  });

  it('si arriba no entra, pasa abajo', () => {
    const anchor = { top: 20, left: 400, width: 200, height: 50 };
    expect(computeBubblePosition(anchor, bubble, viewport, 'top', 10).placement).toBe('bottom');
  });

  it('a los costados centra en Y', () => {
    const anchor = { top: 300, left: 50, width: 100, height: 100 };
    expect(computeBubblePosition(anchor, bubble, viewport, 'right', 10))
      .toEqual({ top: 250, left: 160, placement: 'right' });
  });

  it('no se sale por los bordes horizontales', () => {
    const anchor = { top: 100, left: 0, width: 40, height: 40 };
    const position = computeBubblePosition(anchor, bubble, viewport, 'bottom', 10);
    expect(position.left).toBe(12);
  });

  it('un ancla enorme que no deja lugar apoya el globo abajo, centrado en X', () => {
    const anchor = { top: 0, left: 0, width: 1000, height: 800 };
    expect(computeBubblePosition(anchor, bubble, viewport, 'bottom'))
      .toEqual({ top: 588, left: 350, placement: 'center' });
  });

  it('center ignora el ancla', () => {
    const anchor = { top: 0, left: 0, width: 10, height: 10 };
    expect(computeBubblePosition(anchor, bubble, viewport, 'center'))
      .toEqual({ top: 300, left: 350, placement: 'center' });
  });
});
