import { CoverageEvent } from '../../match/post-match/utils/review-coverage';
import { analysisCoverage, analysisTone, minutesWithoutZone } from './analysis-coverage';

describe('analysisCoverage', () => {
  const event = (playerId: string | null, teamPossession: CoverageEvent['teamPossession'], eventTypeId = 't'): CoverageEvent => ({ eventTypeId, playerId, teamPossession });
  const all = null;

  it('sin eventos es 100 %', () => {
    expect(analysisCoverage([], all)).toEqual({ totalEvents: 0, withoutPlayer: 0, percent: 100 });
  });

  it('cuenta las jugadas propias sin jugador', () => {
    const result = analysisCoverage([event('p1', 'OWN'), event(null, 'OWN'), event('  ', 'NEUTRAL'), event('p2', 'OWN')], all);
    expect(result).toEqual({ totalEvents: 4, withoutPlayer: 2, percent: 50 });
  });

  it('los eventos del rival no cuentan como pendientes', () => {
    const result = analysisCoverage([event(null, 'OPPONENT'), event(null, 'OPPONENT'), event('p1', 'OWN')], all);
    expect(result.withoutPlayer).toBe(0);
    expect(result.percent).toBe(100);
  });

  it('redondea el porcentaje', () => {
    expect(analysisCoverage([event('p', 'OWN'), event('p', 'OWN'), event(null, 'OWN')], all).percent).toBe(67);
  });

  it('coincide con post-partido: los eventos de tipos inactivos no cuentan (78 % y no 70 %)', () => {
    const events = [
      ...Array.from({ length: 6 }, () => event('p1', 'OWN', 'activo')),
      event(null, 'OWN', 'activo'), event(null, 'OWN', 'baja'), event(null, 'OPPONENT', 'activo'), event('', 'NEUTRAL', 'activo')
    ];
    expect(analysisCoverage(events, new Set(['activo'])).percent).toBe(78);
    expect(analysisCoverage(events, all).percent).toBe(70);
  });
});

describe('minutesWithoutZone', () => {
  it('sin tramos faltan los 80 minutos', () => {
    expect(minutesWithoutZone([])).toBe(80);
  });

  it('descuenta los tramos de ambos tiempos', () => {
    expect(minutesWithoutZone([
      { period: 1, startMinute: 0, endMinute: 40 },
      { period: 2, startMinute: 40, endMinute: 55 }
    ])).toBe(25);
  });
});

describe('analysisTone', () => {
  it('90 o más es bien, 60 o más es atención, menos es mal', () => {
    expect(analysisTone(100)).toBe('good');
    expect(analysisTone(90)).toBe('good');
    expect(analysisTone(89)).toBe('warn');
    expect(analysisTone(60)).toBe('warn');
    expect(analysisTone(59)).toBe('bad');
  });
});
