import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Panel lateral translúcido del tablero: rótulo en Mono y contenido libre. */
@Component({
  selector: 'app-board-panel',
  standalone: true,
  template: `
    <section class="panel" [attr.aria-label]="label()">
      <p class="label-mono panel-label">{{ label() }}</p>
      <ng-content />
    </section>
  `,
  styleUrl: './board-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardPanelComponent {
  readonly label = input.required<string>();
}
