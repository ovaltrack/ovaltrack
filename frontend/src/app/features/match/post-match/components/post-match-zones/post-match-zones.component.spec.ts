import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { PostMatchZonesComponent } from './post-match-zones.component';
import { EventTypeService } from '../../../services/event-type.service';
import { MatchZonesStore } from '../../store/match-zones.store';
import { PostMatchShellStore } from '../../store/post-match-shell.store';
import { Match } from '../../../types/match.types';
import { MatchTimelineEventResponse } from '../../../types/event.types';
import { ZoneAssignmentResponse } from '../../../types/zone.types';
import { ZoneAssignmentPanelComponent } from '../zone-assignment-panel/zone-assignment-panel.component';

describe('PostMatchZonesComponent', () => {
  let fixture: ComponentFixture<PostMatchZonesComponent>;
  let component: PostMatchZonesComponent;
  let http: HttpTestingController;
  let router: Router;

  const match = { id: 'match-1', opponent: { id: 'opp-1', name: 'Trelew RC', alias: 'Trelew', city: null }, homeScore: 12, awayScore: 7 } as Match;
  const zonesUrl = (r: { url: string }) => r.url.endsWith('/matches/match-1/zones');
  const eventsUrl = (r: { url: string }) => r.url.includes('/event/match/post-match');

  const zone: ZoneAssignmentResponse = { id: 'z1', matchId: 'match-1', period: 1, startMinute: 10, endMinute: 25, row: 2, col: 3 };
  const ev = (id: string, period: 1 | 2, minute: number, cell: { row: number; col: number } | null): MatchTimelineEventResponse => ({
    id, eventTypeId: 't', eventTypeName: 'Tackle', matchTime: minute * 60, period, teamPossession: 'OWN', zone: cell
  });
  const events = [
    ev('a', 1, 12, { row: 2, col: 3 }),
    ev('b', 1, 18, { row: 2, col: 3 }),
    ev('c', 1, 35, null),
    ev('d', 2, 50, null)
  ];

  const query = <T extends HTMLElement>(selector: string): T | null => fixture.nativeElement.querySelector(selector);
  const queryAll = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const cell = (row: number, col: number): HTMLElement =>
    queryAll('[data-testid="zone-cell"]').find(c => c.dataset['row'] === String(row) && c.dataset['col'] === String(col)) as HTMLElement;

  function create(id: string | null = 'match-1'): void {
    TestBed.overrideProvider(PostMatchShellStore, {
      useValue: { matchId: signal(id ?? ''), match: signal(match) },
    });
    fixture = TestBed.createComponent(PostMatchZonesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function createLoaded(assignments: ZoneAssignmentResponse[] = [zone], list: MatchTimelineEventResponse[] = events): void {
    create();
    http.expectOne(zonesUrl).flush({ assignments, summary: { cells: [], unzonedEventCount: 0 } });
    http.expectOne(eventsUrl).flush(list);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostMatchZonesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PostMatchShellStore, useValue: { matchId: signal('match-1'), match: signal(match) } },
        { provide: EventTypeService, useValue: { getAll: () => of([]) } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    TestBed.inject(MatchZonesStore).reset();
  });

  afterEach(() => http.verify());

  describe('carga', () => {
    it('carga tramos y eventos y muestra KPI, cancha, grilla de territorio y panel', () => {
      createLoaded();

      expect(query('app-rugby-field')).not.toBeNull();
      expect(query('app-zone-kpi-strip')).not.toBeNull();
      expect(query('app-zone-territory-grid')).not.toBeNull();
      expect(query('app-zone-assignment-panel')).not.toBeNull();
    });

    it('la grilla de territorio va encima de la cancha', () => {
      createLoaded();

      const grid = query('app-zone-territory-grid') as Element;
      const field = query('app-rugby-field') as Element;

      expect(grid.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('muestra el error del backend y permite volver', () => {
      create();
      // forkJoin cancela las demás peticiones al primer error: solo se responde la de zonas.
      http.expectOne(zonesUrl).flush({ message: 'Acceso denegado' }, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();

      expect(query('.feedback-state--error')?.textContent).toContain('Acceso denegado');
      expect(query('app-rugby-field')).toBeNull();
    });

    it('sin id de partido no consulta al backend', () => {
      create(null);

      expect(query('.feedback-state--error')?.textContent).toContain('No se indicó el partido');
      http.expectNone(zonesUrl);
    });

    it('el error permite volver al análisis del partido', () => {
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);
      create();
      http.expectOne(zonesUrl).flush({ message: 'Acceso denegado' }, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();

      query<HTMLButtonElement>('.feedback-state--error .btn-outline')?.click();

      expect(navigate).toHaveBeenCalledWith(['/post-match', 'match-1']);
    });
  });

  describe('atajos de teclado', () => {
    const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document): void => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
      fixture.detectChanges();
    };

    it('F2-H9. una letra elige la celda de la grilla que le corresponde', () => {
      createLoaded();

      press('d');

      expect(component.selectedCell()).toEqual({ row: 2, col: 3 });
    });

    it('las mayúsculas funcionan igual', () => {
      createLoaded();

      press('N');

      expect(component.selectedCell()).toEqual({ row: 3, col: 6 });
    });

    it('F2-S4. con el foco en un campo de escritura las letras no hacen nada', () => {
      createLoaded();

      press('q', {}, query('#zone-start') as HTMLElement);

      expect(component.selectedCell()).toBeNull();
    });

    it('con Ctrl/Cmd/Alt las letras no son atajos (no pisan los del navegador)', () => {
      createLoaded();

      press('a', { ctrlKey: true });
      press('a', { metaKey: true });
      press('a', { altKey: true });

      expect(component.selectedCell()).toBeNull();
    });

    it('Ctrl/Cmd + Enter guarda el tramo, incluso escribiendo un minuto', () => {
      createLoaded([], []);
      press('d');

      press('Enter', { ctrlKey: true }, query('#zone-start') as HTMLElement);

      const post = http.expectOne(zonesUrl);
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ row: 2, col: 3, period: 1, startMinute: 0, endMinute: 5 });
      post.flush({ ...zone, startMinute: 0, endMinute: 5 });
      http.expectOne(zonesUrl).flush({ assignments: [], summary: { cells: [], unzonedEventCount: 0 } });
      http.expectOne(eventsUrl).flush([]);
    });

    it('Ctrl + Enter sin zona elegida no guarda nada', () => {
      createLoaded([], []);

      press('Enter', { ctrlKey: true });

      http.expectNone(r => r.method === 'POST');
    });

    it('Ctrl/Cmd + Enter toma el minuto escrito en Hasta aunque no se haya confirmado', () => {
      createLoaded([], []);
      press('d');
      const end = query<HTMLInputElement>('#zone-end') as HTMLInputElement;
      end.value = '9';
      end.dispatchEvent(new Event('input'));

      press('Enter', { ctrlKey: true }, end);

      const post = http.expectOne(zonesUrl);
      expect(post.request.body).toEqual({ row: 2, col: 3, period: 1, startMinute: 0, endMinute: 9 });
      post.flush({ ...zone, startMinute: 0, endMinute: 9 });
      http.expectOne(zonesUrl).flush({ assignments: [], summary: { cells: [], unzonedEventCount: 0 } });
      http.expectOne(eventsUrl).flush([]);
    });

    it('Ctrl/Cmd + Enter con el formulario inválido no guarda y deja el error inline', () => {
      createLoaded([], []);
      press('d');
      const end = query<HTMLInputElement>('#zone-end') as HTMLInputElement;
      end.value = '0';
      end.dispatchEvent(new Event('input'));

      press('Enter', { ctrlKey: true }, end);

      http.expectNone(r => r.method === 'POST');
      expect(query('[data-testid="range-error"]')).not.toBeNull();
    });

    it('Ctrl/Cmd + Enter sin franja marca el campo Franja como error', () => {
      createLoaded([], []);

      press('Enter', { ctrlKey: true });

      expect(query('[data-testid="selected-cell"]')?.classList).toContain('is-error');
    });

    describe('Esc deshace una sola cosa por vez', () => {
      it('con una zona elegida vuelve a "Nuevo tramo" vacío, sin confirmar', () => {
        createLoaded([], []);
        press('d');
        expect(component.selectedCell()).not.toBeNull();

        press('Escape');

        expect(component.selectedCell()).toBeNull();
      });

      it('con el foco en Desde primero sale del campo y no borra lo escrito ni la selección', () => {
        createLoaded([], []);
        press('d');
        const start = query<HTMLInputElement>('#zone-start') as HTMLInputElement;
        start.value = '7';
        start.dispatchEvent(new Event('input'));

        press('Escape', {}, start);

        expect(start.value).toBe('7');
        expect(component.selectedCell()).toEqual({ row: 2, col: 3 });

        press('Escape');
        expect(component.selectedCell()).toBeNull();
      });

      it('sin nada que deshacer no hace nada', () => {
        createLoaded([], []);

        press('Escape');

        expect(component.selectedCell()).toBeNull();
      });
    });

    describe('teclado en la grilla', () => {
      const tracks = (): HTMLElement => query('[data-testid="territory-tracks"]') as HTMLElement;

      it('la grilla es una sola parada de Tab y sus bloques quedan fuera del orden de Tab', () => {
        createLoaded();

        expect(tracks().getAttribute('tabindex')).toBe('0');
        queryAll('[data-testid="territory-block"]').forEach(block => expect(block.getAttribute('tabindex')).toBe('-1'));
      });

      it('F3-H1. Enter sobre un hueco precarga franja y rango desde el minuto del cursor', () => {
        createLoaded([], []);
        tracks().dispatchEvent(new FocusEvent('focus'));

        press('Enter', {}, tracks());

        expect(component.selectedCell()).toEqual({ row: 2, col: 6 });
      });

      it('↓ baja una franja antes de abrir el hueco', () => {
        createLoaded([], []);
        tracks().dispatchEvent(new FocusEvent('focus'));

        press('ArrowDown', {}, tracks());
        press('Enter', {}, tracks());

        expect(component.selectedCell()).toEqual({ row: 2, col: 5 });
      });

      it('F3-S4. las flechas dentro de un campo no mueven la grilla', () => {
        createLoaded([], []);
        tracks().dispatchEvent(new FocusEvent('focus'));

        press('ArrowDown', {}, query('#zone-start') as HTMLElement);
        press('Enter', {}, tracks());

        expect(component.selectedCell()).toEqual({ row: 2, col: 6 });
      });
    });

    it('el ícono "?" despliega la ayuda con las teclas de cada fila', () => {
      createLoaded();
      expect(query('[data-testid="shortcuts-help"]')).toBeNull();

      query<HTMLButtonElement>('[data-testid="shortcuts-toggle"]')?.click();
      fixture.detectChanges();

      const help = query('[data-testid="shortcuts-help"]')?.textContent ?? '';
      expect(help).toContain('Q W E R T Y');
      expect(help).toContain('Enter');
      expect(query('[data-testid="shortcuts-toggle"]')?.getAttribute('aria-expanded')).toBe('true');
    });

    it('la ayuda general incluye la regla del rango', () => {
      createLoaded();

      query<HTMLButtonElement>('[data-testid="shortcuts-toggle"]')?.click();
      fixture.detectChanges();

      const rules = query('[data-testid="range-rules"]')?.textContent ?? '';
      expect(rules).toContain('Inicio incluido, fin excluido: 20′–25′ y 25′–30′ no se pisan.');
      expect(rules).toContain('El tiempo añadido cuenta como minuto 40 (1T) y 80 (2T).');
    });
  });

  describe('estados de carga y vacío', () => {
    it('una carga rápida no muestra la pelota', () => {
      create();
      expect(query('[data-testid="zones-loading"]')).toBeNull();

      http.expectOne(zonesUrl).flush({ assignments: [], summary: { cells: [], unzonedEventCount: 0 } });
      http.expectOne(eventsUrl).flush([]);
      fixture.detectChanges();

      expect(query('[data-testid="zones-loading"]')).toBeNull();
    });

    it('si la carga pasa de 100 ms muestra la pelota de rugby con aviso accesible', fakeAsync(() => {
      create();
      tick(100);
      fixture.detectChanges();

      expect(query('[data-testid="zones-loading"]')).not.toBeNull();
      expect(query('[data-testid="zones-loading"] [role="status"]')?.textContent).toContain('Cargando zonas del partido');

      http.expectOne(zonesUrl).flush({ assignments: [], summary: { cells: [], unzonedEventCount: 0 } });
      http.expectOne(eventsUrl).flush([]);
      tick(400);
      fixture.detectChanges();

      expect(query('[data-testid="zones-loading"]')).toBeNull();
    }));

    it('sin tramos el formulario viene precargado con 0–5', () => {
      createLoaded([], []);

      const panel = fixture.debugElement.query(By.directive(ZoneAssignmentPanelComponent)).componentInstance as ZoneAssignmentPanelComponent;
      expect([panel.startMinute, panel.endMinute]).toEqual([0, 5]);
    });

    it('sin tramos solo se ven dos mensajes de inicio: la grilla y el campo Franja', () => {
      createLoaded([], []);

      expect(query('[data-testid="territory-empty"]')?.textContent).toContain('Tocá una fila de la grilla para empezar');
      expect(query('[data-testid="selected-cell"]')?.textContent).toContain('Tocá la grilla o la cancha');
      for (const repeated of ['start-hint', 'zones-empty', 'save-hint', 'panel-subtitle']) {
        expect(query(`[data-testid="${repeated}"]`)).withContext(repeated).toBeNull();
      }
    });
  });

  describe('vínculo entre cancha y grilla', () => {
    const segmentBars = (): HTMLElement[] => queryAll('[data-testid="territory-block"]');

    it('hover en una celda resalta sus tramos en la grilla y atenúa el resto', () => {
      createLoaded([zone, { ...zone, id: 'z2', startMinute: 25, endMinute: 40, row: 1, col: 5 }]);

      cell(2, 3).dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();

      expect(segmentBars().map(bar => bar.classList.contains('is-linked'))).toEqual([true, false]);
      expect(segmentBars().map(bar => bar.classList.contains('is-dimmed'))).toEqual([false, true]);

      cell(2, 3).dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();

      expect(segmentBars().some(bar => bar.classList.contains('is-dimmed'))).toBeFalse();
    });

    it('hover en un tramo resalta su celda en la cancha', () => {
      createLoaded();

      segmentBars()[0].dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();

      expect(cell(2, 3).classList).toContain('is-linked');
      expect(cell(1, 1).classList).not.toContain('is-linked');
    });
  });

  describe('filtros de la cancha', () => {
    const typed = (id: string, possession: 'OWN' | 'OPPONENT', minute: number): MatchTimelineEventResponse => ({
      ...ev(id, 1, minute, { row: 2, col: 3 }), teamPossession: possession
    });
    const mixed = [typed('a', 'OWN', 11), typed('b', 'OWN', 12), typed('c', 'OPPONENT', 13)];
    const count = (): string => cell(2, 3).querySelector('[data-testid="zone-count"]')?.textContent?.trim() ?? '';
    const pill = (group: string, label: string): HTMLElement | undefined =>
      queryAll(`[data-testid="${group}"]`).find(b => b.textContent?.trim() === label);

    it('F2-H6. el filtro de posesión recalcula el calor de la cancha', () => {
      createLoaded([zone], mixed);
      expect(count()).toBe('3');

      pill('possession-filter', 'Rival')?.click();
      fixture.detectChanges();
      expect(count()).toBe('1');

      pill('possession-filter', 'Propios')?.click();
      fixture.detectChanges();
      expect(count()).toBe('2');
    });

    it('las píldoras de posesión son Todos, Propios y Rival; las de tiempo, Todo el partido, 1T y 2T', () => {
      createLoaded([zone], mixed);

      expect(queryAll('[data-testid="possession-filter"]').map(b => b.textContent?.trim())).toEqual(['Todos', 'Propios', 'Rival']);
      expect(queryAll('[data-testid="period-filter"]').map(b => b.textContent?.trim())).toEqual(['Todo el partido', '1T', '2T']);
    });

    it('la píldora activa lleva aria-pressed', () => {
      createLoaded([zone], mixed);

      pill('period-filter', '2T')?.click();
      fixture.detectChanges();

      expect(pill('period-filter', '2T')?.getAttribute('aria-pressed')).toBe('true');
      expect(pill('period-filter', 'Todo el partido')?.getAttribute('aria-pressed')).toBe('false');
    });

    it('la grilla de territorio cuenta los eventos con el mismo filtro de posesión', () => {
      createLoaded([zone], mixed);

      pill('possession-filter', 'Rival')?.click();
      fixture.detectChanges();

      const counts = queryAll('[data-testid="territory-row-count"]').map(el => el.textContent?.trim());
      expect(counts).toEqual(['0', '0', '0', '1', '0', '0']);
    });

    it('ya no hay selector de calor ni conmutador de modo', () => {
      createLoaded([zone], mixed);

      expect(query('[data-testid="heat-on"]')).toBeNull();
      expect(query('[data-testid="heat-off"]')).toBeNull();
      expect(query('[data-testid="mode-assign"]')).toBeNull();
      expect(query('[data-testid="mode-view"]')).toBeNull();
      expect(query('[data-testid="heat-legend"]')).not.toBeNull();
    });
  });

  describe('indicadores y conteos derivados de los eventos', () => {
    it('F2-H7. la franja de KPI muestra eventos, sin zona y porcentaje del tiempo con zona', () => {
      createLoaded();

      expect(query('[data-testid="kpi-total"]')?.textContent?.trim()).toBe('4');
      expect(query('[data-testid="kpi-unzoned"]')?.textContent?.trim()).toBe('2');
      expect(query('[data-testid="kpi-coverage"]')?.textContent?.trim()).toBe('19%');
    });

    it('F2-H8. con el partido completo el tiempo con zona es 100 %', () => {
      createLoaded([
        { ...zone, id: 'p1', startMinute: 0, endMinute: 40 },
        { ...zone, id: 'p2', period: 2, startMinute: 40, endMinute: 80 }
      ]);

      expect(query('[data-testid="kpi-coverage"]')?.textContent?.trim()).toBe('100%');
    });

    it('los KPI no dependen de los filtros', () => {
      createLoaded();

      component.setPeriodFilter(2);
      fixture.detectChanges();

      expect(query('[data-testid="kpi-total"]')?.textContent?.trim()).toBe('4');
      expect(query('[data-testid="kpi-unzoned"]')?.textContent?.trim()).toBe('2');
    });

    it('no quedan la cobertura 1T/2T ni el chip de sin zona (los reemplaza la franja de KPI)', () => {
      createLoaded();

      expect(query('[data-testid="coverage"]')).toBeNull();
      expect(query('[data-testid="unzoned-chip"]')).toBeNull();
    });

    it('sin franja elegida el rango del formulario es una barra sobre el eje, no una columna en las filas', () => {
      createLoaded();

      expect(query('[data-testid="territory-axis-range"]')).not.toBeNull();
      expect(query('[data-testid="territory-preview"]')).toBeNull();
    });

    it('con franja elegida la vista previa va solo en esa fila', () => {
      createLoaded();
      cell(2, 3).click();
      fixture.detectChanges();

      expect(query('[data-testid="territory-axis-range"]')).toBeNull();
      expect(queryAll('[data-testid="territory-preview"]').length).toBe(1);
    });

    it('la cancha cuenta los eventos de cada celda', () => {
      createLoaded();

      expect(cell(2, 3).querySelector('[data-testid="zone-count"]')?.textContent).toContain('2');
    });

    it('el filtro de tiempo recalcula los conteos de la cancha', () => {
      createLoaded();

      component.setPeriodFilter(2);
      fixture.detectChanges();

      expect(cell(2, 3).querySelector('[data-testid="zone-count"]')).toBeNull();
    });
  });

  describe('elegir la zona', () => {
    it('F2-H5. tocar una celda de la cancha completa franja y lateral en el formulario', () => {
      createLoaded();

      cell(3, 5).click();
      fixture.detectChanges();

      expect(component.selectedCell()).toEqual({ row: 3, col: 5 });
      expect(query('[data-testid="sheet-zone"]')?.textContent).toContain('22 rival');
      expect(queryAll('[data-testid="lateral-option"]')[2].classList).toContain('is-active');
    });

    it('la franja elegida resalta su fila en la grilla', () => {
      createLoaded();

      cell(1, 5).click();
      fixture.detectChanges();

      const labels = queryAll('[data-testid="territory-row-label"]');
      expect(labels.map(l => l.classList.contains('is-selected'))).toEqual([false, true, false, false, false, false]);
    });

    it('la ayuda "?" incluye la nota de vista relativa que antes estaba bajo la cancha', () => {
      createLoaded();
      expect(query('[data-testid="relative-note"]')).toBeNull();

      query<HTMLButtonElement>('[data-testid="shortcuts-toggle"]')?.click();
      fixture.detectChanges();

      expect(query('[data-testid="relative-note"]')?.textContent).toContain('siempre atacás hacia la derecha');
    });
  });

  describe('grilla de territorio', () => {
    const panelOf = (): ZoneAssignmentPanelComponent =>
      fixture.debugElement.query(By.directive(ZoneAssignmentPanelComponent)).componentInstance as ZoneAssignmentPanelComponent;

    /** Clic en la pista de la grilla, en el minuto y la franja (columna de la cancha) indicados. */
    function clickTrack(minute: number, col: number): void {
      const rect = (query('[data-testid="territory-tracks"]') as HTMLElement).getBoundingClientRect();
      const rowIndex = 6 - col;
      (query('[data-testid="territory-tracks"]') as HTMLElement).dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + ((minute + 0.5) / 80) * rect.width,
        clientY: rect.top + ((rowIndex + 0.5) / 6) * rect.height
      }));
      fixture.detectChanges();
    }

    it('F2-H1. clic en una fila dentro de un hueco precarga franja y rango, con lateral Centro', () => {
      createLoaded();

      clickTrack(3, 6);

      expect([panelOf().period, panelOf().startMinute, panelOf().endMinute]).toEqual([1, 0, 10]);
      expect(component.selectedCell()).toEqual({ row: 2, col: 6 });
    });

    it('un clic en otra franja conserva el lateral ya elegido', () => {
      createLoaded();
      component.selectedCell.set({ row: 3, col: 3 });

      clickTrack(30, 5);

      expect(component.selectedCell()).toEqual({ row: 3, col: 5 });
      expect([panelOf().startMinute, panelOf().endMinute]).toEqual([25, 40]);
    });

    it('F2-S1. clic en una fila sobre un tramo ya zonificado no hace nada', () => {
      createLoaded();
      component.selectedCell.set({ row: 1, col: 2 });
      panelOf().prefill({ startMinute: 60, endMinute: 70 });

      clickTrack(12, 3);

      expect([panelOf().startMinute, panelOf().endMinute]).toEqual([60, 70]);
      expect(component.selectedCell()).toEqual({ row: 1, col: 2 });
    });

    it('F2-H2. tocar un bloque lo carga para editar y le pone el anillo', () => {
      createLoaded();

      query<HTMLButtonElement>('[data-testid="territory-block"]')?.click();
      fixture.detectChanges();

      expect(query('app-zone-assignment-panel .section-title')?.textContent).toContain('Editar tramo');
      expect(query('[data-testid="territory-block"]')?.classList).toContain('is-selected');
    });

    it('F2-H6. el filtro de tiempo atenúa la otra mitad de la grilla', () => {
      createLoaded();
      expect(query('[data-testid="territory-veil"]')).toBeNull();

      component.setPeriodFilter(1);
      fixture.detectChanges();

      expect(query('[data-testid="territory-veil"]')?.classList).toContain('veil-second');
    });

    it('F2-H9. sin tramos la grilla entera es un hueco y muestra cómo empezar', () => {
      createLoaded([], []);

      expect(queryAll('[data-testid="territory-gap"]').length).toBe(2);
      expect(query('[data-testid="territory-empty"]')).not.toBeNull();
    });

    it('cada fila muestra los eventos de su franja, con el in-goal rival arriba', () => {
      createLoaded();

      const counts = queryAll('[data-testid="territory-row-count"]').map(el => el.textContent?.trim());
      expect(counts).toEqual(['0', '0', '0', '2', '0', '0']);
    });
  });
});
