import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
import { CityPickerComponent } from '../../../components/city-picker/city-picker.component';
import { RegisterStepsComponent } from '../../../components/register-steps/register-steps.component';
import { AuthService } from '../../../services/auth.service';
import { ClubRegistrationDTO } from '../../../types/auth.types';
import { focusFirstInvalid, formatDate, notInFuture, todayIso, validateStep } from '../../../utils/register-form.utils';

const STEP_FIELDS = [
  ['firstName', 'lastName', 'email', 'password', 'birthDate'],
  ['clubName', 'clubCity', 'clubContactPhone'],
  ['termsAccepted'],
] as const;

/** Solicitud de alta de un club, en tres pasos: responsable → club → revisar y enviar. */
@Component({
  selector: 'app-club-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CityPickerComponent, RegisterStepsComponent],
  templateUrl: './club-register.component.html',
  styleUrls: ['../../../styles/register-form.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly stepTitle = viewChild<ElementRef<HTMLElement>>('stepTitle');

  readonly steps = ['Tus datos', 'El club', 'Revisar y enviar'];
  readonly step = signal(0);
  readonly submitting = signal(false);
  readonly doneMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly today = todayIso();
  readonly formatDate = formatDate;

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    birthDate: ['', [Validators.required, notInFuture]],
    clubName: ['', [Validators.required, Validators.maxLength(180)]],
    clubCity: ['', [Validators.required, Validators.maxLength(180)]],
    clubContactPhone: ['', [Validators.maxLength(40)]],
    termsAccepted: [false, [Validators.requiredTrue]],
  });

  /** El control se tocó y es inválido: muestra el error. */
  showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  next(): void {
    if (!validateStep(this.form, STEP_FIELDS[this.step()])) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.goTo(this.step() + 1);
  }

  back(): void {
    this.goTo(this.step() - 1);
  }

  goTo(index: number): void {
    this.step.set(Math.min(Math.max(index, 0), this.steps.length - 1));
    setTimeout(() => this.stepTitle()?.nativeElement.focus());
  }

  submit(): void {
    if (this.submitting()) return;
    const invalidStep = STEP_FIELDS.findIndex((fields) => !validateStep(this.form, fields));
    if (invalidStep !== -1) {
      if (invalidStep !== this.step()) this.goTo(invalidStep);
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ClubRegistrationDTO = {
      admin: {
        email: raw.email.trim(),
        password: raw.password,
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        birthDate: raw.birthDate,
      },
      club: {
        name: raw.clubName.trim(),
        city: raw.clubCity.trim(),
        contactEmail: raw.email.trim(),
        contactPhone: raw.clubContactPhone.trim() || undefined,
      },
      termsAccepted: raw.termsAccepted,
    };

    this.submitting.set(true);
    this.authService
      .registerClub(payload)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.doneMessage.set(response.message),
        error: (error: unknown) => this.toast.error(this.authService.getErrorMessage(error, 'register'), 'No se pudo enviar la solicitud'),
      });
  }
}
