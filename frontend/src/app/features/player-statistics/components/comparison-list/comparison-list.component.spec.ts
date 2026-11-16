import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetricComparison } from '../../types/player-stats-api.types';
import { toComparisonRows } from '../../utils/player-comparison';
import { ComparisonListComponent } from './comparison-list.component';

describe('ComparisonListComponent', () => {
  let fixture: ComponentFixture<ComparisonListComponent>;
  const comparisons: MetricComparison[] = [
    { key: 'points', playerValue: 4, squadValue: 2, format: 'PER_MATCH', higherIsBetter: true, verdict: 'ABOVE' },
    { key: 'penaltiesConceded', playerValue: 2, squadValue: 1, format: 'PER_MATCH', higherIsBetter: false, verdict: 'ABOVE' },
    { key: 'tries', playerValue: null, squadValue: null, format: 'PER_MATCH', higherIsBetter: true, verdict: 'NO_DATA' }
  ];
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ComparisonListComponent] }).compileComponents();
    fixture = TestBed.createComponent(ComparisonListComponent);
    fixture.componentRef.setInput('rows', toComparisonRows(comparisons));
  });

  it('dibuja una fila por métrica con su veredicto y el tono invertido en penales', () => {
    fixture.detectChanges();
    const rows = Array.from(el().querySelectorAll<HTMLElement>('.metric'));
    expect(rows.length).toBe(3);
    expect(rows.map(row => row.dataset['tone'])).toEqual(['good', 'bad', 'muted']);
    expect(rows[2].textContent).toContain('—');
    expect(rows[2].textContent).toContain('Sin datos');
  });

  it('por defecto la leyenda dice «Jugador» y «Plantel» y el promedio no es neutro', () => {
    fixture.detectChanges();
    expect(el().querySelector('.legend')?.textContent).toContain('Jugador');
    expect(el().querySelector('.legend')?.textContent).toContain('Plantel');
    expect(el().querySelector('.fill--squad.neutral')).toBeNull();
  });

  it('con las etiquetas del Inicio: «Vos», «Promedio del plantel» y el promedio en gris neutro', () => {
    fixture.componentRef.setInput('playerLabel', 'Vos');
    fixture.componentRef.setInput('squadLabel', 'Promedio del plantel');
    fixture.componentRef.setInput('neutralSquad', true);
    fixture.detectChanges();
    expect(el().querySelector('.legend')?.textContent).toContain('Vos');
    expect(el().querySelector('.legend')?.textContent).toContain('Promedio del plantel');
    expect(el().querySelectorAll('.fill--squad.neutral').length).toBe(3);
    expect(el().querySelector('.visually-hidden')?.textContent).toContain('Vos 4, Promedio del plantel 2');
  });
});
