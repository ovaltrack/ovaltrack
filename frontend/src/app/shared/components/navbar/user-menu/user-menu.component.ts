import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, Injector, afterNextRender, computed, inject, signal, viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { ROLE_META } from '../../../../features/members/types/members.types';
import { getUserInitials } from '../../../../core/navigation/user-initials';
import { SyncStatusSource } from '../../../../core/navigation/sync-status.source';
import { ThemeService } from '../../../../core/services/theme.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { LogoutConfirmDialogComponent } from './logout-confirm-dialog/logout-confirm-dialog.component';

/** Ruta de "Mi perfil": la abren la tarjeta de identidad y la opción del menú. */
const PROFILE_ROUTE = '/profile';

/** Avatar con iniciales y menú de usuario: identidad, sincronización, apariencia y cierre de sesión. */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [RouterLink, LogoutConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css'
})
export class UserMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly authService = inject(AuthService);
  private readonly userContext = inject(UserContextService);
  private readonly syncSource = inject(SyncStatusSource);
  private readonly toast = inject(ToastService);
  readonly themeService = inject(ThemeService);

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly profileRoute = PROFILE_ROUTE;
  readonly isOpen = signal(false);
  readonly logoutDialogOpen = signal(false);
  readonly logoutSyncFailed = signal(false);
  readonly syncStatus = this.syncSource.status;

  readonly email = computed(() => this.userContext.userContext()?.email ?? this.authService.currentUser()?.email ?? '');
  readonly fullName = computed(() => this.userContext.fullName() || this.email());
  readonly initials = computed(() => getUserInitials(this.fullName(), this.email()));
  readonly clubName = computed(() => this.userContext.currentClub()?.name ?? null);
  readonly roleMeta = computed(() => {
    const role = this.authService.effectiveRole();
    return role ? ROLE_META[role] : null;
  });
  readonly hasPending = computed(() => this.syncStatus().pendingCount > 0);
  readonly isSyncing = computed(() => this.syncStatus().state === 'syncing');
  readonly isOnline = computed(() => this.syncStatus().state !== 'offline');

  /** Lo usa la barra para abrir el menú al tocar el aviso de sincronización. */
  open(): void {
    this.isOpen.set(true);
    afterNextRender(() => this.panel()?.nativeElement.focus(), { injector: this.injector });
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close(false);
    } else {
      this.open();
    }
  }

  close(restoreFocus = true): void {
    this.isOpen.set(false);
    if (restoreFocus) {
      this.trigger()?.nativeElement.focus();
    }
  }

  async retrySync(): Promise<void> {
    const result = await this.syncSource.retry();
    if (result === 'offline') {
      this.toast.warning('Sin conexión: los cambios se enviarán al volver la red.');
    } else if (result === 'incomplete') {
      this.toast.warning('No se pudieron enviar todos los cambios. Se reintentará automáticamente.');
    }
  }

  /** Siempre pide confirmar: sin conexión no se puede volver a iniciar sesión. */
  logout(): void {
    this.close(false);
    this.logoutSyncFailed.set(false);
    this.logoutDialogOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutDialogOpen.set(false);
    this.trigger()?.nativeElement.focus();
  }

  confirmLogout(): void {
    this.logoutDialogOpen.set(false);
    this.authService.logout();
  }

  /** Cierra sesión solo si se pudo enviar todo; si no, el diálogo queda abierto con el aviso. */
  async syncAndLogout(): Promise<void> {
    this.logoutSyncFailed.set(false);
    const result = await this.syncSource.retry();
    if (result === 'done') {
      this.confirmLogout();
    } else if (result === 'incomplete') {
      this.logoutSyncFailed.set(true);
    }
  }

  /** `pointerdown` (no `click`): así abrir el menú desde el aviso de sincronización no lo cierra al burbujear. */
  @HostListener('document:pointerdown', ['$event'])
  onOutsidePointer(event: PointerEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }
}
