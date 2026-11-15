import { splitColumns } from './split-columns';

describe('splitColumns', () => {
  it('reparte los de índice par a la izquierda y los impares a la derecha', () => {
    expect(splitColumns([0, 1, 2, 3, 4])).toEqual([[0, 2, 4], [1, 3]]);
  });

  it('sin elementos quedan dos columnas vacías', () => {
    expect(splitColumns([])).toEqual([[], []]);
  });

  it('con uno solo la derecha queda vacía', () => {
    expect(splitColumns(['a'])).toEqual([['a'], []]);
  });
});
