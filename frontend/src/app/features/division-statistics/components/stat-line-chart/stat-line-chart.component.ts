import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { scaleMaxFor } from '../../../../shared/utils/bars';
import { formatMetricValue, MetricUnit } from '../../utils/division-metrics';

export interface ChartSeries {
  name: string;
  color: string;
  dashed?: boolean;
  /** `null` = sin dato en ese partido: no se dibuja el punto y se corta la línea. */
  values: (number | null)[];
}

interface ChartPoint { x: number; y: number; tooltip: string; label: string; labelY: number; }
interface ChartLine { name: string; color: string; dashed: boolean; polylines: string[]; points: ChartPoint[]; }
interface Gridline { y: number; label: string; }
interface XTick { x: number; label: string; }

const WIDTH = 600;
const HEIGHT = 230;
const MARGIN = { top: 14, right: 18, bottom: 34, left: 42 };
const MAX_X_TICKS = 8;
/** Con más partidos que esto los números se superponen y se ocultan (siguen en el tooltip). */
const MAX_LABELED_POINTS = 24;
const LABEL_OFFSET_ABOVE = 9;
const LABEL_OFFSET_BELOW = 16;

/** Gráfico de líneas con puntos en SVG puro (sin dependencias): un punto por partido, una línea por serie. */
@Component({
  selector: 'ot-stat-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stat-line-chart.component.html',
  styleUrl: './stat-line-chart.component.css',
})
export class StatLineChartComponent implements OnChanges {
  /** Etiqueta corta del eje X (una por partido). */
  @Input() labels: string[] = [];
  /** Detalle completo de cada partido, para el tooltip. */
  @Input() details: string[] = [];
  @Input() series: ChartSeries[] = [];
  @Input() unit: MetricUnit = 'int';

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly plotLeft = MARGIN.left;
  readonly plotRight = WIDTH - MARGIN.right;

  lines: ChartLine[] = [];
  gridlines: Gridline[] = [];
  xTicks: XTick[] = [];
  showLabels = true;

  ngOnChanges(): void {
    const count = this.labels.length;
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const yMax = this.niceMax();
    this.showLabels = count <= MAX_LABELED_POINTS;

    const xAt = (index: number) =>
      count <= 1 ? MARGIN.left + plotWidth / 2 : MARGIN.left + (plotWidth * index) / (count - 1);
    const yAt = (value: number) => MARGIN.top + plotHeight - (Math.min(value, yMax) / yMax) * plotHeight;

    this.gridlines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
      y: yAt(yMax * ratio),
      label: formatMetricValue(Math.round(yMax * ratio * 10) / 10, this.unit),
    }));

    const step = Math.max(1, Math.ceil(count / MAX_X_TICKS));
    this.xTicks = this.labels
      .map((label, index) => ({ x: xAt(index), label, index }))
      .filter(tick => tick.index % step === 0 || tick.index === count - 1)
      .map(({ x, label }) => ({ x, label }));

    this.lines = this.series.map((serie, serieIndex) => {
      const points: ChartPoint[] = [];
      const polylines: string[] = [];
      let segment: ChartPoint[] = [];
      const closeSegment = () => {
        if (segment.length > 1) {
          polylines.push(segment.map(point => `${point.x},${point.y}`).join(' '));
        }
        segment = [];
      };

      serie.values.forEach((value, index) => {
        if (value === null || value === undefined) {
          closeSegment();
          return;
        }
        const y = yAt(value);
        // La primera serie rotula arriba del punto y las demás abajo, para que dos líneas cercanas no pisen sus números.
        // Si no hay lugar arriba (valor en el techo del eje), se rotula abajo.
        const below = serieIndex > 0 || y - LABEL_OFFSET_ABOVE < MARGIN.top - 4;
        const formatted = formatMetricValue(value, this.unit);
        const point = {
          x: xAt(index),
          y,
          tooltip: `${this.details[index] ?? this.labels[index] ?? ''}\n${serie.name}: ${formatted}`,
          label: formatted,
          labelY: below ? y + LABEL_OFFSET_BELOW : y - LABEL_OFFSET_ABOVE,
        };
        points.push(point);
        segment.push(point);
      });
      closeSegment();

      return { name: serie.name, color: serie.color, dashed: !!serie.dashed, polylines, points };
    });
  }

  /** Techo del eje Y: 100 en porcentajes; en conteos, el siguiente valor "redondo" por encima del máximo. */
  private niceMax(): number {
    return scaleMaxFor(this.unit === 'percent' ? 'percent' : 'count', this.series.flatMap(serie => serie.values));
  }
}
