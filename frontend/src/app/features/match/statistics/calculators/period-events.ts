import { StatisticEvent } from '../types/statistic.types';

/**
 * Eventos activos del período (los de período null cuentan en ambos). Sin período: partido completo.
 * Un evento sin `active` (los del timeline del post-partido) ya es activo.
 */
export function eventsOfPeriod<T extends StatisticEvent>(events: T[], period?: number): T[] {
  return events.filter(event => event.active !== false && (period === undefined || event.period === null || event.period === undefined || event.period === period));
}
