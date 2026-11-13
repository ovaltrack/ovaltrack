import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TerritoryGapSelection, ZoneTerritoryGridComponent } from './zone-territory-grid.component';
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
    fixture.componentRef.setInput('assignments', [{ id: 'z', matchId: 'm', period: 1, startMinute: 18, endMinute: 23, row: 2, col: 5 }]);
    render([point('a')]);

    const [element] = allPoints();
    expect(element.getAttribute('aria-label')).toBe('Try 22:30 · D6 · el tramo incluye todo el minuto 22 y termina en 23′');
    expect(element.getAttribute('title')).toBe('Try 22:30 · D6 · el tramo incluye todo el minuto 22 y termina en 23′');
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

  describe('cortes: el rombo es la señal y la línea solo aparece cuando hace falta', () => {
    const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30', possession: 'OWN' };
    const hover = (element: HTMLElement): void => {
      element.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
    };

    it('el eje solo tiene los minutos: no hay tira de tanteo ni marcas por corte', () => {
      render([point('a')], [tryCut]);

      expect(fixture.nativeElement.querySelector('[data-testid="territory-score-strip"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="territory-cut-mark"]')).toBeNull();
    });

    it('en la vista normal no hay líneas de corte sobre la grilla', () => {
      render([point('a')], [tryCut]);

      expect(cutLines().length).toBe(0);
    });

    it('pasar el puntero por el punto resalta el borde del tramo que corta, sin dibujar la línea', () => {
      fixture.componentRef.setInput('assignments', [
        { id: 'z', matchId: 'm', period: 1, startMinute: 18, endMinute: 23, row: 2, col: 5 },
        { id: 'y', matchId: 'm', period: 1, startMinute: 10, endMinute: 18, row: 2, col: 4 }
      ]);
      render([point('a')], [tryCut]);
      const edges = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-block"].is-cut-edge'));

      hover(allPoints()[0]);
      expect(cutLines().length).toBe(0);
      expect(allPoints()[0].classList).toContain('is-hot');
      expect(edges().length).toBe(1);
      expect(edges()[0].getAttribute('aria-label')).toContain('18′ a 23′');

      allPoints()[0].dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      expect(edges().length).toBe(0);
    });

    it('sin un tramo que termine en el corte, el tooltip del punto lo dice', () => {
      render([point('a')], [tryCut]);

      expect(allPoints()[0].getAttribute('title')).toBe('Try 22:30 · D6 · el corte cae al final del minuto 22, pero ningún tramo termina en 23′');
    });

    it('con un rango en edición solo se ven los cortes que toca, no los lejanos ni los vecinos', () => {
      const cut = (eventId: string, minute: number): TramoCutMark => ({ ...tryCut, eventId, minute });
      fixture.componentRef.setInput('previewRange', { period: 1, startMinute: 20, endMinute: 23 });

      render([], [cut('a', 5), cut('b', 23), cut('c', 38)]);

      expect(cutLines().map(line => line.style.left)).toEqual([`${(23 / 80) * 100}%`]);
    });

    it('un corte sin rombo (Kick H, Drop goal) se ve como línea cuando el rango en edición lo toca', () => {
      const kick: TramoCutMark = { eventId: 'k', eventTypeName: 'Kick H', period: 1, minute: 31, label: 'Kick H 30:10', possession: 'OWN' };
      fixture.componentRef.setInput('previewRange', { period: 1, startMinute: 28, endMinute: 31 });

      render([point('a')], [tryCut, kick]);

      expect(cutLines().map(line => line.style.left)).toEqual([`${(31 / 80) * 100}%`]);
    });

    it('dos puntos casi juntos en una franja se dibujan como uno con el número', () => {
      render([point('a'), point('b', { minute: 22.55, cutMinute: 23 })]);

      expect(allPoints().length).toBe(1);
      expect(allPoints()[0].textContent?.trim()).toBe('2');
      expect(allPoints()[0].getAttribute('aria-label')).toContain('Try 22:30');
    });

    it('dos puntos lejanos siguen siendo dos', () => {
      render([point('a'), point('b', { minute: 60, cutMinute: 61 })]);

      expect(allPoints().length).toBe(2);
    });
  });
});

describe('ZoneTerritoryGridComponent: cortes por try', () => {
  let fixture: ComponentFixture<ZoneTerritoryGridComponent>;

  const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30', possession: 'OWN' };
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

  it('el tramo que se está editando muestra la línea de su corte', () => {
    fixture.componentRef.setInput('previewRange', { period: 1, startMinute: 15, endMinute: 20 });
    render([{ ...tryCut, minute: 20, label: 'Try 19:30' }]);

    expect(cuts().length).toBe(1);
    expect(cuts()[0].style.left).toBe('25%');
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

describe('ZoneTerritoryGridComponent: in-goal solo para puntos', () => {
  let fixture: ComponentFixture<ZoneTerritoryGridComponent>;
  const selections: TerritoryGapSelection[] = [];

  const tracks = (): HTMLElement => fixture.nativeElement.querySelector('[data-testid="territory-tracks"]');
  const rowAt = (index: number): HTMLElement => fixture.nativeElement.querySelectorAll('[data-testid="territory-row"]')[index];
  const rowLabelAt = (index: number): HTMLElement => fixture.nativeElement.querySelectorAll('[data-testid="territory-row-label"]')[index];

  /** Clic a la altura de la fila (las filas no son parejas) y en el minuto indicado. */
  const clickRow = (index: number, minute: number): void => {
    const rect = tracks().getBoundingClientRect();
    const row = rowAt(index).getBoundingClientRect();
    tracks().dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + ((minute + 0.5) / 80) * rect.width, clientY: row.top + row.height / 2
    }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    selections.length = 0;
    await TestBed.configureTestingModule({ imports: [ZoneTerritoryGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(ZoneTerritoryGridComponent);
    fixture.componentInstance.gapSelected.subscribe(selection => selections.push(selection));
    fixture.detectChanges();
  });

  it('las franjas de in-goal son carriles finos y las del campo no', () => {
    [0, 5].forEach(index => {
      expect(rowAt(index).classList).toContain('is-lane');
      expect(rowLabelAt(index).classList).toContain('is-lane');
    });
    [1, 2, 3, 4].forEach(index => expect(rowAt(index).classList).not.toContain('is-lane'));
  });

  it('el carril explica por qué no admite tramos', () => {
    expect(rowLabelAt(0).getAttribute('title')).toBe('Solo puntos: el in-goal no admite tramos nuevos');
    expect(rowLabelAt(2).getAttribute('title')).toBeNull();
  });

  it('un clic en un hueco del carril de in-goal no propone ningún tramo', () => {
    clickRow(0, 12);
    clickRow(5, 12);

    expect(selections).toEqual([]);
  });

  it('un clic en un hueco de una franja del campo sí propone el tramo', () => {
    clickRow(1, 12);

    expect(selections).toEqual([{ period: 1, startMinute: 0, endMinute: 40, col: 5 }]);
  });

  it('un tramo de in-goal que ya existe se sigue dibujando y se puede abrir', () => {
    const assignment: ZoneAssignmentResponse = { id: 'ig', matchId: 'm', period: 1, startMinute: 4, endMinute: 5, row: 2, col: 6 };
    const opened: ZoneAssignmentResponse[] = [];
    fixture.componentInstance.segmentSelected.subscribe(value => opened.push(value));
    fixture.componentRef.setInput('assignments', [assignment]);
    fixture.detectChanges();

    const block = rowAt(0).querySelector('[data-testid="territory-block"]') as HTMLButtonElement;
    block.click();

    expect(opened).toEqual([assignment]);
  });

  it('el cursor del teclado arranca en el 22 rival y Enter sobre un hueco de in-goal no propone nada', () => {
    tracks().dispatchEvent(new FocusEvent('focus'));
    tracks().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    tracks().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(selections).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="territory-cursor-status"]').textContent)
      .toContain('el in-goal solo tiene puntos, no admite tramos nuevos');
  });
});

describe('ZoneTerritoryGridComponent: un toque propone el segmento entre cortes', () => {
  let fixture: ComponentFixture<ZoneTerritoryGridComponent>;
  const selections: TerritoryGapSelection[] = [];
  const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30', possession: 'OWN' };

  const tracks = (): HTMLElement => fixture.nativeElement.querySelector('[data-testid="territory-tracks"]');
  const rowAt = (index: number): HTMLElement => fixture.nativeElement.querySelectorAll('[data-testid="territory-row"]')[index];

  /** Clic en el minuto indicado sobre la fila de la franja 3 (campo propio). */
  const clickAt = (minute: number): void => {
    const rect = tracks().getBoundingClientRect();
    const row = rowAt(3).getBoundingClientRect();
    tracks().dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + ((minute + 0.5) / 80) * rect.width, clientY: row.top + row.height / 2
    }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    selections.length = 0;
    await TestBed.configureTestingModule({ imports: [ZoneTerritoryGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(ZoneTerritoryGridComponent);
    fixture.componentInstance.gapSelected.subscribe(selection => selections.push(selection));
    fixture.componentRef.setInput('cuts', [tryCut]);
    fixture.detectChanges();
  });

  it('un toque antes del corte propone desde el inicio del hueco hasta el corte', () => {
    clickAt(10);

    expect(selections).toEqual([{ period: 1, startMinute: 0, endMinute: 23, col: 3 }]);
  });

  it('un toque después del corte propone desde el corte hasta el fin del hueco', () => {
    clickAt(30);

    expect(selections).toEqual([{ period: 1, startMinute: 23, endMinute: 40, col: 3 }]);
  });

  it('sin cortes propone todo el hueco, como antes', () => {
    fixture.componentRef.setInput('cuts', []);
    fixture.detectChanges();

    clickAt(30);

    expect(selections).toEqual([{ period: 1, startMinute: 0, endMinute: 40, col: 3 }]);
  });
});
