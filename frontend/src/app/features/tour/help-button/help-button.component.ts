import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../auth/services/auth.service';
import { TOUR_ROLES, TourService } from '../services/tour.service';

/** Botón «?» de la barra: Ovi explica la pantalla actual, sin salir de ella. */
@Component({
  selector: 'app-help-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button
        type="button"
        class="help-btn"
        [class.is-active]="tour.state().active"
        (click)="openHelp()"
        aria-label="Ayuda de esta pantalla"
        title="Ayuda"
      >
        <i class="bi bi-question-circle" aria-hidden="true"></i>
      </button>
    }
  `,
  styles: [`
    :host { display: contents; }
    .help-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--btn-outline-fg);
      font-size: 19px;
      transition: background-color .15s ease;
    }
    .help-btn:hover,
    .help-btn.is-active { background: var(--surface-hover); }
    .help-btn:focus-visible {
      outline: 2px solid var(--btn-outline-fg);
      outline-offset: 2px;
    }
  `]
})
export class HelpButtonComponent {
  private readonly auth = inject(AuthService);
  readonly tour = inject(TourService);

  readonly visible = computed(() => {
    const role = this.auth.effectiveRole();
    return role !== null && TOUR_ROLES.includes(role);
  });

  openHelp(): void {
    if (this.tour.state().active) {
      this.tour.exit();
      return;
    }
    this.tour.help();
  }
}
