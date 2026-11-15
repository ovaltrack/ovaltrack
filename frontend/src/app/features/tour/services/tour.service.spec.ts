import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { UserContextService } from '../../../core/services/user-context.service';
import { UserContext } from '../../auth/types/auth.types';
import { TOUR_STEPS } from '../tour-steps';
import { TourContext, TourStep } from '../types/tour.types';
import { TourContextService } from './tour-context.service';
import { of } from 'rxjs';
import { TourService } from './tour.service';

@Component({ standalone: true, template: '' })
class BlankComponent {}

const step = (id: string, route: (c: TourContext) => string | null, extra: Partial<TourStep> = {}): TourStep => ({
  id, route, anchor: id, title: id, body: `texto ${id}`, placement: 'bottom', mood: 'happy', ...extra
});

const STEPS: readonly TourStep[] = [
  step('a', () => '/home', { screen: '/home' }),
  step('b', () => '/home', { screen: '/home' }),
  step('c', c => (c.finishedMatchId ? `/post-match/${c.finishedMatchId}` : null), { screen: '/post-match/:id' }),
  step('d', c => (c.liveMatchId ? `/live/${c.liveMatchId}` : null)),
  step('e', () => '/divisions')
];

const staff = (userId: string, role: UserContext['role'] = 'COACH_ANALYST', tutorialPending = true): UserContext =>
  ({ userId, role, club: { id: 'c1' }, tutorialPending } as UserContext);

const FULL: TourContext = { divisionId: 'd1', upcomingMatchId: 'u1', liveMatchId: 'l1', finishedMatchId: 'f1' };

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

describe('TourService', () => {
  let service: TourService;
  let router: Router;
  let context: TourContext;
  const userContext = signal<UserContext | null>(null);

  let markTutorialSeen: jasmine.Spy;

  beforeEach(async () => {
    context = FULL;
    markTutorialSeen = jasmine.createSpy('markTutorialSeen').and.returnValue(of(undefined));
    userContext.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'home', component: BlankComponent },
          { path: 'club', component: BlankComponent },
          { path: 'divisions', component: BlankComponent },
          { path: 'post-match/:id', component: BlankComponent },
          { path: 'live/:id', component: BlankComponent }
        ]),
        { provide: TOUR_STEPS, useValue: STEPS },
        { provide: TourContextService, useValue: { load: () => Promise.resolve(context) } },
        { provide: UserContextService, useValue: { userContext, markTutorialSeen } }
      ]
    });
    service = TestBed.inject(TourService);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/club');
  });

  it('arranca inactiva', () => {
    expect(service.state().active).toBeFalse();
    expect(service.currentStep()).toBeNull();
  });

  it('start() resuelve las rutas reales, activa el primer paso y navega', async () => {
    expect(await service.start()).toBeTrue();

    expect(service.currentStep()?.id).toBe('a');
    expect(service.currentStep()?.body).toBe('texto a');
    expect(router.url).toBe('/home');
    expect(service.progress()).toEqual({ current: 1, total: 5 });
  });

  it('saltea los pasos de pantallas para las que el club no tiene datos', async () => {
    context = { ...FULL, liveMatchId: null };
    await service.start();

    expect(service.progress().total).toBe(4);
    await service.goTo(3);
    expect(service.currentStep()?.id).toBe('e');
  });

  it('start() sin pasos para mostrar no se activa', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TOUR_STEPS, useValue: [step('x', () => null)] },
        { provide: TourContextService, useValue: { load: () => Promise.resolve(context) } },
        { provide: UserContextService, useValue: { userContext, markTutorialSeen } }
      ]
    });
    const empty = TestBed.inject(TourService);
    expect(await empty.start()).toBeFalse();
    expect(empty.state().active).toBeFalse();
  });

  it('next() y prev() recorren los pasos entre pantallas', async () => {
    await service.start();
    await service.next();
    expect(service.currentStep()?.id).toBe('b');
    expect(router.url).toBe('/home');

    await service.next();
    expect(service.currentStep()?.id).toBe('c');
    expect(router.url).toBe('/post-match/f1');

    await service.prev();
    expect(service.currentStep()?.id).toBe('b');
    expect(router.url).toBe('/home');
  });

  it('prev() en el primer paso no hace nada', async () => {
    await service.start();
    await service.prev();
    expect(service.currentStep()?.id).toBe('a');
  });

  it('goTo() rechaza índices fuera de rango o con la guía inactiva', async () => {
    expect(await service.goTo(1)).toBeFalse();
    await service.start();
    expect(await service.goTo(-1)).toBeFalse();
    expect(await service.goTo(5)).toBeFalse();
    expect(await service.goTo(1.5)).toBeFalse();
    expect(await service.goTo(4)).toBeTrue();
    expect(service.isLast()).toBeTrue();
  });

  it('next() en el último paso termina la guía y vuelve a donde se lanzó', async () => {
    await service.start(4);
    await service.next();
    await tick();

    expect(service.state().active).toBeFalse();
    expect(router.url).toBe('/club');
  });

  it('exit() (saltar el tutorial) vuelve a la pantalla de origen', async () => {
    await service.start(2);
    service.exit();
    await tick();

    expect(service.currentStep()).toBeNull();
    expect(router.url).toBe('/club');
  });

  it('atrás del navegador mueve la guía al paso de esa pantalla', async () => {
    await service.start(2);
    await router.navigateByUrl('/home');
    expect(service.currentStep()?.id).toBe('a');
  });

  it('salir a una pantalla que no es de la guía la termina sin redirigir', async () => {
    await service.start();
    await router.navigateByUrl('/club');
    expect(service.state().active).toBeFalse();
    expect(router.url).toBe('/club');
  });

  it('una cuenta nueva la ve sola al llegar al inicio y queda marcada como vista en el backend', async () => {
    await router.navigateByUrl('/home');
    userContext.set(staff('u1'));
    TestBed.flushEffects();
    await tick();

    expect(service.state().active).toBeTrue();
    expect(markTutorialSeen).toHaveBeenCalledTimes(1);
  });

  it('arranca sola aunque el contexto llegue antes que la navegación al inicio (recién logueado)', async () => {
    userContext.set(staff('u1'));
    TestBed.flushEffects();
    await tick();
    expect(service.state().active).toBeFalse();

    await router.navigateByUrl('/home');
    await tick();
    expect(service.state().active).toBeTrue();
  });

  it('no arranca sola en cada inicio de sesión: sin la guía pendiente, ni si el rol no es del staff', async () => {
    await router.navigateByUrl('/home');
    userContext.set(staff('u1', 'COACH_ANALYST', false));
    TestBed.flushEffects();
    await tick();
    expect(service.state().active).toBeFalse();

    userContext.set(null);
    TestBed.flushEffects();
    userContext.set(staff('u3', 'PLAYER'));
    TestBed.flushEffects();
    await tick();
    expect(service.state().active).toBeFalse();
    expect(markTutorialSeen).not.toHaveBeenCalled();
  });

  it('en la misma sesión arranca una sola vez aunque vuelva al inicio', async () => {
    await router.navigateByUrl('/home');
    userContext.set(staff('u1'));
    TestBed.flushEffects();
    await tick();
    service.exit();
    await router.navigateByUrl('/club');
    await router.navigateByUrl('/home');
    await tick();

    expect(service.state().active).toBeFalse();
    expect(markTutorialSeen).toHaveBeenCalledTimes(1);
  });

  it('el «?» explica solo la pantalla actual, con cualquier partido, y no navega al cerrar', async () => {
    await router.navigateByUrl('/post-match/otro');
    expect(service.help()).toBeTrue();

    expect(service.mode()).toBe('help');
    expect(service.currentStep()?.id).toBe('c');
    expect(service.currentStep()?.url).toBe('/post-match/otro');
    expect(service.progress().total).toBe(1);

    await service.next();
    await tick();
    expect(service.state().active).toBeFalse();
    expect(router.url).toBe('/post-match/otro');
  });

  it('el «?» en una pantalla fuera del recorrido muestra su ayuda escrita, sin navegar', async () => {
    await router.navigateByUrl('/club');
    expect(service.help()).toBeTrue();

    expect(service.mode()).toBe('help');
    expect(service.currentStep()?.title).toBe('La ficha del club');
    expect(service.currentStep()?.placement).toBe('center');
    expect(router.url).toBe('/club');
  });

  it('desde la ayuda se puede pasar al recorrido completo', async () => {
    await router.navigateByUrl('/home');
    service.help();
    expect(service.progress().total).toBe(2);

    await service.start();
    expect(service.mode()).toBe('tour');
    expect(service.progress().total).toBe(5);
  });

});
