import { MatchTimelineEventResponse } from '../../types/event.types';
import { ZoneRule } from '../../types/event-type.types';
import { Possession } from '../../types/live-capture.types';
import { ZoneCellRef, ZonePeriod } from '../../types/zone.types';

/** Evento con lo mínimo que la regla necesita para ubicarse. */
export type RuleEvent = Pick<MatchTimelineEventResponse,
  'id' | 'eventTypeId' | 'eventTypeName' | 'period' | 'matchTime' | 'teamPossession' | 'attributes'>;

/** Regla de zona de cada tipo de evento, por id; los tipos sin regla pueden faltar o valer null. */
export type ZoneRulesByType = ReadonlyMap<string, ZoneRule | null | undefined>;

/** Tramo propuesto (nuevo o editado) que se quiere comprobar contra los eventos que contiene. */
export interface RuleRange {
  period: ZonePeriod;
  startMinute: number;
  endMinute: number;
  row: number;
  col: number;
}

export interface ZoneRuleConflict {
  event: RuleEvent;
  /** Mismo texto que devuelve el backend (409) para que el aviso previo y el del servidor coincidan. */
  message: string;
}

/**
 * Celda final de un evento (espejo de `EventZoneResolver` del backend): aplica la regla del tipo sobre la celda del
 * tramo y la perspectiva del equipo que lo ejecuta (el rival se espeja). Null si no hay celda.
 */
export function placeEventZone(
  rule: ZoneRule | null | undefined,
  possession: Possession | null | undefined,
  attributes: Record<string, unknown> | null | undefined,
  assignmentCell: ZoneCellRef | null
): ZoneCellRef | null {
  throw new Error('Sin implementar');
}

/** Verdadero si la regla fija fila y columna sin necesitar ningún tramo. */
export function isFixedZone(rule: ZoneRule | null | undefined, attributes: Record<string, unknown> | null | undefined): boolean {
  throw new Error('Sin implementar');
}

/** Texto de lo permitido (ej. "las columnas 2 a 5"); el mismo que arma el backend. */
export function describeZoneRule(rule: ZoneRule): string {
  throw new Error('Sin implementar');
}

/** Primer evento (en orden cronológico) que el tramo propuesto dejaría en una celda prohibida para su tipo. */
export function findZoneRuleConflict(range: RuleRange, events: RuleEvent[], rules: ZoneRulesByType): ZoneRuleConflict | null {
  throw new Error('Sin implementar');
}
