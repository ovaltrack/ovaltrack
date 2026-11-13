import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, signal, viewChild
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, filter, finalize, of, switchMap, tap } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { PersonService } from '../../../../services/person.service';
import { PersonResponse, PersonUpdateRequest } from '../../../person/types/person.types';

@Component({
  selector: 'app-person-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-edit-dialog.component.html',
  styleUrl: './person-edit-dialog.component.css',
})
export class PersonEditDialogComponent {
  private readonly personService = inject(PersonService);
  private readonly toast = inject(ToastService);

  readonly personId = input<string | null>(null);
  readonly saved = output<PersonResponse>();
  readonly cancel = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    birthDate: [''],
    contactEmail: ['', Validators.email],
    contactPhone: [''],
  });

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      const open = this.personId() !== null;
      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    });

    toObservable(this.personId).pipe(
      tap(() => {
        this.form.reset();
        this.errorMessage.set(null);
      }),
      filter((id): id is string => id !== null),
      tap(() => this.loading.set(true)),
      switchMap(id => this.personService.getPersonById(id).pipe(
        catchError(() => {
          this.errorMessage.set('No se pudieron cargar los datos de la persona.');
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )),
      takeUntilDestroyed(),
    ).subscribe(person => {
      if (person) {
        this.form.setValue({
          firstName: person.firstName,
          lastName: person.lastName,
          birthDate: person.birthDate ?? '',
          contactEmail: person.contactEmail ?? '',
          contactPhone: person.contactPhone ?? '',
        });
      }
    });
  }

  isInvalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  save(): void {
    const id = this.personId();
    if (!id || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: PersonUpdateRequest = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      birthDate: value.birthDate || null,
      contactEmail: value.contactEmail.trim() || null,
      contactPhone: value.contactPhone.trim() || null,
    };

    this.saving.set(true);
    this.errorMessage.set(null);
    this.personService.updatePerson(id, request).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: person => {
        this.toast.success(`Datos de ${person.firstName} ${person.lastName} actualizados.`);
        this.saved.emit(person);
      },
      error: (error: HttpErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'No se pudieron guardar los cambios.'),
    });
  }

  onEscape(event: Event): void {
    event.preventDefault();
    if (!this.saving()) {
      this.cancel.emit();
    }
  }
}
