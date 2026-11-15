import {
  EventTypeStat,
  EventTypeStatGroup,
  FieldStat,
  MetricFormat,
  PlayerEventTypeValue,
  PlayerStatColumn,
  TeamValue,
} from '../types/statistic.types';

/** Fila "propio vs rival" lista para mostrar; los valores numéricos alimentan las barras. */
export interface StatLine {
  label: string;
  own: string;
  opponent: string;
  ownValue: number;
  opponentValue: number;
}

export interface StatBreakdown {
  title: string;
  lines: StatLine[];
}

export interface TypeStatPresentation {
  eventTypeId: string;
  name: string;
  hasData: boolean;
  /** Cantidad del tipo; en los que tienen intentos, "convertidos/intentos". */
  main: StatLine;
  /** Puntos y totales/promedios de campos numéricos. */
  extra: StatLine[];
  /** `main` seguido de `extra`. */
  lines: StatLine[];
  /** Distribución de campos select y boolean (solo opciones con eventos). */
  breakdowns: StatBreakdown[];
}

export interface GroupStatPresentation {
  name: string;
  types: TypeStatPresentation[];
  hasData: boolean;
}

export interface PresentationOptions {
  includePoints: boolean;
}

const EMPTY = '—';

/** Etiqueta de los eventos sin valor en un campo `select`. */
export const PENDING_LABEL = 'Sin completar';

export function formatMetric(value: number | null, format: MetricFormat): string {
  if (value === null) return EMPTY;
  switch (format) {
    case 'percent': return `${value}%`;
    case 'signed': return value > 0 ? `+${value}` : `${value}`;
    default: return `${value}`;
  }
}

const formatDecimal = (value: number | null): string =>
  (value === null ? EMPTY : (Math.round(value * 10) / 10).toFixed(1));

const countLine = (label: string, value: TeamValue): StatLine => ({
  label,
  own: `${value.own}`,
  opponent: `${value.opponent}`,
  ownValue: value.own,
  opponentValue: value.opponent,
});

const hasCount = (value: TeamValue): boolean => value.own + value.opponent > 0;

export function mainLine(stat: EventTypeStat): StatLine {
  const made = stat.made ?? stat.count;
  if (!stat.hasAttempts) {
    return countLine(stat.name, stat.count);
  }
  return {
    label: stat.name,
    own: `${made.own}/${stat.count.own}`,
    opponent: `${made.opponent}/${stat.count.opponent}`,
    ownValue: made.own,
    opponentValue: made.opponent,
  };
}

function fieldBreakdown(field: FieldStat): StatBreakdown | null {
  let lines: StatLine[] = [];
  if (field.kind === 'select') {
    lines = [
      ...field.options.map(option => countLine(option.label, option.count)),
      countLine(PENDING_LABEL, field.pending),
    ].filter(line => line.ownValue + line.opponentValue > 0);
  } else if (field.kind === 'boolean') {
    lines = [countLine(field.trueLabel, field.yes), countLine(field.falseLabel, field.no)]
      .filter(line => line.ownValue + line.opponentValue > 0);
  }
  return lines.length > 0 ? { title: field.label, lines } : null;
}

function numberLines(field: FieldStat): StatLine[] {
  if (field.kind !== 'number') return [];
  const lines: StatLine[] = [];
  if (field.total.own !== null || field.total.opponent !== null) {
    lines.push({
      label: `${field.label} · total`,
      own: field.total.own === null ? EMPTY : `${field.total.own}`,
      opponent: field.total.opponent === null ? EMPTY : `${field.total.opponent}`,
      ownValue: field.total.own ?? 0,
      opponentValue: field.total.opponent ?? 0,
    });
    lines.push({
      label: `${field.label} · promedio`,
      own: formatDecimal(field.average.own),
      opponent: formatDecimal(field.average.opponent),
      ownValue: field.average.own ?? 0,
      opponentValue: field.average.opponent ?? 0,
    });
  }
  return lines;
}

export function presentType(stat: EventTypeStat, options: PresentationOptions): TypeStatPresentation {
  const extra: StatLine[] = [];
  if (options.includePoints && stat.points && hasCount(stat.points)) {
    extra.push(countLine('Puntos', stat.points));
  }
  extra.push(...stat.fields.flatMap(numberLines));

  const main = mainLine(stat);
  return {
    eventTypeId: stat.eventTypeId,
    name: stat.name,
    hasData: hasCount(stat.count),
    main,
    extra,
    lines: [main, ...extra],
    breakdowns: stat.fields
      .map(fieldBreakdown)
      .filter((breakdown): breakdown is StatBreakdown => breakdown !== null),
  };
}

export function presentGroups(groups: EventTypeStatGroup[], options: PresentationOptions): GroupStatPresentation[] {
  return groups.map(group => {
    const types = group.types.map(stat => presentType(stat, options));
    return { name: group.name, types, hasData: types.some(type => type.hasData) };
  });
}

/** Tipos que suman, en orden de catálogo: el desglose del marcador. */
export function scoringLines(groups: EventTypeStatGroup[]): StatLine[] {
  return groups.flatMap(group => group.types).filter(stat => stat.isScoring).map(mainLine);
}

/** Valor de un jugador en una columna: "convertidos/intentos" en los tipos con intentos. */
export function formatPlayerValue(column: PlayerStatColumn, value: PlayerEventTypeValue | undefined): string {
  if (!value || value.count === 0) return EMPTY;
  return column.hasAttempts ? `${value.made ?? 0}/${value.count}` : `${value.count}`;
}

/** El jugador registró al menos un evento del tipo de la columna. */
export function hasPlayerValue(column: PlayerStatColumn, values: Record<string, PlayerEventTypeValue>): boolean {
  return (values[column.eventTypeId]?.count ?? 0) > 0;
}
