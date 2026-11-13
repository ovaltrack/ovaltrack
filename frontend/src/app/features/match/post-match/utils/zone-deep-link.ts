import { EventZoneLink } from './zone-event-link';
import { PeriodGap, TRACK_MINUTES, gapAtMinute } from './zone-track-layout';
import { ZoneAssignmentResponse } from '../../types/zone.types';

/** Parámetros de la URL de Zonas: `?tramo=<id>` abre ese tramo; `?minuto=<n>` (0–79, acumulado) lleva a ese minuto. */
export interface ZoneDeepLinkParams {
  tramo?: string | null;
  minuto?: string | null;
}

/** Qué hacer con el enlace una vez cargados los tramos del partido. */
export type ZoneDeepLinkTarget =
  | { kind: 'none' }
  | { kind: 'segment'; segment: ZoneAssignmentResponse }
  | { kind: 'gap'; gap: PeriodGap; minute: number }
  | { kind: 'invalid'; reason: 'tramo' | 'minuto' };

const INTEGER = /^\d+$/;

/**
 * Interpreta los parámetros contra los tramos del partido. Un tramo que no está entre ellos (borrado, de otro partido
 * o inventado) y un minuto fuera de 0–79 son inválidos: la pantalla los ignora y avisa. `tramo` manda sobre `minuto`;
 * un minuto que ya está dentro de un tramo abre ese tramo, y si cae en un hueco, lo precarga (con el minuto, para
 * proponer solo el segmento entre cortes).
 */
export function resolveZoneDeepLink(params: ZoneDeepLinkParams, assignments: ZoneAssignmentResponse[]): ZoneDeepLinkTarget {
  if (params.tramo) {
    const segment = assignments.find(a => a.id === params.tramo);
    return segment ? { kind: 'segment', segment } : { kind: 'invalid', reason: 'tramo' };
  }

  if (params.minuto === undefined || params.minuto === null) return { kind: 'none' };
  if (!INTEGER.test(params.minuto)) return { kind: 'invalid', reason: 'minuto' };

  const minute = Number(params.minuto);
  if (minute >= TRACK_MINUTES) return { kind: 'invalid', reason: 'minuto' };

  const segment = assignments.find(a => a.startMinute <= minute && minute < a.endMinute);
  if (segment) return { kind: 'segment', segment };

  const gap = gapAtMinute(assignments, minute);
  return gap ? { kind: 'gap', gap, minute } : { kind: 'invalid', reason: 'minuto' };
}

/**
 * Parámetros del enlace desde Eventos para un evento: su tramo si lo tiene; si no, su minuto (el hueco que lo
 * contiene). Sin tramo ni minuto conocido (ej. no se pudieron cargar los tramos) lleva a Zonas sin parámetros.
 */
export function zoneDeepLinkParams(link: EventZoneLink | null): Record<string, string> {
  if (!link) return {};
  if (link.segment) return { tramo: link.segment.id };
  return link.gap ? { minuto: String(link.minute) } : {};
}
