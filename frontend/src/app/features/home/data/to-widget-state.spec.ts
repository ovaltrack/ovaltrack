import { Subject, map, of, throwError } from 'rxjs';
import { WidgetState } from '../types/home.types';
import { Snapshot } from './dashboard-snapshot.cache';
import { WidgetSnapshot, toWidgetState } from './to-widget-state';

describe('toWidgetState', () => {
  function collect<T>(source: import('rxjs').Observable<T>, options = {}): WidgetState<T>[] {
    const states: WidgetState<T>[] = [];
    source.pipe(toWidgetState<T>(options)).subscribe(state => states.push(state));
    return states;
  }

  it('emite loading y luego ready con el dato y su fetchedAt', () => {
    const states = collect(of({ wins: 3 }), { now: () => 42 });
    expect(states).toEqual([
      { status: 'loading' },
      { status: 'ready', data: { wins: 3 }, fetchedAt: 42, stale: false }
    ]);
  });

  it('emite loading antes de que llegue la respuesta', () => {
    const response = new Subject<number>();
    const states = collect(response);
    expect(states).toEqual([{ status: 'loading' }]);
    response.next(1);
    expect(states.length).toBe(2);
  });

  it('una lista vacía es empty', () => {
    expect(collect(of([] as number[])).map(s => s.status)).toEqual(['loading', 'empty']);
  });

  it('null es empty', () => {
    expect(collect(of(null)).map(s => s.status)).toEqual(['loading', 'empty']);
  });

  it('isEmpty personalizado decide cuándo está vacío', () => {
    const states = collect(of({ total: 0 }), { isEmpty: (value: { total: number }) => value.total === 0 });
    expect(states[1].status).toBe('empty');
  });

  it('un error no se propaga: queda como estado error con mensaje', () => {
    const states = collect(throwError(() => new Error('500')));
    expect(states).toEqual([{ status: 'loading' }, { status: 'error', message: 'No pudimos cargar esto' }]);
  });

  it('el mensaje de error se puede personalizar', () => {
    const states = collect(throwError(() => new Error('x')), { errorMessage: 'Sin datos de forma' });
    expect(states[1]).toEqual({ status: 'error', message: 'Sin datos de forma' });
  });

  describe('con snapshot', () => {
    function fakeSnapshot(initial: Snapshot<number> | null) {
      const writes: { data: number; fetchedAt: number }[] = [];
      const snapshot: WidgetSnapshot<number> = {
        read: () => initial,
        write: (data, fetchedAt) => writes.push({ data, fetchedAt })
      };
      return { snapshot, writes };
    }

    it('guarda el snapshot con cada respuesta buena', () => {
      const { snapshot, writes } = fakeSnapshot(null);
      collect(of(7), { snapshot, now: () => 100 });
      expect(writes).toEqual([{ data: 7, fetchedAt: 100 }]);
    });

    it('no guarda un dato vacío', () => {
      const { snapshot, writes } = fakeSnapshot(null);
      collect(of(null), { snapshot });
      expect(writes).toEqual([]);
    });

    it('sin conexión y con snapshot muestra el snapshot sin pedir a la red', () => {
      const { snapshot } = fakeSnapshot({ data: 5, fetchedAt: 10 });
      let requested = false;
      const source = new Subject<number>();
      const states = collect<number>(source.pipe(map(value => { requested = true; return value; })), { snapshot, offline: true });
      expect(states).toEqual([{ status: 'loading' }, { status: 'ready', data: 5, fetchedAt: 10, stale: true }]);
      expect(requested).toBeFalse();
    });

    it('sin conexión y sin snapshot usa la fuente y marca el dato como stale', () => {
      const { snapshot } = fakeSnapshot(null);
      const states = collect(of(3), { snapshot, offline: true, now: () => 50 });
      expect(states[1]).toEqual({ status: 'ready', data: 3, fetchedAt: 50, stale: true });
    });

    it('un error con snapshot cae a la última vista buena', () => {
      const { snapshot } = fakeSnapshot({ data: 9, fetchedAt: 20 });
      const states = collect<number>(throwError(() => new Error('500')), { snapshot });
      expect(states[1]).toEqual({ status: 'ready', data: 9, fetchedAt: 20, stale: true });
    });

    it('un error sin snapshot sigue siendo error', () => {
      const { snapshot } = fakeSnapshot(null);
      const states = collect<number>(throwError(() => new Error('500')), { snapshot });
      expect(states[1].status).toBe('error');
    });
  });
});
