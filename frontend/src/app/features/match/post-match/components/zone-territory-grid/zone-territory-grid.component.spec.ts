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

  describe('cortes: tira de tanteo en el eje y línea solo cuando hace falta', () => {
    const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30', possession: 'OWN', glyph: 'T' };
    const marks = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-cut-mark"]'));
    const hover = (element: HTMLElement): void => {
      element.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
    };

    it('cada corte es una marca con su letra sobre el eje, con el mismo texto que el punto', () => {
      render([point('a')], [tryCut]);

      expect(marks().length).toBe(1);
      expect(marks()[0].textContent?.trim()).toBe('T');
      expect(marks()[0].getAttribute('title')).toBe(allPoints()[0].getAttribute('title'));
      expect(marks()[0].style.left).toBe(`${(23 / 80) * 100}%`);
    });

    it('un corte sin punto (Kick H, Drop goal) tiene su marca con la letra y el motivo', () => {
      const kick: TramoCutMark = { eventId: 'k', eventTypeName: 'Kick H', period: 1, minute: 31, label: 'Kick H 30:10', possession: 'OWN', glyph: 'P' };

      render([point('a')], [tryCut, kick]);

      expect(marks().map(mark => mark.textContent?.trim())).toEqual(['T', 'P']);
      expect(marks()[1].getAttribute('title')).toBe('Corte: Kick H 30:10 · el tramo termina en 31′');
    });

    it('en la vista normal no hay líneas de corte sobre la grilla', () => {
      render([point('a')], [tryCut]);

      expect(cutLines().length).toBe(0);
    });

    it('pasar el puntero por el punto muestra su línea resaltada, y al salir la oculta', () => {
      render([point('a')], [tryCut]);

      hover(allPoints()[0]);
      expect(cutLines().length).toBe(1);
      expect(cutLines()[0].classList).toContain('is-hot');
      expect(allPoints()[0].classList).toContain('is-hot');

      allPoints()[0].dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      expect(cutLines().length).toBe(0);
    });

    it('pasar el puntero por la marca del eje muestra la línea de ese corte', () => {
      render([point('a')], [tryCut]);

      hover(marks()[0]);

      expect(cutLines().length).toBe(1);
      expect(cutLines()[0].style.left).toBe(`${(23 / 80) * 100}%`);
    });

    it('con un rango en edición se ven los cortes vecinos y no los lejanos', () => {
      const cut = (eventId: string, minute: number): TramoCutMark => ({ ...tryCut, eventId, minute });
      fixture.componentRef.setInput('previewRange', { period: 1, startMinute: 20, endMinute: 23 });

      render([], [cut('a', 5), cut('b', 23), cut('c', 38)]);

      expect(cutLines().map(line => line.style.left)).toEqual([`${(5 / 80) * 100}%`, `${(23 / 80) * 100}%`]);
    });

    it('dos cortes casi juntos se dibujan como una sola marca con el número', () => {
      const near: TramoCutMark = { ...tryCut, eventId: 'b', minute: 23.05, label: 'Try 22:33' };

      render([], [tryCut, near]);

      expect(marks().length).toBe(1);
      expect(marks()[0].textContent?.trim()).toBe('2');
      expect(marks()[0].getAttribute('title')).toContain('Try 22:30');
      expect(marks()[0].getAttribute('title')).toContain('Try 22:33');
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

  const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30', possession: 'OWN', glyph: 'T' };
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

  it('marca el corte en el eje, en el minuto donde termina el tramo, con su motivo', () => {
    render([{ ...tryCut, minute: 20, label: 'Try 19:30' }]);

    const [mark] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="territory-cut-mark"]')) as HTMLElement[];
    expect(mark.style.left).toBe('25%');
    expect(mark.getAttribute('title')).toBe('Corte: Try 19:30 · el tramo termina en 20′');
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
  const tryCut: TramoCutMark = { eventId: 'a', eventTypeName: 'Try', period: 1, minute: 23, label: 'Try 22:30', possession: 'OWN', glyph: 'T' };

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
