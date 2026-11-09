import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Progreso del registro guiado: barra por paso (en celular, "Paso X de N · nombre"). */
@Component({
  selector: 'app-register-steps',
  standalone: true,
  template: `
    <ol class="rf-steps" aria-label="Pasos del registro">
      @for (label of steps(); track label; let i = $index) {
        <li
          class="rf-step"
          [class.is-done]="i < current()"
          [class.is-current]="i === current()"
          [attr.aria-current]="i === current() ? 'step' : null"
        >
          <span class="rf-step-label"><span class="rf-step-num">{{ i + 1 }}</span>{{ label }}</span>
          @if (i < current()) {
            <span class="adm-sr-only">(completo)</span>
          }
        </li>
      }
    </ol>
    <p class="rf-step-compact" aria-hidden="true">Paso {{ current() + 1 }} de {{ steps().length }} · {{ currentLabel() }}</p>
  `,
  styleUrls: ['../../styles/register-form.css'],
  styles: [
    `
      .adm-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterStepsComponent {
  readonly steps = input.required<string[]>();
  readonly current = input.required<number>();

  readonly currentLabel = computed(() => this.steps()[this.current()] ?? '');
}
