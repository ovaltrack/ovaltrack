import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZoneTerritoryGridComponent } from './zone-territory-grid.component';
import { FixedZoneMark } from '../../utils/zone-track-layout';

describe('ZoneTerritoryGridComponent: marcas de zona fija', () => {
  let fixture: ComponentFixture<ZoneTerritoryGridComponent>;

  const mark = (eventId: string, eventTypeName: string, cell: { row: number; col: number }, minute: number): FixedZoneMark =>
    ({ eventId, eventTypeName, period: 1, cell, minute });

  const rows = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-row"]'));
  const marksIn = (row: HTMLElement): HTMLElement[] => Array.from(row.querySelectorAll('[data-testid="territory-fixed-mark"]'));
  const allMarks = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-fixed-mark"]'));

  const render = (marks: FixedZoneMark[]): void => {
    fixture.componentRef.setInput('fixedMarks', marks);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ZoneTerritoryGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(ZoneTerritoryGridComponent);
  });

  it('sin marcas no dibuja ninguna', () => {
    render([]);

    expect(allMarks().length).toBe(0);
  });

  it('dibuja la marca en la fila de su franja: el in-goal rival es la primera fila', () => {
    render([mark('a', 'Try', { row: 3, col: 6 }, 22.5)]);

    expect(marksIn(rows()[0]).length).toBe(1);
    expect(allMarks().length).toBe(1);
  });

  it('la marca se ubica en su minuto sobre el eje de 80 minutos', () => {
    render([mark('a', 'Try', { row: 3, col: 6 }, 20)]);

    expect(allMarks()[0].style.left).toBe('25%');
  });

  it('describe la marca para el puntero y los lectores de pantalla', () => {
    render([mark('a', 'Try', { row: 3, col: 6 }, 22.5)]);

    const [element] = allMarks();
    expect(element.getAttribute('aria-label')).toBe('Try 22:30 · D6 · zona fija por el tipo');
    expect(element.getAttribute('title')).toBe('Try 22:30 · D6 · zona fija por el tipo');
  });

  it('no es un tramo: no se puede seleccionar ni agrega bloques', () => {
    render([mark('a', 'Try', { row: 3, col: 6 }, 22.5)]);

    expect(fixture.nativeElement.querySelectorAll('[data-testid="territory-block"]').length).toBe(0);
    expect(allMarks()[0].tagName).not.toBe('BUTTON');
  });

  it('no cambia los huecos sin zona', () => {
    const gapsBefore = fixture.nativeElement.querySelectorAll('[data-testid="territory-gap"]').length;

    render([mark('a', 'Try', { row: 3, col: 6 }, 22.5)]);

    expect(fixture.nativeElement.querySelectorAll('[data-testid="territory-gap"]').length).toBe(gapsBefore);
  });
});
