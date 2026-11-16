import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpcomingFixture } from '../../domain/upcoming-fixtures';
import { WidgetState } from '../../types/home.types';
import { UpcomingCardComponent } from './upcoming-card.component';

describe('UpcomingCardComponent', () => {
  let fixture: ComponentFixture<UpcomingCardComponent>;

  const fixtures: UpcomingFixture[] = [
    { matchId: 'a', day: 21, month: 'nov', opponent: 'CRC', when: 'Sábado · 15:30', rosterChip: 'Suplentes 6/8', ariaLabel: '21 de nov, CRC, Sábado · 15:30, nómina: Suplentes 6/8' },
    { matchId: 'b', day: 28, month: 'nov', opponent: 'TRC', when: 'Sábado · 15:30', rosterChip: null, ariaLabel: '28 de nov, TRC, Sábado · 15:30' }
  ];

  const render = (state: WidgetState<UpcomingFixture[]>): void => {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  };
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UpcomingCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(UpcomingCardComponent);
    fixture.componentRef.setInput('divisionName', 'Primera');
  });

  it('cargando muestra el esqueleto y ninguna fecha', () => {
    render({ status: 'loading' });
    expect(el().querySelector('.sk')).not.toBeNull();
    expect(el().querySelector('.fixture')).toBeNull();
  });

  it('vacío dice «No hay partidos programados»', () => {
    render({ status: 'empty' });
    expect(el().textContent).toContain('No hay partidos programados');
  });

  it('error muestra el mensaje y Reintentar emite retry', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    render({ status: 'error', message: 'No pudimos cargar esto' });
    (el().querySelector('.tile-retry') as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });

  it('con datos dibuja el bloque de fecha, el rival, la hora y el chip solo en el primero', () => {
    render({ status: 'ready', data: fixtures, fetchedAt: 1, stale: false });
    const rows = el().querySelectorAll('.fixture');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.date-day')?.textContent).toBe('21');
    expect(rows[0].textContent).toContain('CRC');
    expect(rows[0].querySelector('.fixture-chip')?.textContent).toContain('Suplentes 6/8');
    expect(rows[1].querySelector('.fixture-chip')).toBeNull();
    expect(el().textContent).toContain('Fixture · Primera');
  });

  it('sin conexión muestra el sello «Datos de hh:mm» y no un toast', () => {
    render({ status: 'ready', data: fixtures, fetchedAt: new Date(2026, 10, 6, 14, 5).getTime(), stale: true });
    expect(el().querySelector('.tile-seal')?.textContent).toContain('Datos de 14:05');
  });
});
