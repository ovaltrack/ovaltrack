import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClubKpi } from '../../domain/club-kpis';
import { WidgetState } from '../../types/home.types';
import { HomeKpiRowComponent } from './home-kpi-row.component';

describe('HomeKpiRowComponent', () => {
  let fixture: ComponentFixture<HomeKpiRowComponent>;
  const kpis: ClubKpi[] = [
    { key: 'players', label: 'Jugadores activos', value: '122', sub: 'en 4 divisiones', warn: false },
    { key: 'matches', label: 'Partidos 2026', value: '34', sub: '20 G · 2 E · 12 P', warn: false },
    { key: 'analysis', label: 'Análisis promedio', value: '81 %', sub: 'último partido de cada división', warn: true },
    { key: 'pending', label: 'Pendientes', value: '2', sub: 'Superior y M15', warn: true }
  ];
  const render = (state: WidgetState<ClubKpi[]>): void => {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HomeKpiRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(HomeKpiRowComponent);
    fixture.componentRef.setInput('seasonYear', 2026);
  });

  it('cargando no dibuja números (sin ceros provisorios)', () => {
    render({ status: 'loading' });
    expect(el().querySelector('.kpi-value')).toBeNull();
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

  it('con datos dibuja cuatro KPIs con rótulo, número y contexto, y marca en ámbar los que corresponden', () => {
    render({ status: 'ready', data: kpis, fetchedAt: 1, stale: false });
    expect(el().querySelectorAll('.kpi').length).toBe(4);
    expect(el().querySelector('.kpi-value')?.textContent).toBe('122');
    expect(el().querySelectorAll('.kpi-value.warn').length).toBe(2);
    expect(el().textContent).toContain('Superior y M15');
  });

  it('sin conexión muestra el sello «Datos de hh:mm»', () => {
    render({ status: 'ready', data: kpis, fetchedAt: new Date(2026, 10, 6, 14, 5).getTime(), stale: true });
    expect(el().querySelector('.tile-seal')?.textContent).toContain('Datos de 14:05');
  });
});
