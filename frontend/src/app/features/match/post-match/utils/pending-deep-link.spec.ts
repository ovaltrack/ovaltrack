import { pendingOnlyFilters, wantsPendingOnly } from './pending-deep-link';

describe('pending-deep-link', () => {
  it('solo pendientes=1 activa el filtro', () => {
    expect(wantsPendingOnly('1')).toBeTrue();
    expect(wantsPendingOnly('0')).toBeFalse();
    expect(wantsPendingOnly('true')).toBeFalse();
    expect(wantsPendingOnly(null)).toBeFalse();
  });

  it('los filtros dejan solo «sin jugador» y nada más que lo oculte', () => {
    expect(pendingOnlyFilters()).toEqual({ period: 'ALL', team: 'ALL', onlyUnassigned: true, searchTerm: '', hiddenLaneIds: [] });
  });
});
