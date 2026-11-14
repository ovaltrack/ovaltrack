/** Porción de una dona: `display` reemplaza al número en la leyenda (p. ej. "2 de 3"). */
export interface DonutSlice {
  label: string;
  value: number;
  display?: string;
  /** Color CSS listo para `stroke`: siempre sale de tokens del sistema de diseño. */
  color: string;
}

/** Porción sin color: el color lo asigna la fábrica según el equipo y la cantidad de porciones. */
export interface DonutSliceInput {
  label: string;
  value: number;
  display?: string;
  /** Porción de relleno ("Otros", "Sin completar"): se pinta en neutro y no entra en la rampa del equipo. */
  muted?: boolean;
}

/** Equipo al que pertenece una dona de reparto o de avance: se muestra en su propia línea, con su color. */
export interface DonutTeam {
  name: string;
  /** Color CSS del equipo (`var(--…)`). */
  color: string;
}

export interface DonutChart {
  id: string;
  title: string;
  /** Solo en las donas de un único equipo; las de propio contra rival nombran a ambos en la leyenda. */
  team?: DonutTeam;
  slices: DonutSlice[];
  /** Valor que equivale al círculo completo: la suma en las de reparto, 100 en las de avance. */
  max: number;
  /** Texto del centro: el total en las de reparto, el porcentaje en las de avance. */
  center: { value: string; label: string };
  /** `share` reparte un total entre categorías; `gauge` muestra un porcentaje sobre 100. */
  variant: 'share' | 'gauge';
  /** `false` oculta el porcentaje de la leyenda cuando el valor ya es un porcentaje (p. ej. la posesión). */
  showPercent?: boolean;
}

/** Porción lista para dibujar con `stroke-dasharray` y `stroke-dashoffset`. */
export interface DonutSegment extends DonutSlice {
  percent: number;
  dash: number;
  gap: number;
  offset: number;
}

/** Propio vs rival de una misma cantidad; las filas de estadísticas (`StatLine`) ya cumplen esta forma. */
export interface VersusValues {
  ownValue: number;
  opponentValue: number;
  own?: string;
  opponent?: string;
}

export interface VersusNames {
  own: string;
  opponent: string;
}

/** Variables de color de cada equipo (las mismas de `.text-own` y `.text-opp`). */
export const OWN_COLOR_VAR = '--btn-primary-bg';
export const RIVAL_COLOR_VAR = '--team-rival';

export const OTHERS_LABEL = 'Otros';
export const DEFAULT_MAX_SLICES = 6;

const MUTED_COLOR = 'var(--border-strong)';
/** Intensidad (%) del color del equipo en cada porción, de la mayor a la menor. */
const TONE_PERCENTS = [100, 82, 66, 52, 40, 30, 22, 16];

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

const formatPercent = (value: number): string => `${Math.round(value * 10) / 10}%`;

/**
 * Porcentajes enteros que suman 100 (método del mayor resto), para que la leyenda no muestre 99 % ni 101 %.
 * Sin total devuelve ceros.
 */
export function roundedPercents(values: number[]): number[] {
  const total = sum(values);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map(value => (value / total) * 100);
  const floors = exact.map(Math.floor);
  const missing = Math.round(100 - sum(floors));
  const winners = new Set(
    exact
      .map((value, index) => ({ index, remainder: value - floors[index] }))
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, missing)
      .map(entry => entry.index)
  );
  return floors.map((value, index) => (winners.has(index) ? value + 1 : value));
}

/** Porcentaje de cada porción sobre `max`; lo que falta para completar el círculo no se informa. */
export function slicePercents(slices: DonutSlice[], max: number): number[] {
  const values = slices.map(slice => Math.max(0, slice.value));
  const remainder = Math.max(0, max - sum(values));
  return roundedPercents([...values, remainder]).slice(0, slices.length);
}

/** Tramos del anillo en orden, con las porciones sin valor en largo cero (siguen en la leyenda). */
export function donutSegments(slices: DonutSlice[], circumference: number, max: number): DonutSegment[] {
  const percents = slicePercents(slices, max);
  const lengths = slices.map(slice => (max > 0 ? (Math.max(0, slice.value) / max) * circumference : 0));
  return slices.map((slice, index) => ({
    ...slice,
    percent: percents[index],
    dash: lengths[index],
    gap: circumference - lengths[index],
    offset: sum(lengths.slice(0, index)),
  }));
}

export function isEmptyDonut(chart: DonutChart): boolean {
  return chart.slices.every(slice => slice.value <= 0);
}

/**
 * Deja las `max` porciones más grandes en su orden original y junta el resto en «Otros» (al final).
 * Una dona con muchas porciones pequeñas no se puede leer.
 */
export function limitSlices(slices: DonutSliceInput[], max = DEFAULT_MAX_SLICES): DonutSliceInput[] {
  if (slices.length <= max) return slices;

  const keep = new Set(
    slices
      .map((slice, index) => ({ index, value: slice.value }))
      .sort((a, b) => b.value - a.value || a.index - b.index)
      .slice(0, max - 1)
      .map(entry => entry.index)
  );
  const kept = slices.filter((_, index) => keep.has(index));
  const rest = slices.filter((_, index) => !keep.has(index));
  return [...kept, { label: OTHERS_LABEL, value: sum(rest.map(slice => slice.value)), muted: true }];
}

/**
 * Rampa de `count` tonos del color de un equipo, de más a menos intenso. Se mezcla con la superficie de la tarjeta
 * en vez de inventar colores, así sigue el tema claro y el oscuro.
 */
export function teamTones(colorVar: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const percent = TONE_PERCENTS[Math.min(index, TONE_PERCENTS.length - 1)];
    return percent === 100 ? `var(${colorVar})` : `color-mix(in srgb, var(${colorVar}) ${percent}%, var(--surface))`;
  });
}

/** Dos porciones, propio y rival, con el color de cada equipo. El centro suma ambas. */
export function versusDonut(id: string, title: string, values: VersusValues, names: VersusNames): DonutChart {
  const total = values.ownValue + values.opponentValue;
  return {
    id,
    title,
    slices: [
      { label: names.own, value: values.ownValue, display: values.own, color: `var(${OWN_COLOR_VAR})` },
      { label: names.opponent, value: values.opponentValue, display: values.opponent, color: `var(${RIVAL_COLOR_VAR})` },
    ],
    max: total,
    center: { value: `${total}`, label: 'total' },
    variant: 'share',
  };
}

/** Reparte un total entre categorías con la rampa de un equipo; las muchas porciones chicas van a «Otros». */
export function shareDonut(
  id: string,
  title: string,
  items: DonutSliceInput[],
  colorVar: string,
  maxSlices = DEFAULT_MAX_SLICES
): DonutChart {
  const limited = limitSlices(items, maxSlices);
  const tones = teamTones(colorVar, limited.filter(item => !item.muted).length);
  const slices = limited.reduce<DonutSlice[]>((result, item) => {
    const colored = result.filter(slice => slice.color !== MUTED_COLOR).length;
    const color = item.muted ? MUTED_COLOR : tones[colored];
    return [...result, { label: item.label, value: item.value, display: item.display, color }];
  }, []);
  const total = sum(slices.map(slice => slice.value));
  return { id, title, slices, max: total, center: { value: `${total}`, label: 'total' }, variant: 'share' };
}

/** Anillo de avance de un porcentaje (0–100). Sin dato (`null`) queda vacío con «—» en el centro. */
export function gaugeDonut(id: string, title: string, percent: number | null, colorVar: string): DonutChart {
  if (percent === null) {
    return { id, title, slices: [], max: 100, center: { value: '—', label: '' }, variant: 'gauge' };
  }
  const value = Math.min(100, Math.max(0, percent));
  return {
    id,
    title,
    slices: [{ label: title, value, color: `var(${colorVar})` }],
    max: 100,
    center: { value: formatPercent(value), label: '' },
    variant: 'gauge',
  };
}

/** Asocia la dona a un equipo (línea con su color debajo del título). */
export function withTeam(chart: DonutChart, name: string, colorVar: string): DonutChart {
  return { ...chart, team: { name, color: `var(${colorVar})` } };
}

/** Texto para lectores de pantalla: el anillo es un dibujo y la leyenda se oculta para no repetir. */
export function describeDonut(chart: DonutChart): string {
  const heading = chart.team ? `${chart.title} de ${chart.team.name}` : chart.title;
  if (isEmptyDonut(chart)) return `${heading}: sin datos`;
  if (chart.variant === 'gauge') return `${heading}: ${chart.center.value}`;

  const percents = slicePercents(chart.slices, chart.max);
  const parts = chart.slices.map((slice, index) => `${slice.label} ${slice.display ?? slice.value} (${percents[index]} %)`);
  return `${heading}: ${parts.join(', ')}`;
}
