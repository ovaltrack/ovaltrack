/** Niveles de calor de la cancha: escala secuencial de un solo tono en 5 pasos (0 = sin eventos). */
export interface HeatStep {
  level: number;
  label: string;
}

export const HEAT_STEPS: readonly HeatStep[] = [
  { level: 0, label: '0' },
  { level: 1, label: '1–5' },
  { level: 2, label: '6–15' },
  { level: 3, label: '16–30' },
  { level: 4, label: '30+' }
];

const MAX_LEVEL = HEAT_STEPS.length - 1;

/** Nivel 0–4 de una cantidad de eventos, con los cortes de la leyenda: 0 · 1–5 · 6–15 · 16–30 · 30+. */
export function heatLevel(count: number): number {
  if (!(count > 0)) return 0;
  if (count <= 5) return 1;
  if (count <= 15) return 2;
  if (count <= 30) return 3;
  return 4;
}

/** Posición 0–1 dentro de la escala ámbar → naranja; 0 para los niveles sin relleno. */
export function heatMix(level: number): number {
  return level <= 1 ? 0 : Math.min(level - 1, MAX_LEVEL - 1) / (MAX_LEVEL - 1);
}

/** Un nivel de la escala relativa: su rango real («3–5»), y su posición 0–1 en la mezcla ámbar → naranja. */
export interface ScaleStep {
  level: number;
  label: string;
  mix: number;
}

/** Escala de calor ajustada a los valores que se están mostrando: reparte los niveles en cuartiles del máximo actual. */
export interface HeatScale {
  steps: readonly ScaleStep[];
  levelOf(count: number): number;
}

export function heatScale(values: readonly number[]): HeatScale {
  throw new Error('no implementado');
}
