import { DerivedMetric, EventTypeStat, MetricFormat, MetricStatus, OptionalTeamValue, TeamValue } from '../types/statistic.types';
import { calculatePercentage } from './math-utils';

/** Estadística de un tipo visible en la vista, por `code`; `undefined` si no está en la vista. */
export type StatLookup = (code: string) => EventTypeStat | undefined;

/**
 * Métrica que combina varios tipos de evento y por eso no se puede derivar del catálogo.
 * Es el único lugar del cálculo que nombra códigos: un tipo nuevo nunca necesita tocar este
 * archivo, solo una métrica combinada nueva.
 *
 * Acá van solo las métricas que se calculan con los totales por tipo y sirven durante el partido
 * (entretiempo y modal de estadísticas, que funcionan sin conexión). Las que necesitan la secuencia
 * de eventos, las zonas o los campos `post` las calcula el backend para el post-partido.
 */
interface DerivedMetricDefinition {
  id: string;
  label: string;
  format: MetricFormat;
  /** Las métricas deshabilitadas no se calculan ni se muestran en ninguna vista. */
  enabled: boolean;
  /** Tipos que tienen que estar visibles en la vista para mostrar la métrica. */
  requires: string[];
  compute(stat: StatLookup): OptionalTeamValue;
  assess?(value: OptionalTeamValue, stat: StatLookup): MetricStatus;
}

const TACKLE_SUCCESS_THRESHOLD = 70;

const NO_DATA: MetricStatus = { label: 'Sin datos', type: 'neutral' };

const countOf = (stat: EventTypeStat | undefined): TeamValue => stat?.count ?? { own: 0, opponent: 0 };
const madeOf = (stat: EventTypeStat | undefined): TeamValue => stat?.made ?? { own: 0, opponent: 0 };

const sum = (...values: TeamValue[]): TeamValue => values.reduce(
  (total, value) => ({ own: total.own + value.own, opponent: total.opponent + value.opponent }),
  { own: 0, opponent: 0 },
);

/** Porcentaje de `part` sobre `total` por equipo; `null` sin intentos. */
const rate = (part: TeamValue, total: TeamValue): OptionalTeamValue => ({
  own: total.own > 0 ? calculatePercentage(part.own, total.own) : null,
  opponent: total.opponent > 0 ? calculatePercentage(part.opponent, total.opponent) : null,
});

/**
 * Eventos del tipo por equipo cuyo campo `select` vale alguna de `values`. Sin `values` cuenta los que
 * tienen cualquier opción cargada (sin los pendientes). Cero si el campo no está en la vista.
 */
function optionCount(stat: EventTypeStat | undefined, fieldKey: string, values?: string[]): TeamValue {
  const field = stat?.fields.find(candidate => candidate.key === fieldKey);
  if (field?.kind !== 'select') return { own: 0, opponent: 0 };
  return sum(...field.options
    .filter(option => !values || values.includes(option.value))
    .map(option => option.count));
}

/** Formación fija ganada sobre el saque propio: la pelota quedó en quien sacó (limpia o con penal a favor). */
const SET_PIECE_WON = ['won_clean', 'penalty_for'];

const setPieceSuccess = (code: string, fieldKey: string) => (stat: StatLookup): OptionalTeamValue =>
  rate(optionCount(stat(code), fieldKey, SET_PIECE_WON), optionCount(stat(code), fieldKey));

/** Positivo es bueno para el equipo propio; sin eventos de ningún lado no hay datos. */
const assessBalance = (events: (stat: StatLookup) => TeamValue) =>
  (value: OptionalTeamValue, stat: StatLookup): MetricStatus => {
    const total = events(stat);
    if (total.own + total.opponent === 0 || value.own === null) return NO_DATA;
    if (value.own > 0) return { label: 'Favorable', type: 'success' };
    if (value.own === 0) return { label: 'Parejo', type: 'neutral' };
    return { label: 'Desfavorable', type: 'warning' };
  };

const DERIVED_METRICS: DerivedMetricDefinition[] = [
  {
    id: 'scrum-success',
    label: 'Scrums propios ganados (limpios + penal a favor)',
    format: 'percent',
    enabled: true,
    requires: ['SCRUM'],
    compute: setPieceSuccess('SCRUM', 'scrumResult'),
  },
  {
    id: 'lineout-success',
    label: 'Line-outs propios ganados (limpios + penal a favor)',
    format: 'percent',
    enabled: true,
    requires: ['LINEOUT'],
    compute: setPieceSuccess('LINEOUT', 'lineResult'),
  },
  {
    id: 'goal-kicking',
    label: 'Efectividad a los palos (conversiones + penales)',
    format: 'percent',
    enabled: true,
    requires: ['CONVERSION', 'PENALTY_KICK'],
    compute: stat => rate(
      sum(madeOf(stat('CONVERSION')), madeOf(stat('PENALTY_KICK'))),
      sum(countOf(stat('CONVERSION')), countOf(stat('PENALTY_KICK'))),
    ),
  },
  {
    id: 'penalty-balance',
    label: 'Balance de penales (cometidos por el rival − propios)',
    format: 'signed',
    enabled: true,
    requires: ['PENALTY_CONCEDED'],
    // El penal que concede un equipo lo cobra el otro: positivo = el rival cometió más.
    compute: stat => {
      const conceded = countOf(stat('PENALTY_CONCEDED'));
      return { own: conceded.opponent - conceded.own, opponent: conceded.own - conceded.opponent };
    },
    assess: assessBalance(stat => countOf(stat('PENALTY_CONCEDED'))),
  },
  {
    id: 'tackle-effectiveness',
    label: 'Efectividad de tackles (completados / intentados)',
    format: 'percent',
    enabled: true,
    requires: ['TACKLE_MADE', 'TACKLE_MISSED'],
    compute: stat => {
      const made = countOf(stat('TACKLE_MADE'));
      return rate(made, sum(made, countOf(stat('TACKLE_MISSED'))));
    },
    assess: value => {
      if (value.own === null) return NO_DATA;
      return value.own >= TACKLE_SUCCESS_THRESHOLD
        ? { label: 'Bien', type: 'success' }
        : { label: 'A mejorar', type: 'warning' };
    },
  },
  {
    id: 'turnover-balance',
    label: 'Balance de turnovers (ganados − perdidos)',
    format: 'signed',
    enabled: true,
    requires: ['TURNOVER_WON'],
    // El turnover que gana un equipo es el que pierde el otro.
    compute: stat => {
      const won = countOf(stat('TURNOVER_WON'));
      return { own: won.own - won.opponent, opponent: won.opponent - won.own };
    },
    assess: assessBalance(stat => countOf(stat('TURNOVER_WON'))),
  },
];

/** Métricas combinadas habilitadas cuyos tipos requeridos están visibles en la vista. */
export function computeDerivedMetrics(stat: StatLookup): DerivedMetric[] {
  return DERIVED_METRICS
    .filter(definition => definition.enabled)
    .filter(definition => definition.requires.every(code => stat(code) !== undefined))
    .map(definition => {
      const value = definition.compute(stat);
      return {
        id: definition.id,
        label: definition.label,
        format: definition.format,
        value,
        status: definition.assess ? definition.assess(value, stat) : null,
      };
    });
}
