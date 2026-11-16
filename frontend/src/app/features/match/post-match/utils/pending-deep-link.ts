import { ReviewFilters } from '../types/match-review.types';

/** `?pendientes=1` abre Eventos con «Solo sin jugador», para completar el análisis desde el Inicio. */
export const PENDING_QUERY_PARAM = 'pendientes';

export const wantsPendingOnly = (value: string | null): boolean => value === '1';

/** Filtros que dejan a la vista todas las jugadas sin jugador: ni período, equipo, búsqueda ni carriles ocultos las esconden. */
export function pendingOnlyFilters(): ReviewFilters {
  return { period: 'ALL', team: 'ALL', onlyUnassigned: true, searchTerm: '', hiddenLaneIds: [] };
}
