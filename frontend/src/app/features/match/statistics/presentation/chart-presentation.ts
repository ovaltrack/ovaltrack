import {
  DonutChart,
  OWN_COLOR_VAR,
  RIVAL_COLOR_VAR,
  VersusNames,
  gaugeDonut,
  isEmptyDonut,
  shareDonut,
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

interface TeamItem {
  label: string;
  own: number;
  opponent: number;
  /** Relleno como «Sin completar»: va en neutro. */
  muted?: boolean;
}

/** La fila tiene algo que graficar: 0 contra 0 queda como fila. */
export const hasData = (line: StatLine): boolean => line.ownValue + line.opponentValue > 0;

const toItems = (lines: StatLine[]): TeamItem[] =>
  lines.map(line => ({ label: line.label, own: line.ownValue, opponent: line.opponentValue, muted: line.label === PENDING_LABEL }));

/** Porcentaje de posesión del rival, con un decimal (el complemento de la propia). */
export const opponentPossessionOf = (own: number): number => Math.max(0, Math.round((100 - own) * 10) / 10);

/** Una dona de reparto para cada equipo que tenga datos: el reparto de un equipo no se compara con el del otro. */
function teamShares(id: string, title: string, items: TeamItem[], names: VersusNames, maxSlices?: number): DonutChart[] {
  const sides = [
    { key: 'own', name: names.own, colorVar: OWN_COLOR_VAR, value: (item: TeamItem) => item.own },
    { key: 'rival', name: names.opponent, colorVar: RIVAL_COLOR_VAR, value: (item: TeamItem) => item.opponent },
  ];
  return sides
    .map(side => withTeam(
      shareDonut(
        `${id}-${side.key}`,
        title,
        items
          .map(item => ({ label: item.label, value: side.value(item), muted: item.muted }))
          .filter(slice => slice.value > 0),
        side.colorVar,
        maxSlices
      ),
      side.name,
      side.colorVar
    ))
    .filter(chart => !isEmptyDonut(chart));
}

/** Una dona versus por cada línea con datos; las demás (0 contra 0) siguen como fila. */
function versusCharts(prefix: string, lines: StatLine[], names: VersusNames): ChartCard {
  return {
    charts: lines.filter(hasData).map(line => versusDonut(`${prefix}-${line.label}`, line.label, line, names)),
    rest: lines.filter(line => !hasData(line)),
  };
}

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
export function pointsDonuts(groups: EventTypeStatGroup[], names: VersusNames): DonutChart[] {
  const items = groups
    .flatMap(group => group.types)
    .filter(type => type.isScoring)
    .map(type => ({ label: type.name, own: type.points?.own ?? 0, opponent: type.points?.opponent ?? 0 }));
  return teamShares('points', 'Puntos', items, names);
}

const scoringTypes = (groups: EventTypeStatGroup[]): EventTypeStat[] =>
  groups.flatMap(group => group.types).filter(type => type.isScoring);

const hasAttempts = (type: EventTypeStat): boolean => type.count.own + type.count.opponent > 0;

/**
 * Tarjeta «Marcador y posesión»: posesión, puntos por tipo de tanto y cada tanto propio contra rival. Un tanto con
 * intentos pero sin aciertos (un drop errado) no tiene porciones: queda como fila, igual que en Mediciones. Los que
 * no tuvieron ningún intento no aparecen.
 */
export function scoreCard(stats: MatchStatistics, names: VersusNames): ChartCard {
  const scoring = versusCharts('score', scoringTypes(stats.groups).filter(hasAttempts).map(mainLine), names);
  return {
    charts: [possessionDonut(stats.ownPossessionPercentage, names), ...pointsDonuts(stats.groups, names), ...scoring.charts],
    rest: scoring.rest,
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
  const distribution = teamShares(section.id, section.title, toItems(section.distribution), names, ADVANCED_MAX_SLICES);
  const counts = versusCharts(section.id, section.counts, names);
  const charted = new Set([...(distribution.length > 0 ? section.distribution : []), ...section.counts.filter(hasData)]);
  return {
    charts: [...distribution, ...counts.charts],
    rest: section.lines.filter(line => !charted.has(line)),
  };
}

/** Área del catálogo: cada tipo es una dona versus y cada desglose, un reparto por equipo; totales y promedios, filas. */
export function measurementCard(section: GroupStatPresentation, names: VersusNames): ChartCard {
  const mains = versusCharts(section.name, section.types.map(type => type.main), names);
  return {
    charts: [
      ...mains.charts,
      ...section.types.flatMap(type => type.breakdowns.flatMap(breakdown =>
        teamShares(`${type.eventTypeId}-${breakdown.title}`, `${type.name} · ${breakdown.title}`, toItems(breakdown.lines), names)
      )),
    ],
    rest: [...mains.rest, ...section.types.flatMap(type => type.extra)],
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
