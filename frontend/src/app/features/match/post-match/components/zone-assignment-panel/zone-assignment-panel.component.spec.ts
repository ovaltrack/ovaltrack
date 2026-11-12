import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { EventTypeService } from '../../../services/event-type.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { ZoneAssignmentPanelComponent } from './zone-assignment-panel.component';
import { MatchZonesStore } from '../../store/match-zones.store';
import { MatchTimelineEventResponse } from '../../../types/event.types';
import { MatchZonesResponse, ZoneAssignmentResponse } from '../../../types/zone.types';

describe('ZoneAssignmentPanelComponent', () => {
  let fixture: ComponentFixture<ZoneAssignmentPanelComponent>;
  let component: ZoneAssignmentPanelComponent;
  let store: MatchZonesStore;
  let http: HttpTestingController;
  let toast: ToastService;

  const zonesUrl = (r: { url: string }) => r.url.endsWith('/matches/match-1/zones');
  const eventsUrl = (r: { url: string }) => r.url.includes('/event/match/post-match');
  const emptyResponse: MatchZonesResponse = { assignments: [], summary: { cells: [], unzonedEventCount: 0 } };
  const existingZone: ZoneAssignmentResponse = {
    id: 'zone-1', matchId: 'match-1', period: 1, startMinute: 10, endMinute: 25, row: 2, col: 3
  };

  const query = <T extends HTMLElement>(selector: string): T | null => fixture.nativeElement.querySelector(selector);
  const queryAll = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const saveButton = (): HTMLButtonElement => query<HTMLButtonElement>('[data-testid="zone-save"]') as HTMLButtonElement;
  const rangeError = (): string => query('[data-testid="range-error"]')?.textContent?.trim() ?? '';

  const ev = (id: string, period: 1 | 2, minute: number): MatchTimelineEventResponse => ({
    id, eventTypeId: 't', eventTypeName: 'Tackle', matchTime: minute * 60, period, teamPossession: 'OWN'
  });

  /** Tras escribir, el store recarga tramos y eventos. */
  function flushReload(assignments: ZoneAssignmentResponse[] = []): void {
    http.expectOne(zonesUrl).flush({ assignments, summary: { cells: [], unzonedEventCount: 0 } });
    http.expectOne(eventsUrl).flush([]);
  }

  /** Carga el store como lo hace la página (tramos + eventos) y renderiza el panel. */
  function render(assignments: ZoneAssignmentResponse[] = [], events: MatchTimelineEventResponse[] = []): void {
    store.load('match-1').subscribe();
    http.expectOne(zonesUrl).flush({ assignments, summary: { cells: [], unzonedEventCount: 0 } });
    http.expectOne(eventsUrl).flush(events);
    fixture.componentRef.setInput('matchId', 'match-1');
    fixture.detectChanges();
  }

  function selectCell(row: number, col: number): void {
    fixture.componentRef.setInput('selectedCell', { row, col });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZoneAssignmentPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EventTypeService, useValue: { getAll: () => of([]) } },
      ],
    }).compileComponents();

    store = TestBed.inject(MatchZonesStore);
    store.reset();
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ZoneAssignmentPanelComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  describe('formulario', () => {
    it('F2-S4. sin franja elegida el botón está deshabilitado y el campo Franja dice dónde elegirla', () => {
      render();

      expect(saveButton().disabled).toBeTrue();
      expect(query('[data-testid="selected-cell"]')?.textContent).toContain('Tocá la grilla o la cancha');
      expect(saveButton().getAttribute('aria-describedby')).toBe('zone-franja');
      expect(query('#zone-franja')).not.toBeNull();
      expect(query('[data-testid="save-hint"]')).toBeNull();
    });

    it('no hay selector de tiempo: el 1T o 2T se deduce del rango', () => {
      render();

      expect(queryAll('[data-testid="lateral-option"]').map(b => b.textContent?.trim())).toEqual(['Izquierda', 'Centro', 'Derecha']);
      expect(query('#zone-period-label')).toBeNull();
    });

    it('no propone el tiempo completo por defecto: sugiere 5 minutos', () => {
      render();

      expect(component.startMinute).toBe(0);
      expect(component.endMinute).toBe(5);
    });

    it('sugiere el primer hueco libre, no el inicio del tiempo', () => {
      render([{ ...existingZone, startMinute: 0, endMinute: 10 }]);

      expect([component.startMinute, component.endMinute]).toEqual([10, 15]);
    });

    it('con el partido completamente cubierto no sugiere rango y lo explica', () => {
      render([
        { ...existingZone, id: 'p1', startMinute: 0, endMinute: 40 },
        { ...existingZone, id: 'p2', period: 2, startMinute: 40, endMinute: 80 }
      ]);
      selectCell(2, 3);

      expect([component.startMinute, component.endMinute]).toEqual([null, null]);
      expect(saveButton().disabled).toBeTrue();
      expect(rangeError()).toContain('minutos enteros');
    });

    it('la regla del rango va en un "?" junto a "Hasta", con tooltip y aria-label, y no hay fila de ayuda', () => {
      render();

      const rule = query<HTMLButtonElement>('[data-testid="range-rule-help"]');
      expect(rule?.getAttribute('aria-label')).toBe('Inicio incluido, fin excluido: 20′–25′ y 25′–30′ no se pisan.');
      expect(rule?.title).toBe(rule?.getAttribute('aria-label') ?? '');
      expect(query('label[for="zone-end"]')?.parentElement).toBe(rule?.parentElement ?? null);
      expect(query('.range-note')).toBeNull();
      expect(query('[data-testid="range-help-toggle"]')).toBeNull();
    });

    it('Desde y Hasta van lado a lado, también al crear un tramo', () => {
      render();

      const fields = queryAll('.range-row .range-field');
      expect(fields.length).toBe(2);
      expect(fields[0].querySelector('#zone-start')).not.toBeNull();
      expect(fields[1].querySelector('#zone-end')).not.toBeNull();
    });

    it('al elegir la franja y con un rango válido se habilita guardar y desaparece la referencia a la ayuda', () => {
      render();
      selectCell(2, 3);

      expect(saveButton().disabled).toBeFalse();
      expect(saveButton().getAttribute('aria-describedby')).toBeNull();
      expect(query('[data-testid="selected-cell"]')?.textContent).toContain('C3');
      expect(query('[data-testid="selected-cell"]')?.textContent).toContain('Campo propio');
      expect(query('[data-testid="sheet-zone"]')?.textContent).toContain('Campo propio');
    });

    describe('lateral', () => {
      const lateralButtons = (): HTMLButtonElement[] => queryAll('[data-testid="lateral-option"]') as HTMLButtonElement[];

      it('sin franja los botones de lateral están deshabilitados', () => {
        render();

        expect(lateralButtons().every(b => b.disabled)).toBeTrue();
      });

      it('con franja marca el lateral elegido y permite cambiarlo sin perder la franja', () => {
        render();
        component.selectedCell.set({ row: 2, col: 5 });
        fixture.detectChanges();
        expect(lateralButtons()[1].classList).toContain('is-active');

        lateralButtons()[2].click();
        fixture.detectChanges();

        expect(component.selectedCell()).toEqual({ row: 3, col: 5 });
        expect(lateralButtons()[2].classList).toContain('is-active');
      });
    });

    describe('hoja inferior en móvil', () => {
      const summary = (): string => query('[data-testid="sheet-summary"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const sheet = (): HTMLElement => query('.panel-card.is-sheet') as HTMLElement;

      it('el resumen muestra la zona elegida, el rango y cuántos eventos se vinculan', () => {
        render([], [ev('1', 1, 1), ev('2', 1, 3)]);
        selectCell(2, 4);
        component.startMinute = 0;
        component.endMinute = 5;
        fixture.detectChanges();

        expect(summary()).toContain('Campo rival');
        expect(query('[data-testid="sheet-range"]')?.textContent).toBe('0′–5′ · 1T · 2 eventos');
      });

      it('sin franja el resumen repite el texto del campo Franja y no muestra rango', () => {
        render([
          { ...existingZone, id: 'p1', startMinute: 0, endMinute: 40 },
          { ...existingZone, id: 'p2', period: 2, startMinute: 40, endMinute: 80 }
        ]);

        expect(summary()).toContain('Tocá la grilla o la cancha');
        expect(query('[data-testid="sheet-range"]')).toBeNull();
      });

      it('"Más opciones" expande la hoja y "Menos opciones" la vuelve a compactar', () => {
        render();
        expect(sheet().classList).not.toContain('is-open');
        expect(query('[data-testid="sheet-toggle"]')?.textContent?.trim()).toBe('Más opciones');

        query<HTMLButtonElement>('[data-testid="sheet-toggle"]')?.click();
        fixture.detectChanges();
        expect(sheet().classList).toContain('is-open');
        expect(query('[data-testid="sheet-toggle"]')?.textContent?.trim()).toBe('Menos opciones');
        expect(query('[data-testid="sheet-toggle"]')?.getAttribute('aria-expanded')).toBe('true');

        query<HTMLButtonElement>('[data-testid="sheet-toggle"]')?.click();
        fixture.detectChanges();
        expect(sheet().classList).not.toContain('is-open');
      });

      it('cerrar la hoja equivale a Esc: deselecciona y vuelve a "Nuevo tramo" vacío', () => {
        render();
        selectCell(2, 3);
        component.toggleSheet();
        fixture.detectChanges();

        query<HTMLButtonElement>('[data-testid="sheet-close"]')?.click();
        fixture.detectChanges();

        expect(component.selectedCell()).toBeNull();
        expect(sheet().classList).not.toContain('is-open');
        expect(query('[data-testid="panel-title"]')?.textContent?.trim()).toBe('Nuevo tramo');
      });

      it('sin nada elegido, cerrar solo compacta la hoja expandida', () => {
        render();
        component.toggleSheet();
        fixture.detectChanges();

        query<HTMLButtonElement>('[data-testid="sheet-close"]')?.click();
        fixture.detectChanges();

        expect(sheet().classList).not.toContain('is-open');
      });

      it('el resumen compacto muestra el problema del rango, porque Desde/Hasta están ocultos', () => {
        render([{ ...existingZone, startMinute: 0, endMinute: 10 }]);
        selectCell(2, 3);
        component.startMinute = 5;
        component.endMinute = 8;
        component.onRangeChange();
        fixture.detectChanges();

        expect(query('[data-testid="sheet-error"]')?.textContent).toContain('Choca con el tramo');
      });

      it('la hoja suma el título con la celda elegida y el lateral con nombres cortos', () => {
        render();
        selectCell(2, 3);

        expect(query('[data-testid="sheet-zone-badge"]')?.textContent?.trim()).toBe('C3');
        expect(queryAll('[data-testid="lateral-option"]').map(b => b.querySelector('.lat-short')?.textContent?.trim()))
          .toEqual(['Izq.', 'Centro', 'Der.']);
      });

      it('al guardar, la hoja vuelve a quedar compacta', () => {
        render();
        selectCell(2, 3);
        component.toggleSheet();
        fixture.detectChanges();

        saveButton().click();
        http.expectOne(zonesUrl).flush({ ...existingZone, startMinute: 0, endMinute: 5 });
        flushReload([{ ...existingZone, startMinute: 0, endMinute: 5 }]);
        fixture.detectChanges();

        expect(sheet().classList).not.toContain('is-open');
      });
    });

    describe('rango en minutos acumulados', () => {
      it('los botones − y + ajustan el minuto sin salirse de 0–80', () => {
        render();
        component.startMinute = 0;

        component.adjust('start', -1);
        expect(component.startMinute).toBe(0);

        component.adjust('start', 1);
        expect(component.startMinute).toBe(1);

        component.endMinute = 80;
        component.adjust('end', 1);
        expect(component.endMinute).toBe(80);
      });

      it('"Hasta" puede pasar del 40 al 41: el tope ya no es el del tiempo', () => {
        render();
        component.endMinute = 40;

        component.adjust('end', 1);

        expect(component.endMinute).toBe(41);
      });

      it('deduce el 2T desde el minuto 40 y envía ese tiempo', () => {
        render();
        selectCell(2, 3);
        component.startMinute = 40;
        component.endMinute = 45;
        fixture.detectChanges();

        expect(component.period).toBe(2);
        expect(query('[data-testid="linked-preview"]')?.textContent).toContain('2T');

        saveButton().click();
        const post = http.expectOne(zonesUrl);
        expect(post.request.body).toEqual({ row: 2, col: 3, period: 2, startMinute: 40, endMinute: 45 });
        post.flush({ ...existingZone, period: 2, startMinute: 40, endMinute: 45 });
        flushReload();
      });

      it('F2-S2. un rango que cruza el entretiempo bloquea guardar y sugiere partirlo', () => {
        render();
        selectCell(2, 3);
        component.startMinute = 35;
        component.endMinute = 45;
        component.onRangeChange();
        fixture.detectChanges();

        expect(saveButton().disabled).toBeTrue();
        expect(rangeError()).toContain('entretiempo');
        expect(rangeError()).toContain('Partilo');
        expect(component.period).toBeNull();
        expect(store.formRange()).toBeNull();
      });

      it('un rango que termina justo en el 40 no cruza el entretiempo', () => {
        render();
        selectCell(2, 3);
        component.startMinute = 35;
        component.endMinute = 40;
        fixture.detectChanges();

        expect(saveButton().disabled).toBeFalse();
        expect(query('[data-testid="range-error"]')).toBeNull();
      });

      it('F2-S3. un rango que choca con otro tramo bloquea guardar, nombra el tramo y lo marca como conflicto', () => {
        render([existingZone]);
        selectCell(1, 1);
        component.startMinute = 20;
        component.endMinute = 30;
        component.onRangeChange();
        fixture.detectChanges();

        expect(saveButton().disabled).toBeTrue();
        expect(rangeError()).toContain("1T 10'–25'");
        expect(store.conflictId()).toBe('zone-1');

        component.startMinute = 25;
        component.onRangeChange();
        expect(store.conflictId()).toBeNull();
      });

      it('un rango con inicio mayor que el fin bloquea guardar con su motivo', () => {
        render();
        selectCell(1, 1);
        component.startMinute = 20;
        component.endMinute = 10;
        fixture.detectChanges();

        expect(saveButton().disabled).toBeTrue();
        expect(rangeError()).toContain('menor');
      });
    });

    describe('cancelar', () => {
      it('descarta la franja y vuelve a sugerir el próximo hueco', () => {
        render([{ ...existingZone, startMinute: 0, endMinute: 10 }]);
        selectCell(2, 3);
        component.startMinute = 30;
        component.endMinute = 35;

        query<HTMLButtonElement>('[data-testid="zone-cancel"]')?.click();
        fixture.detectChanges();

        expect(component.selectedCell()).toBeNull();
        expect([component.startMinute, component.endMinute]).toEqual([10, 15]);
      });

      it('al editar sale de la edición sin guardar nada', () => {
        render([existingZone]);
        component.startEdit(existingZone);
        fixture.detectChanges();

        query<HTMLButtonElement>('[data-testid="zone-cancel"]')?.click();
        fixture.detectChanges();

        expect(component.editingId).toBeNull();
        expect(store.editingId()).toBeNull();
        expect(query('[data-testid="panel-title"]')?.textContent).toContain('Nuevo tramo');
        http.expectNone(r => r.method !== 'GET');
      });
    });
  });

  describe('huecos sin zona', () => {
    const gapItems = (): HTMLElement[] => queryAll('[data-testid="gap-item"]');
    const text = (el: HTMLElement): string => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    it('F2-H4. lista cada hueco con su rango, sus eventos y su tiempo', () => {
      render([{ ...existingZone, startMinute: 10, endMinute: 25 }], [ev('1', 1, 5), ev('2', 1, 30), ev('3', 1, 33), ev('4', 2, 70)]);

      expect(gapItems().map(text)).toEqual(['0′–10′ 1 evento 1T', '25′–40′ 2 eventos 1T', '40′–80′ 1 evento 2T']);
      expect(query('[data-testid="gaps-count"]')?.textContent?.trim()).toBe('3');
    });

    it('F2-H4. tocar un hueco precarga el formulario con ese rango y conserva la franja elegida', () => {
      render([existingZone]);
      selectCell(2, 5);

      gapItems()[1].click();
      fixture.detectChanges();

      expect([component.period, component.startMinute, component.endMinute]).toEqual([1, 25, 40]);
      expect(component.selectedCell()).toEqual({ row: 2, col: 5 });
      expect(store.formRange()).toEqual({ period: 1, startMinute: 25, endMinute: 40 });
      expect(gapItems()[1].classList).toContain('is-loaded');
    });

    it('tocar un hueco mientras se edita un tramo sale de la edición', () => {
      render([existingZone]);
      component.startEdit(existingZone);

      component.selectGap({ period: 2, start: 40, end: 80, eventCount: 0 });

      expect(component.editingId).toBeNull();
      expect(store.editingId()).toBeNull();
    });

    it('F2-H8. con el partido completo muestra "Partido completo" y ningún hueco', () => {
      render([
        { ...existingZone, id: 'p1', startMinute: 0, endMinute: 40 },
        { ...existingZone, id: 'p2', period: 2, startMinute: 40, endMinute: 80 }
      ]);

      expect(gapItems().length).toBe(0);
      expect(query('[data-testid="match-complete"]')?.textContent).toContain('Partido completo');
    });

    it('F2-H9. sin tramos los huecos son los dos tiempos enteros', () => {
      render([], [ev('1', 1, 5)]);

      expect(gapItems().map(text)).toEqual(['0′–40′ 1 evento 1T', '40′–80′ 0 eventos 2T']);
    });

    it('al guardar un tramo la lista se actualiza con los huecos que quedan', () => {
      render();
      selectCell(2, 3);
      saveButton().click();
      http.expectOne(zonesUrl).flush({ ...existingZone, startMinute: 0, endMinute: 5 });
      flushReload([{ ...existingZone, startMinute: 0, endMinute: 5 }]);
      fixture.detectChanges();

      expect(gapItems().map(text)).toEqual(['5′–40′ 0 eventos 1T', '40′–80′ 0 eventos 2T']);
    });
  });

  describe('tope de huecos', () => {
    const gapItems = (): HTMLElement[] => queryAll('[data-testid="gap-item"]');
    const more = (): HTMLElement | null => query('[data-testid="gaps-more"]');
    const gaps = (): { start: number; end: number }[] => component.gaps;
    /** Tramos de 5′ separados por 5′ desde el minuto 5: n-1 tramos dejan n huecos (el último llega hasta el 80′). */
    const zonesWithGaps = (gaps: number): ZoneAssignmentResponse[] =>
      Array.from({ length: gaps - 1 }, (_, i) => {
        const start = 5 + i * 10;
        return { ...existingZone, id: `zone-${i}`, period: start < 40 ? 1 : 2, startMinute: start, endMinute: start + 5 };
      });

    it('con hasta cuatro huecos los muestra todos, sin aviso', () => {
      render(zonesWithGaps(4));

      expect(gapItems().length).toBe(4);
      expect(more()).toBeNull();
    });

    it('con más de cuatro muestra los primeros en orden y "+N más en la grilla", sin botón ni scroll', () => {
      render(zonesWithGaps(7));

      expect(gapItems().length).toBe(4);
      expect(query('[data-testid="gaps-count"]')?.textContent?.trim()).toBe('7');
      expect(more()?.textContent?.trim()).toBe('+3 más en la grilla');
      expect(query('[data-testid="gaps-toggle"]')).toBeNull();
    });

    it('el hueco precargado que no entra ocupa el lugar del último visible', () => {
      render(zonesWithGaps(7));
      const hidden = gaps()[6];

      component.prefill({ startMinute: hidden.start, endMinute: hidden.end });
      fixture.detectChanges();

      const items = gapItems();
      expect(items.length).toBe(4);
      expect(items[3].classList).toContain('is-loaded');
      expect(more()?.textContent?.trim()).toBe('+3 más en la grilla');
    });
  });

  describe('vista previa de eventos', () => {
    const events = [ev('1', 1, 12), ev('2', 1, 20), ev('3', 1, 30), ev('4', 2, 50)];

    it('informa el tiempo y cuántos eventos se vincularán con el rango del formulario', () => {
      render([], events);
      component.startMinute = 10;
      component.endMinute = 25;
      fixture.detectChanges();

      expect(query('[data-testid="linked-preview"]')?.textContent?.replace(/\s+/g, ' ')).toContain('1T · se vincularán 2 eventos');
    });

    it('usa singular con un solo evento y avisa con cero', () => {
      render([], events);
      component.startMinute = 29;
      component.endMinute = 31;
      fixture.detectChanges();
      expect(query('[data-testid="linked-preview"]')?.textContent).toContain('1 evento');

      component.startMinute = 1;
      component.endMinute = 3;
      fixture.detectChanges();
      expect(query('[data-testid="linked-preview"]')?.textContent).toContain('0 eventos');
    });

    it('no muestra la vista previa mientras el rango no sea válido', () => {
      render([], events);
      component.startMinute = 20;
      component.endMinute = 10;
      fixture.detectChanges();

      expect(query('[data-testid="linked-preview"]')).toBeNull();
    });

    it('al reducir un tramo en edición avisa cuántos eventos pasan a Sin zona', () => {
      render([existingZone], events);
      component.startEdit(existingZone);
      component.endMinute = 15;
      fixture.detectChanges();

      expect(query('[data-testid="released-preview"]')?.textContent).toContain('1 evento pasará');
    });

    it('prefill carga el rango de un hueco y sale del modo edición', () => {
      render([existingZone], events);
      component.startEdit(existingZone);

      component.prefill({ startMinute: 40, endMinute: 55 });

      expect([component.period, component.startMinute, component.endMinute, component.editingId]).toEqual([2, 40, 55, null]);
    });
  });

  describe('guardado', () => {
    it('crea el tramo con el payload del formulario, recarga y avisa con un toast', () => {
      render();
      selectCell(2, 3);
      const success = spyOn(toast, 'success');

      saveButton().click();

      const post = http.expectOne(zonesUrl);
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ row: 2, col: 3, period: 1, startMinute: 0, endMinute: 5 });
      post.flush({ ...existingZone, startMinute: 0, endMinute: 5 });

      flushReload([{ ...existingZone, startMinute: 0, endMinute: 5 }]);
      fixture.detectChanges();

      expect(success).toHaveBeenCalledWith('Tramo guardado');
      expect(store.assignments().length).toBe(1);
    });

    it('al guardar con éxito la cancha pulsa la celda guardada', () => {
      render();
      selectCell(2, 3);
      saveButton().click();
      http.expectOne(zonesUrl).flush({ ...existingZone, startMinute: 0, endMinute: 5 });
      flushReload([{ ...existingZone, startMinute: 0, endMinute: 5 }]);

      expect(store.pulseCell()).toEqual({ row: 2, col: 3 });
    });

    it('tras guardar, la franja queda sin elegir y "Desde" continúa donde terminó el tramo', () => {
      render();
      selectCell(2, 3);
      saveButton().click();
      http.expectOne(zonesUrl).flush({ ...existingZone, startMinute: 0, endMinute: 5 });
      flushReload([{ ...existingZone, startMinute: 0, endMinute: 5 }]);

      expect(component.selectedCell()).toBeNull();
      expect([component.startMinute, component.endMinute]).toEqual([5, 10]);
    });

    it('F2-S6. mientras guarda el botón queda deshabilitado y un segundo clic no repite la petición', () => {
      render();
      selectCell(2, 3);

      saveButton().click();
      fixture.detectChanges();
      expect(saveButton().disabled).toBeTrue();
      expect(saveButton().textContent).toContain('Guardando');
      saveButton().click();
      component.save();

      const post = http.expectOne(zonesUrl);
      post.flush({ ...existingZone, startMinute: 0, endMinute: 5 });
      flushReload([{ ...existingZone, startMinute: 0, endMinute: 5 }]);
    });

    it('F2-S5. ante un 409 muestra el error inline, conserva el formulario y además avisa con un toast', () => {
      render();
      selectCell(2, 3);
      const error = spyOn(toast, 'error');
      const message = 'El tramo se solapa con el tramo 1T 3\'–8\' ya asignado';

      saveButton().click();
      http.expectOne(zonesUrl).flush({ message }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(query('[data-testid="server-error"]')?.textContent).toContain('se solapa con el tramo 1T');
      expect(component.selectedCell()).toEqual({ row: 2, col: 3 });
      expect([component.startMinute, component.endMinute]).toEqual([0, 5]);
      expect(error).toHaveBeenCalledOnceWith(message);
    });

    it('el error del servidor se limpia al modificar el rango', () => {
      render();
      selectCell(2, 3);
      saveButton().click();
      http.expectOne(zonesUrl).flush({ message: 'Error' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      component.onRangeChange();
      fixture.detectChanges();

      expect(query('[data-testid="server-error"]')).toBeNull();
    });
  });

  describe('edición de un tramo', () => {
    it('cargar un tramo muestra "Editar tramo", su franja y su rango, y publica el tramo en edición', () => {
      render([existingZone]);

      component.startEdit(existingZone);
      fixture.detectChanges();

      expect(query('[data-testid="panel-title"]')?.textContent).toContain('Editar tramo');
      expect(component.selectedCell()).toEqual({ row: 2, col: 3 });
      expect([component.startMinute, component.endMinute]).toEqual([10, 25]);
      expect(store.editingId()).toBe('zone-1');
      expect(saveButton().textContent).toContain('Guardar cambios');
    });

    it('Guardar cambios envía un PUT con el rango nuevo', () => {
      render([existingZone]);
      component.startEdit(existingZone);
      component.endMinute = 31;
      component.onRangeChange();
      fixture.detectChanges();

      saveButton().click();

      const put = http.expectOne(r => r.url.endsWith('/matches/match-1/zones/zone-1'));
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ row: 2, col: 3, period: 1, startMinute: 10, endMinute: 31 });
      put.flush(existingZone);
      http.expectOne(zonesUrl).flush(emptyResponse);
      http.expectOne(eventsUrl).flush([]);
    });

    it('cambiar el lateral de un tramo en edición lo guarda en el PUT', () => {
      render([existingZone]);
      component.startEdit(existingZone);
      component.setLateral(3);
      fixture.detectChanges();

      saveButton().click();

      const put = http.expectOne(r => r.url.endsWith('/matches/match-1/zones/zone-1'));
      expect(put.request.body).toEqual({ row: 3, col: 3, period: 1, startMinute: 10, endMinute: 25 });
      put.flush(existingZone);
      http.expectOne(zonesUrl).flush(emptyResponse);
      http.expectOne(eventsUrl).flush([]);
    });

    describe('eliminar con "Deshacer"', () => {
      const deleteUrl = (r: { url: string }) => r.url.endsWith('/matches/match-1/zones/zone-1');
      const deleteButton = (): HTMLButtonElement | null => query<HTMLButtonElement>('[data-testid="zone-delete"]');

      function deleteExistingZone(): void {
        component.startEdit(existingZone);
        fixture.detectChanges();
        deleteButton()?.click();
        http.expectOne(deleteUrl).flush(null, { status: 204, statusText: 'No Content' });
        flushReload();
        fixture.detectChanges();
      }

      it('"Eliminar" solo aparece al editar un tramo, como botón de ícono con aria-label', () => {
        render([existingZone]);
        expect(deleteButton()).toBeNull();

        component.startEdit(existingZone);
        fixture.detectChanges();

        expect(deleteButton()).not.toBeNull();
        expect(deleteButton()?.getAttribute('aria-label')).toBe('Eliminar tramo');
        expect(deleteButton()?.textContent?.trim()).toBe('');
      });

      it('al editar el título lleva la celda del tramo y su tiempo; al crear no', () => {
        render([existingZone]);
        expect(query('[data-testid="edit-zone"]')).toBeNull();

        component.startEdit(existingZone);
        fixture.detectChanges();

        expect(query('[data-testid="edit-zone"]')?.textContent?.trim()).toBe('C3');
        expect(query('[data-testid="edit-period"]')?.textContent?.trim()).toBe(`${existingZone.period}T`);
      });

      it('F2-H3. quita el tramo de inmediato, sin confirmar, y avisa cuántos eventos quedan sin zona', () => {
        render([existingZone], [ev('1', 1, 12), ev('2', 1, 20), ev('3', 1, 30)]);
        component.startEdit(existingZone);
        fixture.detectChanges();
        const success = spyOn(toast, 'success');

        deleteButton()?.click();
        const del = http.expectOne(deleteUrl);
        expect(del.request.method).toBe('DELETE');
        del.flush(null, { status: 204, statusText: 'No Content' });
        flushReload();

        expect(success).toHaveBeenCalledOnceWith(
          '2 eventos pasan a "Sin zona".', 'Tramo C3 · 10′–25′ eliminado', 6000,
          jasmine.objectContaining({ label: 'Deshacer' }));
        expect(component.editingId).toBeNull();
        expect(component.selectedCell()).toBeNull();
      });

      it('"Deshacer" vuelve a crear el tramo con un POST con los mismos datos', () => {
        render([existingZone]);
        const success = spyOn(toast, 'success');
        deleteExistingZone();

        success.calls.mostRecent().args[3]?.handler();

        const post = http.expectOne(zonesUrl);
        expect(post.request.method).toBe('POST');
        expect(post.request.body).toEqual({ row: 2, col: 3, period: 1, startMinute: 10, endMinute: 25 });
        post.flush({ ...existingZone, id: 'zone-2' });
        flushReload([{ ...existingZone, id: 'zone-2' }]);

        expect(success).toHaveBeenCalledWith('El tramo volvió al partido.', 'Tramo restaurado');
      });

      it('si "Deshacer" falla porque el rango ya fue ocupado, avisa el motivo y no duplica el tramo', () => {
        render([existingZone]);
        const success = spyOn(toast, 'success');
        const error = spyOn(toast, 'error');
        deleteExistingZone();

        success.calls.mostRecent().args[3]?.handler();
        http.expectOne(zonesUrl)
          .flush({ message: 'El tramo se solapa con el tramo 1T 12′–20′ ya asignado' }, { status: 409, statusText: 'Conflict' });

        expect(error).toHaveBeenCalledOnceWith('El tramo se solapa con el tramo 1T 12′–20′ ya asignado', 'No se pudo deshacer');
        expect(store.assignments().length).toBe(0);
      });

      it('F3-S2. si "Deshacer" encuentra el rango ya ocupado por otro tramo, avisa y no envía nada', () => {
        render([existingZone]);
        const success = spyOn(toast, 'success');
        const error = spyOn(toast, 'error');
        deleteExistingZone();
        store.assignments.set([{ ...existingZone, id: 'zone-9', startMinute: 20, endMinute: 30 }]);

        success.calls.mostRecent().args[3]?.handler();

        http.expectNone(zonesUrl);
        expect(error).toHaveBeenCalledOnceWith(
          jasmine.stringContaining('El rango ya está ocupado por el tramo'), 'No se pudo deshacer');
        expect(store.assignments().length).toBe(1);
      });

      it('F2-S5. si falla el borrado avisa con un toast y el formulario conserva lo cargado', () => {
        render([existingZone]);
        component.startEdit(existingZone);
        fixture.detectChanges();
        const error = spyOn(toast, 'error');

        deleteButton()?.click();
        http.expectOne(deleteUrl)
          .flush({ message: 'Las zonas solo se pueden editar en partidos finalizados' }, { status: 409, statusText: 'Conflict' });
        fixture.detectChanges();

        expect(error).toHaveBeenCalledOnceWith('Las zonas solo se pueden editar en partidos finalizados');
        expect(component.editingId).toBe('zone-1');
        expect(store.assignments().length).toBe(1);
      });
    });
  });

  describe('corte por try', () => {
    const tryEvent: MatchTimelineEventResponse = {
      id: 'try', eventTypeId: 'try', eventTypeName: 'Try', matchTime: 22 * 60 + 30, period: 1, teamPossession: 'OWN',
      attributes: { zone: 'right' }
    };
    const withTryRule = (): void =>
      store.zoneRules.set(new Map([['try', { columns: [6], rowFrom: 'zone', closesTramo: true }]]));

    it('un rango que sigue después del try muestra el motivo, deshabilita Guardar y ofrece terminar en su minuto', () => {
      render([], [tryEvent]);
      withTryRule();
      selectCell(2, 5);
      component.startMinute = 20;
      component.endMinute = 25;
      fixture.detectChanges();

      expect(rangeError()).toContain("El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'");
      expect(saveButton().disabled).toBeTrue();

      query<HTMLButtonElement>('[data-testid="cut-fix"]')?.click();
      fixture.detectChanges();

      expect(component.endMinute).toBe(23);
      expect(saveButton().disabled).toBeFalse();
    });

    it('un tramo guardado que cruza un try, al editarlo, ofrece cortarlo en el minuto del try', () => {
      const crossing: ZoneAssignmentResponse = { ...existingZone, startMinute: 20, endMinute: 25, col: 5 };
      render([crossing], [tryEvent]);
      withTryRule();
      component.startEdit(crossing);
      fixture.detectChanges();

      expect(query('[data-testid="cut-fix"]')?.textContent?.trim()).toBe('Terminar en 23′');
    });

    it('el asistente propone un rango que termina en el try', () => {
      render([{ ...existingZone, startMinute: 0, endMinute: 20 }], [tryEvent]);
      withTryRule();
      component.cancel();
      fixture.detectChanges();

      expect([component.startMinute, component.endMinute]).toEqual([20, 23]);
    });
  });
});
