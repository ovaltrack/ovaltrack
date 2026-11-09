import { ChangeDetectionStrategy, Component, DestroyRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { catchError, filter, of, switchMap, tap } from 'rxjs';
import { GeorefService } from '../../services/georef.service';
import { Province } from '../../types/georef.types';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const MAX_OPTIONS = 60;
const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');

/**
 * Provincia + ciudad de Argentina (Georef). El valor del control es solo el nombre de la ciudad:
 * la provincia sirve para acotar la lista. Si Georef no responde, la ciudad pasa a texto libre
 * para no bloquear el registro.
 */
@Component({
  selector: 'app-city-picker',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CityPickerComponent), multi: true }],
  template: `
    <div class="rf-grid">
      <div class="rf-field">
        <label class="rf-label" [attr.for]="inputId() + '-province'">Provincia</label>
        <select
          class="rf-input"
          [id]="inputId() + '-province'"
          [disabled]="disabled() || provincesState() !== 'ready'"
          (change)="onProvinceChange($event)"
        >
          <option value="" [selected]="!provinceId()">
            {{ provincesState() === 'loading' ? 'Cargando provincias…' : 'Elegí la provincia' }}
          </option>
          @for (p of provinces(); track p.id) {
            <option [value]="p.id" [selected]="p.id === provinceId()">{{ p.nombre }}</option>
          }
        </select>
      </div>

      <div class="rf-field">
        <label class="rf-label" [attr.for]="inputId()">Ciudad</label>
        @if (freeText()) {
          <input
            type="text"
            class="rf-input"
            [id]="inputId()"
            [class.is-invalid]="invalid()"
            [value]="value()"
            [disabled]="disabled()"
            placeholder="Escribí la ciudad"
            autocomplete="address-level2"
            (input)="onFreeText($event)"
            (blur)="onTouched()"
          />
        } @else {
          <input
            type="text"
            role="combobox"
            class="rf-input"
            autocomplete="off"
            aria-autocomplete="list"
            [id]="inputId()"
            [attr.aria-controls]="inputId() + '-options'"
            [attr.aria-expanded]="open()"
            [attr.aria-activedescendant]="open() && active() >= 0 ? inputId() + '-opt-' + active() : null"
            [class.is-invalid]="invalid()"
            [value]="query()"
            [disabled]="disabled() || citiesState() !== 'ready'"
            [placeholder]="cityPlaceholder()"
            (input)="onQuery($event)"
            (focus)="open.set(true)"
            (blur)="onBlur()"
            (keydown)="onKeydown($event)"
          />
          @if (open() && citiesState() === 'ready') {
            <ul class="rf-options" role="listbox" [id]="inputId() + '-options'" aria-label="Ciudades">
              @for (c of filtered(); track c; let i = $index) {
                <li>
                  <button
                    type="button"
                    role="option"
                    tabindex="-1"
                    class="rf-option"
                    [id]="inputId() + '-opt-' + i"
                    [class.is-active]="i === active()"
                    [class.is-selected]="c === value()"
                    [attr.aria-selected]="c === value()"
                    (mousedown)="$event.preventDefault()"
                    (click)="select(c)"
                  >
                    {{ c }}
                  </button>
                </li>
              } @empty {
                <li class="rf-options-empty" role="status">No encontramos esa ciudad en la provincia.</li>
              }
            </ul>
          }
        }
      </div>
    </div>
    @if (freeText()) {
      <p class="rf-hint rf-picker-note" role="status">
        <i class="bi bi-wifi-off" aria-hidden="true"></i>
        No pudimos cargar el listado de ciudades: escribí la ciudad a mano.
      </p>
    } @else if (!provinceId() && provincesState() === 'ready') {
      <p class="rf-hint rf-picker-note">Elegí la provincia para ver sus ciudades.</p>
    }
  `,
  styleUrls: ['../../styles/register-form.css'],
  styles: [
    `
      :host {
        display: block;
      }
      .rf-picker-note {
        margin: 8px 0 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CityPickerComponent implements ControlValueAccessor {
  private readonly georef = inject(GeorefService);
  private readonly destroyRef = inject(DestroyRef);

  readonly inputId = input('city');
  readonly invalid = input(false);

  readonly provinces = signal<Province[]>([]);
  readonly provincesState = signal<LoadState>('loading');
  readonly provinceId = signal<string | null>(null);
  readonly cities = signal<string[]>([]);
  readonly citiesState = signal<LoadState>('idle');

  readonly value = signal('');
  readonly query = signal('');
  readonly open = signal(false);
  readonly active = signal(-1);
  readonly disabled = signal(false);

  readonly freeText = computed(() => this.provincesState() === 'error' || this.citiesState() === 'error');
  readonly filtered = computed(() => {
    const q = normalize(this.query().trim());
    const list = q ? this.cities().filter((c) => normalize(c).includes(q)) : this.cities();
    return list.slice(0, MAX_OPTIONS);
  });
  readonly cityPlaceholder = computed(() => {
    if (!this.provinceId()) return 'Primero elegí la provincia';
    return this.citiesState() === 'loading' ? 'Cargando ciudades…' : 'Buscá la ciudad';
  });

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    this.georef
      .provinces()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.provinces.set(list);
          this.provincesState.set('ready');
        },
        error: () => this.provincesState.set('error'),
      });

    toObservable(this.provinceId)
      .pipe(
        filter((id): id is string => !!id),
        tap(() => {
          this.citiesState.set('loading');
          this.cities.set([]);
        }),
        switchMap((id) => this.georef.cities(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        if (!list) {
          this.citiesState.set('error');
          return;
        }
        this.cities.set(list);
        this.citiesState.set('ready');
        if (list.length === 1) this.select(list[0]);
      });
  }

  /* ---------- ControlValueAccessor ---------- */
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
    this.query.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /* ---------- Interacción ---------- */
  onProvinceChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value || null;
    this.provinceId.set(id);
    this.setValue('');
    this.query.set('');
    if (!id) this.citiesState.set('idle');
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.setValue('');
    this.open.set(true);
    this.active.set(-1);
  }

  onFreeText(event: Event): void {
    this.setValue((event.target as HTMLInputElement).value);
  }

  onBlur(): void {
    this.open.set(false);
    this.active.set(-1);
    this.onTouched();
  }

  onKeydown(event: KeyboardEvent): void {
    const options = this.filtered();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open.set(true);
      if (!options.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.update((i) => (i < 0 ? (step > 0 ? 0 : options.length - 1) : (i + step + options.length) % options.length));
      return;
    }
    if (event.key === 'Enter' && this.open() && options.length) {
      event.preventDefault();
      this.select(options[Math.max(this.active(), 0)]);
      return;
    }
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  select(city: string): void {
    this.setValue(city);
    this.query.set(city);
    this.open.set(false);
    this.active.set(-1);
    this.onTouched();
  }

  private setValue(city: string): void {
    this.value.set(city);
    this.onChange(city);
  }
}
