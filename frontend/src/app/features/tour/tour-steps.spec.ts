import { DEFAULT_TOUR_STEPS, helpStepsFor, resolveTourSteps } from './tour-steps';
import { TourContext } from './types/tour.types';

describe('resolveTourSteps', () => {
  const full: TourContext = { divisionId: 'd1', upcomingMatchId: 'u1', liveMatchId: 'l1', finishedMatchId: 'f1' };

  it('con todos los datos recorre todas las pantallas reales', () => {
    const steps = resolveTourSteps(DEFAULT_TOUR_STEPS, full);
    expect(steps.length).toBe(DEFAULT_TOUR_STEPS.length);
    expect(steps.map(step => step.url)).toContain('/selection-roster/u1');
    expect(steps.map(step => step.url)).toContain('/live-capture/l1');
    expect(steps.map(step => step.url)).toContain('/post-match/f1/zones');
    expect(steps[steps.length - 1].url).toBe('/post-match/f1/statistics');
  });

  it('un club sin partidos ve las pantallas que tiene y la vista previa de las demás', () => {
    const steps = resolveTourSteps(DEFAULT_TOUR_STEPS, { ...full, upcomingMatchId: null, liveMatchId: null, finishedMatchId: null });
    expect(steps.map(step => step.id)).toEqual([
      'welcome', 'home-board', 'division-list', 'squad', 'roster-field', 'live-scoreboard', 'pm-timeline', 'zones-grid', 'stats-summary', 'finish'
    ]);
    expect(steps[steps.length - 1].url).toBe('/home');
  });

  it('la vista previa queda centrada en la pantalla anterior, con su texto y su captura', () => {
    const steps = resolveTourSteps(DEFAULT_TOUR_STEPS, { ...full, liveMatchId: null });
    const index = steps.findIndex(step => step.id === 'live-scoreboard');
    const preview = steps[index];

    expect(preview.url).toBe(steps[index - 1].url);
    expect(preview.placement).toBe('center');
    expect(preview.body).toContain('si no hay señal');
    expect(preview.image?.src).toBe('assets/landing/live-capture');
    expect(steps.map(step => step.id)).not.toContain('live-catalog');
    expect(steps.find(step => step.id === 'pm-timeline')?.image).toBeUndefined();
  });

  it('sin vista previa ni datos el paso se saltea', () => {
    const steps = resolveTourSteps(DEFAULT_TOUR_STEPS, { ...full, divisionId: null });
    expect(steps.map(step => step.id)).not.toContain('squad');
  });

  it('cada paso señala un ancla y tiene texto', () => {
    DEFAULT_TOUR_STEPS.forEach(step => {
      expect(step.anchor.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      if (step.preview) {
        expect(step.preview.body.length).toBeGreaterThan(0);
        expect(step.preview.image?.alt.length ?? 1).toBeGreaterThan(0);
      }
    });
  });

  it('la ayuda de una pantalla toma sus pasos con cualquier partido y sobre la URL actual', () => {
    const steps = helpStepsFor(DEFAULT_TOUR_STEPS, '/post-match/xyz/zones');
    expect(steps.map(step => step.id)).toEqual(['zones-grid', 'zones-panel']);
    expect(steps.every(step => step.url === '/post-match/xyz/zones')).toBeTrue();
    expect(helpStepsFor(DEFAULT_TOUR_STEPS, '/post-match/xyz').map(step => step.id)).toEqual(['pm-timeline', 'pm-table']);
  });

  it('las pantallas sin guion no tienen ayuda propia', () => {
    expect(helpStepsFor(DEFAULT_TOUR_STEPS, '/members')).toEqual([]);
  });
});
