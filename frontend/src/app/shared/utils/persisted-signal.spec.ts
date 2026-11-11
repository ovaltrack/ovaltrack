import { PersistedStorage, clearPersistedSignals, persistedSignal } from './persisted-signal';

/** Almacenamiento en memoria con la misma interfaz que `sessionStorage`. */
function memoryStorage(initial: Record<string, string> = {}): PersistedStorage & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
    dump: () => Object.fromEntries(data),
  };
}

const isString = (value: unknown): value is string => typeof value === 'string';

describe('persistedSignal', () => {
  it('sin nada guardado arranca con el valor inicial', () => {
    const filter = persistedSignal('filter', 'all', { storage: memoryStorage() });

    expect(filter()).toBe('all');
  });

  it('guarda cada cambio y lo recupera al crearse de nuevo (recarga o volver a la pantalla)', () => {
    const storage = memoryStorage();
    persistedSignal('filter', 'all', { storage }).set('finished');

    expect(persistedSignal('filter', 'all', { storage })()).toBe('finished');
  });

  it('update también guarda el valor', () => {
    const storage = memoryStorage();
    persistedSignal('cards', false, { storage }).update(value => !value);

    expect(persistedSignal('cards', false, { storage })()).toBeTrue();
  });

  it('descarta un valor guardado que ya no es válido', () => {
    const storage = memoryStorage({ 'ovaltrack.view.filter': JSON.stringify(42) });

    expect(persistedSignal('filter', 'all', { storage, isValid: isString })()).toBe('all');
  });

  it('descarta un valor guardado que no es JSON', () => {
    const storage = memoryStorage({ 'ovaltrack.view.filter': '{roto' });

    expect(persistedSignal('filter', 'all', { storage })()).toBe('all');
  });

  it('sin almacenamiento funciona como una señal común', () => {
    const filter = persistedSignal('filter', 'all', { storage: null });
    filter.set('finished');

    expect(filter()).toBe('finished');
  });

  it('si el almacenamiento falla al guardar, el valor queda igual en memoria', () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    const filter = persistedSignal('filter', 'all', { storage });

    filter.set('finished');

    expect(filter()).toBe('finished');
  });
});

describe('clearPersistedSignals', () => {
  it('borra solo lo guardado con persistedSignal', () => {
    const storage = memoryStorage({ 'auth_token': 'token', 'otra-app': 'x' });
    persistedSignal('filter', 'all', { storage }).set('finished');
    persistedSignal('division', '', { storage }).set('division-1');

    clearPersistedSignals(storage);

    expect(storage.dump()).toEqual({ 'auth_token': 'token', 'otra-app': 'x' });
  });
});
