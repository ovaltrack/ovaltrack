import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DivisionStatusRow } from '../../domain/division-status';
import { WidgetState } from '../../types/home.types';
import { DivisionStatusTableComponent } from './division-status-table.component';

describe('DivisionStatusTableComponent', () => {
  let fixture: ComponentFixture<DivisionStatusTableComponent>;

  const ok: DivisionStatusRow = {
    divisionId: 'd1', name: 'Superior', staff: { text: '2 en staff', issue: null }, players: { text: '30', issue: null },
    next: { text: 'Sáb 21 nov', sub: '15:30 · vs CRC', live: false }, roster: { text: 'Lista', issue: null },
    last: [{ matchId: 'a', result: 'win', score: '20-10', opponent: 'TRC' }], analysis: { percent: 95, tone: 'good' }, action: null
  };
  const bad: DivisionStatusRow = {
    ...ok, divisionId: 'd2', name: 'M15', staff: { text: 'Sin entrenador', issue: 'error' }, players: { text: '12', issue: 'warn', note: 'no alcanza para 15' },
    last: [], analysis: { percent: 70, tone: 'warn' },
    action: { label: 'Asignar entrenador', route: '/divisions/d2/coaches', ariaLabel: 'Asignar entrenador a M15' }
  };

  const render = (state: WidgetState<DivisionStatusRow[]>, online = true): void => {
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('online', online);
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DivisionStatusTableComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(DivisionStatusTableComponent);
  });

  it('cargando muestra el esqueleto y ninguna fila', () => {
    render({ status: 'loading' });
    expect(el().querySelector('.mx-row')).toBeNull();
    expect(el().querySelector('.sk')).not.toBeNull();
  });

  it('vacío dice que todavía no hay divisiones', () => {
    render({ status: 'empty' });
    expect(el().textContent).toContain('Todavía no hay divisiones');
  });

  it('error muestra el mensaje y Reintentar emite retry', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    render({ status: 'error', message: 'No pudimos cargar esto' });
    (el().querySelector('.tile-retry') as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });

  it('usa roles de tabla: una tabla, un encabezado de 8 columnas y una fila por división', () => {
    render({ status: 'ready', data: [ok, bad], fetchedAt: 1, stale: false });
    expect(el().querySelectorAll('[role="table"]').length).toBe(1);
    expect(el().querySelectorAll('[role="columnheader"]').length).toBe(8);
    expect(el().querySelectorAll('[role="row"]').length).toBe(3);
    expect(el().querySelectorAll('[role="row"]:not(.mx-head) [role="cell"]').length).toBe(16);
  });

  it('solo marca lo que no está bien, con ícono y texto', () => {
    render({ status: 'ready', data: [ok, bad], fetchedAt: 1, stale: false });
    const rows = el().querySelectorAll('.mx-row:not(.mx-head)');
    expect(rows[0].querySelector('.bi-exclamation-triangle')).toBeNull();
    const marked = rows[1].querySelectorAll('.bi-exclamation-triangle');
    expect(marked.length).toBe(2);
    expect(rows[1].textContent).toContain('Sin entrenador');
    expect(rows[1].textContent).toContain('no alcanza para 15');
  });

  it('la acción es un enlace outline con aria-label completo, y solo donde hay algo que resolver', () => {
    render({ status: 'ready', data: [ok, bad], fetchedAt: 1, stale: false });
    const rows = el().querySelectorAll('.mx-row:not(.mx-head)');
    expect(rows[0].querySelector('.action-btn')).toBeNull();
    const action = rows[1].querySelector('a.action-btn') as HTMLAnchorElement;
    expect(action.getAttribute('href')).toBe('/divisions/d2/coaches');
    expect(action.getAttribute('aria-label')).toBe('Asignar entrenador a M15');
    expect(action.classList.contains('btn-outline')).toBeTrue();
  });

  it('sin conexión la acción queda deshabilitada con «Requiere conexión» y aparece el sello', () => {
    render({ status: 'ready', data: [bad], fetchedAt: new Date(2026, 10, 6, 14, 5).getTime(), stale: true }, false);
    const button = el().querySelector('button.action-btn') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Requiere conexión');
    expect(button.getAttribute('aria-label')).toContain('requiere conexión');
    expect(el().querySelector('.tile-seal')?.textContent).toContain('Datos de 14:05');
  });

  it('el análisis dibuja la barra con role="img" y el % escrito', () => {
    render({ status: 'ready', data: [bad], fetchedAt: 1, stale: false });
    expect(el().querySelector('.analysis-bar')?.getAttribute('role')).toBe('img');
    expect(el().querySelector('.analysis-text')?.textContent).toContain('70 %');
  });
});
