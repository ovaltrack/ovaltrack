import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { ClubDetailsComponent } from './features/club/club-details.component';
import { DivisionFormComponent } from './features/division/division-form.component';
import { DivisionListComponent } from './features/division/division-list.component';
import { DivisionPlayerFormComponent } from './features/division-player/form/division-player-form.component';
import { DivisionCoachListComponent } from './features/division-coach/division-coach-list.component';
import { hasRoleGuard } from './core/guards/has-role.guard';
import { hasClubGuard } from './core/guards/has-club.guard';
import { DivisionPlayerListComponent } from './features/division-player/list/division-player-list.component';
import { OpponentManagerComponent } from './features/match/opponents/opponent-manager.component';


export const routes: Routes = [
    // Raíz: redirige a /home
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
    },

    {
        path: 'home',
        loadComponent: () =>
            import('./features/home/home.component').then(m => m.HomeComponent)
    },
    {
        path: 'admin/ovaltrack',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard],
        data: { roles: ['ADMIN_OVALTRACK'] },
        loadComponent: () =>
            import('./features/admin/pages/panel-ovaltrack/ovaltrack-admin.component')
                .then(m => m.OvaltrackAdminComponent)
    },
    {
        path: 'auth',
        canMatch: [guestGuard],
        loadChildren: () =>
            import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
    },
    {
        path: 'live-capture/:matchId/halftime',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST'],
            preload: true,
            navbar: 'hidden'
        },
        loadComponent: () =>
            import('./features/match/halftime-summary/halftime-summary.component').then(
                m => m.HalftimeSummaryComponent
            )
    },
    {
        path: 'live-capture/:matchId',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST'],
            preload: true,
            navbar: 'hidden'
        },
        loadComponent: () =>
            import('./features/match/carga-en-vivo/carga-en-vivo.component').then(
                m => m.CargaEnVivoComponent
            )
    },
    {
        path: 'match-selection',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST'],
            preload: true
        },
        loadComponent: () =>
            import('./features/match/match-selection/match-selection.component').then(
                m => m.MatchSelectComponent
            )
    },
    {
        canMatch: [authGuard],
        canActivate: [hasRoleGuard],
        data: {
            roles: ["ADMIN_OVALTRACK", "ADMIN_CLUB"]
        },
        path: 'club',
        component: ClubDetailsComponent
    },
    {
        path: 'divisions/new',
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ["ADMIN_OVALTRACK", "ADMIN_CLUB"]
        },
        canMatch: [authGuard],
        component: DivisionFormComponent
    },
    {
        path: 'divisions',
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ["ADMIN_OVALTRACK", "ADMIN_CLUB", "COACH_ANALYST"]
        },
        canMatch: [authGuard],
        component: DivisionListComponent
    },
    {
        path: 'divisions/:divisionId/coaches',
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST']
        },
        canMatch: [authGuard],
        component: DivisionCoachListComponent
    },
    {
        path: 'divisions/:divisionId/statistics',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST'],
            layout: 'wide'
        },
        loadComponent: () =>
            import('./features/division-statistics/division-statistics.component').then(
                m => m.DivisionStatisticsComponent
            )
    },
    {
        path: 'divisions/:divisionId/players',
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST']
        },
        canMatch: [authGuard],
        component: DivisionPlayerListComponent
    },
    {
        path: 'division-statistics/:divisionId',
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST'],
            layout: 'wide'
        },
        canMatch: [authGuard],
        loadComponent: () =>
            import('./features/division-statistics/division-statistics.component')
                .then(m => m.DivisionStatisticsComponent)
    },
    {
        path: 'players/new',
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ["ADMIN_OVALTRACK", "ADMIN_CLUB", "COACH_ANALYST"]
        },
        canMatch: [authGuard],
        component: DivisionPlayerFormComponent
    },
    {
        path: 'division-player-user-query',
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST']
        },
        canMatch: [authGuard],
        loadComponent: () =>
            import('./features/division-player/user-query/division-player-user-query.component')
                .then(m => m.DivisionPlayerUserQueryComponent)
    },
    {
        path: 'profile',
        canMatch: [authGuard],
        title: 'Mi perfil · OvalTrack',
        loadComponent: () =>
            import('./features/profile/pages/profile/profile.component').then(m => m.ProfileComponent)
    },
    {
        path: 'members',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ["ADMIN_OVALTRACK", "ADMIN_CLUB", "COACH_ANALYST"]
        },
        loadComponent: () =>
            import('./features/members/pages/members-page/members-page.component').then(
                m => m.MembersPageComponent
            )
    },
    {
        path: 'miembros',
        redirectTo: 'members',
        pathMatch: 'full'
    },
    {
        path: 'selection-roster/:id',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST']
        },
        loadComponent: () =>
            import('./features/match/selection-roster/selection-roster.component').then(
                m => m.SelectionRosterComponent
            )
    },
    {
        path: 'post-match/:id',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST'],
            preload: true,
            navbar: 'compact'
        },
        loadComponent: () =>
            import('./features/match/post-match/post-match-shell.component').then(
                m => m.PostMatchShellComponent
            ),
        children: [
            {
                path: '',
                data: { preload: true, layout: 'wide', lockViewport: true, viewTitle: 'Eventos' },
                loadComponent: () =>
                    import('./features/match/post-match/post-match.component').then(
                        m => m.PostMatchComponent
                    )
            },
            {
                path: 'zones',
                data: { layout: 'wide', viewTitle: 'Zonas de cancha' },
                loadComponent: () => import('./features/match/post-match/components/post-match-zones/post-match-zones.component')
                    .then(m => m.PostMatchZonesComponent),
            },
            {
                path: 'statistics',
                loadComponent: () => import('./features/match/post-match/components/post-match-statistics/post-match-statistics.component')
                    .then(m => m.PostMatchStatisticsComponent),
                data: { layout: 'wide', viewTitle: 'Estadísticas' },
            }
        ]
    },
    {
        path: 'invitation',
        loadComponent: () =>
            import('./features/invitation/invitation.component').then(
                c => c.InvitationComponent
            )
    },
    {
        path: 'opponent',
        canMatch: [authGuard],
        canActivate: [hasRoleGuard, hasClubGuard],
        data: {
            roles: ['ADMIN_OVALTRACK', 'ADMIN_CLUB']
        },
        component: OpponentManagerComponent
    },
    {
        path: 'player-statistics',
        loadComponent: () => import('./features/player-statistics/player-statistics.component')
            .then(c => c.PlayerStatisticsComponent),
        canMatch: [authGuard],
        canActivate: [hasRoleGuard],
        data: { roles: ['PLAYER'] },
    },
    {
        path: 'player-statistics/:matchId',
        loadComponent: () => import('./features/player-statistics/player-match-statistics/player-match-statistics.component')
            .then(c => c.PlayerMatchStatisticsComponent),
        canMatch: [authGuard],
        canActivate: [hasRoleGuard],
        data: { roles: ['PLAYER'] },
    },
    // Textos legales: públicos, con o sin sesión
    {
        path: 'legal/terminos',
        title: 'Términos y Condiciones · OvalTrack',
        loadComponent: () =>
            import('./features/legal/terms/terms.component').then(m => m.TermsComponent)
    },
    {
        path: 'legal/privacidad',
        title: 'Política de Privacidad · OvalTrack',
        loadComponent: () =>
            import('./features/legal/privacy/privacy.component').then(m => m.PrivacyComponent)
    },
    // Wildcard para rutas no encontradas
    {
        path: '**',
        redirectTo: 'home'
    }
];
