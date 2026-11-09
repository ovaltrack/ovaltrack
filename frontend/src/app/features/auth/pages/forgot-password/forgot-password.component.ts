import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../services/auth.service';

/** Pide el enlace de recupero. La respuesta no dice si el correo tiene cuenta. */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../../styles/register-form.css', '../login/login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: [inject(ActivatedRoute).snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  readonly submitting = signal(false);
  /** Correo al que se pidió el enlace; con valor se muestra la confirmación. */
  readonly sentTo = signal<string | null>(null);

  showError(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.email.value.trim();
    this.submitting.set(true);
    this.authService
      .requestPasswordReset(email)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.sentTo.set(email),
        error: (error: unknown) =>
          this.toast.error(this.authService.getErrorMessage(error, 'register'), 'No se pudo enviar el enlace'),
      });
  }

  /** Vuelve al formulario para pedir otro enlace o corregir el correo. */
  retry(): void {
    this.sentTo.set(null);
  }
}
