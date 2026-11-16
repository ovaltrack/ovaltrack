import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SquadComparison, squadComparison } from '../../domain/squad-comparison';
import { WidgetState } from '../../types/home.types';
import { SquadComparisonCardComponent } from './squad-comparison-card.component';

describe('SquadComparisonCardComponent', () => {
  let fixture: ComponentFixture<SquadComparisonCardComponent>;
  const comparison = squadComparison([
    { key: 'points', playerValue: 4, squadValue: 2, format: 'PER_MATCH', higherIsBetter: true, verdict: 'ABOVE' },
    { key: 'penaltiesConceded', playerValue: 2, squadValue: 1, format: 'PER_MATCH', higherIsBetter: false, verdict: 'ABOVE' },
    { key: 'tries', playerValue: null, squadValue: null, format: 'PER_MATCH', higherIsBetter: true, verdict: 'NO_DATA' }
  ])!;
  const render = (state: WidgetState<SquadComparison>): void => {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SquadComparisonCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(SquadComparisonCardComponent);
  });

  it('cargando no dibuja métricas', () => {
    render({ status: 'loading' });
    expect(el().querySelector('.metric')).toBeNull();
    expect(el().querySelector('.sk')).not.toBeNull();
  });

  it('vacío explica que no hay datos para compararse', () => {
    render({ status: 'empty' });
    expect(el().textContent).toContain('Todavía no hay datos para compararte con el plantel');
  });

  it('error muestra el mensaje y Reintentar emite retry', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    render({ status: 'error', message: 'No pudimos cargar esto' });
    expect(el().textContent).toContain('No pudimos cargar esto');
    (el().querySelector('.tile-retry') as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });

  it('offline: con el dato guardado dibuja el sello «Datos de hh:mm» y las métricas', () => {
    render({ status: 'ready', data: comparison, fetchedAt: new Date(2026, 10, 6, 14, 5).getTime(), stale: true });
    expect(el().querySelector('.tile-seal')?.textContent).toContain('Datos de 14:05');
    expect(el().querySelectorAll('.metric').length).toBe(3);
  });

  it('con datos: resumen, leyenda «Vos» y «Promedio del plantel», penales invertidos y «—» sin datos', () => {
    render({ status: 'ready', data: comparison, fetchedAt: 1, stale: false });
    expect(el().querySelector('.cmp-summary')?.textContent).toContain('1 a favor · 1 a mejorar');
    expect(el().querySelector('.legend')?.textContent).toContain('Vos');
    expect(el().querySelector('.legend')?.textContent).toContain('Promedio del plantel');
    const rows = Array.from(el().querySelectorAll<HTMLElement>('.metric'));
    expect(rows[0].dataset['tone']).toBe('good');
    expect(rows[1].dataset['tone']).toBe('bad');
    expect(rows[2].textContent).toContain('—');
    expect(rows[2].textContent).toContain('Sin datos');
    expect(el().querySelector('.tile-seal')).toBeNull();
  });
});
