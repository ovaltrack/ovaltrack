import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { WidgetState } from '../../types/home.types';
import { HomeTileComponent } from './home-tile.component';

@Component({
  standalone: true,
  imports: [HomeTileComponent],
  template: `
    <app-home-tile label="Forma" title="Últimos partidos" [state]="state" (retry)="retries = retries + 1">
      <p data-testid="content">Con datos</p>
      <p tileEmpty data-testid="empty">Sin datos todavía</p>
    </app-home-tile>
  `
})
class HostComponent {
  state: WidgetState<number> = { status: 'loading' };
  retries = 0;
}

describe('HomeTileComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const render = (state: WidgetState<number>): void => {
    host.state = state;
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;
  const has = (selector: string): boolean => el().querySelector(selector) !== null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('cargando no dibuja el título (no puede afirmar nada que todavía no sabe)', () => {
    render({ status: 'loading' });
    expect(has('.tile-title')).toBeFalse();
    expect(has('.tile-title-sk')).toBeTrue();
    render({ status: 'empty' });
    expect(el().querySelector('.tile-title')?.textContent).toContain('Últimos partidos');
  });

  it('cargando muestra el esqueleto y no el contenido', () => {
    render({ status: 'loading' });
    expect(has('.sk')).toBeTrue();
    expect(has('[data-testid="content"]')).toBeFalse();
  });

  it('vacío muestra el texto de la ranura tileEmpty', () => {
    render({ status: 'empty' });
    expect(el().querySelector('[data-testid="empty"]')?.textContent).toContain('Sin datos todavía');
  });

  it('error muestra el mensaje y Reintentar emite retry', () => {
    render({ status: 'error', message: 'No pudimos cargar esto' });
    expect(el().textContent).toContain('No pudimos cargar esto');
    el().querySelector<HTMLButtonElement>('.tile-retry')?.click();
    expect(host.retries).toBe(1);
  });

  it('con datos muestra el contenido sin sello', () => {
    render({ status: 'ready', data: 1, fetchedAt: Date.now(), stale: false });
    expect(has('[data-testid="content"]')).toBeTrue();
    expect(has('.tile-seal')).toBeFalse();
  });

  it('con datos del snapshot (offline) muestra el sello "Datos de hh:mm"', () => {
    render({ status: 'ready', data: 1, fetchedAt: new Date(2026, 10, 6, 9, 5).getTime(), stale: true });
    expect(el().querySelector('.tile-seal')?.textContent).toContain('Datos de 09:05');
  });
});
