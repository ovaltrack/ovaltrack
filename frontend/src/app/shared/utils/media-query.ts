import { DestroyRef, Signal, signal } from '@angular/core';

/** Si la pantalla cumple la media query, siguiendo los cambios. Sin `matchMedia` (SSR o tests) es false. */
export function watchMediaQuery(query: string, destroyRef: DestroyRef): Signal<boolean> {
  if (typeof matchMedia !== 'function') return signal(false).asReadonly();

  const list = matchMedia(query);
  const matches = signal(list.matches);
  const onChange = (event: MediaQueryListEvent): void => matches.set(event.matches);
  list.addEventListener('change', onChange);
  destroyRef.onDestroy(() => list.removeEventListener('change', onChange));
  return matches.asReadonly();
}
