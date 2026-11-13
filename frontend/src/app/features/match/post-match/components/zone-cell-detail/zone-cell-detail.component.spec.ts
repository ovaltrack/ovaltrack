import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZoneAssignmentResponse } from '../../../types/zone.types';
import { UnzonedItem } from '../../utils/zone-unzoned';
import { ZoneCellDetailComponent } from './zone-cell-detail.component';

describe('ZoneCellDetailComponent', () => {
  let fixture: ComponentFixture<ZoneCellDetailComponent>;
  let component: ZoneCellDetailComponent;

  const query = <T extends HTMLElement>(selector: string): T | null => fixture.nativeElement.querySelector(selector);
  const queryAll = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();

  const tramo: ZoneAssignmentResponse = { id: 'z1', matchId: 'm', period: 1, startMinute: 20, endMinute: 25, row: 2, col: 6 };
  const gapItem: UnzonedItem = {
    event: { id: 'e1', eventTypeId: 't', eventTypeName: 'Scrum', period: 1, matchTime: 600, teamPossession: 'OWN', attributes: {}, zone: null },
    reason: 'GAP', tramo: null, minute: 10, clock: '1T 10:00', reasonText: 'Ningún tramo cubre este minuto'
  };
  const forbiddenItem: UnzonedItem = {
    event: { id: 'e2', eventTypeId: 't', eventTypeName: 'Line-out', period: 1, matchTime: 1320, teamPossession: 'OPPONENT', attributes: {}, zone: null },
    reason: 'FORBIDDEN', tramo, minute: 22, clock: '1T 22:00',
    reasonText: "El tramo 1T 20'–25' (C6) no admite Line-out: solo puede ocurrir en las columnas 2 a 5"
  };
  const noTimeItem: UnzonedItem = {
    event: { id: 'e3', eventTypeId: 't', eventTypeName: 'Tackle', period: 3, matchTime: 0, teamPossession: 'OWN', attributes: {}, zone: null },
    reason: 'NO_TIME', tramo: null, minute: null, clock: '3T 00:00', reasonText: 'Sin tiempo de partido'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ZoneCellDetailComponent] }).compileComponents();
    fixture = TestBed.createComponent(ZoneCellDetailComponent);
    component = fixture.componentInstance;
  });

  describe('detalle de la celda', () => {
    it('sin celda señalada no dibuja nada: la lectura de la cancha ya dice cómo usarla', () => {
      fixture.detectChanges();

      expect(query('[data-testid="cell-detail"]')).toBeNull();
    });

    it('en Eventos lista las jugadas con su reloj, tipo, equipo y de dónde sale la zona', () => {
      fixture.componentRef.setInput('cell', { row: 2, col: 5 });
      fixture.componentRef.setInput('eventRows', [
        { id: 'a', clock: '1T 22:30', typeName: 'Scrum', team: 'Propio', origin: "Tramo 1T 20'–25'" },
        { id: 'b', clock: '1T 30:00', typeName: 'Try', team: 'Rival', origin: 'Zona fija por el tipo' }
      ]);
      fixture.detectChanges();

      expect(queryAll('[data-testid="cell-event"]').length).toBe(2);
      expect(queryAll('[data-testid="cell-event"]')[0].textContent).toContain('1T 22:30');
      expect(queryAll('[data-testid="cell-event"]')[0].textContent).toContain('Scrum');
      expect(queryAll('[data-testid="cell-event"]')[0].textContent).toContain("Tramo 1T 20'–25'");
      expect(queryAll('[data-testid="cell-event"]')[1].textContent).toContain('Zona fija por el tipo');
    });

    it('el título nombra la celda', () => {
      fixture.componentRef.setInput('cell', { row: 2, col: 5 });
      fixture.detectChanges();

      expect(query('[data-testid="cell-detail-title"]')?.textContent).toContain('C5');
    });

    it('sin jugadas lo dice', () => {
      fixture.componentRef.setInput('cell', { row: 2, col: 5 });
      fixture.detectChanges();

      expect(query('[data-testid="cell-empty"]')?.textContent).toContain('Sin jugadas en esta zona');
    });

    it('en Minutos lista los tramos de la celda con su duración', () => {
      fixture.componentRef.setInput('cell', { row: 2, col: 5 });
      fixture.componentRef.setInput('mode', 'MINUTES');
      fixture.componentRef.setInput('tramoRows', [{ id: 'a', label: "1T 20'–25'", minutes: 5 }, { id: 'b', label: "2T 60'–61'", minutes: 1 }]);
      fixture.detectChanges();

      expect(queryAll('[data-testid="cell-tramo"]').map(row => row.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        "1T 20'–25' · 5 min", "2T 60'–61' · 1 min"
      ]);
      expect(query('[data-testid="cell-event"]')).toBeNull();
    });

    it('en Minutos sin tramos en la celda lo dice', () => {
      fixture.componentRef.setInput('cell', { row: 2, col: 5 });
      fixture.componentRef.setInput('mode', 'MINUTES');
      fixture.detectChanges();

      expect(query('[data-testid="cell-empty"]')?.textContent).toContain('Sin tramos en esta zona');
    });
  });

  describe('jugadas sin zona', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('view', 'unzoned');
      fixture.componentRef.setInput('unzoned', [gapItem, forbiddenItem, noTimeItem]);
      fixture.detectChanges();
    });

    it('lista cada jugada con su reloj, tipo, equipo y motivo', () => {
      const rows = queryAll('[data-testid="unzoned-item"]');

      expect(rows.length).toBe(3);
      expect(rows[0].textContent).toContain('1T 10:00');
      expect(rows[0].textContent).toContain('Scrum');
      expect(rows[0].textContent).toContain('Ningún tramo cubre este minuto');
      expect(rows[1].textContent).toContain('Rival');
      expect(rows[1].textContent).toContain('no admite Line-out');
    });

    it('el título cuenta las jugadas', () => {
      expect(query('[data-testid="unzoned-title"]')?.textContent).toContain('3 jugadas sin zona');
    });

    it('un hueco ofrece completarlo y un tramo que no admite el tipo, abrirlo', () => {
      const rows = queryAll('[data-testid="unzoned-item"]');

      expect(rows[0].querySelector('[data-testid="unzoned-fix"]')?.textContent?.trim()).toBe('Completar hueco');
      expect(rows[1].querySelector('[data-testid="unzoned-fix"]')?.textContent?.trim()).toBe('Abrir tramo');
    });

    it('sin tiempo de partido no hay arreglo posible acá: solo ver la jugada en Eventos', () => {
      const row = queryAll('[data-testid="unzoned-item"]')[2];

      expect(row.querySelector('[data-testid="unzoned-fix"]')).toBeNull();
      expect(row.querySelector('[data-testid="unzoned-event"]')).not.toBeNull();
    });

    it('completar el hueco avisa con la jugada', () => {
      const requested: UnzonedItem[] = [];
      component.gapRequested.subscribe(item => requested.push(item));

      queryAll('[data-testid="unzoned-item"]')[0].querySelector<HTMLButtonElement>('[data-testid="unzoned-fix"]')?.click();

      expect(requested).toEqual([gapItem]);
    });

    it('abrir el tramo avisa con el tramo', () => {
      const requested: ZoneAssignmentResponse[] = [];
      component.tramoRequested.subscribe(item => requested.push(item));

      queryAll('[data-testid="unzoned-item"]')[1].querySelector<HTMLButtonElement>('[data-testid="unzoned-fix"]')?.click();

      expect(requested).toEqual([tramo]);
    });

    it('«Ver en Eventos» avisa con el id de la jugada', () => {
      const requested: string[] = [];
      component.eventRequested.subscribe(id => requested.push(id));

      queryAll('[data-testid="unzoned-item"]')[1].querySelector<HTMLButtonElement>('[data-testid="unzoned-event"]')?.click();

      expect(requested).toEqual(['e2']);
    });

    it('volver cierra el listado', () => {
      let closed = 0;
      component.closed.subscribe(() => closed++);

      query<HTMLButtonElement>('[data-testid="unzoned-close"]')?.click();

      expect(closed).toBe(1);
    });

    it('con una sola jugada el título va en singular', () => {
      fixture.componentRef.setInput('unzoned', [gapItem]);
      fixture.detectChanges();

      expect(query('[data-testid="unzoned-title"]')?.textContent).toContain('1 jugada sin zona');
    });

    it('sin jugadas sin zona lo celebra y no deja una lista vacía', () => {
      fixture.componentRef.setInput('unzoned', []);
      fixture.detectChanges();

      expect(query('[data-testid="unzoned-empty"]')?.textContent).toContain('Todas las jugadas tienen zona');
      expect(query('[data-testid="unzoned-item"]')).toBeNull();
    });
  });

  it('el texto del detalle no mezcla las dos vistas', () => {
    fixture.componentRef.setInput('cell', { row: 2, col: 5 });
    fixture.detectChanges();
    expect(text()).not.toContain('sin zona');

    fixture.componentRef.setInput('view', 'unzoned');
    fixture.componentRef.setInput('unzoned', [gapItem]);
    fixture.detectChanges();
    expect(query('[data-testid="cell-detail-title"]')).toBeNull();
  });
});
