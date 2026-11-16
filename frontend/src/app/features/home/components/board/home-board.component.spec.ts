import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BoardModel, PrimaryAction } from '../../types/home.types';
import { HomeBoardComponent } from './home-board.component';

describe('HomeBoardComponent', () => {
  let fixture: ComponentFixture<HomeBoardComponent>;

  const capture: PrimaryAction = { kind: 'capture-live', label: 'Capturar en vivo', route: '/live-capture/m1', target: 'board', requiresConnection: false };
  const lineup: PrimaryAction = { kind: 'define-lineup', label: 'Definir alineación', route: '/selection-roster/m1', target: 'board', requiresConnection: true };
  const next: BoardModel = {
    kind: 'next', matchId: 'm1', divisionName: 'Superior', opponent: 'Trelew RC', city: null,
    dateLabel: 'Sáb 7 nov · mañana', time: '14:30', starters: 15, substitutes: 6, rosterGaps: { kind: 'substitutes', count: 2, label: 'Suplentes 6/8', missing: '2 suplentes' }, readyOffline: true, week: null
  };

  const render = (model: BoardModel, primary: PrimaryAction | null, online = true): void => {
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('primary', primary);
    fixture.componentRef.setInput('online', online);
    fixture.componentRef.setInput('now', new Date(2026, 10, 6, 18, 0));
    fixture.detectChanges();
  };

  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HomeBoardComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(HomeBoardComponent);
  });

  it('dibuja a lo sumo un botón primario', () => {
    render(next, capture);
    expect(el().querySelectorAll('.btn-on-board').length).toBe(1);
  });

  it('con semana de juego dibuja los 4 pasos, el actual con aria-current y los hechos con texto', () => {
    const steps = [
      { stage: 'analyze' as const, number: 1, name: 'Analizar', status: 'done' as const, subtitle: 'vs TRC · 100 %' },
      { stage: 'train' as const, number: 2, name: 'Entrenar', status: 'done' as const, subtitle: 'Hecho' },
      { stage: 'call-up' as const, number: 3, name: 'Convocar', status: 'current' as const, subtitle: 'Suplentes 6/8' },
      { stage: 'play' as const, number: 4, name: 'Jugar', status: 'pending' as const, subtitle: 'Sáb 7 · 14:30' }
    ];
    render({ ...next, week: { stage: 'call-up', label: 'Semana de juego · Superior · paso 3 de 4', steps } } as BoardModel, capture);
    expect(el().querySelectorAll('.step').length).toBe(4);
    expect(el().querySelector('.step.current')?.getAttribute('aria-current')).toBe('step');
    expect(el().querySelectorAll('.step[aria-current]').length).toBe(1);
    expect(el().textContent).toContain('paso 3 de 4');
    expect(el().querySelector('.step.done')?.textContent).toContain('hecho');
  });

  it('sin semana no dibuja pasos', () => {
    render(next, capture);
    expect(el().querySelector('app-board-steps')).toBeNull();
  });

  it('no dibuja el primario si su destino es otra tarjeta', () => {
    render(next, { ...capture, target: 'inbox-tile' });
    expect(el().querySelectorAll('.btn-on-board').length).toBe(0);
  });

  it('sin conexión deshabilita lo que necesita red y avisa', () => {
    render(next, lineup, false);
    expect(el().querySelector<HTMLButtonElement>('button.btn-on-board')?.disabled).toBeTrue();
    expect(el().textContent).toContain('Requiere conexión');
  });

  it('sin conexión la captura sigue activa', () => {
    render(next, capture, false);
    expect(el().querySelector('a.btn-on-board')).not.toBeNull();
  });

  it('el día de partido muestra la cuenta regresiva como timer', () => {
    render({ kind: 'match-day', matchId: 'm1', divisionName: 'Superior', opponent: 'Trelew RC', startsAt: new Date(2026, 10, 6, 20, 30, 15), starters: 15, substitutes: 8, week: null }, capture);
    expect(el().querySelector('[role="timer"]')?.textContent?.replace(/\s/g, '')).toBe('023015');
  });

  it('con el partido en otro dispositivo no ofrece capturar', () => {
    render({ kind: 'live-elsewhere', matchId: 'm1', opponent: 'Trelew RC', periodLabel: "2T 52'", ownScore: 7, opponentScore: 3, lastDataAt: '14:05', week: null }, null);
    expect(el().querySelectorAll('.btn-on-board').length).toBe(0);
    expect(el().textContent).toContain('otro dispositivo');
  });
});
