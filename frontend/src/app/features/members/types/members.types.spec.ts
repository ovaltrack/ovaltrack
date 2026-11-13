import { Member, UserRole, canEditPersonData, matchesStatus, membersFooterLabel, showsStatus } from './members.types';

const member = (active: boolean): Member => ({
  id: 'u1', personId: 'p1', email: 'a@club.com', firstName: 'Ana', lastName: 'Gómez', role: 'PLAYER', active, isProtected: false
});

describe('estado visible solo si la cuenta no está activa', () => {
  it('una cuenta activa no muestra estado', () => {
    expect(showsStatus(member(true))).toBeFalse();
  });

  it('una cuenta inactiva sí lo muestra', () => {
    expect(showsStatus(member(false))).toBeTrue();
  });

  it('el filtro de inactivos solo deja las cuentas que muestran estado', () => {
    const members = [member(true), member(false)];
    expect(members.filter(m => matchesStatus(m, 'INACTIVE')).every(showsStatus)).toBeTrue();
  });
});

describe('membersFooterLabel', () => {
  it('muestra cuántos se ven del total', () => {
    expect(membersFooterLabel(6, 25)).toBe('Mostrando 6 de 25');
  });

  it('con la lista completa los dos números coinciden', () => {
    expect(membersFooterLabel(25, 25)).toBe('Mostrando 25 de 25');
  });

  it('sin resultados muestra cero', () => {
    expect(membersFooterLabel(0, 25)).toBe('Mostrando 0 de 25');
  });
});

describe('quién puede editar los datos de una persona', () => {
  const roles: (UserRole | null)[] = ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST', 'PLAYER', 'NO_ROLE', null];

  it('el administrador del club edita a cualquiera, incluidos entrenadores y administradores', () => {
    expect(roles.every(target => canEditPersonData('ADMIN_CLUB', target))).toBeTrue();
  });

  it('el entrenador edita solo a jugadores, con o sin cuenta', () => {
    expect(roles.filter(target => canEditPersonData('COACH_ANALYST', target))).toEqual(['PLAYER', null]);
  });

  it('un jugador, una cuenta sin rol o sin sesión no editan a nadie', () => {
    for (const viewer of ['PLAYER', 'NO_ROLE', null] as (UserRole | null)[]) {
      expect(roles.some(target => canEditPersonData(viewer, target))).withContext(String(viewer)).toBeFalse();
    }
  });
});
