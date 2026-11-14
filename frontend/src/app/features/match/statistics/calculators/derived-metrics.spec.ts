import { computeMatchStatistics } from './match-statistics-calculator';
import { DerivedMetric, StatView } from '../types/statistic.types';
import { LiveCaptureEventType } from '../../types/event-type.types';
import { LocalMatchEvent } from '../../types/event.types';
import { buildEventType, buildLocalEvent } from '../../../../testing/offline-test-helpers';

const setPieceField = (key: string) => ({
  key, label: 'Resultado', type: 'select' as const, phase: 'live' as const, required: true,
  options: ['won_clean', 'lost', 'lost_own', 'penalty_for', 'penalty_against'].map(value => ({ value, label: value })),
});
const kickField = { key: 'wasSuccessful', label: 'Resultado', type: 'boolean' as const, phase: 'live' as const, required: true, effects: ['scoring' as const] };

const types: LiveCaptureEventType[] = [
  buildEventType({ id: 'scrum', code: 'SCRUM', name: 'Scrum', actor: 'ATTACKING', statView: ['intermediate'], templateEventFields: [setPieceField('scrumResult')] }),
  buildEventType({ id: 'lineout', code: 'LINEOUT', name: 'Line-out', actor: 'ATTACKING', statView: ['intermediate'], templateEventFields: [setPieceField('lineResult')] }),
  buildEventType({ id: 'conversion', code: 'CONVERSION', name: 'Conversión', isScoring: true, points: 2, actor: 'ATTACKING', statView: ['basic', 'intermediate'], templateEventFields: [kickField] }),
  buildEventType({ id: 'penalty-kick', code: 'PENALTY_KICK', name: 'Kick H', isScoring: true, points: 3, actor: 'ATTACKING', statView: ['basic', 'intermediate'], templateEventFields: [kickField] }),
  buildEventType({ id: 'penalty', code: 'PENALTY_CONCEDED', name: 'Penal', actor: 'CHOOSE', statView: ['basic', 'intermediate'] }),
  buildEventType({ id: 'tackle-made', code: 'TACKLE_MADE', name: 'Tackle completado', actor: 'DEFENDING', statView: [] }),
  buildEventType({ id: 'tackle-missed', code: 'TACKLE_MISSED', name: 'Tackle fallado', actor: 'DEFENDING', statView: [] }),
  buildEventType({ id: 'turnover', code: 'TURNOVER_WON', name: 'Turnover', actor: 'DEFENDING', statView: ['intermediate'] }),
];

let sequence = 0;
const event = (eventTypeId: string, teamPossession: 'OWN' | 'OPPONENT', attributes: Record<string, unknown> = {}): LocalMatchEvent => {
  sequence++;
  return buildLocalEvent({ id: `e-${sequence}`, clientEventId: `e-${sequence}`, localSequence: sequence, eventTypeId, teamPossession, attributes });
};

const events = [
  // Scrums: propio 2 de 3 ganados (uno sin resultado no cuenta); rival 0 de 1.
  event('scrum', 'OWN', { scrumResult: 'won_clean' }),
  event('scrum', 'OWN', { scrumResult: 'penalty_for' }),
  event('scrum', 'OWN', { scrumResult: 'lost_own' }),
  event('scrum', 'OWN'),
  event('scrum', 'OPPONENT', { scrumResult: 'penalty_against' }),
  // Line-outs: propio 1 de 2.
  event('lineout', 'OWN', { lineResult: 'won_clean' }),
  event('lineout', 'OWN', { lineResult: 'lost' }),
  // Palos: propio 2 de 3 (conversión + penal); rival 0 de 1.
  event('conversion', 'OWN', { wasSuccessful: true }),
  event('conversion', 'OWN', { wasSuccessful: false }),
  event('penalty-kick', 'OWN', { wasSuccessful: true }),
  event('penalty-kick', 'OPPONENT', { wasSuccessful: false }),
  // Penales concedidos: propio 1, rival 3.
  event('penalty', 'OWN'),
  event('penalty', 'OPPONENT'),
  event('penalty', 'OPPONENT'),
  event('penalty', 'OPPONENT'),
  // Tackles propios: 3 de 4.
  event('tackle-made', 'OWN'),
  event('tackle-made', 'OWN'),
  event('tackle-made', 'OWN'),
  event('tackle-missed', 'OWN'),
  // Turnovers: propio 1, rival 2.
  event('turnover', 'OWN'),
  event('turnover', 'OPPONENT'),
  event('turnover', 'OPPONENT'),
];

const derived = (view: StatView, list = events): DerivedMetric[] => computeMatchStatistics(list, types, view).derived;
const metric = (view: StatView, id: string): DerivedMetric | undefined => derived(view).find(candidate => candidate.id === id);

describe('computeDerivedMetrics', () => {
  it('muestra solo las métricas cuyos tipos están en la vista', () => {
    expect(derived('basic').map(m => m.id)).toEqual(['goal-kicking', 'penalty-balance']);
    expect(derived('intermediate').map(m => m.id))
      .toEqual(['scrum-success', 'lineout-success', 'goal-kicking', 'penalty-balance', 'turnover-balance']);
    expect(derived('full').map(m => m.id)).toEqual([
      'scrum-success', 'lineout-success', 'goal-kicking', 'penalty-balance', 'tackle-effectiveness', 'turnover-balance',
    ]);
  });

  it('formaciones fijas: ganadas (limpia o penal a favor) sobre las de saque propio con resultado', () => {
    expect(metric('intermediate', 'scrum-success')?.value).toEqual({ own: 66.7, opponent: 0 });
    expect(metric('intermediate', 'lineout-success')?.value).toEqual({ own: 50, opponent: null });
  });

  it('efectividad a los palos suma conversiones y penales', () => {
    expect(metric('basic', 'goal-kicking')?.value).toEqual({ own: 66.7, opponent: 0 });
  });

  it('balance de penales: positivo cuando el rival concede más', () => {
    const balance = metric('basic', 'penalty-balance');
    expect(balance?.value).toEqual({ own: 2, opponent: -2 });
    expect(balance?.status).toEqual({ label: 'Favorable', type: 'success' });
  });

  it('efectividad de tackles y balance de turnovers', () => {
    expect(metric('full', 'tackle-effectiveness')?.value).toEqual({ own: 75, opponent: null });
    expect(metric('full', 'tackle-effectiveness')?.status).toEqual({ label: 'Bien', type: 'success' });
    const turnovers = metric('full', 'turnover-balance');
    expect(turnovers?.value).toEqual({ own: -1, opponent: 1 });
    expect(turnovers?.status).toEqual({ label: 'Desfavorable', type: 'warning' });
  });

  it('sin eventos no hay porcentajes ni estado', () => {
    const empty = computeMatchStatistics([], types, 'full').derived;
    expect(empty.find(m => m.id === 'scrum-success')?.value).toEqual({ own: null, opponent: null });
    expect(empty.find(m => m.id === 'penalty-balance')?.status).toEqual({ label: 'Sin datos', type: 'neutral' });
  });
});
