import { FollowUpChoice, LiveCaptureEventType, PossessionAfter, TemplateField } from '../../types/event-type.types';
import { BackendEventResponse, Possession } from '../../types/live-capture.types';

export type Team = 'OWN' | 'OPPONENT';

export const opposite = (team: Team): Team => (team === 'OWN' ? 'OPPONENT' : 'OWN');

/** Campos que se piden en el momento de la carga en vivo. */
export const liveFields = (type: LiveCaptureEventType): TemplateField[] =>
  (type.templateEventFields ?? []).filter(field => field.phase === 'live');

/**
 * Indica si un evento suma puntos. Un campo marcado con el efecto `scoring`
 * (penal, drop gol, conversión) lo decide: si vale `false` no suma.
 */
export function countsAsScoring(type: LiveCaptureEventType, attrs?: Record<string, unknown> | null): boolean {
  if (!type.isScoring) {
    return false;
  }
  const field = type.templateEventFields?.find(f => f.effects?.includes('scoring'));
  return !field || attrs?.[field.key] !== false;
}

export function eventTeam(type: LiveCaptureEventType | undefined, event: BackendEventResponse): Team | null {
  if (!type) return null;
  return event.teamPossession === 'NEUTRAL' ? null : event.teamPossession;
}

/**
 * Equipo que ejecuta el evento según el `actor` del tipo y la posesión vigente.
 * Devuelve `null` cuando el analista debe elegirlo (actor CHOOSE o posesión neutral).
 */
export function resolveActor(type: LiveCaptureEventType, possession: Possession): Team | null {
  if (type.actor === 'CHOOSE' || possession === 'NEUTRAL') {
    return null;
  }
  return type.actor === 'DEFENDING' ? opposite(possession) : possession;
}

/**
 * Equipo al que se le suman los puntos de un evento. un evento NEUTRAL sin jugador no suma a nadie.
 */
export function scoringTeam(event: { teamPossession: Possession; playerId?: string | null }): Team | null {
  if (event.teamPossession === 'OPPONENT') {
    return 'OPPONENT';
  }
  if (event.teamPossession === 'OWN' || event.playerId != null) {
    return 'OWN';
  }
  return null;
}

/**
 * Regla de posesión de un evento ya cargado: la de la opción elegida, la de un
 * campo boolean con efecto `possession` (si es `false` no cambia), o la del tipo.
 */
export function possessionRule(type: LiveCaptureEventType, attrs?: Record<string, unknown> | null): PossessionAfter {
  for (const field of type.templateEventFields ?? []) {
    if (field.type === 'select') {
      const option = field.options?.find(o => o.value === attrs?.[field.key]);
      if (option?.possession) {
        return option.possession;
      }
    }
    if (field.type === 'boolean' && field.effects?.includes('possession') && attrs?.[field.key] === false) {
      return 'KEEP';
    }
  }
  return type.possessionAfter ?? 'KEEP';
}

/** Botonera de eventos siguientes: la de la opción elegida, o la del tipo. */
export function followUpChoices(type: LiveCaptureEventType, attrs?: Record<string, unknown> | null): FollowUpChoice[] {
  for (const field of type.templateEventFields ?? []) {
    const option = field.type === 'select' ? field.options?.find(o => o.value === attrs?.[field.key]) : undefined;
    if (option?.followUps?.length) {
      return option.followUps;
    }
  }
  return type.followUpChoices ?? [];
}
