import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 52;
const LENGTH = 2 * Math.PI * RADIUS;

/** Anillo de análisis sobre el tablero: % cargado en Mono, con el aria-label completo. */
@Component({
  selector: 'app-analysis-ring',
  standalone: true,
  templateUrl: './analysis-ring.component.html',
  styleUrl: './analysis-ring.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalysisRingComponent {
  /** 0–100. */
  readonly percent = input.required<number>();

  readonly radius = RADIUS;
  readonly dash = computed(() => `${(Math.min(100, Math.max(0, this.percent())) / 100) * LENGTH} ${LENGTH}`);
  readonly ariaLabel = computed(() => `Análisis cargado al ${this.percent()} por ciento`);
}
