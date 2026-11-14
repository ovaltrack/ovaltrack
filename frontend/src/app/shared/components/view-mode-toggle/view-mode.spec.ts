import { STATS_VIEW_OPTIONS, isStatsViewMode } from './view-mode';

describe('isStatsViewMode', () => {
  it('acepta los tres modos, así lo guardado antes de sumar las barras sigue valiendo', () => {
    expect(['list', 'chart', 'bars'].every(isStatsViewMode)).toBeTrue();
  });

  it('descarta cualquier otro valor guardado', () => {
    expect(['table', 'CHART', '', null, undefined, 1].some(isStatsViewMode)).toBeFalse();
  });
});

describe('STATS_VIEW_OPTIONS', () => {
  it('ofrece cada modo una sola vez, con su etiqueta e ícono', () => {
    expect(STATS_VIEW_OPTIONS.map(option => option.mode)).toEqual(['list', 'chart', 'bars']);
    expect(STATS_VIEW_OPTIONS.map(option => option.label)).toEqual(['Lista', 'Donas', 'Barras']);
    expect(STATS_VIEW_OPTIONS.every(option => option.icon.startsWith('bi-'))).toBeTrue();
  });
});
