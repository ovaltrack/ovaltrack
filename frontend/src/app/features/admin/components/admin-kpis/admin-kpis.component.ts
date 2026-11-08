import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AdminStats } from '../../types/ovaltrack-admin.types';

/** Resumen del panel: pendientes (resaltados si hay) y totales activos. */
@Component({
  selector: 'app-admin-kpis',
  standalone: true,
  host: { role: 'region', 'aria-label': 'Resumen' },
  template: `
    <article class="tile adm-kpi" [class.adm-kpi-alert]="stats().pendingRequests > 0">
      <span class="label-mono">Solicitudes</span>
      <strong>{{ stats().pendingRequests }}</strong>
      <span class="adm-kpi-hint">Cuentas por revisar</span>
    </article>
    <article class="tile adm-kpi" [class.adm-kpi-alert]="stats().pendingClubs > 0">
      <span class="label-mono">Clubes pendientes</span>
      <strong>{{ stats().pendingClubs }}</strong>
      <span class="adm-kpi-hint">Esperan administrador</span>
    </article>
    <article class="tile adm-kpi">
      <span class="label-mono">Cuentas activas</span>
      <strong>{{ stats().activeAccounts }}</strong>
      <span class="adm-kpi-hint">Con acceso aprobado</span>
    </article>
    <article class="tile adm-kpi">
      <span class="label-mono">Clubes activos</span>
      <strong>{{ stats().activeClubs }}</strong>
      <span class="adm-kpi-hint">Operando en la plataforma</span>
    </article>
  `,
  styleUrl: './admin-kpis.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminKpisComponent {
  readonly stats = input.required<AdminStats>();
}
