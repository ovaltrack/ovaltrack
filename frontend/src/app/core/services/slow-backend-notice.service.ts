import { Injectable, inject } from '@angular/core';
import { Observable, defer, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from './connectivity.service';
import { ToastService } from './toast.service';

/** Cuánto puede tardar un pedido al backend antes de avisar. */
export const SLOW_BACKEND_DELAY_MS = 5_000;
/** Separación mínima entre dos avisos, para no repetirlo con cada pedido de una misma pantalla. */
export const SLOW_BACKEND_NOTICE_GAP_MS = 120_000;
export const SLOW_BACKEND_MESSAGE = 'El servidor está tardando en responder. Si estuvo un rato sin uso, puede demorar hasta un minuto en despertar.';
const NOTICE_DURATION_MS = 8_000;

/**
 * Avisa con un toast cuando un pedido al backend sigue sin respuesta a los {@link SLOW_BACKEND_DELAY_MS} ms
 * (por ejemplo, Render despertando). No modifica el pedido ni su resultado; sin conexión no avisa.
 */
@Injectable({ providedIn: 'root' })
export class SlowBackendNoticeService {
  private readonly toast = inject(ToastService);
  private readonly connectivity = inject(ConnectivityService);
  private lastShownAt = Number.NEGATIVE_INFINITY;

  watch<T>(url: string, request$: Observable<T>): Observable<T> {
    if (!url.startsWith(environment.apiUrl) || url.includes('/actuator/')) return request$;
    return defer(() => {
      const timer = setTimeout(() => this.notify(), SLOW_BACKEND_DELAY_MS);
      return request$.pipe(finalize(() => clearTimeout(timer)));
    });
  }

  private notify(): void {
    const now = Date.now();
    if (!this.connectivity.online() || now - this.lastShownAt < SLOW_BACKEND_NOTICE_GAP_MS) return;
    this.lastShownAt = now;
    this.toast.info(SLOW_BACKEND_MESSAGE, 'Conectando', NOTICE_DURATION_MS);
  }
}
