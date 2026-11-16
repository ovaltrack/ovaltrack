import { SCREEN_HELP, matchesScreen, screenHelpFor } from './screen-help';
import { DEFAULT_TOUR_STEPS } from './tour-steps';

describe('screenHelpFor', () => {
  it('toma la ayuda de la pantalla con cualquier id', () => {
    const step = screenHelpFor(SCREEN_HELP, '/divisions/abc/coaches');
    expect(step.title).toBe('El cuerpo técnico');
    expect(step.url).toBe('/divisions/abc/coaches');
    expect(step.placement).toBe('center');
  });

  it('distingue la pantalla del jugador de la de un partido suyo', () => {
    expect(screenHelpFor(SCREEN_HELP, '/players/p1/statistics').title).toBe('Estadísticas del jugador');
    expect(screenHelpFor(SCREEN_HELP, '/players/p1/statistics/m1').title).toBe('El jugador en este partido');
  });

  it('una pantalla sin ayuda escrita avisa y ofrece el recorrido', () => {
    expect(screenHelpFor(SCREEN_HELP, '/pantalla-nueva').body).toContain('Ver tutorial completo');
  });

  it('las pantallas del recorrido no se repiten en la ayuda escrita', () => {
    const tourScreens = DEFAULT_TOUR_STEPS.flatMap(step => (step.screen ? [step.screen] : []));
    SCREEN_HELP.forEach(help => {
      expect(tourScreens.some(screen => matchesScreen(screen, help.screen))).withContext(help.screen).toBeFalse();
    });
  });
});
