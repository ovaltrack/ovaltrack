import { PersistedStorage, clearPersistedSignals, oneOf, persistedSignal } from './persisted-signal';

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

describe('persistedSignal con clave asignada después (useKey)', () => {
  it('sin clave no guarda nada', () => {
    const storage = memoryStorage();
    persistedSignal<string>(null, 'ALL', { storage }).set('OWN');

    expect(storage.dump()).toEqual({});
  });

  it('al asignar la clave carga lo guardado para ella, y cada partido tiene lo suyo', () => {
    const storage = memoryStorage();
    const possession = persistedSignal<string>(null, 'ALL', { storage });
    possession.useKey('post-match.match-1.possession');
    possession.set('OWN');

    possession.useKey('post-match.match-2.possession');
    expect(possession()).withContext('otro partido arranca con el valor inicial').toBe('ALL');

    possession.useKey('post-match.match-1.possession');
    expect(possession()).toBe('OWN');
  });

  it('useKey(null) vuelve al valor inicial sin borrar lo guardado', () => {
    const storage = memoryStorage();
    const possession = persistedSignal<string>('post-match.match-1.possession', 'ALL', { storage });
    possession.set('OWN');

    possession.useKey(null);
    possession.set('ALL');

    expect(possession()).toBe('ALL');
    expect(persistedSignal('post-match.match-1.possession', 'ALL', { storage })()).toBe('OWN');
  });
});

describe('oneOf', () => {
  it('acepta solo las opciones del filtro', () => {
    const isPeriod = oneOf<'ALL' | 1 | 2>(['ALL', 1, 2]);

    expect([isPeriod('ALL'), isPeriod(1), isPeriod(2), isPeriod('1'), isPeriod(3), isPeriod(null)])
      .toEqual([true, true, true, false, false, false]);
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
