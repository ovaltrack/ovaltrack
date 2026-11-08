import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Contenido de una tabla sin filas: skeletons mientras carga o el estado vacío con ícono. */
@Component({
  selector: 'app-admin-table-placeholder',
  standalone: true,
  template: `
    @if (loading()) {
      <div class="adm-skeleton" aria-busy="true" aria-label="Cargando">
        @for (i of skeletonRows; track i) {
          <div class="adm-skeleton-row">
            <span class="sk sk-avatar"></span>
            <div class="adm-skeleton-text">
              <span class="sk sk-line"></span>
              <span class="sk sk-line s"></span>
            </div>
            <span class="sk sk-pill"></span>
          </div>
        }
      </div>
    } @else {
      <div class="adm-empty">
        <i class="bi" [class]="'bi ' + icon()" aria-hidden="true"></i>
        <p>{{ message() }}</p>
      </div>
    }
  `,
  styleUrl: '../../styles/admin-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTablePlaceholderComponent {
  readonly loading = input(false);
  /** Clase de Bootstrap Icons, p. ej. `bi-inbox`. */
  readonly icon = input('bi-inbox');
  readonly message = input('');

  readonly skeletonRows = [0, 1, 2];
}
