import { MatchTimelineEventResponse } from '../../types/event.types';
import { ZoneRule } from '../../types/event-type.types';
import { ZONE_HALF_MINUTES, ZoneAssignmentResponse, ZoneCellRef, ZonePeriod } from '../../types/zone.types';
import { zoneLabel, zoneName } from './zone-grid';
import { effectiveMatchTime, periodRange } from './zone-stats';
import { PeriodGap, gapAtMinute } from './zone-track-layout';

const SECONDS_PER_MINUTE = 60;

export type ZoneLinkEvent = Pick<MatchTimelineEventResponse, 'period' | 'matchTime' | 'zone'>;

/** A dónde lleva el evento en Zonas: el tramo que explica su zona, o el hueco de su minuto si no tiene zona. */
export interface EventZoneLink {
  /** Tramo que contiene el minuto del evento y coincide con su `zone`; null si no hay zona o no coincide. */
  segment: ZoneAssignmentResponse | null;
  /** Hueco sin zona que contiene el minuto; solo si el evento no tiene zona y el minuto no está en un tramo. */
  gap: PeriodGap | null;
  /** Minuto acumulado de partido (0–79) con el que se ubica el evento; el tiempo añadido queda en el último. */
  minute: number;
  /** El evento ocurrió después del 40′ (1T) o del 80′ (2T) y cuenta en el tramo que termina ahí. */
  isAddedTime: boolean;
}

/** Período válido (1T o 2T) y minuto de juego presente; sin eso el evento no se puede ubicar. */
function isLocatable(event: ZoneLinkEvent): event is ZoneLinkEvent & { period: ZonePeriod } {
  return (event.period === 1 || event.period === 2) && Number.isFinite(event.matchTime) && event.matchTime >= 0;
}

/** Tramo que contiene el segundo de juego (rango semiabierto [inicio, fin)). */
function containingSegment(period: ZonePeriod, seconds: number, assignments: ZoneAssignmentResponse[]): ZoneAssignmentResponse | null {
  return assignments.find(zone =>
    zone.period === period &&
    zone.startMinute * SECONDS_PER_MINUTE <= seconds &&
    seconds < zone.endMinute * SECONDS_PER_MINUTE) ?? null;
}

/**
 * Zona de un evento calculada en el cliente con los tramos cargados. Solo para eventos que el servidor no zonificó
 * (los que se acaban de crear en la pantalla): los demás traen su `zone` de `GET /event/match/post-match`.
 */
export function zoneForEvent(
  event: Pick<ZoneLinkEvent, 'period' | 'matchTime'> & Partial<Pick<MatchTimelineEventResponse, 'teamPossession' | 'attributes'>>,
  assignments: ZoneAssignmentResponse[],
  rule?: ZoneRule | null
): ZoneCellRef | null {
  if (!isLocatable({ ...event, zone: null })) return null;
  const segment = containingSegment(event.period as ZonePeriod, effectiveMatchTime(event.period as ZonePeriod, event.matchTime), assignments);
  return segment ? { row: segment.row, col: segment.col } : null;
}

/**
 * Ubica un evento en los tramos del partido con la misma regla que el backend (`EventZoneResolver`): rango
 * semiabierto [inicio, fin) y tiempo añadido limitado al último segundo del 1T / 2T. Es la única función que busca
 * el tramo de un evento por su minuto.
 *
 * Si el tramo encontrado no coincide con `event.zone` (datos desfasados entre la zona y los tramos), no se devuelve:
 * Eventos muestra solo la zona, sin rango ni enlace al tramo.
 * Devuelve null si el evento no tiene un tiempo válido (no se puede ubicar).
 */
export function resolveEventZoneLink(event: ZoneLinkEvent, assignments: ZoneAssignmentResponse[]): EventZoneLink | null {
  if (!isLocatable(event)) return null;

  const seconds = effectiveMatchTime(event.period, event.matchTime);
  const minute = Math.floor(seconds / SECONDS_PER_MINUTE);
  const isAddedTime = event.matchTime >= periodRange(event.period).end * SECONDS_PER_MINUTE;

  const container = containingSegment(event.period, seconds, assignments);

  const segment = container && event.zone && container.row === event.zone.row && container.col === event.zone.col
    ? container
    : null;
  const gap = event.zone || container ? null : gapAtMinute(assignments, minute);

  return { segment, gap, minute, isAddedTime };
}

/** Minuto en que termina el tiempo del evento (40 o 80), para aclarar a qué tramo cuenta el tiempo añadido. */
function periodEndMinute(link: EventZoneLink): number {
  return (Math.floor(link.minute / ZONE_HALF_MINUTES) + 1) * ZONE_HALF_MINUTES;
}

/**
 * Descripción de la zona de un evento para tooltips y lectores de pantalla: la zona con su lateral y franja, el rango
 * del tramo si se conoce (o el hueco, si no tiene zona) y la aclaración del tiempo añadido.
 */
export function describeEventZone(zone: ZoneCellRef | null, link: EventZoneLink | null, fixedByType = false): string {
  const parts: string[] = [];
  if (zone) {
    parts.push(`${zoneLabel(zone)} · ${zoneName(zone)}`);
    if (link?.segment) parts.push(`tramo ${link.segment.startMinute}′–${link.segment.endMinute}′`);
  } else {
    parts.push('Sin zona');
    if (link?.gap) parts.push(`hueco ${link.gap.start}′–${link.gap.end}′`);
  }
  if (link?.isAddedTime) parts.push(`tiempo añadido: cuenta en el tramo que termina en ${periodEndMinute(link)}′`);
  return parts.join(' · ');
}
