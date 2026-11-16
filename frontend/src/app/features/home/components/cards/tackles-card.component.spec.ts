import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TackleColumns } from '../../domain/tackle-columns';
import { WidgetState } from '../../types/home.types';
import { TacklesCardComponent } from './tackles-card.component';

describe('TacklesCardComponent', () => {
  let fixture: ComponentFixture<TacklesCardComponent>;
  const group = (label: string, sublabel: string, value: number) => ({
    label, sublabel, detail: `${label} · ${sublabel}`,
    values: [{ series: 'Tackles', value, display: String(value), color: 'var(--btn-primary-bg)' }]
  });
  const columns = (groups: ReturnType<typeof group>[], squad: string | null = '7,2'): TackleColumns => ({
    chart: { id: 'player-tackles', title: 'Tackles completados', orientation: 'vertical', unit: 'count', max: 16, groups },
    ariaLabel: 'Tackles completados en los últimos partidos: 9, 12',
    foot: { average: '10,5', squad }
  });
  const render = (state: WidgetState<TackleColumns>): void => {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;
  const ready = (data: TackleColumns, stale = false): WidgetState<TackleColumns> =>
    ({ status: 'ready', data, fetchedAt: new Date(2026, 10, 6, 14, 5).getTime(), stale });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TacklesCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(TacklesCardComponent);
  });

  it('cargando no dibuja columnas ni pie', () => {
    render({ status: 'loading' });
    expect(el().querySelector('app-stat-columns')).toBeNull();
    expect(el().querySelector('.tackles-foot')).toBeNull();
  });

  it('vacío dice que todavía no hay tackles', () => {
    render({ status: 'empty' });
    expect(el().textContent).toContain('Todavía no hay tackles para mostrar');
  });

  it('error muestra el mensaje y Reintentar emite retry', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    render({ status: 'error', message: 'No pudimos cargar esto' });
    (el().querySelector('.tile-retry') as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });

  it('offline: con el dato guardado dibuja el sello «Datos de hh:mm»', () => {
    render(ready(columns([group('02/11', 'TIG', 9), group('09/11', 'DG', 12)]), true));
    expect(el().querySelector('.tile-seal')?.textContent).toContain('Datos de 14:05');
    expect(el().querySelector('app-stat-columns')).not.toBeNull();
  });

  it('con datos: gráfico con la serie en el aria-label, pie con promedio y plantel, y «Últimos 8 partidos» con 8', () => {
    render(ready(columns(Array.from({ length: 8 }, (_, index) => group(`0${index + 1}/11`, 'TIG', index + 5)))));
    expect(el().querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Tackles completados en los últimos partidos: 9, 12');
    expect(el().querySelector('.label-mono')?.textContent).toContain('Últimos 8 partidos');
    expect(el().querySelector('.tackles-foot')?.textContent).toContain('Promedio 10,5 por partido');
    expect(el().querySelector('.tackles-foot')?.textContent).toContain('el plantel hace 7,2');
  });

  it('con menos de 8 partidos el rótulo dice cuántos y sin promedio del plantel el pie no lo nombra', () => {
    render(ready(columns([group('02/11', 'TIG', 9), group('09/11', 'DG', 12)], null)));
    expect(el().querySelector('.label-mono')?.textContent).toContain('Últimos 2 partidos');
    expect(el().querySelector('.tackles-foot')?.textContent).not.toContain('plantel');
  });
});
