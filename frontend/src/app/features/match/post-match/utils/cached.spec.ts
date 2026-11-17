import { Observable, defer, of, throwError } from 'rxjs';
import { cached } from './cached';

describe('cached', () => {
  function counted<T>(produce: (call: number) => Observable<T>): { source: () => Observable<T>; calls: () => number } {
    let calls = 0;
    return { source: () => defer(() => produce(++calls)), calls: () => calls };
  }

  function read<T>(resource: { get(): Observable<T> }): T[] {
    const values: T[] = [];
    resource.get().subscribe(value => values.push(value));
    return values;
  }

  it('pide una sola vez aunque se lea varias', () => {
    const { source, calls } = counted(call => of(call));
    const resource = cached(source);

    expect(read(resource)).toEqual([1]);
    expect(read(resource)).toEqual([1]);
    expect(calls()).toBe(1);
  });

  it('vuelve a pedir después de invalidar', () => {
    const { source, calls } = counted(call => of(call));
    const resource = cached(source);

    read(resource);
    resource.invalidate();

    expect(read(resource)).toEqual([2]);
    expect(calls()).toBe(2);
  });

  it('no guarda el error: la próxima lectura reintenta', () => {
    const { source, calls } = counted(call => call === 1 ? throwError(() => new Error('falló')) : of('ok'));
    const resource = cached(source);
    let failure: unknown = null;

    resource.get().subscribe({ error: error => failure = error });
    expect(failure).toEqual(new Error('falló'));

    expect(read(resource)).toEqual(['ok']);
    expect(calls()).toBe(2);
  });

  it('un error viejo no descarta el pedido nuevo tras invalidar', () => {
    let fail: (error: Error) => void = () => undefined;
    let calls = 0;
    const resource = cached<string>(() => defer(() => {
      calls++;
      if (calls > 1) return of('nuevo');
      return new Observable<string>(subscriber => { fail = error => subscriber.error(error); });
    }));

    resource.get().subscribe({ error: () => undefined });
    resource.invalidate();
    expect(read(resource)).toEqual(['nuevo']);
    fail(new Error('tarde'));

    expect(read(resource)).toEqual(['nuevo']);
    expect(calls).toBe(2);
  });
});
