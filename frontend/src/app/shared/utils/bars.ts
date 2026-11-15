import { DonutTeam, OWN_COLOR_VAR, RIVAL_COLOR_VAR, VersusNames } from './donut';

/** `percent` va siempre de 0 a 100; `count` usa una escala redondeada sobre el mayor valor. */
export type BarUnit = 'count' | 'percent';

/** Valor de una serie dentro de un grupo: `null` = sin dato (no hay barra y se muestra «—»). */
export interface BarValue {
  series: string;
  value: number | null;
  /** Texto que se muestra junto a la barra (p. ej. "2/3" o "85%"). */
  display: string;
  /** Intentos en los tantos que los tienen: el carril claro mide los intentos y la barra, los convertidos (`value`). */
  of?: number;
  /** Color CSS listo para `background`: siempre sale de tokens del sistema de diseño. */
  color: string;
}

/** Una categoría (barras horizontales) o un partido o bloque de tiempo (columnas). */
export interface BarGroup {
  /** Vacía cuando el título del gráfico ya nombra la única fila (una cantidad de propio contra rival). */
  label: string;
  /** Segunda línea de la etiqueta de una columna (p. ej. la sigla del rival debajo de la fecha). */
  sublabel?: string;
  /** Texto largo para el `title` de una columna (p. ej. fecha y rival). */
  detail?: string;
  values: BarValue[];
}

export interface BarLegendItem {
  label: string;
  color: string;
}

export interface BarChart {
  id: string;
  title: string;
  /** Solo en los gráficos de un único equipo; los de propio contra rival se leen con la leyenda de la tarjeta. */
  team?: DonutTeam;
  /** Horizontal para categorías; vertical (columnas) solo para secuencias en el tiempo. */
  orientation: 'horizontal' | 'vertical';
  unit: BarUnit;
  /** Valor que equivale al extremo del eje: 100 en porcentajes, `evenScaleMax` en cantidades. */
  max: number;
  groups: BarGroup[];
  /** Solo cuando las series no son propio y rival (p. ej. los colores de las métricas de división). */
  legend?: BarLegendItem[];
}

export interface ScaleTick {
  value: number;
  label: string;
  /** Posición sobre el eje, de 0 a 100. */
  percent: number;
}

/** Línea de propio contra rival; las filas de estadísticas (`StatLine`) ya cumplen esta forma. */
export interface VersusBarLine {
  label: string;
  ownValue: number | null;
  opponentValue: number | null;
  own?: string;
  opponent?: string;
  /** Intentos de cada equipo, en los tantos que los tienen (`ownValue` son los convertidos). */
  ownOf?: number;
  opponentOf?: number;
}

export interface VersusBarOptions {
  unit?: BarUnit;
  orientation?: BarChart['orientation'];
}

/** Con más valores que esto los números de las columnas se superponen: se ocultan y quedan en el `title`. */
export const MAX_LABELED_COLUMN_VALUES = 24;
/** Ancho mínimo por grupo para rotular todas las columnas sin que se encimen (fecha `dd/mm` y sigla). */
export const MIN_COLUMN_LABEL_WIDTH = 44;
/** Sin ese lugar, se rotula uno de cada `ceil(n/8)` grupos (la misma regla del gráfico de líneas). */
const MAX_SKIPPED_LABELS = 8;

const PERCENT_MAX = 100;
const MIN_COUNT_MAX = 4;
const NO_VALUE = '—';
/** Mitades «redondas» del eje de barras, por orden de magnitud: con el máximo en el doble, la marca del medio es entera. */
const HALF_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

const present = (values: (number | null)[]): number[] => values.filter((value): value is number => value !== null);

/**
 * Techo del eje Y del gráfico de líneas: el siguiente valor «redondo» (medio orden de magnitud) por encima del máximo,
 * mínimo 4. Las barras y las columnas usan `evenScaleMax`.
 */
export function niceScaleMax(max: number): number {
  if (max <= MIN_COUNT_MAX) return MIN_COUNT_MAX;
  const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
  return Math.ceil(max / step) * step || MIN_COUNT_MAX;
}

/** Techo del eje del gráfico de líneas según la unidad y los valores que se dibujan. */
export function scaleMaxFor(unit: BarUnit, values: (number | null)[]): number {
  return unit === 'percent' ? PERCENT_MAX : niceScaleMax(Math.max(0, ...present(values)));
}

/**
 * Techo de un eje de cantidades en barras y columnas, que marcan el cero, la mitad y el máximo: el doble de la menor
 * mitad entera y «redonda» que cubre el mayor valor, mínimo 4. Así ninguna marca tiene decimales (15 → 16, 45 → 50) y
 * la barra más larga ocupa al menos el 60 % del eje.
 */
export function evenScaleMax(max: number): number {
  if (max <= MIN_COUNT_MAX) return MIN_COUNT_MAX;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max / 2)));
  const halves = HALF_STEPS.map(step => step * magnitude).filter(half => Number.isInteger(half) && half * 2 >= max);
  return Math.min(...halves) * 2;
}

/** Techo del eje de barras y columnas según la unidad y los valores que se dibujan. */
export function axisMaxFor(unit: BarUnit, values: (number | null)[]): number {
  return unit === 'percent' ? PERCENT_MAX : evenScaleMax(Math.max(0, ...present(values)));
}

const formatAxis = (value: number, unit: BarUnit): string => (unit === 'percent' ? `${value}%` : `${value}`);

/** Marcas del eje: cero, la mitad y el máximo. */
export function scaleTicks(chart: Pick<BarChart, 'max' | 'unit'>): ScaleTick[] {
  return [0, 0.5, 1].map(ratio => {
    const value = oneDecimal(chart.max * ratio);
    return { value, label: formatAxis(value, chart.unit), percent: ratio * 100 };
  });
}

/** Largo de una barra (0–100) sobre el máximo del eje; sin dato o sin escala, cero. */
export function barPercent(value: number | null, max: number): number {
  if (value === null || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

const defaultDisplay = (value: number | null, unit: BarUnit): string => {
  if (value === null) return NO_VALUE;
  return unit === 'percent' ? `${oneDecimal(value)}%` : `${value}`;
};

function barValue(
  series: string,
  value: number | null,
  display: string | undefined,
  unit: BarUnit,
  colorVar: string,
  of?: number
): BarValue {
  const bar = { series, value, display: display ?? defaultDisplay(value, unit), color: `var(${colorVar})` };
  return of === undefined ? bar : { ...bar, of };
}

/** Una barra por equipo en cada línea, con el color de cada uno; ambos comparten la escala del gráfico. */
export function versusBars(
  id: string,
  title: string,
  lines: VersusBarLine[],
  names: VersusNames,
  options: VersusBarOptions = {}
): BarChart {
  const unit = options.unit ?? 'count';
  const groups = lines.map<BarGroup>(line => ({
    label: line.label,
    values: [
      barValue(names.own, line.ownValue, line.own, unit, OWN_COLOR_VAR, line.ownOf),
      barValue(names.opponent, line.opponentValue, line.opponent, unit, RIVAL_COLOR_VAR, line.opponentOf),
    ],
  }));
  return {
    id,
    title,
    orientation: options.orientation ?? 'horizontal',
    unit,
    max: axisMaxFor(unit, groups.flatMap(group => group.values.flatMap(value => [value.value, value.of ?? null]))),
    groups,
  };
}

export interface TeamBarItem {
  label: string;
  value: number;
  display?: string;
}

/** Una barra por categoría de un solo equipo (acciones de un jugador), en el orden recibido. */
export function teamBars(id: string, title: string, items: TeamBarItem[], colorVar: string): BarChart {
  return {
    id,
    title,
    orientation: 'horizontal',
    unit: 'count',
    max: axisMaxFor('count', items.map(item => item.value)),
    groups: items.map(item => ({ label: item.label, values: [barValue(item.label, item.value, item.display, 'count', colorVar)] })),
  };
}

/**
 * Sin nada que dibujar: ningún valor o, en categorías de cantidades, todo en cero (no hay nada que comparar). Una
 * secuencia en el tiempo (columnas) en cero sí es un dato: ninguna tarjeta en cinco partidos.
 */
export function isEmptyBars(chart: BarChart): boolean {
  const values = present(chart.groups.flatMap(group => group.values.map(value => value.value)));
  const allZero = chart.unit === 'count' && chart.orientation === 'horizontal' && values.every(value => value <= 0);
  return values.length === 0 || allZero;
}

/**
 * Índices de los grupos de columnas que llevan etiqueta en el eje X: todos si al área le tocan 44 px o más por grupo;
 * si no, uno de cada `ceil(n/8)`. El último se rotula siempre. Sin medir todavía (ancho 0) se aplican los saltos.
 */
export function labeledColumns(count: number, plotWidth: number): number[] {
  const fits = count > 0 && plotWidth / count >= MIN_COLUMN_LABEL_WIDTH;
  const step = fits ? 1 : Math.max(1, Math.ceil(count / MAX_SKIPPED_LABELS));
  return Array.from({ length: count }, (_, index) => index).filter(index => index % step === 0 || index === count - 1);
}

/** Las columnas muestran su valor encima solo mientras entren sin pisarse. */
export function showsColumnValues(chart: BarChart): boolean {
  return chart.groups.reduce((total, group) => total + group.values.length, 0) <= MAX_LABELED_COLUMN_VALUES;
}

/**
 * El número sobre una columna: un «0» solo aporta si otra serie del grupo tiene valor (ahí se compara); con todas en 0
 * queda el trazo mínimo sin número. El «—» de sin dato se muestra siempre.
 */
export function showsColumnValue(value: BarValue, group: BarGroup): boolean {
  return value.value === null || value.value !== 0 || group.values.some(other => other !== value && (other.value ?? 0) > 0);
}

/** Valor en texto: «1 de 3» cuando la barra tiene intentos. */
const describeValue = (value: BarValue): string => (value.of === undefined ? value.display : `${value.value} de ${value.of}`);

/** Un grupo en texto: «categoría valor» con una serie, «categoría: serie valor, serie valor» con varias; sin etiqueta, solo los valores. */
function describeGroup(group: BarGroup): string {
  const single = group.values.length === 1;
  const values = single ? describeValue(group.values[0]) : group.values.map(value => `${value.series} ${describeValue(value)}`).join(', ');
  if (!group.label) return values;
  return single ? `${group.label} ${values}` : `${group.label}: ${values}`;
}

/** Texto para lectores de pantalla: las barras son un dibujo y sus valores visibles se ocultan para no repetirlos. */
export function describeBars(chart: BarChart): string {
  const heading = chart.team ? `${chart.title} de ${chart.team.name}` : chart.title;
  if (isEmptyBars(chart)) return `${heading}: sin datos`;

  const scale = chart.unit === 'percent' ? ' (de 0 a 100 %)' : '';
  return `${heading}${scale}: ${chart.groups.map(describeGroup).join('; ')}`;
}
