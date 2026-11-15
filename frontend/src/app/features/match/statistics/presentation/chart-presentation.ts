import {
  DonutChart,
  OWN_COLOR_VAR,
  PairedSliceInput,
  RIVAL_COLOR_VAR,
  VersusNames,
  gaugeDonut,
  isEmptyDonut,
  shareDonut,
  sharedSlices,
  versusDonut,
  withTeam,
} from '../../../../shared/utils/donut';
import {
  DerivedMetric,
  EventTypeStat,
  EventTypeStatGroup,
  MatchStatistics,
  PlayerStatColumn,
  PlayerStatistic,
  TeamValue,
} from '../types/statistic.types';
import { AdvancedSection } from './advanced-presentation';
import {
  GroupStatPresentation,
  PENDING_LABEL,
  StatLine,
  formatMetric,
  formatPlayerValue,
  mainLine,
} from './stat-presentation';

/**
 * Qué se grafica como dona: lo que es parte de un total (categorías de un campo, finales de posesión, puntos por
 * tipo de tanto), una cantidad de propio contra rival y los porcentajes. Lo que no es parte de un total (tasas,
 * promedios, saldos) queda como fila en `rest`, así ningún dato desaparece al cambiar de visualización. El gráfico
 * es genérico: las barras (`bar-presentation.ts`) usan la misma tarjeta con sus propios gráficos.
 */
export interface ChartCard<T = DonutChart> {
  charts: T[];
  rest: StatLine[];
}

/** Las secciones avanzadas más largas (bloques de 10') tienen 8 categorías: nunca se agrupan en «Otros». */
const ADVANCED_MAX_SLICES = 8;

/** La fila tiene algo que graficar: 0 contra 0 queda como fila. */
export const hasData = (line: StatLine): boolean => line.ownValue + line.opponentValue > 0;

const toItems = (lines: StatLine[]): PairedSliceInput[] =>
  lines.map(line => ({ label: line.label, own: line.ownValue, opponent: line.opponentValue, muted: line.label === PENDING_LABEL }));

/** Porcentaje de posesión del rival, con un decimal (el complemento de la propia). */
export const opponentPossessionOf = (own: number): number => Math.max(0, Math.round((100 - own) * 10) / 10);

/**
 * Una dona de reparto para cada equipo que tenga datos: el reparto de un equipo no se compara con el del otro, pero
 * las dos tienen las mismas categorías, en el mismo orden y con el mismo tono (`sharedSlices`), para leerlas juntas.
 * Con una sola categoría con datos no hay reparto que mostrar: no hay donas y queda una fila con los dos equipos,
 * con la etiqueta que arma `rowLabel`.
 */
function teamShares(
  id: string,
  title: string,
  items: PairedSliceInput[],
  names: VersusNames,
  rowLabel: (category: string) => string,
  maxSlices?: number
): ChartCard {
  const present = items.filter(item => item.own + item.opponent > 0);
  if (present.length === 1) return { charts: [], rest: [shareRow(present[0], rowLabel(present[0].label))] };

  const slices = sharedSlices(items, maxSlices);
  const sides = [
    { key: 'own', name: names.own, colorVar: OWN_COLOR_VAR, slices: slices.own },
    { key: 'rival', name: names.opponent, colorVar: RIVAL_COLOR_VAR, slices: slices.opponent },
  ];
  return {
    charts: sides
      .map(side => withTeam(shareDonut(`${id}-${side.key}`, title, side.slices, side.colorVar, maxSlices), side.name, side.colorVar))
      .filter(chart => !isEmptyDonut(chart)),
    rest: [],
  };
}

const shareRow = (item: PairedSliceInput, label: string): StatLine => ({
  label,
  own: `${item.own}`,
  opponent: `${item.opponent}`,
  ownValue: item.own,
  opponentValue: item.opponent,
});

/** Una dona versus por cada línea con datos; las demás (0 contra 0) siguen como fila. */
function versusCharts(prefix: string, lines: StatLine[], names: VersusNames, titleOf = (line: StatLine) => line.label): ChartCard {
  return {
    charts: lines.filter(hasData).map(line => versusDonut(`${prefix}-${line.label}`, titleOf(line), line, names)),
    rest: lines.filter(line => !hasData(line)),
  };
}

/** Título del reparto de un bloque de segundo nivel: el de la tarjeta ya nombra el tema, el gráfico dice qué muestra. */
const DISTRIBUTION_TITLES: Record<string, string> = {
  possessions: 'Cómo terminan',
  'try-sources': 'Tries por origen',
  'score-blocks': 'Puntos por bloque',
};

export const distributionTitle = (section: AdvancedSection): string => DISTRIBUTION_TITLES[section.id] ?? section.title;

/** Título de una cantidad: si repite el de la tarjeta («Posesiones»), dice que es la cantidad. Las filas de la Lista no cambian. */
export const countTitle = (section: AdvancedSection, line: StatLine): string =>
  line.label === section.title ? `Cantidad de ${line.label.toLowerCase()}` : line.label;

export function possessionDonut(ownPercentage: number, names: VersusNames): DonutChart {
  const opponentPercentage = opponentPossessionOf(ownPercentage);
  const chart = versusDonut(
    'possession',
    'Posesión',
    { ownValue: ownPercentage, opponentValue: opponentPercentage, own: `${ownPercentage}%`, opponent: `${opponentPercentage}%` },
    names
  );
  return { ...chart, center: { value: `${ownPercentage}%`, label: 'propia' }, showPercent: false };
}

/** Puntos de cada equipo repartidos por tipo de tanto (try, conversión, penal, drop). */
export function pointsDonuts(groups: EventTypeStatGroup[], names: VersusNames): ChartCard {
  const items = groups
    .flatMap(group => group.types)
    .filter(type => type.isScoring)
    .map(type => ({ label: type.name, own: type.points?.own ?? 0, opponent: type.points?.opponent ?? 0 }));
  return teamShares('points', 'Puntos', items, names, category => `Puntos · ${category}`);
}

const scoringTypes = (groups: EventTypeStatGroup[]): EventTypeStat[] =>
  groups.flatMap(group => group.types).filter(type => type.isScoring);

const bothTeams = (value: TeamValue): number => value.own + value.opponent;

const wasAttempted = (type: EventTypeStat): boolean => bothTeams(type.count) > 0;

/** Dona de un tanto: en los que tienen intentos, el centro dice los convertidos sobre los intentos de los dos equipos. */
function scoreDonut(type: EventTypeStat, names: VersusNames): DonutChart {
  const chart = versusDonut(`score-${type.name}`, type.name, mainLine(type), names);
  if (!type.hasAttempts || !type.made) return chart;
  return { ...chart, center: { value: `${bothTeams(type.made)}/${bothTeams(type.count)}`, label: 'convertidos' } };
}

/**
 * Tarjeta «Marcador y posesión»: posesión, puntos por tipo de tanto y cada tanto propio contra rival. Un tanto con
 * intentos pero sin aciertos (un drop errado) no tiene porciones: queda como fila, igual que en Mediciones. Los que
 * no tuvieron ningún intento no aparecen.
 */
export function scoreCard(stats: MatchStatistics, names: VersusNames): ChartCard {
  const attempted = scoringTypes(stats.groups).filter(wasAttempted);
  const charted = attempted.filter(type => hasData(mainLine(type)));
  const points = pointsDonuts(stats.groups, names);
  return {
    charts: [
      possessionDonut(stats.ownPossessionPercentage, names),
      ...points.charts,
      ...charted.map(type => scoreDonut(type, names)),
    ],
    rest: [...points.rest, ...attempted.filter(type => !charted.includes(type)).map(mainLine)],
  };
}

export const metricLine = (metric: DerivedMetric): StatLine => ({
  label: metric.label,
  own: formatMetric(metric.value.own, metric.format),
  opponent: formatMetric(metric.value.opponent, metric.format),
  ownValue: metric.value.own ?? 0,
  opponentValue: metric.value.opponent ?? 0,
});

/** Indicador que es un porcentaje con dato de algún equipo: se grafica; saldos y tasas quedan como fila. */
export const isGaugedMetric = (metric: DerivedMetric): boolean =>
  metric.format === 'percent' && (metric.value.own !== null || metric.value.opponent !== null);

/**
 * Tarjeta «Indicadores»: los porcentajes son anillos de avance por equipo, en par (propio y rival juntos, con el
 * título una vez); los saldos quedan como fila.
 */
export function indicatorCard(derived: DerivedMetric[], names: VersusNames): ChartCard {
  const gauged = derived.filter(isGaugedMetric);
  const gauge = (metric: DerivedMetric, key: string, value: number | null, name: string, colorVar: string): DonutChart =>
    ({ ...withTeam(gaugeDonut(`${metric.id}-${key}`, metric.label, value, colorVar), name, colorVar), group: metric.id });
  return {
    charts: gauged.flatMap(metric => [
      gauge(metric, 'own', metric.value.own, names.own, OWN_COLOR_VAR),
      gauge(metric, 'rival', metric.value.opponent, names.opponent, RIVAL_COLOR_VAR),
    ]),
    rest: derived.filter(metric => !gauged.includes(metric)).map(metricLine),
  };
}

/** Bloque de segundo nivel: repartos por equipo, cantidades propio-rival y, como fila, las tasas. */
export function advancedCard(section: AdvancedSection, names: VersusNames): ChartCard {
  // La tarjeta da el contexto: la categoría sola ya está en `section.lines` con su etiqueta, así que esa fila no se suma.
  const distribution = teamShares(section.id, distributionTitle(section), toItems(section.distribution), names, category => category, ADVANCED_MAX_SLICES);
  const counts = versusCharts(section.id, section.counts, names, line => countTitle(section, line));
  const charted = new Set([...(distribution.charts.length > 0 ? section.distribution : []), ...section.counts.filter(hasData)]);
  return {
    charts: [...distribution.charts, ...counts.charts],
    rest: section.lines.filter(line => !charted.has(line)),
  };
}

/** Área del catálogo: cada tipo es una dona versus y cada desglose, un reparto por equipo; totales y promedios, filas. */
export function measurementCard(section: GroupStatPresentation, names: VersusNames): ChartCard {
  const mains = versusCharts(section.name, section.types.map(type => type.main), names);
  const shares = section.types.flatMap(type => type.breakdowns.map(breakdown => {
    const title = `${type.name} · ${breakdown.title}`;
    return teamShares(`${type.eventTypeId}-${breakdown.title}`, title, toItems(breakdown.lines), names, category => `${title} · ${category}`);
  }));
  return {
    charts: [...mains.charts, ...shares.flatMap(share => share.charts)],
    rest: [...mains.rest, ...section.types.flatMap(type => type.extra), ...shares.flatMap(share => share.rest)],
  };
}

/** Acciones que registró un jugador en un grupo del catálogo, con su valor ya formateado. */
export interface PlayerActionGroup {
  groupName: string;
  items: { label: string; value: number; display: string }[];
}

/** Grupos del catálogo con las acciones que el jugador registró (los grupos sin acciones no aparecen). */
export function playerActionGroups(columns: PlayerStatColumn[], player: PlayerStatistic): PlayerActionGroup[] {
  const groups = columns.reduce<Map<string, PlayerStatColumn[]>>(
    (result, column) => result.set(column.groupName, [...(result.get(column.groupName) ?? []), column]),
    new Map()
  );
  return Array.from(groups, ([groupName, groupColumns]) => ({
    groupName,
    items: groupColumns
      .filter(column => (player.values[column.eventTypeId]?.count ?? 0) > 0)
      .map(column => ({
        label: column.label,
        value: player.values[column.eventTypeId].count,
        display: formatPlayerValue(column, player.values[column.eventTypeId]),
      })),
  })).filter(group => group.items.length > 0);
}

/** Acciones de un jugador: una dona por grupo del catálogo con las acciones que registró. */
export function playerActionCharts(columns: PlayerStatColumn[], player: PlayerStatistic): DonutChart[] {
  return playerActionGroups(columns, player).map(group =>
    shareDonut(`player-${group.groupName}`, group.groupName, group.items, OWN_COLOR_VAR)
  );
}
