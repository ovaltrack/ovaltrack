import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZoneKpiStripComponent } from './zone-kpi-strip.component';

describe('ZoneKpiStripComponent', () => {
  let fixture: ComponentFixture<ZoneKpiStripComponent>;

  const link = (): HTMLButtonElement | null => fixture.nativeElement.querySelector('[data-testid="kpi-unzoned-link"]');
  const render = (unzoned: number): void => {
    fixture.componentRef.setInput('totalEvents', 51);
    fixture.componentRef.setInput('unzonedEvents', unzoned);
    fixture.componentRef.setInput('coveragePercent', 80);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ZoneKpiStripComponent] }).compileComponents();
    fixture = TestBed.createComponent(ZoneKpiStripComponent);
  });

  it('con jugadas sin zona, «sin zona» es un botón que las pide', () => {
    render(27);
    let requested = 0;
    fixture.componentInstance.unzonedRequested.subscribe(() => requested++);

    link()?.click();

    expect(link()).not.toBeNull();
    expect(link()?.textContent).toContain('27');
    expect(link()?.textContent).toContain('sin zona');
    expect(requested).toBe(1);
  });

  it('el botón dice a dónde lleva', () => {
    render(27);

    expect(link()?.getAttribute('aria-label')).toBe('Ver las 27 jugadas sin zona y por qué');
    expect(link()?.getAttribute('title')).toBe('Ver las jugadas sin zona y por qué');
  });

  it('con una sola jugada el rótulo va en singular', () => {
    render(1);

    expect(link()?.getAttribute('aria-label')).toBe('Ver la jugada sin zona y por qué');
  });

  it('sin jugadas sin zona no hay nada que abrir: es solo un número', () => {
    render(0);

    expect(link()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="kpi-unzoned"]').textContent.trim()).toBe('0');
  });

  it('el número sigue en ámbar mientras haya pendientes', () => {
    render(3);

    expect(fixture.nativeElement.querySelector('[data-testid="kpi-unzoned"]').classList).toContain('text-amber');
  });
});
