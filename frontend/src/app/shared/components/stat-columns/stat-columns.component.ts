import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BarChart, barPercent, describeBars, isEmptyBars, scaleTicks, showsColumnValues } from '../../utils/bars';

/** Con más grupos que esto se muestra una etiqueta del eje cada tanto (igual que el gráfico de líneas). */
const MAX_X_LABELS = 8;

/**
 * Columnas en HTML/CSS puro, solo para secuencias en el tiempo (bloques de 10', partidos de una división): una columna
 * por serie dentro de cada grupo, sobre una escala común. Los valores van sobre la columna mientras entren; el detalle
 * de cada grupo queda en su `title` y en el texto accesible.
 */
@Component({
  selector: 'app-stat-columns',
  standalone: true,
  templateUrl: './stat-columns.component.html',
  styleUrl: './stat-columns.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatColumnsComponent {
  readonly chart = input.required<BarChart>();

  readonly ticks = computed(() => scaleTicks(this.chart()));
  readonly isEmpty = computed(() => isEmptyBars(this.chart()));
  readonly description = computed(() => describeBars(this.chart()));
  readonly showValues = computed(() => showsColumnValues(this.chart()));
  /** Alguna columna lleva una segunda línea (la sigla del rival): el eje X reserva dos renglones. */
  readonly twoLines = computed(() => this.chart().groups.some(group => !!group.sublabel));
  readonly groups = computed(() => {
    const { groups, max } = this.chart();
    const step = Math.max(1, Math.ceil(groups.length / MAX_X_LABELS));
    return groups.map((group, index) => ({
      label: group.label,
      sublabel: group.sublabel ?? '',
      showLabel: index % step === 0 || index === groups.length - 1,
      title: `${group.detail ?? group.label}: ${group.values.map(value => `${value.series} ${value.display}`).join(', ')}`,
      columns: group.values.map(value => ({
        color: value.color,
        display: value.display,
        height: barPercent(value.value, max),
        muted: !value.value,
        drawn: value.value !== null,
      })),
    }));
  });
}
