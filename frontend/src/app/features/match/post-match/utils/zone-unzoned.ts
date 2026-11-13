import { MatchTimelineEventResponse } from '../../types/event.types';
import { ZoneAssignmentResponse } from '../../types/zone.types';
import { ZoneRulesByType } from './zone-rule';

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

export function unzonedReason(event: Pick<UnzonedSource, 'period' | 'matchTime'>, assignments: ZoneAssignmentResponse[]): UnzonedReason {
  return 'GAP';
}

/** Las jugadas sin zona del partido, en orden cronológico, cada una con su motivo. */
export function unzonedWithReason(events: UnzonedSource[], assignments: ZoneAssignmentResponse[], rules: ZoneRulesByType): UnzonedItem[] {
  return [];
}
