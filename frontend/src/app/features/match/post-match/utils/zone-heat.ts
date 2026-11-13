/** Un nivel de la escala: su rango real («3–5») y su posición 0–1 en la mezcla ámbar → naranja (0 sin relleno). */
export interface HeatStep {
  level: number;
  label: string;
  mix: number;
}

/** Escala de calor ajustada a los valores que se muestran: el 0 siempre existe y los demás niveles salen de cuartiles. */
export interface HeatScale {
  steps: readonly HeatStep[];
  levelOf(count: number): number;
}

/** Cantidad máxima de niveles con color: cuartiles. */
const COLOR_LEVELS = 4;

/** Valor que deja `rank` (1-based, por el método de rango más cercano) de los valores ya ordenados. */
function nearestRank(sorted: readonly number[], fraction: number): number {
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}

/** Techos de cada nivel: cada valor distinto si son pocos y, si no, los cuartiles sin repetir. */
function bandCeilings(sorted: readonly number[]): number[] {
  const distinct = [...new Set(sorted)];
  if (distinct.length <= COLOR_LEVELS) return distinct;

  const quartiles = Array.from({ length: COLOR_LEVELS }, (_, i) => nearestRank(sorted, (i + 1) / COLOR_LEVELS));
  return [...new Set(quartiles)];
}

/** Posición 0–1 en la mezcla: el nivel 1 es el ámbar claro y el último, el naranja. */
function mixOf(level: number, levels: number): number {
  return level <= 1 || levels <= 1 ? 0 : (level - 1) / (levels - 1);
}

function labelOf(values: readonly number[]): string {
  const low = values[0];
  const high = values[values.length - 1];
  return low === high ? `${low}` : `${low}–${high}`;
}

/**
 * Escala relativa al máximo del filtro actual: con 51 jugadas (máximo 10) y con 300 el mapa reparte sus tonos igual, y
 * la leyenda muestra los rangos que realmente hay. Ignora ceros, negativos y valores inválidos.
 */
export function heatScale(values: readonly number[]): HeatScale {
  const sorted = values.filter(value => value > 0).sort((a, b) => a - b);
  const ceilings = bandCeilings(sorted);
  const bands = ceilings.map((ceiling, i) =>
    sorted.filter(value => value <= ceiling && (i === 0 || value > ceilings[i - 1])));
  const levels = bands.length;

  return {
    steps: [
      { level: 0, label: '0', mix: 0 },
      ...bands.map((band, i) => ({ level: i + 1, label: labelOf(band), mix: mixOf(i + 1, levels) }))
    ],
    levelOf: count => {
      if (!(count > 0)) return 0;
      const index = ceilings.findIndex(ceiling => count <= ceiling);
      return index === -1 ? levels : index + 1;
    }
  };
}
