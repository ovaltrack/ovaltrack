import { LiveCaptureEventType } from '../../types/event-type.types';
import { BackendEventResponse } from '../../types/event.types';
import { calculatePercentage } from './math-utils';

/**
 * Porcentaje de posesión del equipo propio por tiempo de juego: cada evento con posesión definida
 * acredita al equipo que la tenía el tiempo transcurrido desde el evento anterior.
 */
export function computeOwnPossessionPercentage(
  events: BackendEventResponse[],
  eventTypeMap: Map<string, LiveCaptureEventType>
): number {
  const counted = events.filter(e => {
    const et = eventTypeMap.get(e.eventTypeId);
    return et && et.actor !== 'CHOOSE' && e.teamPossession !== 'NEUTRAL' && e.matchTime != null;
  });

  const sorted = [...counted].sort((a, b) => (a.matchTime ?? 0) - (b.matchTime ?? 0));

  let ownTime = 0;
  let oppTime = 0;
  let lastTime = 0;

  for (const e of sorted) {
    const currentTime = e.matchTime ?? 0;
    const duration = currentTime - lastTime;

    if (duration > 0) {
      if (e.teamPossession === 'OWN') {
        ownTime += duration;
      } else if (e.teamPossession === 'OPPONENT') {
        oppTime += duration;
      }
    }
    lastTime = currentTime;
  }

  return calculatePercentage(ownTime, ownTime + oppTime, 50.0);
}
