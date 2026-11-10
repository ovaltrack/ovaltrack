import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchStatistics } from '../../../statistics/types/statistic.types';
import {
  formatMetric,
  GroupStatPresentation,
  presentGroups,
  scoringLines,
  StatLine,
} from '../../../statistics/presentation/stat-presentation';

@Component({
  selector: 'ot-current-stats-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './current-stats-modal.component.html',
  styleUrls: ['../../../styles/match-stats.css', './current-stats-modal.component.css']
})
export class CurrentStatsModalComponent {
  /** Estadísticas de la vista `basic`: tipos marcados con `stat_view` "basic" en el catálogo. */
  @Input() set stats(stats: MatchStatistics | null) {
    this.current = stats;
    this.scoring = stats ? scoringLines(stats.groups) : [];
    // El marcador ya muestra los tipos que suman: el resto se agrupa por `groupName`.
    this.groups = stats
      ? presentGroups(
          stats.groups.map(group => ({ ...group, types: group.types.filter(type => !type.isScoring) })),
          { includePoints: false },
        ).filter(group => group.types.length > 0)
      : [];
  }
  @Input() homeTeam: string = 'PMRC';
  @Input() awayTeam: string = 'Rival';
  @Input() isLoading: boolean = false;
  @Input() isOffline: boolean = false;
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() gameClock: string = '--:--';
  @Input() clockPaused: boolean = true;

  @Output() closeModal = new EventEmitter<void>();
  @Output() toggleClock = new EventEmitter<void>();

  current: MatchStatistics | null = null;
  scoring: StatLine[] = [];
  groups: GroupStatPresentation[] = [];

  readonly formatMetric = formatMetric;

  get opponentPossessionPercentage(): number {
    if (!this.current) return 50;
    return Math.max(0, Math.round((100 - this.current.ownPossessionPercentage) * 10) / 10);
  }

  onClose(): void {
    this.closeModal.emit();
  }
}
