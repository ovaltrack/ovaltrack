import { ZoneAssignmentResponse, ZonePeriod } from '../../types/zone.types';
import { zoneLabel } from './zone-grid';
import { findGaps, periodRange } from './zone-stats';
import { FULL_TRACK, TramoCutMark, TrackWindow } from './zone-track-layout';

export interface DragRange {
  period: ZonePeriod;
  startMinute: number;
  endMinute: number;
}

/** Resultado de un arrastre: el rango provisorio (null si todavía no hay uno válido) y, si se frenó, el motivo. */
export interface DragResult {
  range: DragRange | null;
  notice: string | null;
}

type Segment = Pick<ZoneAssignmentResponse, 'id' | 'period' | 'startMinute' | 'endMinute' | 'row' | 'col'>;

/** Corte por try: el rango no puede dejarlo adentro (frena en `minute`, con el aviso «tope: <label>»). */
export type DragCut = Pick<TramoCutMark, 'period' | 'minute' | 'label'>;

/** Minuto entero bajo un punto horizontal de la pista: por defecto 0–80, o los límites del tramo mostrado. */
export function minuteAtPosition(offsetX: number, trackWidth: number, window: TrackWindow = FULL_TRACK): number {
  if (!(trackWidth > 0)) return window.start;
  const span = window.end - window.start;
  return Math.min(Math.max(window.start + Math.round((offsetX / trackWidth) * span), window.start), window.end);
}

function boundaryNotice(period: ZonePeriod, side: 'start' | 'end'): string {
  if (period === 1) return side === 'start' ? 'tope: inicio del partido' : 'tope: entretiempo';
  return side === 'start' ? 'tope: entretiempo' : 'tope: final del partido';
}

/** Motivo de frenado en `limit`: el borde del tiempo, un corte por try o el tramo vecino que ocupa el otro lado. */
function limitNotice(
  assignments: Segment[], period: ZonePeriod, limit: number, side: 'start' | 'end', cuts: DragCut[], ignoredId?: string
): string {
  const bounds = periodRange(period);
  if (limit === (side === 'start' ? bounds.start : bounds.end)) return boundaryNotice(period, side);

  const cut = cuts.find(c => c.period === period && c.minute === limit);
  if (cut) return `tope: ${cut.label}`;

  const neighbor = assignments.find(a =>
    a.id !== ignoredId && a.period === period && (side === 'start' ? a.endMinute === limit : a.startMinute === limit));
  return neighbor ? `tope: tramo ${zoneLabel(neighbor)}` : 'tope: límite del hueco';
}

/**
 * Crear arrastrando sobre un hueco: el punto de partida queda fijo (`anchor`) y el otro extremo sigue al cursor,
 * pero se frena en el borde del hueco (entretiempo, final del partido u otro tramo) o en un corte por try. Con menos
 * de 1 minuto no hay rango.
 */
export function dragNewRange(assignments: Segment[], period: ZonePeriod, anchor: number, current: number, cuts: DragCut[] = []): DragResult {
  const gap = findGaps(assignments, period).find(g => anchor >= g.start && anchor <= g.end);
  if (!gap) return { range: null, notice: 'No hay un hueco libre en ese minuto' };

  // Un corte por try parte el hueco: el rango no puede dejarlo adentro
  const walls = cuts.filter(c => c.period === period && c.minute > gap.start && c.minute < gap.end).map(c => c.minute);
  const lower = Math.max(gap.start, ...walls.filter(wall => wall <= anchor));
  const upper = Math.min(gap.end, ...walls.filter(wall => wall > anchor));

  const lowest = Math.min(anchor, current);
  const highest = Math.max(anchor, current);
  const startMinute = Math.max(lowest, lower);
  const endMinute = Math.min(highest, upper);

  let notice: string | null = null;
  if (current < lower) notice = limitNotice(assignments, period, lower, 'start', cuts);
  else if (current > upper) notice = limitNotice(assignments, period, upper, 'end', cuts);

  return { range: endMinute - startMinute >= 1 ? { period, startMinute, endMinute } : null, notice };
}

/**
 * Estirar o achicar un tramo desde uno de sus bordes. No puede cruzar el entretiempo ni un corte por try, pisar al
 * vecino ni quedar de menos de 1 minuto. Devuelve siempre el rango resultante (puede ser el original).
 */
export function resizeRange(assignments: Segment[], segment: Segment, edge: 'start' | 'end', minute: number, cuts: DragCut[] = []): DragResult {
  const others = assignments.filter(a => a.id !== segment.id && a.period === segment.period);
  const bounds = periodRange(segment.period);
  const original: DragRange = { period: segment.period, startMinute: segment.startMinute, endMinute: segment.endMinute };

  const walls = cuts.filter(c => c.period === segment.period).map(c => c.minute);

  if (edge === 'start') {
    const lowest = Math.max(bounds.start, ...others.filter(a => a.endMinute <= segment.startMinute).map(a => a.endMinute),
      ...walls.filter(wall => wall < segment.endMinute));
    const highest = segment.endMinute - 1;
    const startMinute = Math.min(Math.max(minute, lowest), highest);
    const notice = minute < lowest ? limitNotice(assignments, segment.period, lowest, 'start', cuts, segment.id)
      : minute > highest ? 'El tramo debe durar al menos 1 minuto' : null;
    return { range: { ...original, startMinute }, notice };
  }

  const lowest = segment.startMinute + 1;
  const highest = Math.min(bounds.end, ...others.filter(a => a.startMinute >= segment.endMinute).map(a => a.startMinute),
    ...walls.filter(wall => wall > segment.startMinute));
  const endMinute = Math.min(Math.max(minute, lowest), highest);
  const notice = minute > highest ? limitNotice(assignments, segment.period, highest, 'end', cuts, segment.id)
    : minute < lowest ? 'El tramo debe durar al menos 1 minuto' : null;
  return { range: { ...original, endMinute }, notice };
}
