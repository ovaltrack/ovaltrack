import { APP_INITIALIZER, ApplicationConfig, inject, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { SelectivePreloadingStrategy } from './core/routing/selective-preloading.strategy';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { jwtInterceptor } from './core/interceptor/jwt.interceptor'; 
import { initializeLocalDatabases } from './features/local-database/local-databases';
import { DexieLiveMatchSource, LiveMatchSource } from './core/navigation/live-match.source';
import { LocalSyncStatusSource, SyncStatusSource } from './core/navigation/sync-status.source';
import { SESSION_CLEANUP } from './core/session/session-cleanup';
import { clearPersistedSignals } from './shared/utils/persisted-signal';
import { DashboardSnapshotCache } from './features/home/data/dashboard-snapshot.cache';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(SelectivePreloadingStrategy)),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => initializeLocalDatabases(),
      multi: true,
    },
    provideHttpClient(withInterceptors([jwtInterceptor])),
    { provide: LiveMatchSource, useClass: DexieLiveMatchSource },
    { provide: SyncStatusSource, useClass: LocalSyncStatusSource },
    // En la raíz porque el Inicio es lazy: al cerrar sesión o ante un 401 se borran los snapshots de todos los usuarios.
    {
      provide: SESSION_CLEANUP,
      multi: true,
      useFactory: () => {
        const snapshots = inject(DashboardSnapshotCache);
        return () => snapshots.clearAll();
      }
    },
    // Filtros y preferencias de vista guardados en sessionStorage: otro usuario en la misma pestaña no los hereda.
    { provide: SESSION_CLEANUP, multi: true, useValue: () => clearPersistedSignals() }
  ]
};