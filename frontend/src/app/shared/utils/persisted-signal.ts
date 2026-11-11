import { WritableSignal, signal } from '@angular/core';

/** Prefijo de todas las claves: permite borrarlas juntas al cerrar sesión (ver `clearPersistedSignals`). */
const KEY_PREFIX = 'ovaltrack.view.';

/** Lo mínimo que se usa del almacenamiento: `sessionStorage` en la app, uno en memoria en los specs. */
export type PersistedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export interface PersistedSignalOptions<T> {
  /** Descarta un valor guardado que ya no es válido (versión vieja, editado a mano); se usa `initial`. */
  isValid?: (value: unknown) => value is T;
  /** Por defecto `sessionStorage`; `null` = sin almacenamiento (la señal funciona igual, solo en memoria). */
  storage?: PersistedStorage | null;
}

/**
 * Señal cuyo valor sobrevive a recargar la página y a salir y volver a la pantalla (mientras dure la pestaña).
 * Pensada para preferencias de la vista (filtros, pestañas), no para datos: esos van en Dexie o en el backend.
 * Si el almacenamiento no está disponible (modo privado, cuota llena) se comporta como una señal común.
 */
export function persistedSignal<T>(key: string, initial: T, options: PersistedSignalOptions<T> = {}): WritableSignal<T> {
  const storage = options.storage === undefined ? browserSessionStorage() : options.storage;
  const storageKey = KEY_PREFIX + key;
  const state = signal<T>(readValue(storage, storageKey, initial, options.isValid));
  const setInMemory = state.set.bind(state);

  const set = (value: T): void => {
    setInMemory(value);
    writeValue(storage, storageKey, value);
  };
  state.set = set;
  state.update = updater => set(updater(state()));
  return state;
}

/** Borra todo lo guardado con `persistedSignal` (al cerrar sesión, para que otro usuario no lo herede). */
export function clearPersistedSignals(storage: PersistedStorage | null = browserSessionStorage()): void {
  if (!storage) return;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((storedKey): storedKey is string => storedKey?.startsWith(KEY_PREFIX) ?? false);
    keys.forEach(storedKey => storage.removeItem(storedKey));
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

function browserSessionStorage(): PersistedStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function readValue<T>(
  storage: PersistedStorage | null,
  storageKey: string,
  initial: T,
  isValid?: (value: unknown) => value is T,
): T {
  if (!storage) return initial;
  try {
    const raw = storage.getItem(storageKey);
    if (raw === null) return initial;
    const parsed: unknown = JSON.parse(raw);
    if (isValid) {
      return isValid(parsed) ? parsed : initial;
    }
    return parsed as T;
  } catch {
    return initial;
  }
}

function writeValue<T>(storage: PersistedStorage | null, storageKey: string, value: T): void {
  if (!storage) return;
  try {
    storage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Cuota llena o almacenamiento bloqueado: la señal sigue funcionando en memoria.
  }
}
