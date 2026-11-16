import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { sparklineGeometry } from '../../domain/sparkline';

const WIDTH = 140;
const HEIGHT = 40;

/** Mini gráfico de una serie con la línea del promedio previo; la serie completa va en el `aria-label`. */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  templateUrl: './sparkline.component.html',
  styleUrl: './sparkline.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SparklineComponent {
  readonly values = input.required<readonly number[]>();
  /** Promedio previo; sin él se usa el de los valores anteriores al último. */
  readonly average = input<number | undefined>(undefined);
  readonly ariaLabel = input.required<string>();

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly geometry = computed(() => sparklineGeometry(this.values(), WIDTH, HEIGHT, this.average()));
}
