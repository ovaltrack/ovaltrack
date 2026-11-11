import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchReviewStore } from '../../store/match-review.store';

@Component({
  selector: 'app-post-match-kpi-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './post-match-kpi-strip.component.html',
  styleUrls: ['../../styles/kpi-strip.css', './post-match-kpi-strip.component.css']
})
export class PostMatchKpiStripComponent {
  readonly store = inject(MatchReviewStore);

  onTogglePending(): void {
    this.store.toggleOnlyUnassigned();
  }
}
