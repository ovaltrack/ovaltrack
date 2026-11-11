import { DestroyRef, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, filter, interval, of } from 'rxjs';
import { environment } from '@environments/environment';
import { ConnectivityService } from './connectivity.service';

/** Cada cuánto se consulta el health check del backend. */
export const BACKEND_HEALTH_INTERVAL_MS = 780_000;

/**
 * Consulta periódicamente `GET /actuator/health` (público en SecurityConfig) para mantener activo el
 * servidor remoto. Sin conexión no hace nada: la petición fallaría igual.
 */
@Injectable({ providedIn: 'root' })
export class BackendHealthService {
  private readonly http = inject(HttpClient);
  private readonly connectivity = inject(ConnectivityService);
  private readonly healthUrl = `${environment.apiUrl}/actuator/health`;

  constructor() {
    interval(BACKEND_HEALTH_INTERVAL_MS).pipe(
      filter(() => this.connectivity.online()),
      exhaustMap(() => this.http.get<{ status: string }>(this.healthUrl).pipe(
        catchError((error: unknown) => {
          console.warn(`Health check del backend falló (${new Date().toISOString()}):`, error);
          return of(null);
        }),
      )),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe();
  }
}
