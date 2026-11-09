import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../auth/services/auth.service';
import { InvitationService } from './service/invitation.service';
import { InvitationSummary } from './types/invitation.types';

type View = 'loading' | 'invalid' | 'create' | 'done';

const MISSING_LINK = 'El enlace de invitación está incompleto. Abrilo de nuevo desde el correo que te llegó.';
const GENERIC_ERROR = 'No pudimos verificar la invitación. Revisá tu conexión e intentá de nuevo.';

/** Marca el error `mismatch` en el grupo si las contraseñas no coinciden. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/** Página pública del enlace de invitación: el jugador crea su cuenta con el correo de contacto. */
@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly invitationService = inject(InvitationService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  private readonly token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';

  readonly view = signal<View>('loading');
  readonly summary = signal<InvitationSummary | null>(null);
  readonly errorMessage = signal('');
  readonly submitting = signal(false);
  readonly showPasswords = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(72),
        Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/),
      ]],
      confirmPassword: ['', [Validators.required]],
      termsAccepted: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatch },
  );

  private readonly password = toSignal(
    this.form.controls.password.valueChanges.pipe(map((value) => value ?? '')),
    { initialValue: '' },
  );

  /** Requisitos que se marcan en vivo mientras escribe. */
  readonly rules = computed(() => {
    const value = this.password();
    return [
      { label: 'Al menos 8 caracteres', ok: value.length >= 8 },
      { label: 'Una letra', ok: /[A-Za-z]/.test(value) },
      { label: 'Un número', ok: /\d/.test(value) },
    ];
  });

  readonly playerName = computed(() => {
    const s = this.summary();
    return s ? `${s.firstName} ${s.lastName}` : '';
  });

  constructor() {
    this.load();
  }

  private load(): void {
    if (!this.token) {
      this.markInvalid(MISSING_LINK);
      return;
    }
    this.invitationService
      .validate(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.view.set('create');
        },
        error: (error: HttpErrorResponse) => this.markInvalid(this.messageOf(error, GENERIC_ERROR)),
      });
  }

  get passwordInvalid(): boolean {
    const control = this.form.controls.password;
    return control.invalid && (control.touched || control.dirty);
  }

  get termsInvalid(): boolean {
    const control = this.form.controls.termsAccepted;
    return control.invalid && control.touched;
  }

  get confirmInvalid(): boolean {
    const control = this.form.controls.confirmPassword;
    return (control.touched || control.dirty) &&
      (control.hasError('required') || this.form.hasError('mismatch'));
  }

  get confirmError(): string {
    return this.form.hasError('mismatch')
      ? 'Las contraseñas no coinciden.'
      : 'Repetí la contraseña para continuar.';
  }

  toggleShowPasswords(): void {
    this.showPasswords.update((value) => !value);
  }

  createAccount(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { password, termsAccepted } = this.form.getRawValue();
    this.submitting.set(true);
    this.authService
      .registerFromInvitation({ token: this.token, password, termsAccepted })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.view.set('done'),
        error: (error: HttpErrorResponse) => this.handleSubmitError(error),
      });
  }

  /**
   * Un 409 significa que el enlace dejó de servir (usado, vencido o cuenta existente):
   * se muestra en pantalla. El resto (datos inválidos, red) va como aviso y deja reintentar.
   */
  private handleSubmitError(error: HttpErrorResponse): void {
    const message = this.messageOf(error, 'No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.');
    if (error.status === 409) {
      this.markInvalid(message);
      return;
    }
    this.toast.error(message, 'No se pudo crear la cuenta');
  }

  private messageOf(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  private markInvalid(message: string): void {
    this.errorMessage.set(message);
    this.view.set('invalid');
  }
}
