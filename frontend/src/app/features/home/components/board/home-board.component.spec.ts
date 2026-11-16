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
    dateLabel: 'Sáb 7 nov · mañana', time: '14:30', starters: 15, substitutes: 6, rosterGaps: { kind: 'substitutes', count: 2, label: 'Suplentes 6/8', missing: '2 suplentes' }, readyOffline: true, squadSize: null, callUp: null, week: null
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

  it('en curso acá: los últimos eventos van en un panel lateral y el chip dice «Sin señal: listo»', () => {
    render({
      kind: 'live-here', matchId: 'm1', opponent: 'Trelew RC', periodLabel: "2T 52'", ownScore: 21, opponentScore: 13, halftime: false,
      recent: [{ label: 'Try', minute: "51'" }, { label: 'Penal', minute: "47'" }], week: null
    }, capture);
    expect(el().querySelector('app-board-panel')?.textContent).toContain('Últimos eventos');
    expect(el().querySelectorAll('app-board-panel li').length).toBe(2);
    expect(el().textContent).toContain('Sin señal: listo');
  });

  it('analysis: título, chips de lo que falta, anillo, «Ver resumen» y panel «Después»', () => {
    render({
      kind: 'analysis', matchId: 'm9', divisionName: 'Superior', title: 'Cerrá el análisis del sábado', subtitle: 'vs Trelew · Ganado 21–13 · Sáb 14 nov',
      percent: 85, withoutPlayer: 12, minutesWithoutZone: 9, after: { title: 'vs CRC · Sáb 21 nov · 15:30', detail: 'En 5 días · nómina sin armar todavía' }, week: null
    }, { kind: 'complete-analysis', label: 'Completar análisis', route: '/post-match/m9', queryParams: { pendientes: 1 }, target: 'board', requiresConnection: true });
    expect(el().textContent).toContain('Cerrá el análisis del sábado');
    expect(el().textContent).toContain('12 jugadas sin jugador');
    expect(el().textContent).toContain('9′ sin zona');
    expect(el().querySelector('app-analysis-ring [role="img"]')?.getAttribute('aria-label')).toBe('Análisis cargado al 85 por ciento');
    expect(el().querySelector('a.btn-on-board-outline')?.getAttribute('href')).toBe('/post-match/m9/statistics');
    expect(el().querySelector('a.btn-on-board')?.getAttribute('href')).toBe('/post-match/m9?pendientes=1');
    expect(el().querySelectorAll('.btn-on-board').length).toBe(1);
    expect(el().querySelector('app-board-panel')?.textContent).toContain('Después: paso 4');
  });

  it('analysis sin partido próximo no dibuja el panel «Después»', () => {
    render({
      kind: 'analysis', matchId: 'm9', divisionName: 'Superior', title: 'Cerrá el análisis', subtitle: 'vs Trelew', percent: 100, withoutPlayer: 0, minutesWithoutZone: 4, after: null, week: null
    }, null);
    expect(el().querySelector('app-board-panel')).toBeNull();
    expect(el().textContent).not.toContain('sin jugador');
  });

  it('Convocar: título, chips de lo que falta, plantel, nota de conexión y panel «Faltan en la nómina»', () => {
    render({
      ...next, squadSize: 52, rosterGaps: { kind: 'substitutes', count: 5, label: 'Suplentes 3/8', missing: '5 suplentes' },
      callUp: { title: 'Armá la nómina del sábado', subtitle: 'vs CRC · Sáb 21 nov · 15:30', dayLabel: 'Sáb 21 nov', inLabel: 'En 2 días · vs CRC' }
    } as BoardModel, lineup);
    expect(el().textContent).toContain('Armá la nómina del sábado');
    expect(el().textContent).toContain('Suplentes 3/8');
    expect(el().textContent).toContain('52 en el plantel');
    expect(el().textContent).toContain('Guardar la nómina requiere conexión.');
    const panels = Array.from(el().querySelectorAll('app-board-panel')).map(panel => panel.textContent ?? '');
    expect(panels.some(text => text.includes('Próximo partido') && text.includes('En 2 días · vs CRC'))).toBeTrue();
    expect(panels.some(text => text.includes('Faltan en la nómina') && text.includes('5 suplentes'))).toBeTrue();
    expect(el().querySelectorAll('.btn-on-board').length).toBe(1);
  });

  it('Convocar sin conexión: «Definir alineación» deshabilitado con «Requiere conexión»', () => {
    render({
      ...next, callUp: { title: 'Armá la nómina del sábado', subtitle: 'vs CRC', dayLabel: 'Sáb 21 nov', inLabel: 'En 2 días · vs CRC' },
      rosterGaps: { kind: 'none', label: 'Sin nómina', missing: '15 titulares y hasta 8 suplentes' }
    } as BoardModel, lineup, false);
    expect(el().querySelector<HTMLButtonElement>('button.btn-on-board')?.disabled).toBeTrue();
    expect(el().textContent).toContain('Requiere conexión');
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

  it('en otro dispositivo muestra el período del último dato, la hora y el panel «Qué pasa después»', () => {
    render({ kind: 'live-elsewhere', matchId: 'm1', opponent: 'Trelew RC', periodLabel: "2T 52'", ownScore: 7, opponentScore: 3, lastDataAt: '14:05', week: null }, null);
    expect(el().textContent).toContain("En curso · 2T 52'");
    expect(el().textContent).toContain('último dato 14:05');
    expect(el().querySelector('app-board-panel')?.textContent).toContain('Qué pasa después');
    expect(el().querySelector('.score')?.getAttribute('aria-label')).toBe('Marcador 7 a 3');
  });

  describe('club-agenda', () => {
    const rows = [
      { matchId: 'a', dayLabel: 'Sáb 21', timeLabel: '10:00', division: 'M15', opponent: 'TRC', chip: { label: 'Sin entrenador', tone: 'warn' as const } },
      { matchId: 'b', dayLabel: 'Sáb 21', timeLabel: '14:30', division: 'Superior', opponent: 'CRC', chip: { label: 'Nómina lista', tone: 'ok' as const } }
    ];
    const week: BoardModel = { kind: 'club-agenda', mode: 'week', label: 'Fin de semana · Sáb 21', title: '2 partidos este fin de semana', sections: [{ key: 'week', label: null, rows }], live: null };

    it('semana: rótulo, título y una fila por partido con su chip de texto', () => {
      render(week, null);
      expect(el().textContent).toContain('Fin de semana · Sáb 21');
      expect(el().querySelector('.board-title')?.textContent).toContain('2 partidos este fin de semana');
      expect(el().querySelectorAll('.agenda-row').length).toBe(2);
      expect(el().querySelector('.agenda-row .agenda-chip')?.textContent).toContain('Sin entrenador');
      expect(el().querySelector('.agenda-sep')).toBeNull();
    });

    it('día de partido: separadores «Ahora» y «Mañana» y panel «<división> · en vivo»', () => {
      render({
        kind: 'club-agenda', mode: 'day', label: 'Hoy en el club · Sáb 21 nov · 1 hoy, 1 mañana', title: 'Hoy en el club',
        sections: [{ key: 'now', label: 'Ahora', rows: [rows[0]] }, { key: 'tomorrow', label: 'Mañana', rows: [rows[1]] }],
        live: { division: 'M15', opponent: 'TRC', ownScore: 10, opponentScore: 7, periodLabel: "2T 52'", lastDataAt: '14:05' }
      }, null);
      expect(Array.from(el().querySelectorAll('.agenda-sep')).map(node => node.textContent?.trim())).toEqual(['Ahora', 'Mañana']);
      expect(el().textContent).toContain('M15 · en vivo');
      expect(el().textContent).toContain('Último dato 14:05');
      expect(el().querySelectorAll('.btn-on-board').length).toBe(0);
    });

    it('sin partidos en la ventana: club-idle con la próxima fecha', () => {
      render({ kind: 'club-idle', nextLabel: 'Sáb 14 nov · 2 partidos' }, null);
      expect(el().textContent).toContain('Sin partidos esta semana');
      expect(el().textContent).toContain('Sáb 14 nov · 2 partidos');
    });
  });
});
