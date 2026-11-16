export interface SparklineGeometry {
  /** Puntos del polígono, "x,y x,y ...". */
  points: string;
  /** Último punto (el partido actual), para el marcador. */
  last: { x: number; y: number };
  /** Altura de la línea del promedio previo. */
  averageY: number;
  /** Promedio previo con el que se dibujó la línea. */
  average: number;
}

export const SPARKLINE_PADDING = 5;

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Geometría del mini gráfico (viewBox `ancho × alto`) de una serie: el menor valor abajo y el mayor arriba, con margen.
 * Una serie plana se dibuja a media altura. La línea del promedio es el de los valores anteriores al último, o `average`
 * si se lo pasa (por ejemplo, el de toda la temporada). `null` con menos de 2 valores: no hay línea que dibujar.
 */
export function sparklineGeometry(values: readonly number[], width: number, height: number, average?: number): SparklineGeometry | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const previous = values.slice(0, -1);
  const mean = average ?? previous.reduce((sum, value) => sum + value, 0) / previous.length;

  const stepX = (width - 2 * SPARKLINE_PADDING) / (values.length - 1);
  const yOf = (value: number): number => span === 0 ? height / 2 : height - SPARKLINE_PADDING - ((value - min) / span) * (height - 2 * SPARKLINE_PADDING);
  const points = values.map((value, index) => ({ x: round1(SPARKLINE_PADDING + index * stepX), y: round1(yOf(value)) }));

  return {
    points: points.map(point => `${point.x},${point.y}`).join(' '),
    last: points[points.length - 1],
    averageY: round1(yOf(Math.min(max, Math.max(min, mean)))),
    average: round1(mean)
  };
}
