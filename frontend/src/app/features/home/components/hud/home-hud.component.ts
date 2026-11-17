import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Encabezado común de las vistas del Inicio; cada vista proyecta sus acciones en `[hudActions]`. */
@Component({
  selector: 'app-home-hud',
  standalone: true,
  templateUrl: './home-hud.component.html',
  styleUrl: './home-hud.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeHudComponent {
  readonly label = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /** Se está trayendo información nueva: se avisa con un chip discreto. */
  readonly refreshing = input(false);
}
