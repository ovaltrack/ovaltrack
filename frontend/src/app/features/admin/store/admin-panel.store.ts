import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, forkJoin } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
import { Club } from 'src/app/features/club/types/club.types';
import { UserResponseDTO } from 'src/app/features/user/types/user.types';
import { MessageResponse } from 'src/app/shared/types/shared-types';
import { OvalTrackAdminService } from '../services/ovaltrack-admin.service';
import {
  AccountFilter,
  AdminStats,
  ClubFilter,
  ConfirmRequest,
  FilterOption,
  UserClubRegistration,
} from '../types/ovaltrack-admin.types';
import { HttpErrorLike, errorMessage, userName } from '../utils/admin-format';

export const ACCOUNT_FILTER_OPTIONS: FilterOption<AccountFilter>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
];

export const CLUB_FILTER_OPTIONS: FilterOption<ClubFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'rejected', label: 'Inactivos' },
];

/** Los pendientes tienen su propia sección; `GET /clubs` sin filtro también los trae. */
const isReviewed = (club: Club): boolean => club.status !== 'PENDING';

/**
 * Estado del panel de administración de la plataforma.
 * Se provee en la página (no en root): cada visita arranca con estado limpio y
 * las suscripciones se cortan al salir.
 */
@Injectable()
export class AdminPanelStore {
  private readonly adminService = inject(OvalTrackAdminService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /* ---------- Datos ---------- */
  readonly requests = signal<UserClubRegistration[]>([]);
  readonly pendingClubs = signal<Club[]>([]);
  readonly allAccounts = signal<UserClubRegistration[]>([]);
  readonly visibleAccounts = signal<UserClubRegistration[]>([]);
  readonly allClubs = signal<Club[]>([]);
  readonly visibleClubs = signal<Club[]>([]);

  /* ---------- Estado de UI ---------- */
  readonly accountFilter = signal<AccountFilter>('all');
  readonly clubFilter = signal<ClubFilter>('all');
  readonly accountSearch = signal('');
  readonly clubSearch = signal('');

  private readonly pendingCalls = signal(0);
  readonly loading = computed(() => this.pendingCalls() > 0);
  /** Hasta la primera respuesta se muestran skeletons en lugar de los estados vacíos. */
  readonly loaded = signal(false);

  /** Fila con una acción en curso (evita doble clic). */
  readonly busyId = signal<string | null>(null);
  readonly busy = computed(() => this.busyId() !== null);

  /** Admin elegido para cada club pendiente (clubId -> adminUserId). */
  readonly selectedAdmin = signal<Record<string, string | null>>({});

  readonly confirmRequest = signal<ConfirmRequest | null>(null);

  readonly changingClubId = signal<string | null>(null);
  readonly newAdminId = signal<string | null>(null);

  /* ---------- Derivados ---------- */
  /** Administradores disponibles para asociar a un club. */
  readonly admins = computed<UserClubRegistration[]>(() => [
    ...this.allAccounts().filter((a) => a.user.role === 'ADMIN_CLUB'),
    ...this.requests().filter((r) => r.user.role === 'ADMIN_CLUB'),
  ]);

  readonly stats = computed<AdminStats>(() => ({
    pendingRequests: this.requests().length,
    pendingClubs: this.pendingClubs().length,
    activeAccounts: this.allAccounts().filter((a) => a.user.active).length,
    activeClubs: this.allClubs().filter((c) => c.status === 'ACTIVE').length,
  }));

  readonly accountCounts = computed<Record<AccountFilter, number>>(() => {
    const all = this.allAccounts();
    const active = all.filter((a) => a.user.active).length;
    return { all: all.length, active, inactive: all.length - active };
  });

  readonly clubCounts = computed<Record<ClubFilter, number>>(() => {
    const all = this.allClubs();
    return {
      all: all.length,
      active: all.filter((c) => c.status === 'ACTIVE').length,
      rejected: all.filter((c) => c.status === 'REJECTED').length,
    };
  });

  readonly filteredAccounts = computed(() => {
    const q = this.accountSearch().trim().toLowerCase();
    return this.visibleAccounts().filter(
      (a) => !q || userName(a.user).toLowerCase().includes(q) || a.user.email.toLowerCase().includes(q),
    );
  });

  readonly filteredClubs = computed(() => {
    const q = this.clubSearch().trim().toLowerCase();
    return this.visibleClubs().filter((c) => !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q));
  });

  readonly changingClub = computed(() => this.visibleClubs().find((c) => c.id === this.changingClubId()) ?? null);

  /* ---------- Carga de datos (GET) ---------- */
  loadAll(): void {
    this.accountFilter.set('all');
    this.clubFilter.set('all');
    this.begin();

    forkJoin({
      pendingUsers: this.adminService.getPendingUsers(),
      pendingClubs: this.adminService.getPendingClubs(),
      users: this.adminService.getUsers(),
      clubs: this.adminService.getClubs(),
    })
      .pipe(
        finalize(() => this.end()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ pendingUsers, pendingClubs, users, clubs }) => {
          this.requests.set(pendingUsers);
          this.pendingClubs.set(pendingClubs);
          this.selectedAdmin.set(Object.fromEntries(pendingClubs.map((c) => [c.id, c.adminUserId ?? null])));
          this.allAccounts.set(users);
          this.visibleAccounts.set(users);
          const reviewed = clubs.filter(isReviewed);
          this.allClubs.set(reviewed);
          this.visibleClubs.set(reviewed);
          this.loaded.set(true);
        },
        error: (err: HttpErrorLike) =>
          this.toast.error(errorMessage(err, 'No se pudieron cargar los datos del panel.'), 'Error de carga', 0, {
            label: 'Reintentar',
            handler: () => this.loadAll(),
          }),
      });
  }

  setAccountFilter(filter: AccountFilter): void {
    if (this.accountFilter() === filter) return;
    this.accountFilter.set(filter);
    this.begin();

    const active = filter === 'all' ? undefined : filter === 'active';
    this.adminService
      .getUsers(active)
      .pipe(
        finalize(() => this.end()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => {
          if (this.accountFilter() !== filter) return;
          this.visibleAccounts.set(list);
          if (filter === 'all') this.allAccounts.set(list);
        },
        error: (err: HttpErrorLike) => this.toast.error(errorMessage(err, 'No se pudieron cargar las cuentas.')),
      });
  }

  setClubFilter(filter: ClubFilter): void {
    if (this.clubFilter() === filter) return;
    this.clubFilter.set(filter);
    this.begin();

    const status = filter === 'all' ? undefined : filter === 'active' ? 'ACTIVE' : 'REJECTED';
    this.adminService
      .getClubs(status)
      .pipe(
        finalize(() => this.end()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (clubs) => {
          if (this.clubFilter() !== filter) return;
          const list = clubs.filter(isReviewed);
          this.visibleClubs.set(list);
          if (filter === 'all') this.allClubs.set(list);
        },
        error: (err: HttpErrorLike) => this.toast.error(errorMessage(err, 'No se pudieron cargar los clubes.')),
      });
  }

  /* ---------- Acciones ---------- */
  approveRequest(registration: UserClubRegistration): void {
    const { user } = registration;
    this.runAction(user.id, this.adminService.approveAccount(user.id), `Cuenta de ${userName(user)} aprobada.`, 'No se pudo aprobar la cuenta.');
  }

  rejectRequest(user: UserResponseDTO): void {
    const name = userName(user);
    this.askConfirm({
      title: 'Rechazar solicitud',
      message: `¿Rechazar la solicitud de ${name}?`,
      detail: 'La cuenta queda rechazada y sin rol; no podrá iniciar sesión.',
      confirmLabel: 'Rechazar',
      run: () =>
        this.runAction(user.id, this.adminService.rejectAccount(user.id), `Solicitud de ${name} rechazada.`, 'No se pudo rechazar la cuenta.'),
    });
  }

  chooseAdminForPending(clubId: string, adminUserId: string | null): void {
    this.selectedAdmin.update((map) => ({ ...map, [clubId]: adminUserId }));
  }

  approveClub(club: Club): void {
    const adminUserId = this.selectedAdmin()[club.id];
    if (!adminUserId) {
      this.toast.warning(`Elegí el administrador que quedará a cargo de ${club.name} antes de aprobarlo.`, 'Falta el administrador');
      return;
    }
    this.runAction(club.id, this.adminService.approveClub(club.id, adminUserId), `${club.name} quedó activo con su administrador.`, 'No se pudo aprobar el club.');
  }

  rejectClub(club: Club): void {
    this.askConfirm({
      title: 'Rechazar club',
      message: `¿Rechazar ${club.name}?`,
      detail: 'El club pasa a la lista de rechazados y no admite registros nuevos.',
      confirmLabel: 'Rechazar club',
      run: () => this.runAction(club.id, this.adminService.rejectClub(club.id), `${club.name} fue rechazado.`, 'No se pudo rechazar el club.'),
    });
  }

  /** Desactivar: el club queda REJECTED y sus miembros pierden el acceso (login y sesiones abiertas). */
  deactivateClub(club: Club): void {
    this.askConfirm({
      title: 'Desactivar club',
      message: `¿Desactivar ${club.name}?`,
      detail: 'Todos sus miembros pierden el acceso, también los que tienen la sesión abierta, hasta que lo reactives. Los datos del club se conservan.',
      confirmLabel: 'Desactivar club',
      run: () =>
        this.runAction(club.id, this.adminService.rejectClub(club.id), `${club.name} fue desactivado.`, 'No se pudo desactivar el club.'),
    });
  }

  reactivateClub(club: Club): void {
    this.runAction(club.id, this.adminService.reactivateClub(club.id), `${club.name} fue reactivado.`, 'No se pudo reactivar el club.');
  }

  setAccountActive(account: UserClubRegistration, active: boolean): void {
    const { user } = account;
    const name = userName(user);
    if (active) {
      this.runAction(user.id, this.adminService.activateAccount(user.id), `Cuenta de ${name} activada.`, 'No se pudo activar la cuenta.');
      return;
    }
    const managedClub = this.allClubs().find((c) => c.adminUserId === user.id);
    this.askConfirm({
      title: 'Desactivar cuenta',
      message: `¿Desactivar la cuenta de ${name}?`,
      detail: managedClub
        ? `Es el administrador de ${managedClub.name}: el club sigue activo, pero queda sin un administrador que pueda entrar.`
        : 'No podrá iniciar sesión hasta que la vuelvas a aceptar.',
      confirmLabel: 'Desactivar',
      run: () =>
        this.runAction(user.id, this.adminService.deactivateAccount(user.id), `Cuenta de ${name} desactivada.`, 'No se pudo desactivar la cuenta.'),
    });
  }

  /* ---------- Confirmación ---------- */
  acceptConfirm(): void {
    const request = this.confirmRequest();
    this.confirmRequest.set(null);
    request?.run();
  }

  cancelConfirm(): void {
    this.confirmRequest.set(null);
  }

  /* ---------- Cambiar administrador (sin disparador en la UI todavía) ---------- */
  openChangeAdmin(club: Club): void {
    this.changingClubId.set(club.id);
    this.newAdminId.set(club.adminUserId ?? null);
  }

  closeChangeAdmin(): void {
    this.changingClubId.set(null);
    this.newAdminId.set(null);
  }

  confirmChangeAdmin(): void {
    const clubId = this.changingClubId();
    const adminUserId = this.newAdminId();
    if (clubId == null || adminUserId == null) return;
    this.updateClubs((list) => list.map((c) => (c.id === clubId ? { ...c, adminUserId } : c)));
    this.closeChangeAdmin();
  }

  /* ---------- Consultas ---------- */
  adminById(id: string | null | undefined): UserClubRegistration | undefined {
    return this.admins().find((a) => a.user.id === id);
  }

  /* ---------- Internos ---------- */
  private askConfirm(request: ConfirmRequest): void {
    if (this.busyId()) return;
    this.confirmRequest.set(request);
  }

  /** Ejecuta una acción de una fila, avisa el resultado con un toast y recarga el panel. */
  private runAction(rowId: string, request$: Observable<MessageResponse>, success: string, fallbackError: string): void {
    if (this.busyId()) return;
    this.busyId.set(rowId);
    request$
      .pipe(
        finalize(() => this.busyId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(success);
          this.loadAll();
        },
        error: (err: HttpErrorLike) => this.toast.error(errorMessage(err, fallbackError)),
      });
  }

  private updateClubs(fn: (list: Club[]) => Club[]): void {
    const filter = this.clubFilter();
    this.allClubs.update(fn);
    this.visibleClubs.update((list) =>
      fn(list).filter((c) => filter === 'all' || (filter === 'active' ? c.status === 'ACTIVE' : c.status === 'REJECTED')),
    );
  }

  private begin(): void {
    this.pendingCalls.update((n) => n + 1);
  }

  private end(): void {
    this.pendingCalls.update((n) => Math.max(0, n - 1));
  }
}
