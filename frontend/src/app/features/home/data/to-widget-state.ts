import { Observable, OperatorFunction, catchError, defer, map, of, startWith } from 'rxjs';
import { WidgetState } from '../types/home.types';
import { Snapshot } from './dashboard-snapshot.cache';

export const WIDGET_ERROR_MESSAGE = 'No pudimos cargar esto';

/** Última vista buena de un widget: se lee sin conexión o ante un error, y se escribe con cada respuesta. */
export interface WidgetSnapshot<T> {
  read(): Snapshot<T> | null;
  write(data: T, fetchedAt: number): void;
}

export interface ToWidgetStateOptions<T> {
  /** Cuándo el dato cuenta como vacío; por defecto `null`, `undefined` o lista sin elementos. */
  isEmpty?: (value: T) => boolean;
  errorMessage?: string;
  now?: () => number;
  snapshot?: WidgetSnapshot<T>;
  /** Sin conexión y con snapshot se muestra el snapshot sin pedir nada a la red. */
  offline?: boolean;
}

const isNullOrEmptyList = (value: unknown): boolean =>
  value == null || (Array.isArray(value) && value.length === 0);

/**
 * Convierte una carga HTTP en el estado de un widget: emite `loading` enseguida y luego `ready`,
 * `empty` o `error`. El error nunca se propaga, así un widget que falla no tumba al resto.
 * Con `snapshot`, un error o la falta de conexión caen a la última vista buena marcada como `stale`.
 */
export function toWidgetState<T>(options: ToWidgetStateOptions<T> = {}): OperatorFunction<T, WidgetState<T>> {
  const { isEmpty = isNullOrEmptyList, errorMessage = WIDGET_ERROR_MESSAGE, now = Date.now, snapshot, offline = false } = options;
  const stale = ({ data, fetchedAt }: Snapshot<T>): WidgetState<T> => ({ status: 'ready', data, fetchedAt, stale: true });

  return (source: Observable<T>) => defer(() => {
    const cached = snapshot?.read() ?? null;
    if (offline && cached) return of(stale(cached));
    return source.pipe(
      map((value): WidgetState<T> => {
        if (isEmpty(value)) return { status: 'empty' };
        const fetchedAt = now();
        snapshot?.write(value, fetchedAt);
        return { status: 'ready', data: value, fetchedAt, stale: offline };
      }),
      catchError(() => of<WidgetState<T>>(cached ? stale(cached) : { status: 'error', message: errorMessage }))
    );
  }).pipe(startWith<WidgetState<T>>({ status: 'loading' }));
}
