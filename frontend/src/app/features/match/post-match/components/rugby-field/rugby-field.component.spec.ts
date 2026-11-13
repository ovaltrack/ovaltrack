import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RugbyFieldComponent } from './rugby-field.component';
import { ZoneCellRef, ZoneCellSummary } from '../../../types/zone.types';

describe('RugbyFieldComponent', () => {
  let fixture: ComponentFixture<RugbyFieldComponent>;

  const cells = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="zone-cell"]'));

  const cellAt = (row: number, col: number): HTMLElement | undefined =>
    cells().find(c => c.dataset['row'] === String(row) && c.dataset['col'] === String(col));

  const reading = (): string => fixture.nativeElement.querySelector('[data-testid="zone-reading"]').textContent.trim();

  const render = (summary: ZoneCellSummary[]): void => {
    fixture.componentRef.setInput('cells', summary);
    fixture.detectChanges();
  };

  const key = (target: HTMLElement | undefined, name: string): void => {
    target?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RugbyFieldComponent] }).compileComponents();
    fixture = TestBed.createComponent(RugbyFieldComponent);
  });

  describe('estructura', () => {
    it('dibuja la grilla completa de 3 filas x 6 columnas como role=grid', () => {
      render([]);

      expect(cells().length).toBe(18);
      expect(fixture.nativeElement.querySelector('[role="grid"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('[role="row"]').length).toBe(3);
    });

    it('etiqueta cada celda con letra de fila y número de columna (I1 … D6)', () => {
      render([]);

      expect(cellAt(1, 1)?.querySelector('[data-testid="zone-label"]')?.textContent).toBe('I1');
      expect(cellAt(2, 3)?.querySelector('[data-testid="zone-label"]')?.textContent).toBe('C3');
      expect(cellAt(3, 6)?.querySelector('[data-testid="zone-label"]')?.textContent).toBe('D6');
    });

    it('muestra el sentido de ataque con el nombre del club', () => {
      fixture.componentRef.setInput('ownClubName', 'Puerto Madryn RC');
      render([]);

      expect(fixture.nativeElement.querySelector('[data-testid="attack-dir"]').textContent).toContain('Puerto Madryn RC ataca');
    });

    it('las columnas y filas siguen las proporciones reglamentarias', () => {
      render([]);
      const component = fixture.componentInstance;

      expect(component.columnTemplate).toBe('10fr 22fr 28fr 28fr 22fr 10fr');
      expect(component.rowMeters).toEqual([15, 40, 15]);
      expect(component.width / component.height).toBeCloseTo(120 / 70, 5);
    });

    it('las líneas de 15 m del dibujo coinciden con los bordes de fila', () => {
      render([]);
      const component = fixture.componentInstance;
      const rowBorderTop = (component.rowMeters[0] / 70) * component.height;
      const rowBorderBottom = ((component.rowMeters[0] + component.rowMeters[1]) / 70) * component.height;

      expect(component.line15Top).toBeCloseTo(rowBorderTop, 5);
      expect(component.line15Bottom).toBeCloseTo(rowBorderBottom, 5);
    });

    it('la línea de mitad de cancha queda en el centro', () => {
      render([]);

      expect(fixture.componentInstance.halfway).toBe(fixture.componentInstance.width / 2);
    });
  });

  describe('conteos y avisos', () => {
    it('muestra el conteo de eventos en la celda correspondiente', () => {
      render([{ row: 2, col: 3, eventCount: 4 }]);

      expect(cellAt(2, 3)?.querySelector('[data-testid="zone-count"]')?.textContent).toContain('4');
    });

    it('abrevia los conteos de mil o más, pero el aria-label conserva el número exacto', () => {
      render([{ row: 2, col: 3, eventCount: 1200 }]);

      expect(cellAt(2, 3)?.querySelector('[data-testid="zone-count"]')?.textContent?.trim()).toBe('1k');
      expect(cellAt(2, 3)?.getAttribute('aria-label')).toContain('1200 eventos');
    });

    it('no muestra conteo en las celdas sin eventos', () => {
      render([{ row: 2, col: 3, eventCount: 4 }]);

      expect(cellAt(1, 1)?.querySelector('[data-testid="zone-count"]')).toBeNull();
    });

    it('marca como activas únicamente las celdas con eventos', () => {
      render([{ row: 2, col: 3, eventCount: 4 }]);

      expect(cellAt(2, 3)?.classList).toContain('has-events');
      expect(cellAt(3, 6)?.classList).not.toContain('has-events');
    });

    it('sin eventos en ninguna zona no agrega carteles: la instrucción de inicio vive en la grilla y el formulario', () => {
      render([]);

      expect(fixture.nativeElement.querySelector('[data-testid="zones-empty"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="start-hint"]')).toBeNull();
    });
  });

  describe('lectura de la zona apuntada', () => {
    it('sugiere cómo interactuar cuando no hay zona apuntada', () => {
      render([]);

      expect(reading()).toContain('Pasá el cursor o tocá una zona');
    });

    it('al pasar el cursor describe la zona y sus eventos', () => {
      render([{ row: 3, col: 5, eventCount: 5 }]);

      cellAt(3, 5)?.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();

      expect(reading()).toBe('D5 · Derecha (55–70 m) · 22 rival (78–100 m) · 5 eventos');
    });

    it('al salir el cursor vuelve a la sugerencia', () => {
      render([]);
      cellAt(1, 2)?.dispatchEvent(new Event('mouseenter'));
      cellAt(1, 2)?.dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();

      expect(reading()).toContain('Pasá el cursor');
    });

    it('al tocar una zona de solo lectura la describe (táctil, sin hover)', () => {
      fixture.componentRef.setInput('selectable', false);
      render([{ row: 3, col: 5, eventCount: 5 }]);

      cellAt(3, 5)?.dispatchEvent(new Event('click'));
      fixture.detectChanges();

      expect(reading()).toBe('D5 · Derecha (55–70 m) · 22 rival (78–100 m) · 5 eventos');
    });
  });

  describe('identidad de la cancha', () => {
    it('rotula los in-goals con PROPIO y el nombre corto del rival', () => {
      render([]);
      fixture.componentRef.setInput('opponentName', 'Trelew Rugby Club');
      fixture.detectChanges();

      const own = fixture.nativeElement.querySelector('[data-testid="ingoal-own"]');
      const rival = fixture.nativeElement.querySelector('[data-testid="ingoal-rival"]');

      expect(own?.textContent?.trim()).toBe('Propio');
      expect(rival?.textContent?.trim()).toBe('Trelew');
      expect(own?.getAttribute('aria-hidden')).toBe('true');
    });

    it('las líneas de la cancha van en una capa propia después de la grilla, para quedar sobre el calor', () => {
      render([]);

      const grid = fixture.nativeElement.querySelector('.pitch-grid') as Element;
      const lines = fixture.nativeElement.querySelector('.pitch-lines') as Element;

      expect(lines.querySelector('.lines')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.pitch-bg .lines')).toBeNull();
      expect(grid.compareDocumentPosition(lines) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('no dibuja chevrones en el centro ni la nota de vista relativa (esa nota vive en la ayuda de la pantalla)', () => {
      render([]);

      expect(fixture.nativeElement.querySelector('.chevrons')).toBeNull();
      expect(fixture.nativeElement.querySelector('.relative-note')).toBeNull();
    });
  });

  describe('microinteracciones y estado vacío', () => {
    it('la celda recién guardada hace un pulso y las demás no', () => {
      render([]);
      fixture.componentRef.setInput('pulseCell', { row: 2, col: 3 });
      fixture.detectChanges();

      expect(cellAt(2, 3)?.classList).toContain('is-pulse');
      expect(cellAt(1, 1)?.classList).not.toContain('is-pulse');
    });

    it('las celdas conservan su elemento DOM al recalcular los conteos (para poder animarlos)', () => {
      render([{ row: 2, col: 3, eventCount: 2 }]);
      const before = cellAt(2, 3);

      fixture.componentRef.setInput('cells', [{ row: 2, col: 3, eventCount: 5 }]);
      fixture.detectChanges();

      expect(cellAt(2, 3)).toBe(before);
    });
  });

  describe('escala de calor', () => {
    const legend = (): HTMLElement | null => fixture.nativeElement.querySelector('[data-testid="heat-legend"]');

    it('muestra la leyenda con los cortes 0 · 1–5 · 6–15 · 16–30 · 30+', () => {
      render([]);

      expect(legend()?.textContent?.replace(/\s+/g, ' ')).toContain('0 1–5 6–15 16–30 30+');
    });

    it('la posición en la escala depende del nivel, no del máximo del partido', () => {
      render([{ row: 1, col: 1, eventCount: 3 }, { row: 2, col: 2, eventCount: 118 }]);

      expect(cellAt(1, 1)?.style.getPropertyValue('--heat')).toBe('0');
      expect(cellAt(2, 2)?.style.getPropertyValue('--heat')).toBe('1');
    });
  });

  describe('vínculo con la grilla de territorio', () => {
    it('avisa la celda bajo el cursor y cuándo se va', () => {
      render([]);
      const hovered: (ZoneCellRef | null)[] = [];
      fixture.componentInstance.cellHover.subscribe(cell => hovered.push(cell));

      cellAt(2, 4)?.dispatchEvent(new Event('mouseenter'));
      cellAt(2, 4)?.dispatchEvent(new Event('mouseleave'));

      expect(hovered).toEqual([{ row: 2, col: 4 }, null]);
    });

    it('resalta la celda vinculada a un tramo', () => {
      render([]);
      fixture.componentRef.setInput('linkedCell', { row: 3, col: 6 });
      fixture.detectChanges();

      expect(cellAt(3, 6)?.classList).toContain('is-linked');
      expect(cellAt(1, 1)?.classList).not.toContain('is-linked');
    });
  });

  describe('selección', () => {
    it('emite la celda tocada', () => {
      render([]);
      const emitted: ZoneCellRef[] = [];
      fixture.componentInstance.cellSelected.subscribe(cell => emitted.push(cell));

      cellAt(2, 3)?.dispatchEvent(new Event('click'));

      expect(emitted).toEqual([{ row: 2, col: 3 }]);
    });

    it('emite la celda con Enter y con Espacio', () => {
      render([]);
      const emitted: ZoneCellRef[] = [];
      fixture.componentInstance.cellSelected.subscribe(cell => emitted.push(cell));

      key(cellAt(1, 1), 'Enter');
      key(cellAt(3, 6), ' ');

      expect(emitted).toEqual([{ row: 1, col: 1 }, { row: 3, col: 6 }]);
    });

    it('marca únicamente la celda seleccionada con aria-selected', () => {
      fixture.componentRef.setInput('selectedCell', { row: 2, col: 3 });
      render([]);

      expect(cellAt(2, 3)?.classList).toContain('is-selected');
      expect(cellAt(2, 3)?.getAttribute('aria-selected')).toBe('true');
      expect(cellAt(1, 1)?.getAttribute('aria-selected')).toBe('false');
    });

    it('no emite si el gráfico es de solo lectura', () => {
      fixture.componentRef.setInput('selectable', false);
      render([]);
      const emitted: ZoneCellRef[] = [];
      fixture.componentInstance.cellSelected.subscribe(cell => emitted.push(cell));

      cellAt(2, 3)?.dispatchEvent(new Event('click'));
      key(cellAt(2, 3), 'Enter');

      expect(emitted).toEqual([]);
    });
  });

  describe('teclado (tabindex móvil)', () => {
    it('solo una celda es parada de Tab', () => {
      render([]);

      expect(cells().filter(c => c.getAttribute('tabindex') === '0').length).toBe(1);
      expect(cellAt(1, 1)?.getAttribute('tabindex')).toBe('0');
    });

    it('con una zona elegida esa celda es la parada de Tab', () => {
      fixture.componentRef.setInput('selectedCell', { row: 2, col: 4 });
      render([]);

      expect(cellAt(2, 4)?.getAttribute('tabindex')).toBe('0');
      expect(cellAt(1, 1)?.getAttribute('tabindex')).toBe('-1');
    });

    it('las flechas mueven el foco y la parada de Tab', () => {
      render([]);

      key(cellAt(1, 1), 'ArrowRight');
      expect(cellAt(1, 2)?.getAttribute('tabindex')).toBe('0');

      key(cellAt(1, 2), 'ArrowDown');
      expect(cellAt(2, 2)?.getAttribute('tabindex')).toBe('0');
      expect(cellAt(1, 1)?.getAttribute('tabindex')).toBe('-1');
    });

    it('las flechas no salen de la grilla', () => {
      render([]);

      key(cellAt(1, 1), 'ArrowLeft');
      key(cellAt(1, 1), 'ArrowUp');
      expect(cellAt(1, 1)?.getAttribute('tabindex')).toBe('0');

      key(cellAt(3, 6), 'ArrowRight');
      key(cellAt(3, 6), 'ArrowDown');
      expect(cellAt(3, 6)?.getAttribute('tabindex')).toBe('0');
    });

    it('Home y End van a los extremos de la fila', () => {
      render([]);

      key(cellAt(2, 3), 'End');
      expect(cellAt(2, 6)?.getAttribute('tabindex')).toBe('0');

      key(cellAt(2, 6), 'Home');
      expect(cellAt(2, 1)?.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('franjas bloqueadas (in-goal solo para puntos)', () => {
    const selected: ZoneCellRef[] = [];

    beforeEach(() => {
      selected.length = 0;
      fixture.componentInstance.cellSelected.subscribe(value => selected.push(value));
      fixture.componentRef.setInput('lockedCols', [1, 6]);
      render([]);
    });

    it('tocar una celda bloqueada no la elige, pero muestra su lectura', () => {
      cellAt(2, 6)?.click();
      fixture.detectChanges();

      expect(selected).toEqual([]);
      expect(reading()).toContain('C6');
    });

    it('las celdas del campo siguen eligiéndose', () => {
      cellAt(2, 3)?.click();

      expect(selected).toEqual([{ row: 2, col: 3 }]);
    });

    it('la celda bloqueada se marca como deshabilitada y lo dice en su etiqueta', () => {
      expect(cellAt(2, 1)?.getAttribute('aria-disabled')).toBe('true');
      expect(cellAt(2, 1)?.getAttribute('aria-label')).toContain('Solo puntos: no admite tramos');
      expect(cellAt(2, 3)?.getAttribute('aria-disabled')).toBeNull();
    });

    it('Enter sobre una celda bloqueada tampoco la elige', () => {
      key(cellAt(1, 6), 'Enter');

      expect(selected).toEqual([]);
    });
  });
});
