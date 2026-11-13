import { MatchTimelineEventResponse } from '../../types/event.types';
import { ZoneAssignmentResponse } from '../../types/zone.types';
import { describeZoneRule, formatMatchTime, ZoneRulesByType } from './zone-rule';
import { describeSegment, effectiveMatchTime, tramoAtEvent } from './zone-stats';

/** Por qué una jugada no tiene zona: sin tiempo de partido, ningún tramo cubre su minuto, o el tramo no admite su tipo. */
export type UnzonedReason = 'NO_TIME' | 'GAP' | 'FORBIDDEN';

export type UnzonedSource = Pick<MatchTimelineEventResponse,
  'id' | 'eventTypeId' | 'eventTypeName' | 'period' | 'matchTime' | 'teamPossession' | 'attributes' | 'zone'>;

/** Una jugada sin zona, con lo que hace falta para explicarla y para llevar al analista a arreglarla. */
export interface UnzonedItem {
  event: UnzonedSource;
  reason: UnzonedReason;
  /** El tramo que cubre su minuto (solo con `FORBIDDEN`). */
  tramo: ZoneAssignmentResponse | null;
  /** Minuto acumulado (0–79) donde cae, para ubicar el hueco; null sin tiempo válido. */
  minute: number | null;
  /** Reloj corto para mostrar, ej. "1T 22:30". */
  clock: string;
  /** Motivo en una frase. */
  reasonText: string;
}

const SECONDS_PER_MINUTE = 60;
/** Las jugadas sin tiempo válido van al final de la lista. */
const NO_PERIOD_ORDER = 99;

function hasValidTime(event: Pick<UnzonedSource, 'period' | 'matchTime'>): boolean {
  return (event.period === 1 || event.period === 2) && typeof event.matchTime === 'number';
}

/**
 * Motivo de una jugada que el backend dejó sin zona: espeja al resolver. Sin tiempo no se puede ubicar; sin tramo en su
 * minuto es un hueco; con un tramo que la cubre, la regla del tipo no admite la celda de ese tramo.
 */
export function unzonedReason(event: Pick<UnzonedSource, 'period' | 'matchTime'>, assignments: ZoneAssignmentResponse[]): UnzonedReason {
  if (!hasValidTime(event)) return 'NO_TIME';
  return tramoAtEvent(event, assignments) ? 'FORBIDDEN' : 'GAP';
}

function reasonText(event: UnzonedSource, reason: UnzonedReason, tramo: ZoneAssignmentResponse | null, rules: ZoneRulesByType): string {
  if (reason === 'NO_TIME') return 'Sin tiempo de partido';
  if (reason === 'GAP' || !tramo) return 'Ningún tramo cubre este minuto';

  const rule = rules.get(event.eventTypeId);
  const base = `El tramo ${describeSegment(tramo)} no admite ${event.eventTypeName}`;
  return rule ? `${base}: solo puede ocurrir en ${describeZoneRule(rule)}` : base;
}

function toItem(event: UnzonedSource, assignments: ZoneAssignmentResponse[], rules: ZoneRulesByType): UnzonedItem {
  const reason = unzonedReason(event, assignments);
  const tramo = reason === 'FORBIDDEN' ? tramoAtEvent(event, assignments) : null;
  const valid = reason !== 'NO_TIME';
  return {
    event,
    reason,
    tramo,
    minute: valid ? Math.floor(effectiveMatchTime(event.period as 1 | 2, event.matchTime) / SECONDS_PER_MINUTE) : null,
    clock: `${event.period}T ${formatMatchTime(event.matchTime)}`,
    reasonText: reasonText(event, reason, tramo, rules)
  };
}

/** Las jugadas sin zona del partido, en orden cronológico, cada una con su motivo. */
export function unzonedWithReason(events: UnzonedSource[], assignments: ZoneAssignmentResponse[], rules: ZoneRulesByType): UnzonedItem[] {
  const order = (event: UnzonedSource): number => (hasValidTime(event) ? event.period : NO_PERIOD_ORDER);
  return events
    .filter(event => !event.zone)
    .sort((a, b) => order(a) - order(b) || a.matchTime - b.matchTime)
    .map(event => toItem(event, assignments, rules));
}
