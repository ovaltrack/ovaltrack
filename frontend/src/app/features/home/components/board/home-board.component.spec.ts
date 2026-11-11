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
    dateLabel: 'Sáb 7 nov · mañana', time: '14:30', starters: 15, substitutes: 6, readyOffline: true
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

  it('no dibuja el primario si su destino es otra tarjeta', () => {
    render(next, { ...capture, target: 'debt-tile' });
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
    render({ kind: 'match-day', matchId: 'm1', divisionName: 'Superior', opponent: 'Trelew RC', startsAt: new Date(2026, 10, 6, 20, 30, 15), starters: 15, substitutes: 8 }, capture);
    expect(el().querySelector('[role="timer"]')?.textContent?.replace(/\s/g, '')).toBe('023015');
  });

  it('con el partido en otro dispositivo no ofrece capturar', () => {
    render({ kind: 'live-elsewhere', matchId: 'm1', opponent: 'Trelew RC', ownScore: 7, opponentScore: 3, lastDataAt: '14:05' }, null);
    expect(el().querySelectorAll('.btn-on-board').length).toBe(0);
    expect(el().textContent).toContain('otro dispositivo');
  });
});
