import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { WritableSignal, signal } from '@angular/core';
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
import { clearPersistedSignals } from '../../../../../shared/utils/persisted-signal';

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
      useValue: { matchId: signal(id ?? ''), match: signal(match), lastSelectedEventId: signal<string | null>(null) },
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
    // Los filtros se guardan en sessionStorage por partido: sin esto, un test le pasaría sus filtros al siguiente.
    clearPersistedSignals();
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

      press('V');

      expect(component.selectedCell()).toEqual({ row: 3, col: 4 });
    });

    it('las letras del in-goal (columnas 1 y 6) no eligen celda: ahí solo hay puntos', () => {
      createLoaded();

      press('N');
      press('Q');

      expect(component.selectedCell()).toBeNull();
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

      it('F3-H1. Enter sobre un hueco precarga franja y rango desde el minuto del cursor; el cursor arranca en el 22 rival', () => {
        createLoaded([], []);
        tracks().dispatchEvent(new FocusEvent('focus'));

        press('Enter', {}, tracks());

        expect(component.selectedCell()).toEqual({ row: 2, col: 5 });
      });

      it('↓ baja una franja antes de abrir el hueco', () => {
        createLoaded([], []);
        tracks().dispatchEvent(new FocusEvent('focus'));

        press('ArrowDown', {}, tracks());
        press('Enter', {}, tracks());

        expect(component.selectedCell()).toEqual({ row: 2, col: 4 });
      });

      it('Enter sobre un hueco del in-goal no crea un tramo', () => {
        createLoaded([], []);
        tracks().dispatchEvent(new FocusEvent('focus'));

        press('ArrowUp', {}, tracks());
        press('Enter', {}, tracks());

        expect(component.selectedCell()).toBeNull();
      });

      it('F3-S4. las flechas dentro de un campo no mueven la grilla', () => {
        createLoaded([], []);
        tracks().dispatchEvent(new FocusEvent('focus'));

        press('ArrowDown', {}, query('#zone-start') as HTMLElement);
        press('Enter', {}, tracks());

        expect(component.selectedCell()).toEqual({ row: 2, col: 5 });
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

    /** Clic en la pista de la grilla, en el minuto y la franja (columna de la cancha) indicados; las filas no son parejas. */
    function clickTrack(minute: number, col: number): void {
      const rect = (query('[data-testid="territory-tracks"]') as HTMLElement).getBoundingClientRect();
      const row = queryAll('[data-testid="territory-row"]')[6 - col].getBoundingClientRect();
      (query('[data-testid="territory-tracks"]') as HTMLElement).dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + ((minute + 0.5) / 80) * rect.width,
        clientY: row.top + row.height / 2
      }));
      fixture.detectChanges();
    }

    it('F2-H1. clic en una fila dentro de un hueco precarga franja y rango, con lateral Centro', () => {
      createLoaded();

      clickTrack(3, 5);

      expect([panelOf().period, panelOf().startMinute, panelOf().endMinute]).toEqual([1, 0, 10]);
      expect(component.selectedCell()).toEqual({ row: 2, col: 5 });
    });

    it('un clic en un carril de in-goal no precarga ningún tramo', () => {
      createLoaded();

      clickTrack(3, 6);
      clickTrack(3, 1);

      expect(component.selectedCell()).toBeNull();
    });

    it('tocar una celda de in-goal en la cancha no elige franja, pero sí lo hace una del campo', () => {
      createLoaded();

      cell(2, 6).click();
      expect(component.selectedCell()).toBeNull();

      cell(2, 4).click();
      expect(component.selectedCell()).toEqual({ row: 2, col: 4 });
    });

    it('un tramo de in-goal que ya existe se puede abrir para editarlo', () => {
      createLoaded([{ ...zone, id: 'ig', startMinute: 4, endMinute: 5, col: 6 }]);

      query<HTMLButtonElement>('[data-testid="territory-block"]')?.click();
      fixture.detectChanges();

      expect(component.selectedCell()).toEqual({ row: 2, col: 6 });
      expect(query('app-zone-assignment-panel .section-title')?.textContent).toContain('Editar tramo');
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

  describe('jugadas sin zona y detalle de la celda', () => {
    const typed = (id: string, period: 1 | 2, minute: number, zoneCell: { row: number; col: number } | null, eventTypeId = 'scrum', eventTypeName = 'Scrum'): MatchTimelineEventResponse =>
      ({ ...ev(id, period, minute, zoneCell), eventTypeId, eventTypeName });
    const withUnzoned = [
      typed('a', 1, 12, { row: 2, col: 3 }),
      typed('hueco', 1, 35, null),
      typed('segundo', 2, 50, null, 'tackle', 'Tackle')
    ];
    const kpiLink = (): HTMLButtonElement | null => query<HTMLButtonElement>('[data-testid="kpi-unzoned-link"]');
    const items = (): HTMLElement[] => queryAll('[data-testid="unzoned-item"]');
    const panel = (): ZoneAssignmentPanelComponent => fixture.debugElement.query(By.directive(ZoneAssignmentPanelComponent)).componentInstance;

    it('el KPI «sin zona» abre la lista con el motivo de cada jugada, en orden cronológico', () => {
      createLoaded([zone], withUnzoned);

      kpiLink()?.click();
      fixture.detectChanges();

      expect(items().length).toBe(2);
      expect(items()[0].textContent).toContain('1T 35:00');
      expect(items()[0].textContent).toContain('Ningún tramo cubre este minuto');
      expect(items()[1].textContent).toContain('2T 50:00');
    });

    it('el enlace del panel abre la misma lista', () => {
      createLoaded([zone], withUnzoned);

      component.openUnzoned();
      fixture.detectChanges();

      expect(query('[data-testid="unzoned-title"]')?.textContent).toContain('2 jugadas sin zona');
    });

    it('«Completar hueco» precarga el hueco de la jugada en el formulario', () => {
      createLoaded([zone], withUnzoned);
      kpiLink()?.click();
      fixture.detectChanges();

      items()[0].querySelector<HTMLButtonElement>('[data-testid="unzoned-fix"]')?.click();
      fixture.detectChanges();

      expect([panel().startMinute, panel().endMinute]).toEqual([25, 40]);
    });

    it('un hueco que cruza un tanto se completa solo hasta el corte que lo separa de la jugada', () => {
      const tryEvent: MatchTimelineEventResponse = { ...typed('try', 1, 22, null, 'try', 'Try'), matchTime: 22 * 60 + 30, attributes: { zone: 'right' } };
      createLoaded([], [tryEvent, typed('despues', 1, 30, null)]);
      TestBed.inject(MatchZonesStore).zoneRules.set(new Map([['try', { columns: [6], rowFrom: 'zone', closesTramo: true }]]));
      fixture.detectChanges();
      kpiLink()?.click();
      fixture.detectChanges();

      items().find(item => item.textContent?.includes('1T 30:00'))?.querySelector<HTMLButtonElement>('[data-testid="unzoned-fix"]')?.click();
      fixture.detectChanges();

      expect([panel().startMinute, panel().endMinute]).toEqual([23, 40]);
    });

    it('«Abrir tramo» carga para editar el tramo que no admite la jugada', () => {
      const forbidden = typed('lineout', 1, 22, null, 'lineout', 'Line-out');
      createLoaded([{ ...zone, startMinute: 20, endMinute: 25, col: 6 }], [forbidden]);
      kpiLink()?.click();
      fixture.detectChanges();

      items()[0].querySelector<HTMLButtonElement>('[data-testid="unzoned-fix"]')?.click();
      fixture.detectChanges();

      expect(panel().editingId).toBe('z1');
    });

    it('«Ver en Eventos» deja la jugada seleccionada y navega a la pantalla de Eventos', () => {
      createLoaded([zone], withUnzoned);
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);
      const shell = TestBed.inject(PostMatchShellStore) as unknown as { lastSelectedEventId: WritableSignal<string | null> };
      kpiLink()?.click();
      fixture.detectChanges();

      items()[0].querySelector<HTMLButtonElement>('[data-testid="unzoned-event"]')?.click();

      expect(shell.lastSelectedEventId()).toBe('hueco');
      expect(navigate).toHaveBeenCalledWith(['/post-match', 'match-1']);
    });

    it('volver cierra la lista y vuelve al detalle de la celda', () => {
      createLoaded([zone], withUnzoned);
      kpiLink()?.click();
      fixture.detectChanges();

      query<HTMLButtonElement>('[data-testid="unzoned-close"]')?.click();
      fixture.detectChanges();

      expect(query('[data-testid="unzoned-title"]')).toBeNull();
    });

    it('tocar una celda de la cancha fija su detalle con las jugadas y el origen de la zona', () => {
      createLoaded([zone], withUnzoned);

      cell(2, 3).click();
      fixture.detectChanges();

      expect(query('[data-testid="cell-detail-title"]')?.textContent).toContain('C3');
      expect(queryAll('[data-testid="cell-event"]').length).toBe(1);
      expect(query('[data-testid="cell-event"]')?.textContent).toContain("Tramo 1T 10'–25'");
    });

    it('el detalle queda fijo al salir el puntero, y el puntero sobre otra celda lo cambia mientras está encima', () => {
      createLoaded([zone], withUnzoned);
      cell(2, 3).click();
      fixture.detectChanges();

      cell(2, 4).dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      expect(query('[data-testid="cell-detail-title"]')?.textContent).toContain('C4');

      cell(2, 4).dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      expect(query('[data-testid="cell-detail-title"]')?.textContent).toContain('C3');
    });

    it('una celda del in-goal también se puede inspeccionar aunque no admita tramos', () => {
      createLoaded([zone], [typed('p', 1, 12, { row: 2, col: 6 })]);

      cell(2, 6).click();
      fixture.detectChanges();

      expect(query('[data-testid="cell-detail-title"]')?.textContent).toContain('C6');
      expect(queryAll('[data-testid="cell-event"]').length).toBe(1);
    });

    it('en Minutos el detalle lista los tramos de la celda', () => {
      createLoaded([zone], withUnzoned);
      (queryAll('[data-testid="mode-filter"]').find(button => button.textContent?.trim() === 'Minutos') as HTMLElement).click();
      fixture.detectChanges();

      cell(2, 3).click();
      fixture.detectChanges();

      expect(query('[data-testid="cell-tramo"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe("1T 10'–25' · 15 min");
    });

    it('el detalle de Eventos sigue el tipo elegido, igual que el mapa', () => {
      const mixed = [typed('a', 1, 12, { row: 2, col: 3 }), typed('b', 1, 14, { row: 2, col: 3 }, 'tackle', 'Tackle')];
      createLoaded([zone], mixed);
      cell(2, 3).click();
      fixture.detectChanges();
      expect(queryAll('[data-testid="cell-event"]').length).toBe(2);

      const select = query<HTMLSelectElement>('[data-testid="type-filter"]') as HTMLSelectElement;
      select.value = 'scrum';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(queryAll('[data-testid="cell-event"]').length).toBe(1);
    });
  });

  describe('filtro por tipo y modo Eventos / Minutos', () => {
    const typed = (id: string, minute: number, col: number, eventTypeId: string, eventTypeName: string): MatchTimelineEventResponse =>
      ({ ...ev(id, 1, minute, { row: 2, col }), eventTypeId, eventTypeName });
    const mixed = [
      typed('a', 12, 3, 'scrum', 'Scrum'),
      typed('b', 14, 3, 'tackle', 'Tackle'),
      typed('c', 16, 4, 'scrum', 'Scrum')
    ];
    const fieldCount = (row: number, col: number): string | undefined =>
      cell(row, col).querySelector('[data-testid="zone-count"]')?.textContent?.trim();
    const typeSelect = (): HTMLSelectElement => query('[data-testid="type-filter"]') as HTMLSelectElement;
    const chooseType = (id: string): void => {
      typeSelect().value = id;
      typeSelect().dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const clickMode = (label: string): void => {
      (queryAll('[data-testid="mode-filter"]').find(button => button.textContent?.trim() === label) as HTMLElement).click();
      fixture.detectChanges();
    };

    it('tipo y Eventos / Minutos van en el encabezado del mapa; período y posesión quedan en la barra de la pantalla', () => {
      createLoaded([zone], mixed);

      expect(query('[data-testid="map-header"] [data-testid="type-filter"]')).not.toBeNull();
      expect(queryAll('[data-testid="map-header"] [data-testid="mode-filter"]').length).toBe(2);
      expect(query('[data-testid="zone-filters"] [data-testid="type-filter"]')).toBeNull();
      expect(query('[data-testid="zone-filters"] [data-testid="mode-filter"]')).toBeNull();
      expect(queryAll('[data-testid="zone-filters"] [data-testid="period-filter"]').length).toBe(3);
      expect(queryAll('[data-testid="zone-filters"] [data-testid="possession-filter"]').length).toBe(3);
    });

    it('el encabezado del mapa lleva el título de lo que cuenta la cancha', () => {
      createLoaded([zone], mixed);
      expect(query('[data-testid="map-header"]')?.textContent).toContain('Eventos por zona');

      clickMode('Minutos');

      expect(query('[data-testid="map-header"]')?.textContent).toContain('Minutos por zona');
    });

    it('el tipo elegido afecta solo al mapa: los conteos de la grilla de territorio no cambian', () => {
      createLoaded([zone], mixed);
      const rowCounts = (): (string | undefined)[] => queryAll('[data-testid="territory-row-count"]').map(el => el.textContent?.trim());
      const before = rowCounts();

      chooseType('scrum');

      expect(rowCounts()).toEqual(before);
      expect([fieldCount(2, 3), fieldCount(2, 4)]).toEqual(['1', '1']);
    });

    it('el filtro lista solo los tipos que tiene el partido, ordenados', () => {
      createLoaded([zone], mixed);

      expect(Array.from(typeSelect().options).map(option => option.textContent?.trim())).toEqual(['Todas las jugadas', 'Scrum', 'Tackle']);
    });

    it('con un tipo elegido la cancha cuenta solo ese tipo', () => {
      createLoaded([zone], mixed);
      expect([fieldCount(2, 3), fieldCount(2, 4)]).toEqual(['2', '1']);

      chooseType('scrum');

      expect([fieldCount(2, 3), fieldCount(2, 4)]).toEqual(['1', '1']);
    });

    it('un tipo recordado que el partido ya no tiene se ignora', () => {
      createLoaded([zone], mixed);

      component.selectedType.set('maul');

      expect(component.typeFilter()).toBe('ALL');
    });

    it('en Minutos la cancha suma los minutos de los tramos, con su leyenda', () => {
      createLoaded([zone], mixed);

      clickMode('Minutos');

      expect(fieldCount(2, 3)).toBe('15');
      expect(fieldCount(2, 4)).toBeUndefined();
      expect(query('[data-testid="map-header"]')?.textContent).toContain('Minutos por zona');
      expect(cell(2, 3).getAttribute('aria-label')).toContain('15 min');
    });

    it('en Minutos se deshabilitan los filtros de tipo y posesión y el de tiempo sigue activo', () => {
      createLoaded([zone], mixed);

      clickMode('Minutos');

      expect(typeSelect().disabled).toBeTrue();
      queryAll('[data-testid="possession-filter"]').forEach(button => expect((button as HTMLButtonElement).disabled).toBeTrue());
      queryAll('[data-testid="period-filter"]').forEach(button => expect((button as HTMLButtonElement).disabled).toBeFalse());
    });

    it('en Minutos el tipo elegido no cambia los minutos, y al volver a Eventos se conserva', () => {
      createLoaded([zone], mixed);
      chooseType('scrum');

      clickMode('Minutos');
      expect(fieldCount(2, 3)).toBe('15');

      clickMode('Eventos');
      expect(typeSelect().disabled).toBeFalse();
      expect(fieldCount(2, 3)).toBe('1');
    });

    it('en Minutos el filtro de tiempo recorta los tramos del tiempo elegido', () => {
      createLoaded([zone, { ...zone, id: 'z2', period: 2, startMinute: 50, endMinute: 60, row: 3, col: 5 }], mixed);
      clickMode('Minutos');

      component.setPeriodFilter(2);
      fixture.detectChanges();

      expect(fieldCount(2, 3)).toBeUndefined();
      expect(fieldCount(3, 5)).toBe('10');
    });
  });
});
