import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { injectCurrentUrl } from 'src/app/core/navigation/current-url';
import { LiveMatchSource } from 'src/app/core/navigation/live-match.source';
import { NavbarModeService } from 'src/app/core/navigation/navbar-mode.service';
import { SyncStatusSource } from 'src/app/core/navigation/sync-status.source';
import { ThemeService } from 'src/app/core/services/theme.service';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { NavLiveMatchComponent } from './nav-live-match/nav-live-match.component';
import { NavModulesComponent } from './nav-modules/nav-modules.component';
import { MobileTabBarComponent } from './mobile-tab-bar/mobile-tab-bar.component';
import { NavSyncStatusComponent } from './nav-sync-status/nav-sync-status.component';
import { UserMenuComponent } from './user-menu/user-menu.component';
import { HelpButtonComponent } from 'src/app/features/tour/help-button/help-button.component';

/**
 * Barra superior: orquesta logo, módulos, estados y menú de usuario.
 * No contiene lógica de negocio; cada parte es un componente que recibe sus datos.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, NavModulesComponent, NavLiveMatchComponent, NavSyncStatusComponent, UserMenuComponent, MobileTabBarComponent, HelpButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private readonly userContext = inject(UserContextService);
  readonly themeService = inject(ThemeService);
  readonly navbarMode = inject(NavbarModeService);
  readonly currentUser = inject(AuthService).currentUser;
  readonly syncStatus = inject(SyncStatusSource).status;

  private readonly liveMatchSource = inject(LiveMatchSource);

  private readonly currentUrl = injectCurrentUrl();

  readonly clubName = computed(() => this.userContext.currentClub()?.name ?? null);

  readonly logoSrc = computed(() => this.themeService.theme() === 'light'
    ? 'assets/brand/OvalTrack-fondo-claro.png'
    : 'assets/brand/OvalTrack-fondo-oscuro.png');

  readonly themeToggleLabel = computed(() =>
    this.themeService.theme() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');

  /**
   * El jugador no captura partidos: no ve el acceso al partido en vivo.
   * Tampoco se muestra dentro de la carga en vivo (o el entretiempo) de ese mismo partido: llevaría a la misma pantalla.
   */
  readonly liveMatch = computed(() => {
    if (this.currentUser()?.role === 'PLAYER') return null;
    const match = this.liveMatchSource.liveMatch();
    if (match && this.currentUrl().startsWith(`/live-capture/${match.matchId}`)) return null;
    return match;
  });

  /** En login y registro la barra solo ofrece volver al inicio: la página ya tiene sus propios accesos. */
  readonly isAuthPage = computed(() => this.currentUrl().startsWith('/auth'));
}
