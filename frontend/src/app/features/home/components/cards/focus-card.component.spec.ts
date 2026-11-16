import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FocusInput } from '../../domain/focus-rows';
import { WidgetState } from '../../types/home.types';
import { FocusCardComponent } from './focus-card.component';

describe('FocusCardComponent', () => {
  let fixture: ComponentFixture<FocusCardComponent>;

  const withRows: FocusInput = {
    series: { lineout: [80, 78, 82, 80, 58], tackle: [85, 86, 85, 87, 87], penalties: [8, 9, 8, 9, 9] },
    lineoutLast: { won: 7, total: 12 }
  };

  const render = (state: WidgetState<FocusInput>, online = true): void => {
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('online', online);
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;
  const text = (): string => el().textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FocusCardComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(FocusCardComponent);
    fixture.componentRef.setInput('seasonYear', 2026);
    fixture.componentRef.setInput('divisionId', 'd1');
  });

  it('cargando muestra el esqueleto y ninguna fila', () => {
    render({ status: 'loading' });
    expect(el().querySelector('.sk')).not.toBeNull();
    expect(el().querySelector('.focus-row')).toBeNull();
  });

  it('con menos de 3 partidos dice «Todavía no hay 3 partidos»', () => {
    render({ status: 'ready', data: { series: { lineout: [70, 72], tackle: [], penalties: [] }, lineoutLast: null }, fetchedAt: 1, stale: false });
    expect(text()).toContain('Todavía no hay 3 partidos');
  });

  it('sin desvíos dice «Sin desvíos importantes»', () => {
    render({ status: 'ready', data: { series: { lineout: [70, 71, 70, 70], tackle: [80, 80, 81, 80], penalties: [8, 8, 8, 8] }, lineoutLast: null }, fetchedAt: 1, stale: false });
    expect(text()).toContain('Sin desvíos importantes');
  });

  it('con datos dibuja las filas con chip de texto y un mini gráfico con role="img"', () => {
    render({ status: 'ready', data: withRows, fetchedAt: 1, stale: false });
    const rows = el().querySelectorAll('.focus-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].querySelector('.focus-chip')?.textContent).toMatch(/[▲▼]/);
    expect(rows[0].querySelector('svg[role="img"]')?.getAttribute('aria-label')).toContain('Último');
    expect(text()).toContain('7 de 12 ganados');
  });

  it('el enlace a las estadísticas va a la ruta de la división', () => {
    render({ status: 'ready', data: withRows, fetchedAt: 1, stale: false });
    expect(el().querySelector('a.focus-link')?.getAttribute('href')).toBe('/divisions/d1/statistics');
  });

  it('error muestra el mensaje y Reintentar emite retry', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    render({ status: 'error', message: 'No pudimos cargar esto' });
    (el().querySelector('.tile-retry') as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });

  it('sin conexión muestra el sello «Datos de» y el enlace queda deshabilitado con «Requiere conexión»', () => {
    render({ status: 'ready', data: withRows, fetchedAt: new Date(2026, 10, 6, 14, 5).getTime(), stale: true }, false);
    expect(text()).toContain('Datos de 14:05');
    expect(el().querySelector('a.focus-link')).toBeNull();
    const button = el().querySelector('button.focus-link') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Requiere conexión');
  });
});
