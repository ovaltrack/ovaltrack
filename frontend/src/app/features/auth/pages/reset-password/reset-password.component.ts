import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../services/auth.service';

type LinkState = 'checking' | 'valid' | 'invalid';

/** Mismas reglas que el backend (entre 8 y 72 caracteres, al menos una letra y un número). */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return confirm && password !== confirm ? { mismatch: true } : null;
}

/** Elegir una contraseña nueva desde el enlace del correo (`/auth/reset-password?token=`). */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../../styles/register-form.css', '../login/login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72), Validators.pattern(PASSWORD_PATTERN)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  /** Correo de la cuenta, para precargarlo en el login. */
  private accountEmail = '';

  readonly linkState = signal<LinkState>(this.token ? 'checking' : 'invalid');
  readonly linkError = signal('El enlace no es válido o ya venció. Pedí uno nuevo.');
  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  private readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  readonly rules = computed(() => {
    const value = this.password();
    return [
      { label: 'Entre 8 y 72 caracteres', ok: value.length >= 8 && value.length <= 72 },
      { label: 'Al menos una letra', ok: /[A-Za-z]/.test(value) },
      { label: 'Al menos un número', ok: /\d/.test(value) },
    ];
  });

  constructor() {
    if (this.token) this.checkLink();
  }

  showPasswordError(): boolean {
    const control = this.form.controls.password;
    return control.invalid && control.touched;
  }

  showConfirmError(): boolean {
    const control = this.form.controls.confirm;
    return control.touched && (control.invalid || this.form.hasError('mismatch'));
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.authService
      .confirmPasswordReset(this.token, this.form.controls.password.value)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.toast.success(response.message, 'Contraseña actualizada');
          void this.router.navigate(['/auth/login'], {
            replaceUrl: true,
            queryParams: this.accountEmail ? { email: this.accountEmail } : {},
          });
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message as string | undefined;
          if (error.status === 409 && message?.startsWith('El enlace')) {
            this.linkError.set(message);
            this.linkState.set('invalid');
            return;
          }
          this.toast.error(message ?? 'Intentá de nuevo en unos minutos.', 'No se pudo cambiar la contraseña');
        },
      });
  }

  private checkLink(): void {
    this.authService
      .validatePasswordResetToken(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (link) => {
          this.accountEmail = link.email;
          this.linkState.set('valid');
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 0) {
            this.linkError.set('No se pudo conectar con el servidor. Revisá tu conexión y volvé a abrir el enlace.');
          } else if (error.error?.message) {
            this.linkError.set(error.error.message);
          }
          this.linkState.set('invalid');
        },
      });
  }
}
