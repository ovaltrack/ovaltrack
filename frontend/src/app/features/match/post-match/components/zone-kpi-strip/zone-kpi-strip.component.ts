import { Component, input } from '@angular/core';

/** Franja de indicadores de Zonas: eventos del partido, los que siguen sin zona y el tiempo ya zonificado. Presentacional. */
@Component({
  selector: 'app-zone-kpi-strip',
  standalone: true,
  templateUrl: './zone-kpi-strip.component.html',
  styleUrls: ['../../styles/kpi-strip.css', './zone-kpi-strip.component.css']
})
export class ZoneKpiStripComponent {
  readonly totalEvents = input<number>(0);
  readonly unzonedEvents = input<number>(0);
  /** Porcentaje (0–100) de los 80 minutos que ya tienen un tramo asignado. */
  readonly coveragePercent = input<number>(0);
}
