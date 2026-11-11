import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, forkJoin, switchMap } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
import { Club } from 'src/app/features/club/types/club.types';
import { UserResponseDTO } from 'src/app/features/user/types/user.types';
import { MessageResponse } from 'src/app/shared/types/shared-types';
import { OvalTrackAdminService } from '../services/ovaltrack-admin.service';
import {
  AccountFilter,
  AdminStats,
  ClubFilter,
  ConfirmChoice,
  ConfirmRequest,
  FilterOption,
  UserClubRegistration,
} from '../types/ovaltrack-admin.types';
import { HttpErrorLike, errorMessage, userName } from '../utils/admin-format';
import { oneOf, persistedSignal } from '../../../shared/utils/persisted-signal';

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
  /** Filtros recordados en la pestaña (recarga o volver a la pantalla); se borran al cerrar sesión. */
  readonly accountFilter = persistedSignal<AccountFilter>('admin.accounts', 'all', {
    isValid: oneOf(ACCOUNT_FILTER_OPTIONS.map(option => option.value)),
  });
  readonly clubFilter = persistedSignal<ClubFilter>('admin.clubs', 'all', {
    isValid: oneOf(CLUB_FILTER_OPTIONS.map(option => option.value)),
  });
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
  /** Entrenadores/analistas activos del club que se está editando. */
  readonly adminCandidates = signal<UserResponseDTO[]>([]);
  readonly candidatesLoading = signal(false);
  /** Admin que se desactiva al guardar (flujo "Reasignar" desde la baja de un admin de club). */
  readonly deactivateAfterChange = signal<UserClubRegistration | null>(null);

  /* ---------- Derivados ---------- */
  /**
   * Administradores disponibles para asociar a un club, sin repetidos y en orden fijo (nombre, id).
   * El orden no depende de si la cuenta está pendiente o aprobada: si una opción cambiara de lugar al
   * aprobarla, algunos navegadores vuelven el <select> a "Elegí un administrador".
   */
  readonly admins = computed<UserClubRegistration[]>(() => {
    const byId = new Map<string, UserClubRegistration>();
    for (const a of [...this.allAccounts(), ...this.requests()]) {
      if (a.user.role === 'ADMIN_CLUB' && !byId.has(a.user.id)) byId.set(a.user.id, a);
    }
    return [...byId.values()].sort(
      (x, y) => userName(x.user).localeCompare(userName(y.user), 'es') || x.user.id.localeCompare(y.user.id),
    );
  });

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

  readonly changingClub = computed(() => this.allClubs().find((c) => c.id === this.changingClubId()) ?? null);

  /* ---------- Carga de datos (GET) ---------- */
  loadAll(): void {
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
          const reviewed = clubs.filter(isReviewed);
          this.allClubs.set(reviewed);
          // Con un filtro recordado, la lista visible se vuelve a pedir filtrada (como al elegirlo).
          const accountFilter = this.accountFilter();
          if (accountFilter === 'all') this.visibleAccounts.set(users);
          else this.fetchAccounts(accountFilter);
          const clubFilter = this.clubFilter();
          if (clubFilter === 'all') this.visibleClubs.set(reviewed);
          else this.fetchClubs(clubFilter);
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
    this.fetchAccounts(filter);
  }

  private fetchAccounts(filter: AccountFilter): void {
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
    this.fetchClubs(filter);
  }

  private fetchClubs(filter: ClubFilter): void {
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

  /** Admin elegido para un club pendiente, solo si sigue entre las opciones (lo mismo que muestra el select). */
  pendingAdminId(clubId: string): string | null {
    const id = this.selectedAdmin()[clubId];
    return id && this.admins().some((a) => a.user.id === id) ? id : null;
  }

  approveClub(club: Club): void {
    const adminUserId = this.pendingAdminId(club.id);
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
    const deactivate$ = this.adminService.deactivateAccount(user.id);
    const deactivateOnly = () =>
      this.runAction(user.id, deactivate$, `Cuenta de ${name} desactivada.`, 'No se pudo desactivar la cuenta.');

    if (managedClub?.status === 'ACTIVE') {
      this.askConfirm({
        kind: 'choices',
        title: 'Desactivar administrador de club',
        message: `${name} administra ${managedClub.name}. ¿Qué pasa con el club?`,
        detail: 'Si solo desactivás la cuenta, el club sigue activo pero sin un administrador que pueda entrar.',
        choices: [
          { label: 'Reasignar administrador', icon: 'bi-person-gear', tone: 'primary', run: () => this.openChangeAdmin(managedClub, account) },
          { label: 'Desactivar también el club', icon: 'bi-slash-circle', tone: 'danger', run: () => this.deactivateAdminAndClub(account, managedClub) },
          { label: 'Solo desactivar la cuenta', icon: 'bi-person-dash', tone: 'outline', run: deactivateOnly },
        ],
      });
      return;
    }

    this.askConfirm({
      title: 'Desactivar cuenta',
      message: `¿Desactivar la cuenta de ${name}?`,
      detail: managedClub
        ? `Es el administrador de ${managedClub.name}, que está inactivo: para reactivarlo vas a necesitar un administrador activo.`
        : 'No podrá iniciar sesión hasta que la vuelvas a aceptar.',
      confirmLabel: 'Desactivar',
      run: deactivateOnly,
    });
  }

  private deactivateAdminAndClub(account: UserClubRegistration, club: Club): void {
    const name = userName(account.user);
    this.askConfirm({
      title: 'Desactivar cuenta y club',
      message: `¿Desactivar a ${name} y a ${club.name}?`,
      detail: 'Todos los miembros del club pierden el acceso, también los que tienen la sesión abierta, hasta que reactives el club.',
      confirmLabel: 'Desactivar ambos',
      run: () =>
        this.runAction(
          account.user.id,
          this.adminService.deactivateAccount(account.user.id).pipe(switchMap(() => this.adminService.rejectClub(club.id))),
          `${name} y ${club.name} fueron desactivados.`,
          'No se pudo desactivar la cuenta y el club.',
        ),
    });
  }

  /* ---------- Confirmación ---------- */
  acceptConfirm(): void {
    const request = this.confirmRequest();
    this.confirmRequest.set(null);
    if (request && request.kind !== 'choices') request.run();
  }

  choose(choice: ConfirmChoice): void {
    this.confirmRequest.set(null);
    choice.run();
  }

  cancelConfirm(): void {
    this.confirmRequest.set(null);
  }

  /* ---------- Cambiar administrador ---------- */
  /** Abre el diálogo; con `deactivating`, al guardar también se desactiva esa cuenta (la del admin actual). */
  openChangeAdmin(club: Club, deactivating: UserClubRegistration | null = null): void {
    if (this.busyId()) return;
    this.changingClubId.set(club.id);
    this.newAdminId.set(null);
    this.deactivateAfterChange.set(deactivating);
    this.adminCandidates.set([]);
    this.candidatesLoading.set(true);
    this.adminService
      .getClubAdminCandidates(club.id)
      .pipe(
        finalize(() => this.candidatesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => {
          if (this.changingClubId() === club.id) this.adminCandidates.set(list);
        },
        error: (err: HttpErrorLike) => this.toast.error(errorMessage(err, 'No se pudieron cargar los entrenadores del club.')),
      });
  }

  closeChangeAdmin(): void {
    this.changingClubId.set(null);
    this.newAdminId.set(null);
    this.deactivateAfterChange.set(null);
    this.adminCandidates.set([]);
  }

  confirmChangeAdmin(): void {
    const club = this.changingClub();
    const candidate = this.adminCandidates().find((u) => u.id === this.newAdminId());
    if (!club || !candidate) return;
    const previous = this.deactivateAfterChange();
    const change$ = this.adminService.changeClubAdmin(club.id, candidate.id);
    this.closeChangeAdmin();

    if (previous) {
      this.runAction(
        club.id,
        change$.pipe(switchMap(() => this.adminService.deactivateAccount(previous.user.id))),
        `${userName(candidate)} administra ${club.name} y la cuenta de ${userName(previous.user)} fue desactivada.`,
        'No se pudo completar la reasignación.',
      );
      return;
    }
    this.runAction(club.id, change$, `${userName(candidate)} es el nuevo administrador de ${club.name}.`, 'No se pudo cambiar el administrador.');
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
