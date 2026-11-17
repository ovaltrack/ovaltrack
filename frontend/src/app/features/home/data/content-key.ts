import { WidgetState } from '../types/home.types';

/**
 * Recuerda el último contenido de un widget y dice si uno nuevo es distinto. Compara los datos, no `fetchedAt`
 * ni `stale`: el snapshot y la respuesta con los mismos datos cuentan como iguales.
 */
export class ContentKey {
  private last: string | null = null;

  changed<T>(state: WidgetState<T>): boolean {
    const key = state.status === 'ready' ? `ready:${JSON.stringify(state.data)}` : state.status;
    if (key === this.last) return false;
    this.last = key;
    return true;
  }
}
