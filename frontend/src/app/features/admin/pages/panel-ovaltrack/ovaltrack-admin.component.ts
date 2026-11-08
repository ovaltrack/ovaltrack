import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, forkJoin } from 'rxjs';
import { OvalTrackAdminService } from '../../services/ovaltrack-admin.service';
import { UserRole } from 'src/app/features/auth/types/auth.types';
import { Club, ClubStatus } from 'src/app/features/club/types/club.types';
import { UserResponseDTO } from 'src/app/features/user/types/user.types';
import { UserClubRegistration } from '../../types/ovaltrack-admin.types';
import { ToastService } from 'src/app/core/services/toast.service';
import { MessageResponse } from 'src/app/shared/types/shared-types';
import { NgTemplateOutlet } from '@angular/common';

export type AccountFilter = 'all' | 'active' | 'inactive';
export type ClubFilter = 'all' | 'active' | 'rejected';

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_OVALTRACK: 'Admin. OvalTrack',
  ADMIN_CLUB: 'Admin. de club',
  COACH_ANALYST: 'Entrenador/analista',
  PLAYER: 'Jugador',
  NO_ROLE: 'Sin rol',
};

@Component({
  selector: 'app-ovaltrack-admin',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './ovaltrack-admin.component.html',
  styleUrl: './ovaltrack-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OvaltrackAdminComponent implements OnInit {
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

  /** Administradores disponibles para asociar a un club. */
  readonly admins = computed<UserClubRegistration[]>(() => [
    ...this.allAccounts().filter((a) => a.user.role === 'ADMIN_CLUB'),
    ...this.requests().filter((r) => r.user.role === 'ADMIN_CLUB'),
  ]);

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

  /** Admin elegido para cada club pendiente (clubId -> adminUserId). */
  readonly selectedAdmin = signal<Record<string, string | null>>({});

  readonly changingClubId = signal<string | null>(null);
  readonly newAdminId = signal<string | null>(null);

  readonly skeletonRows = [0, 1, 2];

  readonly accountFilterOptions: FilterOption<AccountFilter>[] = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Activas' },
    { value: 'inactive', label: 'Inactivas' },
  ];

  readonly clubFilterOptions: FilterOption<ClubFilter>[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'rejected', label: 'Rechazados' },
  ];

  /* ---------- Derivados ---------- */
  readonly stats = computed(() => ({
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
    const active = all.filter((c) => c.status === 'ACTIVE').length;
    return { all: all.length, active, rejected: all.length - active };
  });

  readonly filteredAccounts = computed(() => {
    const q = this.accountSearch().trim().toLowerCase();
    return this.visibleAccounts().filter(
      (a) => !q || this.userName(a.user).toLowerCase().includes(q) || a.user.email.toLowerCase().includes(q),
    );
  });

  readonly filteredClubs = computed(() => {
    const q = this.clubSearch().trim().toLowerCase();
    return this.visibleClubs().filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q),
    );
  });

  readonly changingClub = computed(() => this.visibleClubs().find((c) => c.id === this.changingClubId()) ?? null);

  ngOnInit(): void {
    this.loadAll();
  }

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
          this.allClubs.set(clubs);
          this.visibleClubs.set(clubs);
          this.loaded.set(true);
        },
        error: (err: HttpErrorLike) =>
          this.toast.error(this.errorMessage(err, 'No se pudieron cargar los datos del panel.'), 'Error de carga', 0, {
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
        error: (err: HttpErrorLike) => this.toast.error(this.errorMessage(err, 'No se pudieron cargar las cuentas.')),
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
        next: (list) => {
          if (this.clubFilter() !== filter) return;
          this.visibleClubs.set(list);
          if (filter === 'all') this.allClubs.set(list);
        },
        error: (err: HttpErrorLike) => this.toast.error(this.errorMessage(err, 'No se pudieron cargar los clubes.')),
      });
  }

  /* ---------- Acciones ---------- */
  approveRequest(registration: UserClubRegistration): void {
    this.runAction(
      registration.user.id,
      this.adminService.approveAccount(registration.user.id),
      `Cuenta de ${this.userName(registration.user)} aprobada.`,
      'No se pudo aprobar la cuenta.',
    );
  }

  rejectRequest(user: UserResponseDTO): void {
    this.runAction(
      user.id,
      this.adminService.rejectAccount(user.id),
      `Solicitud de ${this.userName(user)} rechazada.`,
      'No se pudo rechazar la cuenta.',
    );
  }

  chooseAdminForPending(clubId: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedAdmin.update((map) => ({ ...map, [clubId]: value || null }));
  }

  approveClub(club: Club): void {
    const adminUserId = this.selectedAdmin()[club.id];
    if (!adminUserId) {
      this.toast.warning(`Elegí el administrador que quedará a cargo de ${club.name} antes de aprobarlo.`, 'Falta el administrador');
      return;
    }
    this.runAction(
      club.id,
      this.adminService.approveClub(club.id, adminUserId),
      `${club.name} quedó activo con su administrador.`,
      'No se pudo aprobar el club.',
    );
  }

  rejectClub(club: Club): void {
    this.runAction(club.id, this.adminService.rejectClub(club.id), `${club.name} fue rechazado.`, 'No se pudo rechazar el club.');
  }

  setAccountActive(account: UserClubRegistration, active: boolean): void {
    const name = this.userName(account.user);
    this.runAction(
      account.user.id,
      active ? this.adminService.activateAccount(account.user.id) : this.adminService.deactivateAccount(account.user.id),
      active ? `Cuenta de ${name} activada.` : `Cuenta de ${name} desactivada.`,
      active ? 'No se pudo activar la cuenta.' : 'No se pudo desactivar la cuenta.',
    );
  }

  setClubStatus(club: Club, status: ClubStatus): void {
    this.updateClubs((list) => list.map((c) => (c.id === club.id ? { ...c, status } : c)));
  }

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

  /* ---------- Helpers de plantilla ---------- */
  userName(u: UserResponseDTO): string {
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  }

  adminById(id: string | null | undefined): UserClubRegistration | undefined {
    return this.admins().find((a) => a.user.id === id);
  }

  initials(name: string): string {
    return name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }

  roleClass(role: UserRole): string {
    return role === 'ADMIN_CLUB' ? 'role-admin' : role === 'COACH_ANALYST' ? 'role-coach' : 'role-player';
  }

  roleLabel(role: UserRole): string {
    return ROLE_LABELS[role] ?? role;
  }

  formatDate(iso?: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  }

  onSearch(target: 'account' | 'club', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    (target === 'account' ? this.accountSearch : this.clubSearch).set(value);
  }

  /* ---------- Internos ---------- */
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
        error: (err: HttpErrorLike) => this.toast.error(this.errorMessage(err, fallbackError)),
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

  private errorMessage(err: HttpErrorLike, fallback: string): string {
    return err?.error?.message ?? fallback;
  }
}

interface HttpErrorLike {
  error?: { message?: string } | null;
}
