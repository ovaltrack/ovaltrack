import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeasonKpi } from '../../domain/season-kpis';
import { WidgetState } from '../../types/home.types';
import { SeasonCardComponent } from './season-card.component';

describe('SeasonCardComponent', () => {
  let fixture: ComponentFixture<SeasonCardComponent>;
  const kpis: SeasonKpi[] = [
    { key: 'points', label: 'Puntos', value: '25', sub: 'en la temporada', own: true },
    { key: 'tries', label: 'Tries', value: '5', sub: 'en la temporada', own: false },
    { key: 'matches', label: 'Partidos', value: '8', sub: '7 titulares · 1 suplente', own: false },
    { key: 'tackles', label: 'Tackles', value: '—', sub: 'sin datos', own: false },
    { key: 'record', label: 'Récord jugando', value: '5–1–2', sub: 'G · E · P', own: false }
  ];
  const render = (state: WidgetState<SeasonKpi[]>, provisional = false): void => {
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('provisional', provisional);
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SeasonCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(SeasonCardComponent);
    fixture.componentRef.setInput('label', 'M18 · 2026');
    fixture.componentRef.setInput('year', 2026);
  });

  it('cargando no dibuja números', () => {
    render({ status: 'loading' });
    expect(el().querySelector('.season-value')).toBeNull();
    expect(el().querySelector('.sk')).not.toBeNull();
  });

  it('vacío dice que todavía no jugó partidos en el año', () => {
    render({ status: 'empty' });
    expect(el().textContent).toContain('Todavía no jugaste partidos en 2026');
  });

  it('error muestra el mensaje y Reintentar emite retry', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    render({ status: 'error', message: 'No pudimos cargar esto' });
    (el().querySelector('.tile-retry') as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });

  it('con datos dibuja 5 KPIs, los puntos en el color propio y «—» con «sin datos»', () => {
    render({ status: 'ready', data: kpis, fetchedAt: 1, stale: false });
    expect(el().querySelectorAll('.season-kpi').length).toBe(5);
    expect(el().querySelector('.season-value.own')?.textContent).toBe('25');
    expect(el().textContent).toContain('sin datos');
    expect(el().querySelector('.season-provisional')).toBeNull();
  });

  it('con un partido provisorio muestra el chip ámbar', () => {
    render({ status: 'ready', data: kpis, fetchedAt: 1, stale: false }, true);
    expect(el().querySelector('.season-provisional')?.textContent).toContain('Incluye un partido provisorio');
  });

  it('sin conexión muestra el sello «Datos de hh:mm»', () => {
    render({ status: 'ready', data: kpis, fetchedAt: new Date(2026, 10, 6, 14, 5).getTime(), stale: true });
    expect(el().querySelector('.tile-seal')?.textContent).toContain('Datos de 14:05');
  });
});
