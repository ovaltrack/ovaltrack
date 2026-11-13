import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZoneTerritoryGridComponent } from './zone-territory-grid.component';
import { TramoCutMark, ZonePoint } from '../../utils/zone-track-layout';
import { ZoneAssignmentResponse } from '../../../types/zone.types';

describe('ZoneTerritoryGridComponent: puntos de zona', () => {
  let fixture: ComponentFixture<ZoneTerritoryGridComponent>;

  const point = (eventId: string, extra: Partial<ZonePoint> = {}): ZonePoint =>
    ({ eventId, eventTypeName: 'Try', period: 1, col: 6, row: 3, minute: 22.5, cutMinute: 23, ...extra });

  const rows = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-row"]'));
  const pointsIn = (row: HTMLElement): HTMLElement[] => Array.from(row.querySelectorAll('[data-testid="territory-point"]'));
  const allPoints = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-point"]'));
  const cutLines = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-cut"]'));

  const render = (points: ZonePoint[], cuts: TramoCutMark[] = []): void => {
    fixture.componentRef.setInput('points', points);
    fixture.componentRef.setInput('cuts', cuts);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ZoneTerritoryGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(ZoneTerritoryGridComponent);
  });

  it('sin puntos no dibuja ninguno', () => {
    render([]);

    expect(allPoints().length).toBe(0);
  });

  it('dibuja el punto en la fila de su franja: el in-goal rival es la primera fila', () => {
    render([point('a')]);

    expect(pointsIn(rows()[0]).length).toBe(1);
    expect(allPoints().length).toBe(1);
  });

  it('un try sin lado también se dibuja en el carril: alcanza con la columna', () => {
    render([point('a', { row: null })]);

    expect(pointsIn(rows()[0]).length).toBe(1);
  });

  it('un punto del rival va en el carril del in-goal propio, la última fila', () => {
    render([point('a', { col: 1 })]);

    expect(pointsIn(rows()[5]).length).toBe(1);
  });

  it('el punto se ubica en su minuto sobre el eje de 80 minutos', () => {
    render([point('a', { minute: 20, cutMinute: 21 })]);

    expect(allPoints()[0].style.left).toBe('25%');
  });

  it('describe el punto para el puntero y los lectores de pantalla', () => {
    render([point('a')]);

    const [element] = allPoints();
    expect(element.getAttribute('aria-label')).toBe('Try 22:30 · D6 · el tramo termina en 23′');
    expect(element.getAttribute('title')).toBe('Try 22:30 · D6 · el tramo termina en 23′');
  });

  it('no es un tramo: no se puede seleccionar ni agrega bloques', () => {
    render([point('a')]);

    expect(fixture.nativeElement.querySelectorAll('[data-testid="territory-block"]').length).toBe(0);
    expect(allPoints()[0].tagName).not.toBe('BUTTON');
  });

  it('no cambia los huecos sin zona', () => {
    const gapsBefore = fixture.nativeElement.querySelectorAll('[data-testid="territory-gap"]').length;

    render([point('a')]);

    expect(fixture.nativeElement.querySelectorAll('[data-testid="territory-gap"]').length).toBe(gapsBefore);
  });

  describe('línea de corte del punto', () => {
    const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30' };

    it('nace del punto: una sola línea en el minuto del corte, con el mismo texto que el punto', () => {
      render([point('a')], [tryCut]);

      expect(cutLines().length).toBe(1);
      expect(cutLines()[0].getAttribute('title')).toBe(allPoints()[0].getAttribute('title'));
      expect(cutLines()[0].style.left).toBe(`${(23 / 80) * 100}%`);
    });

    it('un corte sin punto (Kick H, Drop goal) sigue como línea suelta con su motivo', () => {
      const kick: TramoCutMark = { eventId: 'k', eventTypeName: 'Kick H', period: 1, minute: 31, label: 'Kick H 30:10' };

      render([point('a')], [tryCut, kick]);

      expect(cutLines().map(line => line.getAttribute('title'))).toEqual([
        'Try 22:30 · D6 · el tramo termina en 23′',
        'Corte: Kick H 30:10 · el tramo termina en 31′'
      ]);
    });

    it('pasar el puntero por el punto resalta su línea de corte, y al revés', () => {
      render([point('a')], [tryCut]);

      allPoints()[0].dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      expect(allPoints()[0].classList).toContain('is-hot');
      expect(cutLines()[0].classList).toContain('is-hot');

      allPoints()[0].dispatchEvent(new Event('mouseleave'));
      cutLines()[0].dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      expect(allPoints()[0].classList).toContain('is-hot');
    });

    it('un punto que no corta no dibuja línea', () => {
      render([point('a', { cutMinute: null })]);

      expect(cutLines().length).toBe(0);
    });
  });
});

describe('ZoneTerritoryGridComponent: cortes por try', () => {
  let fixture: ComponentFixture<ZoneTerritoryGridComponent>;

  const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30' };
  const cuts = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-cut"]'));
  const block = (): HTMLElement => fixture.nativeElement.querySelector('[data-testid="territory-block"]');

  const render = (marks: TramoCutMark[], assignments: ZoneAssignmentResponse[] = []): void => {
    fixture.componentRef.setInput('cuts', marks);
    fixture.componentRef.setInput('assignments', assignments);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ZoneTerritoryGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(ZoneTerritoryGridComponent);
  });

  it('dibuja una línea de corte en el minuto donde termina el tramo, con su motivo', () => {
    render([{ ...tryCut, minute: 20, label: 'Try 19:30' }]);

    const [line] = cuts();
    expect(line.style.left).toBe('25%');
    expect(line.getAttribute('title')).toBe('Corte: Try 19:30 · el tramo termina en 20′');
  });

  it('marca el tramo que sigue después de un corte y lo dice en su descripción', () => {
    render([tryCut], [{ id: 'z', matchId: 'm', period: 1, startMinute: 20, endMinute: 25, row: 2, col: 5 }]);

    expect(block().classList).toContain('is-cut');
    expect(block().getAttribute('aria-label')).toContain('Sigue después del Try 22:30: cortalo en 23′.');
  });

  it('un tramo que termina en el corte no se marca', () => {
    render([tryCut], [{ id: 'z', matchId: 'm', period: 1, startMinute: 20, endMinute: 23, row: 2, col: 5 }]);

    expect(block().classList).not.toContain('is-cut');
  });
});
