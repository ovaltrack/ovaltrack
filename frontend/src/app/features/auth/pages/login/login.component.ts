import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';

type LoginField = 'email' | 'password';

/** Inicio de sesión. Mientras espera la respuesta bloquea el envío para evitar pedidos repetidos. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['../../styles/register-form.css', './login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loginForm = this.formBuilder.nonNullable.group({
    // Precargado al volver de restablecer la contraseña
    email: [inject(ActivatedRoute).snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');

  showError(name: LoginField): boolean {
    const control = this.loginForm.controls[name];
    return control.invalid && control.touched;
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  onSubmit(): void {
    if (this.submitting()) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();
    this.errorMessage.set('');
    this.submitting.set(true);
    this.authService
      .login({ email: email.trim(), password })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.router.navigate(['/home'], { replaceUrl: true }),
        error: (error: unknown) => this.errorMessage.set(this.authService.getErrorMessage(error, 'login')),
      });
  }
}
