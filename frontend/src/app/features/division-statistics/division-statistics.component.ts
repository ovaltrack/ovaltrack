import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DivisionStatisticsService } from './services/division-statistics.service';
import {
  DivisionMatchStatistic,
  DivisionStatisticsErrorKind,
  DivisionStatisticsResponse,
} from './types/division-statistics.types';
import { DIVISION_METRICS, DivisionMetricDef, MetricUnit, isMetricSelection } from './utils/division-metrics';
import { persistedSignal } from '../../shared/utils/persisted-signal';
import { ChartSeries, StatLineChartComponent } from './components/stat-line-chart/stat-line-chart.component';

type RangePreset = 'last3' | 'last6' | 'year';

interface MetricChart {
  id: string;
  label: string;
  unit: MetricUnit;
  series: ChartSeries[];
}

interface Kpi { label: string; value: string; }

interface MatchRow {
  matchId: string;
  date: string;
  opponent: string;
  ownScore: number;
  opponentScore: number;
  result: 'G' | 'E' | 'P';
}

const ERROR_MESSAGES: Record<DivisionStatisticsErrorKind, string> = {
  forbidden: 'No tenés permisos para ver las estadísticas de esta división.',
  'not-found': 'La división no existe o ya no está disponible.',
  'invalid-range': 'El rango de fechas no es válido.',
  generic: 'No pudimos cargar las estadísticas. Intentá de nuevo en unos instantes.',
};

/** Fecha local en formato YYYY-MM-DD (lo que espera el backend). */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-division-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatLineChartComponent],
  templateUrl: './division-statistics.component.html',
  styleUrl: './division-statistics.component.css',
})
export class DivisionStatisticsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly statisticsService = inject(DivisionStatisticsService);

  readonly metrics: DivisionMetricDef[] = DIVISION_METRICS;
  readonly presets: { id: RangePreset; label: string }[] = [
    { id: 'last3', label: 'Últimos 3 meses' },
    { id: 'last6', label: 'Últimos 6 meses' },
    { id: 'year', label: 'Este año' },
  ];

  divisionId = '';
  from = '';
  to = '';
  loading = false;
  error: DivisionStatisticsErrorKind | null = null;
  data: DivisionStatisticsResponse | null = null;

  readonly selectedMetricIds = persistedSignal<string[]>(
    'division-statistics.metrics',
    DIVISION_METRICS.filter(m => m.defaultSelected).map(m => m.id),
    { isValid: isMetricSelection },
  );

  labels: string[] = [];
  details: string[] = [];
  charts: MetricChart[] = [];
  kpis: Kpi[] = [];
  rows: MatchRow[] = [];

  get errorMessage(): string {
    return this.error ? ERROR_MESSAGES[this.error] : '';
  }

  ngOnInit(): void {
    this.applyPreset('last3', false);
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.divisionId = params.get('divisionId') ?? params.get('id') ?? '';
      this.load();
    });
  }

  applyPreset(preset: RangePreset, reload = true): void {
    const today = new Date();
    const start = new Date(today);
    if (preset === 'last3') start.setMonth(today.getMonth() - 3);
    if (preset === 'last6') start.setMonth(today.getMonth() - 6);
    if (preset === 'year') { start.setMonth(0); start.setDate(1); }
    this.from = toIsoDate(start);
    this.to = toIsoDate(today);
    if (reload) this.load();
  }

  load(): void {
    if (!this.divisionId) return;
    if (!this.from || !this.to || this.from > this.to) {
      this.fail('invalid-range');
      return;
    }

    this.loading = true;
    this.error = null;
    this.statisticsService
      .getDivisionStatistics(this.divisionId, this.from, this.to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.loading = false;
          this.data = response;
          this.rebuild();
        },
        error: (err: HttpErrorResponse) => this.fail(this.toErrorKind(err)),
      });
  }

  toggleMetric(metricId: string): void {
    this.selectedMetricIds.update(selected => selected.includes(metricId)
      ? selected.filter(id => id !== metricId)
      : [...selected, metricId]);
    this.buildCharts();
  }

  isSelected(metricId: string): boolean {
    return this.selectedMetricIds().includes(metricId);
  }

  goBack(): void {
    this.location.back();
  }

  private fail(kind: DivisionStatisticsErrorKind): void {
    this.loading = false;
    this.error = kind;
    this.data = null;
    this.rebuild();
  }

  private toErrorKind(err: HttpErrorResponse): DivisionStatisticsErrorKind {
    switch (err.status) {
      case 403: return 'forbidden';
      case 404: return 'not-found';
      case 400: return 'invalid-range';
      default: return 'generic';
    }
  }

  private rebuild(): void {
    const matches = this.data?.matches ?? [];
    this.labels = matches.map(m => this.shortDate(m));
    this.details = matches.map(m => `${this.longDate(m)} · vs ${m.opponentName ?? 'Rival'}`);
    this.rows = matches.map(m => this.toRow(m));
    this.kpis = this.buildKpis(matches);
    this.buildCharts();
  }

  private buildCharts(): void {
    const matches = this.data?.matches ?? [];
    this.charts = this.metrics
      .filter(metric => this.isSelected(metric.id))
      .map(metric => ({
        id: metric.id,
        label: metric.label,
        unit: metric.unit,
        series: metric.series.map(serie => ({
          name: serie.label,
          color: serie.color,
          dashed: serie.dashed,
          values: matches.map(m => serie.value(m.statistics)),
        })),
      }));
  }

  private buildKpis(matches: DivisionMatchStatistic[]): Kpi[] {
    if (matches.length === 0) return [];
    const count = matches.length;
    const avg = (pick: (m: DivisionMatchStatistic) => number) =>
      matches.reduce((sum, m) => sum + pick(m), 0) / count;
    const rows = matches.map(m => this.toRow(m));
    const record = (result: 'G' | 'E' | 'P') => rows.filter(r => r.result === result).length;

    return [
      { label: 'Partidos', value: `${count}` },
      { label: 'G · E · P', value: `${record('G')} · ${record('E')} · ${record('P')}` },
      { label: 'Puntos a favor (prom.)', value: avg(m => m.statistics.ownScore).toFixed(1) },
      { label: 'Puntos en contra (prom.)', value: avg(m => m.statistics.opponentScore).toFixed(1) },
      { label: 'Posesión (prom.)', value: `${avg(m => m.statistics.ownPossessionPercentage).toFixed(1)}%` },
    ];
  }

  private toRow(match: DivisionMatchStatistic): MatchRow {
    const { ownScore, opponentScore } = match.statistics;
    return {
      matchId: match.matchId,
      date: this.longDate(match),
      opponent: match.opponentName ?? 'Rival',
      ownScore,
      opponentScore,
      result: ownScore > opponentScore ? 'G' : ownScore < opponentScore ? 'P' : 'E',
    };
  }

  private shortDate(match: DivisionMatchStatistic): string {
    return new Date(match.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  }

  private longDate(match: DivisionMatchStatistic): string {
    return new Date(match.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
