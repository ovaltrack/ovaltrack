import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MembersService } from '../../services/members.service';
import { Member } from '../../types/members.types';
import { MembersListComponent } from './members-list.component';

const member = (overrides: Partial<Member>): Member => ({
  id: 'u1', personId: 'p1', email: 'a@club.com', firstName: 'Ana', lastName: 'Gómez', role: 'PLAYER', active: true, isProtected: false,
  ...overrides
});

const MEMBERS: Member[] = [
  member({ id: 'admin', firstName: 'Carlos', lastName: 'Administrador', role: 'ADMIN_CLUB', isProtected: true }),
  member({ id: 'coach', firstName: 'Gonzalo', lastName: 'Entrenador', role: 'COACH_ANALYST' }),
  member({ id: 'baja', firstName: 'Julián', lastName: 'Montoya', active: false })
];

describe('MembersListComponent (tabla de miembros)', () => {
  let fixture: ComponentFixture<MembersListComponent>;
  const text = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();
  const all = (selector: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersListComponent],
      providers: [{ provide: MembersService, useValue: { getMembers: () => of(MEMBERS), getMyClub: () => of(null) } }]
    }).compileComponents();
    fixture = TestBed.createComponent(MembersListComponent);
    fixture.componentInstance.setStatusFilter('ALL');
    fixture.detectChanges();
  });

  it('muestra una sola tarjeta con las columnas MIEMBRO, ROL y ACCIONES', () => {
    expect(all('.members-card').length).toBe(1);
    expect(all('.members-table th').map(th => th.textContent?.trim())).toEqual(['Miembro', 'Rol', 'Acciones']);
    expect(all('.member-row').length).toBe(3);
  });

  it('el estado aparece solo en las cuentas inactivas', () => {
    const badges = all('.member-row .status-badge');
    expect(badges.length).toBe(1);
    expect(badges[0].closest('.member-row')?.classList.contains('is-inactive')).toBeTrue();
  });

  it('el administrador protegido se muestra como texto con escudo, sin selector de rol', () => {
    const adminRow = all('.member-row')[0];
    expect(adminRow.querySelector('.role-static svg')).not.toBeNull();
    expect(adminRow.querySelector('.role-btn')).toBeNull();
    expect(all('.member-row')[1].querySelector('.role-btn')).not.toBeNull();
  });

  it('no queda el indicador de permiso (lápiz) en las filas', () => {
    expect(all('.perm-icon').length).toBe(0);
  });

  it('el pie indica cuántos miembros se ven del total', () => {
    expect(text('.members-foot span')).toBe('Mostrando 3 de 3');
    fixture.componentInstance.setStatusFilter('ACTIVE');
    fixture.detectChanges();
    expect(text('.members-foot span')).toBe('Mostrando 2 de 3');
  });
});
