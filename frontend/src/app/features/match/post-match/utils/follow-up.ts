import { LiveCaptureEventType } from '../../types/event-type.types';
import { Team, followUpChoices, opposite, possessionRule, resolveActor } from '../../statistics/calculators/event-rules';

/** Evento que el catálogo propone cargar a continuación de otro; `team` null = lo elige el analista. */
export interface NextEvent {
  type: LiveCaptureEventType;
  label: string;
  preset: Record<string, unknown>;
  team: Team | null;
}

/** Equipo que queda con la pelota después del evento (misma regla que la captura en vivo); null si no informa. */
function possessionAfter(origin: LiveCaptureEventType, attrs: Record<string, unknown> | null, team: Team): Team | null {
  const rule = possessionRule(origin, attrs);
  if (rule === 'ACTOR') return team;
  if (rule === 'OTHER') return opposite(team);
  if (origin.actor === 'ATTACKING') return team;
  return origin.actor === 'DEFENDING' ? opposite(team) : null;
}

function resolveTeam(
  choiceTeam: 'SAME' | 'OTHER' | undefined,
  type: LiveCaptureEventType,
  origin: LiveCaptureEventType,
  attrs: Record<string, unknown> | null,
  originTeam: Team | null
): Team | null {
  if (originTeam === null) return null;
  if (choiceTeam === 'SAME') return originTeam;
  if (choiceTeam === 'OTHER') return opposite(originTeam);
  const possession = possessionAfter(origin, attrs, originTeam);
  return possession === null ? null : resolveActor(type, possession);
}

/**
 * Eventos que el catálogo propone después de cargar `origin`: el seguimiento único del tipo (Try → Conversión)
 * o la botonera de la opción elegida / del tipo (penal, line-out). Los códigos que no existen en el catálogo se descartan.
 */
export function nextEvents(
  origin: LiveCaptureEventType,
  attrs: Record<string, unknown> | null,
  originTeam: Team | null,
  types: LiveCaptureEventType[]
): NextEvent[] {
  if (origin.followUpEventTypeId) {
    const type = types.find(candidate => candidate.id === origin.followUpEventTypeId);
    return type ? [{ type, label: type.name, preset: {}, team: originTeam }] : [];
  }
  return followUpChoices(origin, attrs).flatMap(choice => {
    const type = types.find(candidate => candidate.code === choice.code);
    return type
      ? [{
        type,
        label: choice.label ?? type.name,
        preset: choice.preset ?? {},
        team: resolveTeam(choice.team, type, origin, attrs, originTeam)
      }]
      : [];
  });
}
