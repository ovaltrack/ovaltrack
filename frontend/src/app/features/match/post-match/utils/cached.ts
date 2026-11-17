import { Observable, catchError, shareReplay, throwError } from 'rxjs';

/** Un recurso pedido una sola vez y compartido entre quienes lo leen, hasta que se invalida. */
export interface Cached<T> {
  /** Devuelve el pedido en curso o ya resuelto; sin caché, lo dispara. */
  get(): Observable<T>;
  /** La próxima lectura vuelve a pedir el recurso. */
  invalidate(): void;
}

/**
 * Cachea en memoria el resultado de `factory`. Un error no queda guardado: la próxima lectura reintenta.
 * Invalidar mientras hay un pedido en curso no lo cancela, pero quienes lean después reciben uno nuevo.
 */
export function cached<T>(factory: () => Observable<T>): Cached<T> {
  let shared$: Observable<T> | null = null;
  return {
    get: () => {
      if (shared$) return shared$;
      const current$: Observable<T> = factory().pipe(
        shareReplay({ bufferSize: 1, refCount: false }),
        catchError(error => {
          if (shared$ === current$) shared$ = null;
          return throwError(() => error);
        })
      );
      shared$ = current$;
      return current$;
    },
    invalidate: () => { shared$ = null; }
  };
}
