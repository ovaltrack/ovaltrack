import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FilterOption } from '../../types/ovaltrack-admin.types';

/** Barra de una tabla: filtro segmentado con contadores y buscador. */
@Component({
  selector: 'app-admin-table-toolbar',
  standalone: true,
  template: `
    <div class="status-segment adm-segment" role="group" [attr.aria-label]="filterLabel()">
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          class="status-tab"
          [class.active]="active() === opt.value"
          [attr.aria-pressed]="active() === opt.value"
          (click)="filterChange.emit(opt.value)"
        >
          {{ opt.label }} <span class="status-badge-count">{{ counts()[opt.value] }}</span>
        </button>
      }
    </div>
    <label class="adm-search">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input type="search" [placeholder]="searchPlaceholder()" [attr.aria-label]="searchLabel()" (input)="onSearch($event)" />
    </label>
  `,
  styleUrl: './admin-table-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTableToolbarComponent<T extends string> {
  readonly options = input.required<FilterOption<T>[]>();
  readonly active = input.required<T>();
  readonly counts = input.required<Record<T, number>>();
  readonly filterLabel = input('Filtrar');
  readonly searchPlaceholder = input('Buscar');
  readonly searchLabel = input('Buscar');

  readonly filterChange = output<T>();
  readonly searchChange = output<string>();

  onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }
}
