import { needsCallUp, rosterGaps } from './roster-gaps';

describe('rosterGaps', () => {
  it('empty_roster: sin nómina, aunque llegue una nómina leída', () => {
    expect(rosterGaps(null, 'empty_roster')).toEqual({ kind: 'none', label: 'Sin nómina', missing: '15 titulares y hasta 8 suplentes' });
    expect(rosterGaps({ starters: 15, substitutes: 8 }, 'empty_roster').kind).toBe('none');
  });

  it('nómina leída sin titulares: sin nómina', () => {
    expect(rosterGaps({ starters: 0, substitutes: 0 }, 'not_started').kind).toBe('none');
  });

  it('suplentes 3/8: faltan 5', () => {
    expect(rosterGaps({ starters: 15, substitutes: 3 }, 'not_started')).toEqual({ kind: 'substitutes', count: 5, label: 'Suplentes 3/8', missing: '5 suplentes' });
  });

  it('un suplente que falta va en singular', () => {
    expect(rosterGaps({ starters: 15, substitutes: 7 }, 'not_started')).toEqual(jasmine.objectContaining({ count: 1, missing: '1 suplente' }));
  });

  it('nómina vieja con titulares de menos: gana sobre los suplentes', () => {
    expect(rosterGaps({ starters: 13, substitutes: 2 }, 'not_started')).toEqual({ kind: 'starters', count: 2, label: 'Titulares 13/15', missing: '2 titulares' });
  });

  it('15 titulares y 8 suplentes: completa', () => {
    expect(rosterGaps({ starters: 15, substitutes: 8 }, 'not_started')).toEqual({ kind: 'complete' });
  });

  it('sin nómina leída en un partido no_started: se desconoce, no se acusa', () => {
    expect(rosterGaps(null, 'not_started')).toEqual({ kind: 'unknown' });
  });

  it('needsCallUp: solo cuando falta algo conocido', () => {
    expect(needsCallUp(rosterGaps(null, 'empty_roster'))).toBeTrue();
    expect(needsCallUp(rosterGaps({ starters: 15, substitutes: 3 }, 'not_started'))).toBeTrue();
    expect(needsCallUp(rosterGaps({ starters: 15, substitutes: 8 }, 'not_started'))).toBeFalse();
    expect(needsCallUp(rosterGaps(null, 'not_started'))).toBeFalse();
  });
});
