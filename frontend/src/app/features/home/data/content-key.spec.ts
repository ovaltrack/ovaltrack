import { ContentKey } from './content-key';

describe('ContentKey', () => {
  it('el snapshot y la respuesta con los mismos datos cuentan como iguales', () => {
    const key = new ContentKey();
    expect(key.changed({ status: 'ready', data: [1, 2], fetchedAt: 10, stale: true })).toBeTrue();
    expect(key.changed({ status: 'ready', data: [1, 2], fetchedAt: 99, stale: false })).toBeFalse();
  });

  it('datos distintos cuentan como cambio', () => {
    const key = new ContentKey();
    key.changed({ status: 'ready', data: [1], fetchedAt: 10, stale: true });
    expect(key.changed({ status: 'ready', data: [1, 2], fetchedAt: 20, stale: false })).toBeTrue();
  });

  it('pasar de datos a vacío o error también es cambio', () => {
    const key = new ContentKey();
    key.changed({ status: 'ready', data: [1], fetchedAt: 10, stale: true });
    expect(key.changed({ status: 'empty' })).toBeTrue();
    expect(key.changed({ status: 'error', message: 'x' })).toBeTrue();
    expect(key.changed({ status: 'error', message: 'x' })).toBeFalse();
  });
});
