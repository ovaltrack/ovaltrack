import { BarChart, VersusBarLine, isEmptyBars, teamBars, versusBars } from '../../../../shared/utils/bars';
import { OWN_COLOR_VAR, VersusNames } from '../../../../shared/utils/donut';
import { DerivedMetric, EventTypeStatGroup, MatchStatistics, PlayerStatColumn, PlayerStatistic } from '../types/statistic.types';
import { AdvancedSection } from './advanced-presentation';
import { ChartCard, hasData, isGaugedMetric, metricLine, opponentPossessionOf, playerActionGroups } from './chart-presentation';
import { GroupStatPresentation, StatLine, formatMetric } from './stat-presentation';

/**
 * Qué se grafica en barras, con las mismas reglas de partición que las donas (`chart-presentation.ts`): lo que no se
 * puede dibujar sin mezclar unidades queda como fila en `rest`, así ningún dato desaparece al cambiar de visualización.
 * Cada gráfico mezcla solo valores de la misma unidad: porcentajes de 0 a 100, o cantidades del mismo tipo.
 */

/** Secciones cuyas categorías son momentos del partido (bloques de 10'): van en columnas, en orden de tiempo. */
const SEQUENCE_SECTIONS = new Set(['score-blocks']);

/** La fila sin etiqueta: el título del gráfico ya la nombra. */
const unlabeled = (line: StatLine): VersusBarLine => ({ ...line, label: '' });

const pointLines = (groups: EventTypeStatGroup[]): VersusBarLine[] =>
  groups
    .flatMap(group => group.types)
    .filter(type => type.isScoring)
    .map(type => ({ label: type.name, ownValue: type.points?.own ?? 0, opponentValue: type.points?.opponent ?? 0 }));

/** Tarjeta «Marcador y posesión»: posesión (0–100), puntos por tipo de tanto y cada tanto de propio contra rival. */
export function scoreBars(stats: MatchStatistics, scoring: StatLine[], names: VersusNames): BarChart[] {
  const own = stats.ownPossessionPercentage;
  const opponent = opponentPossessionOf(own);
  const points = versusBars('points', 'Puntos', pointLines(stats.groups), names);
  return [
    versusBars(
      'possession',
      'Posesión',
      [{ label: 'Tiempo de juego', ownValue: own, opponentValue: opponent, own: `${own}%`, opponent: `${opponent}%` }],
      names,
      { unit: 'percent' }
    ),
    ...(isEmptyBars(points) ? [] : [points]),
    ...(scoring.length > 0 ? [versusBars('score', 'Tantos', scoring, names)] : []),
  ];
}

const percentLine = (metric: DerivedMetric): VersusBarLine => ({
  label: metric.label,
  ownValue: metric.value.own,
  opponentValue: metric.value.opponent,
  own: formatMetric(metric.value.own, metric.format),
  opponent: formatMetric(metric.value.opponent, metric.format),
});

/** Tarjeta «Indicadores»: todos los porcentajes en un mismo eje de 0 a 100; los saldos quedan como fila. */
export function indicatorBars(derived: DerivedMetric[], names: VersusNames): ChartCard<BarChart> {
  const percents = derived.filter(isGaugedMetric);
  return {
    charts: percents.length > 0 ? [versusBars('indicators', 'Porcentajes', percents.map(percentLine), names, { unit: 'percent' })] : [],
    rest: derived.filter(metric => !percents.includes(metric)).map(metricLine),
  };
}

/**
 * Bloque de segundo nivel: el reparto por categorías en un solo gráfico (columnas si son momentos del partido), cada
 * cantidad en su gráfico (sus unidades pueden diferir: visitas y puntos) y, como fila, las tasas.
 */
export function advancedBars(section: AdvancedSection, names: VersusNames): ChartCard<BarChart> {
  const orientation = SEQUENCE_SECTIONS.has(section.id) ? 'vertical' : 'horizontal';
  const distribution = section.distribution.length > 0
    ? [versusBars(`${section.id}-distribution`, section.title, section.distribution, names, { orientation })]
    : [];
  const counts = section.counts.filter(hasData);
  const charted = new Set([...section.distribution, ...counts]);
  return {
    charts: [
      ...distribution,
      ...counts.map(line => versusBars(`${section.id}-${line.label}`, line.label, [unlabeled(line)], names)),
    ],
    rest: section.lines.filter(line => !charted.has(line)),
  };
}

/** Área del catálogo: la cantidad de cada tipo en un gráfico, cada desglose en el suyo; totales y promedios, filas. */
export function measurementBars(section: GroupStatPresentation, names: VersusNames): ChartCard<BarChart> {
  const mains = section.types.map(type => type.main);
  const charted = mains.filter(hasData);
  return {
    charts: [
      ...(charted.length > 0 ? [versusBars(`${section.name}-types`, 'Cantidad por tipo', charted, names)] : []),
      ...section.types.flatMap(type =>
        type.breakdowns.map(breakdown =>
          versusBars(`${type.eventTypeId}-${breakdown.title}`, `${type.name} · ${breakdown.title}`, breakdown.lines, names)
        )
      ),
    ],
    rest: [...mains.filter(line => !hasData(line)), ...section.types.flatMap(type => type.extra)],
  };
}

/** Acciones de un jugador: una barra por acción en cada grupo del catálogo, de la que más hizo a la que menos. */
export function playerActionBars(columns: PlayerStatColumn[], player: PlayerStatistic): BarChart[] {
  return playerActionGroups(columns, player).map(group =>
    teamBars(`player-${group.groupName}`, group.groupName, [...group.items].sort((a, b) => b.value - a.value), OWN_COLOR_VAR)
  );
}
