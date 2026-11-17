import { Observable, catchError, map, of } from 'rxjs';
import { activeTypeIdsOf } from '../../match/post-match/utils/review-coverage';
import { EventTypeService } from '../../match/services/event-type.service';

/** Ids de los tipos activos del catálogo (con su caché offline); si no se puede leer, `null`: no se filtra nada. */
export function loadActiveTypeIds(service: EventTypeService): Observable<ReadonlySet<string> | null> {
  return service.getAll().pipe(map(types => activeTypeIdsOf(types)), catchError(() => of(null)));
}
